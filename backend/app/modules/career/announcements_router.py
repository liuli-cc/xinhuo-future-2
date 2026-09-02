"""Campus announcement (校招公告) routes: list, detail, applications, favorites.

与岗位全链路分表（ADR-0002）；状态机复用 stages 模块；公告不做匹配（ADR-0001）。
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Body, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.exceptions import ConflictError, NotFoundError, ValidationError
from ...db.session import get_db
from ..admin.audit import record_audit
from ..auth.dependency import CurrentUser
from ..growth.service import GrowthService  # noqa: F401  (保持与岗位路由对称的导入习惯)
from .model import (
    CareerAnnouncement,
    CareerAnnouncementApplication,
    CareerAnnouncementEvent,
    CareerAnnouncementFavorite,
)
from .service import (
    ANNOUNCEMENT_EXPIRY_MS,
    announcement_dict,
    event_dict,
    is_expired,
    find_or_create_employer,
)
from .stages import STAGE_LABELS, apply_transition, validate_target

router = APIRouter(tags=["career-announcements"])

_PAGE_MAX = 50


def _now() -> int:
    import time
    return int(time.time() * 1000)


def _ms(value) -> int | None:
    return int(value.timestamp() * 1000) if value else None


def _expired(item: CareerAnnouncement) -> bool:
    return is_expired(item.published_at, item.deadline, ANNOUNCEMENT_EXPIRY_MS)


async def _announcement_extras(db: AsyncSession, user_id: int, rows: list[CareerAnnouncement]) -> list[dict]:
    ids = [item.id for item in rows]
    favorites: set[str] = set()
    applications: dict[str, CareerAnnouncementApplication] = {}
    if ids:
        fav_rows = await db.execute(select(CareerAnnouncementFavorite.announcement_id).where(
            CareerAnnouncementFavorite.user_id == user_id, CareerAnnouncementFavorite.announcement_id.in_(ids)))
        favorites = {row for row in fav_rows.scalars()}
        app_rows = await db.execute(select(CareerAnnouncementApplication).where(
            CareerAnnouncementApplication.user_id == user_id, CareerAnnouncementApplication.announcement_id.in_(ids)))
        applications = {row.announcement_id: row for row in app_rows.scalars()}
    payloads = []
    for item in rows:
        app_row = applications.get(item.id)
        app_payload = None
        if app_row:
            app_payload = {"id": app_row.id, "stage": app_row.stage, "outcome": app_row.outcome,
                           "stageLabel": STAGE_LABELS.get(app_row.stage, app_row.stage), "note": app_row.note or "",
                           "submittedAt": app_row.submitted_at, "lastEventAt": app_row.last_event_at,
                           "updatedAt": _ms(app_row.updated_at) or 0}
        payloads.append(announcement_dict(item, favorited=item.id in favorites,
                                          application=app_payload, expired=_expired(item)))
    return payloads


# ── 公告列表 / 详情 ───────────────────────────────────────────────


@router.get("/career/announcements")
async def list_announcements(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    cohort: str = "",
    industry: str = "",
    city: str = "",
    q: str = "",
    include_expired: int = Query(0, alias="includeExpired"),
    page: int = 1,
    page_size: int = Query(20, alias="pageSize"),
):
    page, page_size = max(1, page), min(_PAGE_MAX, max(1, page_size))
    stmt = select(CareerAnnouncement).where(CareerAnnouncement.status == "active")
    if cohort:
        stmt = stmt.where(CareerAnnouncement.cohort.like(f"%{cohort}%"))
    if industry:
        stmt = stmt.where(CareerAnnouncement.industries.contains(industry))
    if city:
        stmt = stmt.where(CareerAnnouncement.city_text.contains(city))
    if q:
        stmt = stmt.where((CareerAnnouncement.title.contains(q.strip())) | (CareerAnnouncement.company.contains(q.strip())))
    all_rows = list((await db.execute(stmt.order_by(
        CareerAnnouncement.published_at.is_(None), CareerAnnouncement.published_at.desc(),
        CareerAnnouncement.created_at.desc()))).scalars())
    total_all = len(all_rows)
    if not include_expired:
        all_rows = [item for item in all_rows if not _expired(item)]
    start = (page - 1) * page_size
    slice_rows = all_rows[start: start + page_size]
    standard_cohorts = ["27届", "26届", "25届", "24届"]
    cohort_options: list[dict] = []
    for value in standard_cohorts:
        count = (await db.execute(select(func.count()).where(
            CareerAnnouncement.status == "active", CareerAnnouncement.cohort.like(f"%{value}%")
        ))).scalar() or 0
        if count:
            cohort_options.append({"value": value, "label": value, "count": count})
    return {"items": await _announcement_extras(db, current_user["id"], slice_rows),
            "total": len(all_rows), "totalBeforeExpiry": total_all,
            "page": page, "pageSize": page_size,
            "cohortOptions": cohort_options}


@router.get("/career/announcements/{announcement_id}")
async def get_announcement(announcement_id: str, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    item = await db.get(CareerAnnouncement, announcement_id)
    if not item:
        raise NotFoundError("公告不存在")
    return {"announcement": (await _announcement_extras(db, current_user["id"], [item]))[0]}


# ── 公告投递 ─────────────────────────────────────────────────────


@router.get("/career/announcement-applications")
async def list_announcement_applications(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    stage: str = "",
    outcome: str = "",
):
    counts_rows = await db.execute(
        select(CareerAnnouncementApplication.stage, CareerAnnouncementApplication.outcome, func.count())
        .where(CareerAnnouncementApplication.user_id == current_user["id"])
        .group_by(CareerAnnouncementApplication.stage, CareerAnnouncementApplication.outcome)
    )
    stage_counts: dict[str, int] = {}
    for row_stage, row_outcome, count in counts_rows.all():
        bucket = row_outcome or row_stage
        stage_counts[bucket] = stage_counts.get(bucket, 0) + count

    stmt = select(CareerAnnouncementApplication, CareerAnnouncement).join(
        CareerAnnouncement, CareerAnnouncement.id == CareerAnnouncementApplication.announcement_id
    ).where(CareerAnnouncementApplication.user_id == current_user["id"]).order_by(
        CareerAnnouncementApplication.updated_at.desc())
    if outcome:
        stmt = stmt.where(CareerAnnouncementApplication.outcome == outcome)
    elif stage:
        stmt = stmt.where(CareerAnnouncementApplication.stage == stage, CareerAnnouncementApplication.outcome.is_(None))
    rows = (await db.execute(stmt)).all()

    app_ids = [item.id for item, _ in rows]
    event_counts: dict[str, int] = {}
    if app_ids:
        counted = await db.execute(
            select(CareerAnnouncementEvent.application_id, func.count())
            .where(CareerAnnouncementEvent.application_id.in_(app_ids)).group_by(CareerAnnouncementEvent.application_id)
        )
        event_counts = {app_id: count for app_id, count in counted.all()}

    applications = []
    from .service import application_dict
    for item, announcement in rows:
        target = {"title": announcement.title, "company": announcement.company,
                  "cityText": announcement.city_text or "", "cohort": announcement.cohort or "",
                  "applyUrl": announcement.apply_url or ""}
        applications.append(application_dict(item, target, event_counts.get(item.id, 0)))
    return {"applications": applications, "counts": stage_counts,
            "stageOptions": [{"value": value, "label": label} for value, label in STAGE_LABELS.items()]}


@router.post("/career/announcement-applications")
async def create_announcement_application(payload: dict = Body(...), current_user: CurrentUser = None, db: AsyncSession = Depends(get_db)):
    announcement = await db.get(CareerAnnouncement, str(payload.get("announcementId", "")))
    if not announcement or announcement.status != "active":
        raise NotFoundError("公告不存在")
    existing = (await db.execute(select(CareerAnnouncementApplication).where(
        CareerAnnouncementApplication.user_id == current_user["id"],
        CareerAnnouncementApplication.announcement_id == announcement.id).limit(1))).scalar_one_or_none()
    if existing:
        raise ConflictError("该公告已在投递工作台")
    item = CareerAnnouncementApplication(id=uuid.uuid4().hex, user_id=current_user["id"],
                                         announcement_id=announcement.id, stage="saved", outcome=None, note=None)
    db.add(item)
    return {"application": {"id": item.id}}


@router.post("/career/announcement-applications/{application_id}/events")
async def add_announcement_application_event(application_id: str, payload: dict = Body(...), current_user: CurrentUser = None, db: AsyncSession = Depends(get_db)):
    item = await db.get(CareerAnnouncementApplication, application_id)
    if not item or item.user_id != current_user["id"]:
        raise NotFoundError("投递记录不存在")
    note = str(payload.get("note", "")).strip()
    if len(note) < 2:
        raise ValidationError("请写下至少 2 个字的阶段反馈或复盘")
    next_stage, next_outcome = validate_target(item.stage, item.outcome, payload.get("stage"), payload.get("outcome"))
    event_payload = apply_transition(item, next_stage, next_outcome, note)
    db.add(CareerAnnouncementEvent(id=uuid.uuid4().hex, user_id=current_user["id"], application_id=item.id, **event_payload))
    await record_audit(db, "career.announcement_application_updated", actor_user_id=current_user["id"],
                       target_type="career_announcement_application", target_id=item.id,
                       details={"stage": next_stage, "outcome": next_outcome})
    return {"ok": True, "stage": item.stage, "outcome": item.outcome}


@router.get("/career/announcement-applications/{application_id}/events")
async def list_announcement_application_events(application_id: str, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    item = await db.get(CareerAnnouncementApplication, application_id)
    if not item or item.user_id != current_user["id"]:
        raise NotFoundError("投递记录不存在")
    rows = (await db.execute(select(CareerAnnouncementEvent).where(
        CareerAnnouncementEvent.application_id == application_id).order_by(CareerAnnouncementEvent.created_at.asc()))).scalars()
    return {"events": [event_dict(row) for row in rows],
            "stageOptions": [{"value": value, "label": label} for value, label in STAGE_LABELS.items()]}


# ── 公告收藏 ─────────────────────────────────────────────────────


@router.get("/career/announcement-favorites")
async def list_announcement_favorites(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(
        select(CareerAnnouncementFavorite, CareerAnnouncement)
        .join(CareerAnnouncement, CareerAnnouncement.id == CareerAnnouncementFavorite.announcement_id)
        .where(CareerAnnouncementFavorite.user_id == current_user["id"])
        .order_by(CareerAnnouncementFavorite.created_at.desc())
    )).all()
    payloads = {item.id: payload for item, payload in zip(
        (announcement for _, announcement in rows),
        await _announcement_extras(db, current_user["id"], [announcement for _, announcement in rows]),
    )}
    return {"favorites": [dict(payloads[announcement.id], favoriteId=fav.id) for fav, announcement in rows]}


@router.post("/career/announcement-favorites")
async def create_announcement_favorite(payload: dict = Body(...), current_user: CurrentUser = None, db: AsyncSession = Depends(get_db)):
    announcement = await db.get(CareerAnnouncement, str(payload.get("announcementId", "")))
    if not announcement:
        raise NotFoundError("公告不存在")
    existing = (await db.execute(select(CareerAnnouncementFavorite).where(
        CareerAnnouncementFavorite.user_id == current_user["id"],
        CareerAnnouncementFavorite.announcement_id == announcement.id).limit(1))).scalar_one_or_none()
    if existing:
        return {"favorite": {"id": existing.id}}
    favorite = CareerAnnouncementFavorite(id=uuid.uuid4().hex, user_id=current_user["id"], announcement_id=announcement.id)
    db.add(favorite)
    return {"favorite": {"id": favorite.id}}


@router.delete("/career/announcement-favorites/{announcement_id}")
async def delete_announcement_favorite(announcement_id: str, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    favorite = (await db.execute(select(CareerAnnouncementFavorite).where(
        CareerAnnouncementFavorite.user_id == current_user["id"],
        CareerAnnouncementFavorite.announcement_id == announcement_id).limit(1))).scalar_one_or_none()
    if favorite:
        await db.delete(favorite)
    return {"ok": True}


# 供导入模块复用（公告上传时建立企业档案）
_employer_helper = find_or_create_employer
