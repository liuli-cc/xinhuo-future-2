"""Career student-facing routes: job board, matching, applications, favorites.

公告与公告投递在 announcements_router；导入与治理在 admin_router。
状态机规则一律走 stages 模块（ADR-0002：逻辑唯一，存储分表）。
"""

from __future__ import annotations

import time
import uuid

from fastapi import APIRouter, Body, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.exceptions import ConflictError, NotFoundError, ValidationError
from ...db.session import get_db
from ..admin.audit import record_audit
from ..auth.dependency import CurrentUser
from ..employment.model import Employer
from ..evidence.model import Evidence
from ..growth.model import GrowthTask
from ..growth.service import GrowthService, evidence_dict
from .model import CareerApplication, CareerEvent, CareerFavorite, CareerJob, CareerMatch
from ...core.permissions import can_manage_employment
from .service import (
    JOB_EXPIRY_MS,
    application_dict,
    build_match,
    event_dict,
    find_or_create_employer,
    infer_category,
    is_expired,
    job_dict,
    parse_job_text,
    parse_requirements,
    rule_profile,
)
from .stages import STAGES, STAGE_LABELS, apply_transition, validate_target

router = APIRouter(tags=["career"])

_PAGE_MAX = 50


# ── 内部助手 ─────────────────────────────────────────────────────


def _now() -> int:
    return int(time.time() * 1000)


async def _student_context(db: AsyncSession, user: dict) -> tuple[dict, list[dict], dict]:
    """(画像, 已核验佐证, 学生结构化信息) — 匹配的三个输入源。"""
    portrait = await GrowthService(db).portrait(user["id"])
    evidence_rows = list((await db.execute(select(Evidence).where(Evidence.user_id == user["id"]))).scalars())
    evidence = [evidence_dict(item) for item in evidence_rows]
    student = {
        "major": user.get("major", ""),
        "grade": user.get("grade", ""),
        "target_role": user.get("target_role", ""),
        "interests": user.get("interests") or [],
    }
    return portrait, evidence, student


async def _compute_match(db: AsyncSession, user: dict, job: CareerJob) -> dict:
    portrait, evidence, student = await _student_context(db, user)
    return build_match(
        {"title": job.title, "description": job.description, "category": job.category,
         "deadline": job.deadline, "published_at": job.published_at,
         "requirement_profile": job.requirement_profile, "majors_text": job.majors_text},
        portrait, evidence, student,
    )


def _expired(item: CareerJob) -> bool:
    return is_expired(item.published_at, item.deadline, JOB_EXPIRY_MS)


async def _favorite_job_ids(db: AsyncSession, user_id: int, job_ids: list[str]) -> set[str]:
    if not job_ids:
        return set()
    rows = await db.execute(select(CareerFavorite.job_id).where(CareerFavorite.user_id == user_id, CareerFavorite.job_id.in_(job_ids)))
    return {row for row in rows.scalars()}


async def _job_extras(db: AsyncSession, user: dict, jobs: list[CareerJob], *, with_match: bool = True) -> list[dict]:
    """批量补齐 match / application / favorited 三个挂载字段。"""
    job_ids = [item.id for item in jobs]
    matches: dict[str, CareerMatch] = {}
    if with_match and job_ids:
        rows = await db.execute(select(CareerMatch).where(CareerMatch.user_id == user["id"], CareerMatch.job_id.in_(job_ids)))
        matches = {row.job_id: row for row in rows.scalars()}
    applications: dict[str, CareerApplication] = {}
    if job_ids:
        rows = await db.execute(select(CareerApplication).where(CareerApplication.user_id == user["id"], CareerApplication.job_id.in_(job_ids)))
        applications = {row.job_id: row for row in rows.scalars()}
    favorites = await _favorite_job_ids(db, user["id"], job_ids)
    results = []
    for item in jobs:
        match_row = matches.get(item.id)
        match_payload = None
        if match_row:
            match_payload = {"overallScore": match_row.overall_score, "confidence": match_row.confidence,
                             "verdict": match_row.verdict, "result": match_row.result,
                             "updatedAt": _ms(match_row.updated_at) or 0}
        app_row = applications.get(item.id)
        app_payload = None
        if app_row:
            app_payload = {"id": app_row.id, "stage": app_row.stage, "outcome": app_row.outcome,
                           "stageLabel": STAGE_LABELS.get(app_row.stage, app_row.stage), "note": app_row.note or "",
                           "submittedAt": app_row.submitted_at, "lastEventAt": app_row.last_event_at,
                           "updatedAt": _ms(app_row.updated_at) or 0}
        results.append(job_dict(item, match=match_payload, application=app_payload,
                                favorited=item.id in favorites, expired=_expired(item)))
    return results


