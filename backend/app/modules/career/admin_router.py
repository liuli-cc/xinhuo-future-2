"""Employment data governance: xlsx import for jobs/announcements, offline
management endpoints.  Permission: can_manage_employment (T2).

导入策略（设计文档 §三）：直接入库 + 规则去重；类别自动推断；需求档案先走
规则解析（同步、毫秒级），LLM 富化在后台任务补齐（无密钥时静默跳过）。
"""

from __future__ import annotations

import asyncio
import io
import re
import time
import uuid
from datetime import datetime

from fastapi import APIRouter, Body, Depends, File, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.exceptions import ForbiddenError, NotFoundError, ValidationError
from ...db.session import get_db
from ..admin.audit import record_audit
from ..auth.dependency import CurrentUser
from .model import CareerAnnouncement, CareerJob
from .service import (
    build_requirement_profile,
    find_or_create_employer,
    infer_category,
    parse_requirements,
    rule_profile,
    split_majors,
)
from ...core.permissions import can_manage_employment

router = APIRouter(tags=["career-admin"])

_MAX_ROWS = 2000

_JOB_COLUMNS = {"行业": "industries", "公司名称": "company", "企业性质": "company_nature",
                "岗位名称": "title", "岗位要求/工作要求": "description", "专业限制": "majors_text",
                "截止时间": "deadline", "工作地点": "city", "投递网址": "source_url", "来源名称": "source_name"}
_ANNOUNCEMENT_COLUMNS = {"招聘简章": "title", "公司名称": "company", "工作城市": "city_text",
                         "详情链接": "detail_url", "☆投递链接☆": "apply_url", "投递链接": "apply_url",
                         "毕业年限": "cohort", "标签": "industries", "截止时间": "deadline",
                         "招聘岗位": "positions_text", "公司描述": "description", "录入时间": "published_at"}


def _require_employment_admin(user: dict) -> None:
    if not can_manage_employment(user):
        raise ForbiddenError("需要就业管理授权（请联系管理员在账号管理中授予）")


def _cell_str(row: dict, key: str) -> str:
    value = row.get(key)
    return str(value).strip() if value is not None else ""


def _cell_ms(value) -> int | None:
    """Excel 日期单元格/文本 → 毫秒时间戳；'未告知'等 → None。"""
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return int(value.timestamp() * 1000)
    text = str(value).strip()
    if not text or re.search(r"未告知|未知|待定|面议", text):
        return None
    match = re.search(r"(20\d{2})[-/年.](\d{1,2})[-/月.](\d{1,2})", text)
    if match:
        year, month, day = (int(part) for part in match.groups())
        try:
            return int(datetime(year, month, day).timestamp() * 1000)
        except ValueError:
            return None
    return None


def _now_ms() -> int:
    return int(time.time() * 1000)


def _sheet_rows(content: bytes) -> list[dict]:
    from openpyxl import load_workbook

    workbook = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    sheet = workbook.worksheets[0]
    rows_iter = sheet.iter_rows(values_only=True)
    headers = [str(cell).strip() if cell is not None else "" for cell in next(rows_iter, [])]
    mapped: list[dict] = []
    for values in rows_iter:
        row = {headers[index]: values[index] for index in range(min(len(headers), len(values)))}
        mapped.append(row)
    workbook.close()
    return mapped


async def _enrich_job_profiles(job_ids: list[str]) -> None:
    """后台任务：逐条用 LLM 补齐需求档案（engine=rules → llm），失败静默跳过。"""
    from ...db.session import get_session_factory

    factory = get_session_factory()
    for job_id in job_ids:
        try:
            async with factory() as session:
                job = await session.get(CareerJob, job_id)
                if not job or (job.requirement_profile or {}).get("engine") == "llm":
                    continue
                profile = await build_requirement_profile(job.title, job.description, job.majors_text)
                if profile.get("engine") == "llm":
                    job.requirement_profile = profile
                    await session.commit()
        except Exception:  # noqa: BLE001 — 富化失败不影响已入库数据
            continue


