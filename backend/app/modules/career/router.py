"""Career job snapshots, matching, applications and decision feedback."""

from __future__ import annotations

import time
import uuid

from fastapi import APIRouter, Body, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.exceptions import ConflictError, NotFoundError, ValidationError
from ...db.session import get_db
from ..admin.audit import record_audit
from ..auth.dependency import CurrentUser
from ..evidence.model import Evidence
from ..growth.model import GrowthTask
from ..growth.service import GrowthService, evidence_dict
from .model import CareerApplication, CareerEvent, CareerJob, CareerMatch, RecommendationFeedback
from .service import build_match, parse_job_text, parse_requirements

router = APIRouter(tags=["career"])


def _ms(value) -> int | None:
    return int(value.timestamp() * 1000) if value else None


def _application_dict(item: CareerApplication, job: CareerJob, match: CareerMatch | None = None, note: str = "") -> dict:
    return {
        "id": item.id, "jobId": item.job_id, "status": item.status, "note": item.note or "",
        "submittedAt": item.submitted_at, "lastEventAt": item.last_event_at,
        "createdAt": _ms(item.created_at) or 0, "updatedAt": _ms(item.updated_at) or 0,
        "title": job.title, "company": job.company, "city": job.city or "",
        "employmentType": job.employment_type or "", "sourceUrl": job.source_url or "",
        "matchScore": match.overall_score if match else None,
        "matchVerdict": match.verdict if match else None, "latestEventNote": note,
    }


async def _job_rows(db: AsyncSession, user_id: int):
    jobs = list((await db.execute(select(CareerJob).where(CareerJob.user_id == user_id).order_by(CareerJob.created_at.desc()))).scalars())
    matches = list((await db.execute(select(CareerMatch).where(CareerMatch.user_id == user_id).order_by(CareerMatch.updated_at.desc()))).scalars())
    applications = list((await db.execute(select(CareerApplication).where(CareerApplication.user_id == user_id))).scalars())
    return jobs, {item.job_id: item for item in matches}, {item.job_id: item for item in applications}