def _ms(value) -> int | None:
    return int(value.timestamp() * 1000) if value else None


# ── 岗位大厅 ─────────────────────────────────────────────────────


@router.get("/career/jobs")
async def list_jobs(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    category: str = "",
    industry: str = "",
    city: str = "",
    q: str = "",
    mine: int = 0,
    fit_for_me: int = Query(0, alias="fitForMe"),
    include_expired: int = Query(0, alias="includeExpired"),
    page: int = 1,
    page_size: int = Query(20, alias="pageSize"),
):
    page, page_size = max(1, page), min(_PAGE_MAX, max(1, page_size))
    if fit_for_me:
        return await _list_jobs_fit_for_me(current_user, db, page, page_size)

    stmt = select(CareerJob).where(CareerJob.status == "active")
    if mine:
        stmt = stmt.where(CareerJob.created_by == current_user["id"])
    else:
        stmt = stmt.where(CareerJob.visibility == "public")
    if category:
        stmt = stmt.where(CareerJob.category == category)
    if industry:
        stmt = stmt.where(CareerJob.industries.contains(industry))
    if city:
        stmt = stmt.where(CareerJob.city.contains(city))
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where((CareerJob.title.contains(q.strip())) | (CareerJob.company.contains(q.strip())))

    all_rows = list((await db.execute(stmt.order_by(CareerJob.published_at.is_(None), CareerJob.published_at.desc(), CareerJob.created_at.desc()))).scalars())
    total_all = len(all_rows)
    if not include_expired:
        all_rows = [item for item in all_rows if not _expired(item)]
    total = len(all_rows)
    start = (page - 1) * page_size
    slice_rows = all_rows[start: start + page_size]
    return {"items": await _job_extras(db, current_user, slice_rows), "total": total, "totalBeforeExpiry": total_all,
            "page": page, "pageSize": page_size,
            "stageOptions": [{"value": value, "label": label} for value, label in STAGE_LABELS.items()]}


async def _list_jobs_fit_for_me(user: dict, db: AsyncSession, page: int, page_size: int):
    """「适合我」：硬条件过滤 + 匹配分排序，内存计算（纯函数，500 条内毫秒级）。"""
    stmt = select(CareerJob).where(
        CareerJob.status == "active", CareerJob.visibility == "public",
        CareerJob.created_by != user["id"],
    ).order_by(CareerJob.published_at.is_(None), CareerJob.published_at.desc()).limit(500)
    rows = list((await db.execute(stmt)).scalars())
    rows = [item for item in rows if not _expired(item)]
    portrait, evidence, student = await _student_context(db, user)
    scored = []
    for item in rows:
        result = build_match(
            {"title": item.title, "description": item.description, "category": item.category,
             "deadline": item.deadline, "published_at": item.published_at,
             "requirement_profile": item.requirement_profile, "majors_text": item.majors_text},
            portrait, evidence, student,
        )
        if not result["hardFilter"]["passed"]:
            continue
        scored.append((result["overallScore"], result, item))
    scored.sort(key=lambda pair: pair[0], reverse=True)
    total = len(scored)
    start = (page - 1) * page_size
    slice_rows = scored[start: start + page_size]
    matches = {item.id: {"overallScore": score, "confidence": result["confidence"], "verdict": result["verdict"],
                         "result": result, "updatedAt": _now()}
               for score, result, item in slice_rows}
    favorites = await _favorite_job_ids(db, user["id"], [item.id for _, _, item in slice_rows])
    items = []
    for score, result, item in slice_rows:
        payload = job_dict(item, match=matches[item.id], favorited=item.id in favorites, expired=False)
        items.append(payload)
    return {"items": items, "total": total, "page": page, "pageSize": page_size, "fitForMe": True}