def _dedup_key(company: str, title: str, source_url: str) -> str:
    from .service import normalize_company_name

    return "|".join((normalize_company_name(company), title.strip(), (source_url or "").strip().lower()))


@router.post("/admin/career/jobs/import")
async def import_jobs(
    file: UploadFile = File(...),
    current_user: CurrentUser = None,
    db: AsyncSession = Depends(get_db),
):
    _require_employment_admin(current_user)
    content = await file.read()
    rows = _sheet_rows(content)
    rows = [row for row in rows if _cell_str(row, "公司名称") and _cell_str(row, "岗位名称")]
    if not rows:
        raise ValidationError("未解析到有效数据行，请检查表头（需含：公司名称、岗位名称、岗位要求/工作要求）")
    if len(rows) > _MAX_ROWS:
        raise ValidationError(f"单次最多导入 {_MAX_ROWS} 行，当前 {len(rows)} 行")

    existing_rows = await db.execute(select(CareerJob.company, CareerJob.title, CareerJob.source_url))
    seen = {_dedup_key(company, title, url or "") for company, title, url in existing_rows.all()}
    now = _now_ms()
    created_ids: list[str] = []
    duplicates = 0
    for row in rows:
        company = _cell_str(row, "公司名称")[:80]
        title = _cell_str(row, "岗位名称")[:100]
        source_url = _cell_str(row, "投递网址")[:500]
        key = _dedup_key(company, title, source_url)
        if key in seen:
            duplicates += 1
            continue
        seen.add(key)
        description = _cell_str(row, "岗位要求/工作要求")[:12000]
        majors_text = _cell_str(row, "专业限制")[:500] or None
        industries = _cell_str(row, "行业")[:200] or None
        company_nature = _cell_str(row, "企业性质")[:40] or None
        employer = await find_or_create_employer(db, name=company, organization_type=company_nature or None)
        item = CareerJob(
            id=uuid.uuid4().hex, created_by=current_user["id"], title=title, company=company,
            city=_cell_str(row, "工作地点")[:200] or None, employment_type=None,
            salary=None, source_url=source_url or None,
            source_name=_cell_str(row, "来源名称")[:60] or "批量导入",
            description=description or title,
            requirements=parse_requirements(title, description or title),
            employer_id=employer.id,
            category=infer_category(title, None), majors_text=majors_text,
            industries=industries, company_nature=company_nature,
            published_at=_cell_ms(row.get("录入时间")) or now,
            deadline=_cell_ms(row.get("截止时间")),
            source="import", visibility="public", status="active",
            requirement_profile=rule_profile(title, description or title, majors_text),
        )
        db.add(item)
        created_ids.append(item.id)
    await db.flush()
    imported = len(created_ids)
    await record_audit(db, "career.jobs_imported", actor_user_id=current_user["id"], target_type="career_job",
                       target_id=file.filename or "upload", details={"imported": imported, "duplicates": duplicates})
    if created_ids:
        asyncio.create_task(_enrich_job_profiles(created_ids))
    return {"imported": imported, "duplicates": duplicates, "enrichQueued": min(imported, 500)}