@router.get("/career/jobs")
async def list_jobs(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    jobs, matches, applications = await _job_rows(db, current_user["id"])
    return {"jobs": [{
        "id": item.id, "title": item.title, "company": item.company, "city": item.city or "",
        "employmentType": item.employment_type or "", "salary": item.salary or "",
        "sourceUrl": item.source_url or "", "sourceName": item.source_name or "",
        "description": item.description, "requirements": item.requirements or [],
        "createdAt": _ms(item.created_at) or 0, "updatedAt": _ms(item.updated_at) or 0,
        "match": ({"overallScore": matches[item.id].overall_score, "confidence": matches[item.id].confidence, "verdict": matches[item.id].verdict, "result": matches[item.id].result, "updatedAt": _ms(matches[item.id].updated_at) or 0} if item.id in matches else None),
        "application": ({"id": applications[item.id].id, "status": applications[item.id].status, "note": applications[item.id].note or "", "submittedAt": applications[item.id].submitted_at, "lastEventAt": applications[item.id].last_event_at, "updatedAt": _ms(applications[item.id].updated_at) or 0} if item.id in applications else None),
    } for item in jobs]}


@router.post("/career/jobs")
async def create_job(payload: dict = Body(...), current_user: CurrentUser = None, db: AsyncSession = Depends(get_db)):
    title = str(payload.get("title", "")).strip()
    company = str(payload.get("company", "")).strip()
    description = str(payload.get("description", "")).strip()
    if len(title) < 2 or len(company) < 2 or len(description) < 30:
        raise ValidationError("岗位名称、单位至少 2 个字，岗位原文至少 30 个字")
    item = CareerJob(
        id=uuid.uuid4().hex, user_id=current_user["id"], title=title[:100], company=company[:80],
        city=str(payload.get("city", ""))[:40] or None, employment_type=str(payload.get("employmentType", ""))[:30] or None,
        salary=str(payload.get("salary", ""))[:40] or None, source_url=str(payload.get("sourceUrl", ""))[:500] or None,
        source_name=str(payload.get("sourceName", ""))[:60] or None, description=description[:12000],
        requirements=parse_requirements(title, description),
    )
    db.add(item)
    await record_audit(db, "career.job_saved", actor_user_id=current_user["id"], target_type="career_job", target_id=item.id)
    return {"job": {"id": item.id}}


@router.post("/career/jobs/parse")
async def parse_job(payload: dict = Body(...), current_user: CurrentUser = None):
    text = str(payload.get("text", "")).strip()
    if len(text) < 10:
        raise ValidationError("岗位原文至少需要 10 个字")
    return {"draft": parse_job_text(text, str(payload.get("sourceUrl", ""))[:500])}


@router.post("/career/jobs/{job_id}/match")
async def match_job(job_id: str, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    job = await db.get(CareerJob, job_id)
    if not job or job.user_id != current_user["id"]:
        raise NotFoundError("岗位不存在")
    portrait = await GrowthService(db).portrait(current_user["id"])
    evidence_rows = list((await db.execute(select(Evidence).where(Evidence.user_id == current_user["id"]))).scalars())
    evidence = [evidence_dict(item) for item in evidence_rows]
    result = build_match({"title": job.title, "description": job.description}, portrait, evidence, current_user.get("target_role", ""), current_user.get("interests", []))
    existing = (await db.execute(select(CareerMatch).where(CareerMatch.user_id == current_user["id"], CareerMatch.job_id == job_id).limit(1))).scalar_one_or_none()
    values = {"overall_score": result["overallScore"], "confidence": result["confidence"], "verdict": result["verdict"], "result": result}
    if existing:
        for key, value in values.items(): setattr(existing, key, value)
    else:
        db.add(CareerMatch(id=uuid.uuid4().hex, user_id=current_user["id"], job_id=job_id, **values))
    await record_audit(db, "career.match_calculated", actor_user_id=current_user["id"], target_type="career_job", target_id=job_id, details={"score": result["overallScore"]})
    return {"match": result}


@router.post("/career/jobs/{job_id}/gap-tasks")
async def create_gap_tasks(job_id: str, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    job = await db.get(CareerJob, job_id)
    match = (await db.execute(select(CareerMatch).where(CareerMatch.user_id == current_user["id"], CareerMatch.job_id == job_id).limit(1))).scalar_one_or_none()
    if not job or job.user_id != current_user["id"] or not match:
        raise NotFoundError("请先完成岗位匹配")
    tasks = []
    for index, gap in enumerate((match.result or {}).get("gaps", [])[:3]):
        task_id = f"career-{job_id[:12]}-{index + 1}"
        key = f"{current_user['id']}:{task_id}"
        item = await db.get(GrowthTask, key)
        if not item:
            item = GrowthTask(id=key, user_id=current_user["id"], task_id=task_id, semester_index=0, title=f"补强：{gap['label']}"[:120], note=gap["recommendation"][:1000], type="岗位补强", xp=35 if gap["priority"] == "required" else 25, is_custom=True)
            db.add(item)
        tasks.append({"taskId": task_id, "title": item.title})
    return {"tasks": tasks}


@router.get("/career/applications")
async def list_applications(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(CareerApplication, CareerJob, CareerMatch).join(CareerJob, CareerJob.id == CareerApplication.job_id).outerjoin(CareerMatch, (CareerMatch.job_id == CareerApplication.job_id) & (CareerMatch.user_id == CareerApplication.user_id)).where(CareerApplication.user_id == current_user["id"]).order_by(CareerApplication.updated_at.desc()))).all()
    return {"applications": [_application_dict(item, job, match) for item, job, match in rows]}


@router.post("/career/applications")
async def create_application(payload: dict = Body(...), current_user: CurrentUser = None, db: AsyncSession = Depends(get_db)):
    job = await db.get(CareerJob, str(payload.get("jobId", "")))
    if not job or job.user_id != current_user["id"]:
        raise NotFoundError("岗位不存在")
    existing = (await db.execute(select(CareerApplication).where(CareerApplication.user_id == current_user["id"], CareerApplication.job_id == job.id).limit(1))).scalar_one_or_none()
    if existing:
        raise ConflictError("该岗位已在投递工作台")
    item = CareerApplication(id=uuid.uuid4().hex, user_id=current_user["id"], job_id=job.id, status="saved", note=None)
    db.add(item)
    return {"application": {"id": item.id}}


@router.post("/career/applications/{application_id}/events")
async def add_application_event(application_id: str, payload: dict = Body(...), current_user: CurrentUser = None, db: AsyncSession = Depends(get_db)):
    item = await db.get(CareerApplication, application_id)
    status = str(payload.get("status", ""))
    note = str(payload.get("note", "")).strip()
    if not item or item.user_id != current_user["id"]:
        raise NotFoundError("投递记录不存在")
    if status not in {"saved", "applied", "written_test", "interview", "offer", "rejected", "withdrawn"} or len(note) < 2:
        raise ValidationError("投递状态或复盘内容无效")
    now = int(time.time() * 1000)
    item.status, item.note, item.last_event_at = status, note[:5000], now
    if status == "applied" and not item.submitted_at: item.submitted_at = now
    db.add(CareerEvent(id=uuid.uuid4().hex, user_id=current_user["id"], application_id=item.id, status=status, note=note[:5000]))
    await record_audit(db, "career.application_updated", actor_user_id=current_user["id"], target_type="career_application", target_id=item.id, details={"status": status})
    return {"ok": True}


@router.get("/decision")
async def decision_plan(target: str = "exploration", current_user: CurrentUser = None, db: AsyncSession = Depends(get_db)):
    portrait = await GrowthService(db).portrait(current_user["id"])
    dimensions = [{"dimension": item["name"], "score": item["score"], "threshold": 65, "gap": max(0, 65-item["score"]), "weightedGap": max(0, 65-item["score"])} for item in portrait["dimensions"]]
    recommendations = [{"id": f"{target}-{item['dimension']}", "dimension": item["dimension"], "title": f"补强{item['dimension']}", "deliverable": "提交一项可核验成果并完成复盘", "priority": min(100, 50+item["gap"]), "estimatedWeeks": 2, "status": "recommended", "rationale": f"当前 {item['score']} 分，参考目标 65 分", "factors": {"gapImpact": item["gap"], "targetRelevance": 70, "urgency": 60, "executability": 70, "interestMatch": 50, "cost": 2, "feedbackAdjustment": 0}} for item in sorted(dimensions, key=lambda x: x["gap"], reverse=True)[:5]]
    return {"plan": {"engineVersion": "XH-DPE-1.0", "modelMode": "deterministic", "target": {"id": target, "label": current_user.get("target_role") or target, "description": "依据已核验成长画像生成"}, "readiness": portrait["overallScore"], "confidence": portrait["confidence"], "evidenceBasis": portrait["verifiedEvidence"], "gaps": dimensions, "recommendations": recommendations, "formula": "按画像差距、目标相关度与可执行性排序", "generatedAt": portrait["calculatedAt"]}, "profiles": []}


@router.post("/decision")
async def decision_feedback(payload: dict = Body(...), current_user: CurrentUser = None, db: AsyncSession = Depends(get_db)):
    feedback = str(payload.get("feedback", ""))
    if feedback not in {"accepted", "completed", "dismissed"}:
        raise ValidationError("无效的建议反馈")
    item = RecommendationFeedback(id=uuid.uuid4().hex, user_id=current_user["id"], target_role=str(payload.get("targetRole", ""))[:40] or None, recommendation_id=str(payload.get("recommendationId", ""))[:120], feedback=feedback)
    db.add(item)
    await record_audit(db, "decision.feedback", actor_user_id=current_user["id"], target_type="recommendation", target_id=item.recommendation_id, details={"feedback": feedback})
    return {"ok": True}