@router.get("/career/jobs/{job_id}")
async def get_job(job_id: str, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    job = await db.get(CareerJob, job_id)
    if not job or (job.visibility != "public" and job.created_by != current_user["id"]):
        raise NotFoundError("岗位不存在")
    payload = (await _job_extras(db, current_user, [job]))[0]
    if job.employer_id:
        employer = await db.get(Employer, job.employer_id)
        if employer:
            payload["employer"] = {
                "id": employer.id, "name": employer.name, "industry": employer.industry or "",
                "organizationType": employer.organization_type or "", "city": employer.city or "",
                "address": employer.address or "",
            }
    return {"job": payload}


@router.post("/career/jobs")
async def create_job(payload: dict = Body(...), current_user: CurrentUser = None, db: AsyncSession = Depends(get_db)):
    title = str(payload.get("title", "")).strip()
    company = str(payload.get("company", "")).strip()
    description = str(payload.get("description", "")).strip()
    if len(title) < 2 or len(company) < 2 or len(description) < 30:
        raise ValidationError("岗位名称、单位至少 2 个字，岗位原文至少 30 个字")
    raw_tags = payload.get("tags")
    tags = list(dict.fromkeys(str(t).strip() for t in raw_tags if str(t).strip()))[:20] if isinstance(raw_tags, list) else None
    employment_type = str(payload.get("employmentType", ""))[:30] or None
    majors_text = str(payload.get("majorsText", ""))[:500] or None
    is_staff_post = can_manage_employment(current_user) and payload.get("visibility") == "public"
    employer = await find_or_create_employer(db, name=company)
    now = _now()
    item = CareerJob(
        id=uuid.uuid4().hex, created_by=current_user["id"], title=title[:100], company=company[:80],
        city=str(payload.get("city", ""))[:200] or None, employment_type=employment_type,
        salary=str(payload.get("salary", ""))[:40] or None, source_url=str(payload.get("sourceUrl", ""))[:500] or None,
        source_name=str(payload.get("sourceName", ""))[:60] or None, description=description[:12000],
        requirements=parse_requirements(title, description),
        employer_id=employer.id, tags=tags,
        category=str(payload.get("category") or infer_category(title, employment_type))[:20],
        majors_text=majors_text,
        industries=str(payload.get("industries", ""))[:200] or None,
        company_nature=str(payload.get("companyNature", ""))[:40] or None,
        published_at=now, deadline=int(payload["deadline"]) if payload.get("deadline") else None,
        source="school_coop" if (is_staff_post and payload.get("source") == "school_coop") else ("import" if is_staff_post else "custom"),
        visibility="public" if is_staff_post else "private",
        status="active", requirement_profile=rule_profile(title, description, majors_text),
    )
    db.add(item)
    await record_audit(db, "career.job_saved", actor_user_id=current_user["id"], target_type="career_job", target_id=item.id,
                       details={"visibility": item.visibility, "category": item.category})
    return {"job": {"id": item.id, "employerId": employer.id, "visibility": item.visibility,
                    "category": item.category, "tags": tags or []}}


@router.post("/career/jobs/parse")
async def parse_job(payload: dict = Body(...), current_user: CurrentUser = None):
    text = str(payload.get("text", "")).strip()
    if len(text) < 10:
        raise ValidationError("岗位原文至少需要 10 个字")
    return {"draft": parse_job_text(text, str(payload.get("sourceUrl", ""))[:500])}


# ── 匹配 ────────────────────────────────────────────────────────


@router.post("/career/jobs/{job_id}/match")
async def match_job(job_id: str, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    job = await db.get(CareerJob, job_id)
    if not job or (job.visibility != "public" and job.created_by != current_user["id"]):
        raise NotFoundError("岗位不存在")
    result = await _compute_match(db, current_user, job)
    existing = (await db.execute(select(CareerMatch).where(CareerMatch.user_id == current_user["id"], CareerMatch.job_id == job_id).limit(1))).scalar_one_or_none()
    values = {"overall_score": result["overallScore"], "confidence": result["confidence"], "verdict": result["verdict"], "result": result}
    if existing:
        for key, value in values.items():
            setattr(existing, key, value)
    else:
        db.add(CareerMatch(id=uuid.uuid4().hex, user_id=current_user["id"], job_id=job_id, **values))
    await record_audit(db, "career.match_calculated", actor_user_id=current_user["id"], target_type="career_job",
                       target_id=job_id, details={"score": result["overallScore"]})
    return {"match": result}


@router.post("/career/jobs/{job_id}/interpret")
async def interpret_job(job_id: str, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    """「AI 解读」：只生成契合分析文案，不产生分数（ADR-0001）。"""
    from ...integrations.llm.client import get_llm_client

    job = await db.get(CareerJob, job_id)
    if not job:
        raise NotFoundError("岗位不存在")
    client = get_llm_client()
    if not client.configured:
        raise ConflictError("服务端未配置模型密钥，无法生成 AI 解读；匹配分数不受影响")
    _, evidence, student = await _student_context(db, current_user)
    evidence_summary = "\n".join(f"- {item['title']}（{item['dimension']}）" for item in evidence if item["verificationStatus"] == "verified")[:1200] or "（暂无已核验佐证）"
    prompt = (
        "你是就业指导老师。根据学生资料与岗位要求，写一段 150 字以内的中文契合度分析："
        "先说最契合的 1-2 点，再指出最需要补强的 1-2 点，语气客观鼓励，不要编造经历，不要给数字分数。\n"
        f"学生：专业 {student['major'] or '未填写'}，年级 {student['grade'] or '未填写'}，目标方向 {student['target_role']}。\n"
        f"已核验佐证：\n{evidence_summary}\n"
        f"岗位：{job.title}（{job.company}）\n要求原文：{job.description[:1200]}"
    )
    response = await client.chat([{"role": "user", "content": prompt}], temperature=0.4, max_tokens=400)
    await record_audit(db, "career.job_interpreted", actor_user_id=current_user["id"], target_type="career_job", target_id=job_id)
    return {"interpretation": response["content"].strip(), "provider": response["providerLabel"]}


@router.post("/career/jobs/{job_id}/gap-tasks")
async def create_gap_tasks(job_id: str, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    job = await db.get(CareerJob, job_id)
    match = (await db.execute(select(CareerMatch).where(CareerMatch.user_id == current_user["id"], CareerMatch.job_id == job_id).limit(1))).scalar_one_or_none()
    if not job or job.created_by != current_user["id"] and job.visibility != "public" or not match:
        raise NotFoundError("请先完成岗位匹配")
    tasks = []
    for index, gap in enumerate((match.result or {}).get("gaps", [])[:3]):
        task_id = f"career-{job_id[:12]}-{index + 1}"
        key = f"{current_user['id']}:{task_id}"
        item = await db.get(GrowthTask, key)
        if not item:
            item = GrowthTask(id=key, user_id=current_user["id"], task_id=task_id, semester_index=0,
                              title=f"补强：{gap['label']}"[:120], note=gap["recommendation"][:1000],
                              type="岗位补强", xp=35 if gap["priority"] == "required" else 25, is_custom=True)
            db.add(item)
        tasks.append({"taskId": task_id, "title": item.title})
    return {"tasks": tasks}


# ── 岗位投递（stage + outcome 两层，时间线只增不改） ───────────────


@router.get("/career/applications")
async def list_applications(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    stage: str = "",
    outcome: str = "",
):
    counts_rows = await db.execute(
        select(CareerApplication.stage, CareerApplication.outcome, func.count())
        .where(CareerApplication.user_id == current_user["id"]).group_by(CareerApplication.stage, CareerApplication.outcome)
    )
    stage_counts: dict[str, int] = {}
    for row_stage, row_outcome, count in counts_rows.all():
        bucket = row_outcome or row_stage
        stage_counts[bucket] = stage_counts.get(bucket, 0) + count

    stmt = select(CareerApplication, CareerJob).join(CareerJob, CareerJob.id == CareerApplication.job_id).where(
        CareerApplication.user_id == current_user["id"]
    ).order_by(CareerApplication.updated_at.desc())
    if outcome:
        stmt = stmt.where(CareerApplication.outcome == outcome)
    elif stage:
        stmt = stmt.where(CareerApplication.stage == stage, CareerApplication.outcome.is_(None))
    rows = (await db.execute(stmt)).all()

    app_ids = [item.id for item, _ in rows]
    event_counts: dict[str, int] = {}
    if app_ids:
        counted = await db.execute(
            select(CareerEvent.application_id, func.count()).where(CareerEvent.application_id.in_(app_ids)).group_by(CareerEvent.application_id)
        )
        event_counts = {app_id: count for app_id, count in counted.all()}

    applications = []
    for item, job in rows:
        match = (await db.execute(select(CareerMatch).where(CareerMatch.user_id == current_user["id"], CareerMatch.job_id == job.id).limit(1))).scalar_one_or_none()
        target = {"title": job.title, "company": job.company, "city": job.city or "",
                  "employmentType": job.employment_type or "", "category": job.category,
                  "sourceUrl": job.source_url or "",
                  "matchScore": match.overall_score if match else None,
                  "matchVerdict": match.verdict if match else None}
        applications.append(application_dict(item, target, event_counts.get(item.id, 0)))
    return {
        "applications": applications,
        "counts": stage_counts,
        "stageOptions": [{"value": value, "label": label} for value, label in STAGE_LABELS.items()],
    }


@router.post("/career/applications")
async def create_application(payload: dict = Body(...), current_user: CurrentUser = None, db: AsyncSession = Depends(get_db)):
    job = await db.get(CareerJob, str(payload.get("jobId", "")))
    if not job or (job.visibility != "public" and job.created_by != current_user["id"]) or job.status != "active":
        raise NotFoundError("岗位不存在")
    existing = (await db.execute(select(CareerApplication).where(
        CareerApplication.user_id == current_user["id"], CareerApplication.job_id == job.id).limit(1))).scalar_one_or_none()
    if existing:
        raise ConflictError("该岗位已在投递工作台")
    item = CareerApplication(id=uuid.uuid4().hex, user_id=current_user["id"], job_id=job.id,
                             stage="saved", outcome=None, note=None)
    db.add(item)
    return {"application": {"id": item.id}}


@router.post("/career/applications/{application_id}/events")
async def add_application_event(application_id: str, payload: dict = Body(...), current_user: CurrentUser = None, db: AsyncSession = Depends(get_db)):
    item = await db.get(CareerApplication, application_id)
    if not item or item.user_id != current_user["id"]:
        raise NotFoundError("投递记录不存在")
    note = str(payload.get("note", "")).strip()
    if len(note) < 2:
        raise ValidationError("请写下至少 2 个字的阶段反馈或复盘")
    next_stage, next_outcome = validate_target(item.stage, item.outcome, payload.get("stage"), payload.get("outcome"))
    event_payload = apply_transition(item, next_stage, next_outcome, note)
    db.add(CareerEvent(id=uuid.uuid4().hex, user_id=current_user["id"], application_id=item.id, **event_payload))
    await record_audit(db, "career.application_updated", actor_user_id=current_user["id"],
                       target_type="career_application", target_id=item.id,
                       details={"stage": next_stage, "outcome": next_outcome})
    return {"ok": True, "stage": item.stage, "outcome": item.outcome}


@router.get("/career/applications/{application_id}/events")
async def list_application_events(application_id: str, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    item = await db.get(CareerApplication, application_id)
    if not item or item.user_id != current_user["id"]:
        raise NotFoundError("投递记录不存在")
    rows = (await db.execute(select(CareerEvent).where(CareerEvent.application_id == application_id).order_by(CareerEvent.created_at.asc()))).scalars()
    return {"events": [event_dict(row) for row in rows], "stageOptions": [{"value": value, "label": label} for value, label in STAGE_LABELS.items()]}


# ── 岗位收藏 ─────────────────────────────────────────────────────


@router.get("/career/favorites")
async def list_favorites(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(
        select(CareerFavorite, CareerJob).join(CareerJob, CareerJob.id == CareerFavorite.job_id)
        .where(CareerFavorite.user_id == current_user["id"]).order_by(CareerFavorite.created_at.desc())
    )).all()
    favorites = await _favorite_job_ids(db, current_user["id"], [job.id for _, job in rows])
    payloads = {item.id: payload for item, payload in zip(
        (job for _, job in rows),
        await _job_extras(db, current_user, [job for _, job in rows]),
    )}
    return {"favorites": [dict(payloads[job.id], favoriteId=fav.id) for fav, job in rows]}


@router.post("/career/favorites")
async def create_favorite(payload: dict = Body(...), current_user: CurrentUser = None, db: AsyncSession = Depends(get_db)):
    job = await db.get(CareerJob, str(payload.get("jobId", "")))
    if not job or (job.visibility != "public" and job.created_by != current_user["id"]):
        raise NotFoundError("岗位不存在")
    existing = (await db.execute(select(CareerFavorite).where(
        CareerFavorite.user_id == current_user["id"], CareerFavorite.job_id == job.id).limit(1))).scalar_one_or_none()
    if existing:
        return {"favorite": {"id": existing.id}}
    favorite = CareerFavorite(id=uuid.uuid4().hex, user_id=current_user["id"], job_id=job.id)
    db.add(favorite)
    return {"favorite": {"id": favorite.id}}


@router.delete("/career/favorites/{job_id}")
async def delete_favorite(job_id: str, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    favorite = (await db.execute(select(CareerFavorite).where(
        CareerFavorite.user_id == current_user["id"], CareerFavorite.job_id == job_id).limit(1))).scalar_one_or_none()
    if favorite:
        await db.delete(favorite)
    return {"ok": True}


# ── 企业库（教师/管理员维护，学生只读） ───────────────────────────


def _employer_dict(item: Employer) -> dict:
    return {
        "id": item.id, "name": item.name,
        "unifiedSocialCreditCode": item.unified_social_credit_code or "",
        "organizationType": item.organization_type or "", "industry": item.industry or "",
        "province": item.province or "", "city": item.city or "", "district": item.district or "",
        "address": item.address or "", "postalCode": item.postal_code or "",
        "createdAt": _ms(item.created_at) or 0, "updatedAt": _ms(item.updated_at) or 0,
    }


@router.get("/career/employers")
async def list_employers(q: str = "", current_user: CurrentUser = None, db: AsyncSession = Depends(get_db)):
    stmt = select(Employer).order_by(Employer.created_at.desc())
    if q:
        stmt = stmt.where(Employer.name.contains(q.strip()))
    rows = list((await db.execute(stmt.limit(100))).scalars())
    return {"employers": [_employer_dict(item) for item in rows]}


@router.post("/career/employers")
async def create_employer(payload: dict = Body(...), current_user: CurrentUser = None, db: AsyncSession = Depends(get_db)):
    name = str(payload.get("name", "")).strip()
    if len(name) < 2:
        raise ValidationError("企业名称至少 2 个字")
    employer = await find_or_create_employer(
        db, name=name,
        credit_code=str(payload.get("unifiedSocialCreditCode", "")).strip() or None,
        organization_type=str(payload.get("organizationType", "")).strip() or None,
        industry=str(payload.get("industry", "")).strip() or None,
        province=str(payload.get("province", "")).strip() or None,
        city=str(payload.get("city", "")).strip() or None,
        district=str(payload.get("district", "")).strip() or None,
        address=str(payload.get("address", "")).strip() or None,
        postal_code=str(payload.get("postalCode", "")).strip() or None,
    )
    await record_audit(db, "career.employer_saved", actor_user_id=current_user["id"], target_type="employer", target_id=str(employer.id))
    return {"employer": _employer_dict(employer)}


@router.get("/career/employers/{employer_id}")
async def get_employer(employer_id: int, current_user: CurrentUser = None, db: AsyncSession = Depends(get_db)):
    employer = await db.get(Employer, employer_id)
    if not employer:
        raise NotFoundError("企业不存在")
    return {"employer": _employer_dict(employer)}


# ── 决策引擎（遗留接口：Group2 的 /ai 页在调用，待其迁移后下线） ────


@router.get("/decision")
async def decision_plan(target: str = "exploration", current_user: CurrentUser = None, db: AsyncSession = Depends(get_db)):
    portrait = await GrowthService(db).portrait(current_user["id"])
    dimensions = [{"dimension": item["name"], "score": item["score"], "threshold": 65,
                   "gap": max(0, 65 - item["score"]), "weightedGap": max(0, 65 - item["score"])}
                  for item in portrait["dimensions"]]
    recommendations = [{"id": f"{target}-{item['dimension']}", "dimension": item["dimension"],
                        "title": f"补强{item['dimension']}", "deliverable": "提交一项可核验成果并完成复盘",
                        "priority": min(100, 50 + item["gap"]), "estimatedWeeks": 2, "status": "recommended",
                        "rationale": f"当前 {item['score']} 分，参考目标 65 分",
                        "factors": {"gapImpact": item["gap"], "targetRelevance": 70, "urgency": 60,
                                    "executability": 70, "interestMatch": 50, "cost": 2,
                                    "feedbackAdjustment": 0}}
                       for item in sorted(dimensions, key=lambda x: x["gap"], reverse=True)[:5]]
    return {"plan": {"engineVersion": "XH-DPE-1.0", "modelMode": "deterministic",
                     "target": {"id": target, "label": current_user.get("target_role") or target,
                                "description": "依据已核验成长画像生成"},
                     "readiness": portrait["overallScore"], "confidence": portrait["confidence"],
                     "evidenceBasis": portrait["verifiedEvidence"], "gaps": dimensions,
                     "recommendations": recommendations,
                     "formula": "按画像差距、目标相关度与可执行性排序",
                     "generatedAt": portrait["calculatedAt"]}, "profiles": []}


@router.post("/decision")
async def decision_feedback(payload: dict = Body(...), current_user: CurrentUser = None, db: AsyncSession = Depends(get_db)):
    from .model import RecommendationFeedback

    feedback = str(payload.get("feedback", ""))
    if feedback not in {"accepted", "completed", "dismissed"}:
        raise ValidationError("无效的建议反馈")
    item = RecommendationFeedback(id=uuid.uuid4().hex, user_id=current_user["id"],
                                  target_role=str(payload.get("targetRole", ""))[:40] or None,
                                  recommendation_id=str(payload.get("recommendationId", ""))[:120], feedback=feedback)
    db.add(item)
    await record_audit(db, "decision.feedback", actor_user_id=current_user["id"], target_type="recommendation",
                       target_id=item.recommendation_id, details={"feedback": feedback})
    return {"ok": True}