@router.post("/admin/career/announcements/import")
async def import_announcements(
    file: UploadFile = File(...),
    current_user: CurrentUser = None,
    db: AsyncSession = Depends(get_db),
):
    _require_employment_admin(current_user)
    content = await file.read()
    rows = _sheet_rows(content)
    rows = [row for row in rows if _cell_str(row, "招聘简章") and _cell_str(row, "公司名称")]
    if not rows:
        raise ValidationError("未解析到有效数据行，请检查表头（需含：招聘简章、公司名称）")
    if len(rows) > _MAX_ROWS:
        raise ValidationError(f"单次最多导入 {_MAX_ROWS} 行，当前 {len(rows)} 行")

    existing_rows = await db.execute(select(CareerAnnouncement.title, CareerAnnouncement.company))
    from .service import normalize_company_name
    seen = {f"{normalize_company_name(company)}|{title.strip()}" for title, company in existing_rows.all()}
    now = _now_ms()
    imported = duplicates = 0
    for row in rows:
        title = _cell_str(row, "招聘简章")[:200]
        company = _cell_str(row, "公司名称")[:80]
        key = f"{normalize_company_name(company)}|{title.strip()}"
        if key in seen:
            duplicates += 1
            continue
        seen.add(key)
        employer = await find_or_create_employer(db, name=company)
        item = CareerAnnouncement(
            id=uuid.uuid4().hex, created_by=current_user["id"], title=title, company=company,
            employer_id=employer.id,
            city_text=_cell_str(row, "工作城市")[:300] or None,
            cohort=_cell_str(row, "毕业年限")[:20] or None,
            positions_text=_cell_str(row, "招聘岗位")[:5000] or None,
            industries=_cell_str(row, "标签")[:200] or None,
            company_nature=_cell_str(row, "企业性质")[:40] or None,
            detail_url=_cell_str(row, "详情链接")[:1000] or None,
            apply_url=(_cell_str(row, "☆投递链接☆") or _cell_str(row, "投递链接"))[:1000] or None,
            description=_cell_str(row, "公司描述")[:3000] or None,
            published_at=_cell_ms(row.get("录入时间")) or now,
            deadline=_cell_ms(row.get("截止时间")),
            source="import", status="active",
        )
        db.add(item)
        imported += 1
    await db.flush()
    await record_audit(db, "career.announcements_imported", actor_user_id=current_user["id"],
                       target_type="career_announcement", target_id=file.filename or "upload",
                       details={"imported": imported, "duplicates": duplicates})
    return {"imported": imported, "duplicates": duplicates}


@router.patch("/admin/career/jobs/{job_id}")
async def govern_job(job_id: str, payload: dict = Body(...), current_user: CurrentUser = None, db: AsyncSession = Depends(get_db)):
    _require_employment_admin(current_user)
    job = await db.get(CareerJob, job_id)
    if not job:
        raise NotFoundError("岗位不存在")
    updates = {}
    if payload.get("status") in ("active", "offline"):
        updates["status"] = payload["status"]
    if payload.get("category") in ("intern", "campus", "social"):
        updates["category"] = payload["category"]
    if "deadline" in payload:
        updates["deadline"] = int(payload["deadline"]) if payload.get("deadline") else None
    if "majorsText" in payload:
        updates["majors_text"] = str(payload.get("majorsText") or "")[:500] or None
    if not updates:
        raise ValidationError("没有可更新的字段（支持 status/category/deadline/majorsText）")
    for key, value in updates.items():
        setattr(job, key, value)
    await record_audit(db, "career.job_governed", actor_user_id=current_user["id"], target_type="career_job",
                       target_id=job_id, details=updates)
    return {"job": {"id": job.id, "status": job.status, "category": job.category, "deadline": job.deadline}}


@router.patch("/admin/career/announcements/{announcement_id}")
async def govern_announcement(announcement_id: str, payload: dict = Body(...), current_user: CurrentUser = None, db: AsyncSession = Depends(get_db)):
    _require_employment_admin(current_user)
    announcement = await db.get(CareerAnnouncement, announcement_id)
    if not announcement:
        raise NotFoundError("公告不存在")
    updates = {}
    if payload.get("status") in ("active", "offline"):
        updates["status"] = payload["status"]
    if "deadline" in payload:
        updates["deadline"] = int(payload["deadline"]) if payload.get("deadline") else None
    if not updates:
        raise ValidationError("没有可更新的字段（支持 status/deadline）")
    for key, value in updates.items():
        setattr(announcement, key, value)
    await record_audit(db, "career.announcement_governed", actor_user_id=current_user["id"],
                       target_type="career_announcement", target_id=announcement_id, details=updates)
    return {"announcement": {"id": announcement.id, "status": announcement.status, "deadline": announcement.deadline}}
