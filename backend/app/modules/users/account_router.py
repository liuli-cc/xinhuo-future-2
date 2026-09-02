"""Self-service account security and privacy rights endpoints."""

from __future__ import annotations

import time
import uuid

from fastapi import APIRouter, Body, Depends, Request
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.config import get_settings
from ...core.exceptions import ConflictError, ValidationError
from ...core.security import verify_password
from ...db.session import get_db
from ..admin.audit import record_audit
from ..admin.model import DeletionRequest
from ..auth.dependency import CurrentUser
from ..career.model import CareerApplication, CareerJob
from ..evidence.model import Evidence
from ..growth.service import GrowthService, evidence_dict
from ..interview.model import InterviewSession
from .repository import UserRepository
from .schema import PasswordChangeRequest, ProfileUpdateRequest
from .service import UserService, public_user

router = APIRouter(prefix="/account", tags=["account"])


def _ms(value) -> int:
    if value is None:
        return 0
    if isinstance(value, int):
        return value
    return int(value.timestamp() * 1000)


def _deletion_dict(item: DeletionRequest | None) -> dict | None:
    if not item:
        return None
    return {
        "id": item.id,
        "requestedAt": item.requested_at,
        "scheduledAt": item.scheduled_at,
        "cancelledAt": item.cancelled_at,
        "completedAt": item.completed_at,
    }


@router.patch("")
async def update_account(
    request: Request,
    payload: dict = Body(...),
    current_user: CurrentUser = None,
    db: AsyncSession = Depends(get_db),
):
    service = UserService(db)
    action = payload.get("action")
    if current_user.get("force_password_change") and action != "password":
        raise ConflictError("首次登录必须先修改临时密码")
    if action == "profile":
        validated = ProfileUpdateRequest.model_validate(payload)
        user = await service.update_profile(current_user["id"], validated.model_dump(exclude_none=True))
        await record_audit(db, "account.profile_updated", actor_user_id=current_user["id"], target_type="user", target_id=current_user["id"])
        return {"user": user}
    if action == "password":
        validated = PasswordChangeRequest.model_validate(payload)
        await service.change_password(current_user["id"], validated.currentPassword, validated.newPassword)
        current_session_id = getattr(request.state, "session_id", "")
        await UserRepository(db).revoke_other_sessions(current_user["id"], current_session_id)
        await record_audit(db, "account.password_changed", actor_user_id=current_user["id"], target_type="user", target_id=current_user["id"])
        return {"ok": True}
    raise ValidationError("不支持的账号操作")


@router.get("/sessions")
async def list_account_sessions(request: Request, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    current_id = getattr(request.state, "session_id", "")
    sessions = await UserRepository(db).list_sessions(current_user["id"])
    return {"sessions": [{
        "id": item["id"],
        "deviceName": item["device_name"] or "未知设备",
        "createdAt": _ms(item["created_at"]),
        "lastSeenAt": item["last_seen_at"],
        "expiresAt": item["expires_at"],
        "current": item["id"] == current_id,
    } for item in sessions]}


@router.delete("/sessions")
async def revoke_account_sessions(
    request: Request,
    payload: dict = Body(default_factory=dict),
    current_user: CurrentUser = None,
    db: AsyncSession = Depends(get_db),
):
    if payload.get("mode", "others") != "others":
        raise ValidationError("仅支持退出其他设备")
    current_id = getattr(request.state, "session_id", "")
    await UserRepository(db).revoke_other_sessions(current_user["id"], current_id)
    return await list_account_sessions(request, current_user, db)


async def _current_deletion(db: AsyncSession, user_id: int) -> DeletionRequest | None:
    return (await db.execute(
        select(DeletionRequest)
        .where(DeletionRequest.user_id == user_id, DeletionRequest.completed_at.is_(None))
        .order_by(DeletionRequest.requested_at.desc()).limit(1)
    )).scalar_one_or_none()


@router.get("/deletion")
async def get_deletion(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    return {"request": _deletion_dict(await _current_deletion(db, current_user["id"]))}


@router.post("/deletion")
async def request_deletion(payload: dict = Body(...), current_user: CurrentUser = None, db: AsyncSession = Depends(get_db)):
    if not verify_password(str(payload.get("currentPassword", "")), current_user["password_salt"], current_user["password_hash"]):
        raise ValidationError("当前密码不正确")
    existing = await _current_deletion(db, current_user["id"])
    if existing and not existing.cancelled_at:
        raise ConflictError("已有待处理的注销申请")
    now = int(time.time() * 1000)
    item = DeletionRequest(
        id=uuid.uuid4().hex,
        user_id=current_user["id"],
        requested_at=now,
        scheduled_at=now + get_settings().ACCOUNT_DELETION_GRACE_DAYS * 86_400_000,
        cancelled_at=None,
        completed_at=None,
    )
    db.add(item)
    await record_audit(db, "privacy.deletion_requested", actor_user_id=current_user["id"], target_type="user", target_id=current_user["id"])
    await db.flush()
    return {"request": _deletion_dict(item)}


@router.delete("/deletion")
async def cancel_deletion(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    item = await _current_deletion(db, current_user["id"])
    if not item or item.cancelled_at:
        raise ConflictError("没有可撤销的注销申请")
    item.cancelled_at = int(time.time() * 1000)
    await record_audit(db, "privacy.deletion_cancelled", actor_user_id=current_user["id"], target_type="user", target_id=current_user["id"])
    return {"request": None}


@router.get("/export")
async def export_account_data(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    user_id = current_user["id"]
    evidence = list((await db.execute(select(Evidence).where(Evidence.user_id == user_id))).scalars())
    jobs = list((await db.execute(select(CareerJob).where(CareerJob.user_id == user_id))).scalars())
    applications = list((await db.execute(select(CareerApplication).where(CareerApplication.user_id == user_id))).scalars())
    interviews = list((await db.execute(select(InterviewSession).where(InterviewSession.user_id == user_id))).scalars())
    content = {
        "exportVersion": "XH-EXPORT-1.0",
        "exportedAt": int(time.time() * 1000),
        "profile": public_user(current_user),
        "growthTasks": await GrowthService(db).list_tasks(user_id),
        "evidence": [evidence_dict(item) for item in evidence],
        "careerJobs": [{
            "id": item.id, "title": item.title, "company": item.company, "city": item.city,
            "description": item.description, "requirements": item.requirements, "createdAt": _ms(item.created_at),
        } for item in jobs],
        "careerApplications": [{
            "id": item.id, "jobId": item.job_id, "status": item.status, "note": item.note,
            "submittedAt": item.submitted_at, "lastEventAt": item.last_event_at,
        } for item in applications],
        "interviews": [{
            "id": item.id, "targetRole": item.target_role, "difficulty": item.difficulty,
            "answers": item.answers, "report": item.report_v2 or item.report,
            "overallScore": item.overall_score, "createdAt": _ms(item.created_at),
        } for item in interviews],
        "notice": "导出不包含密码、会话令牌、审计日志中的其他用户数据或附件二进制。",
    }
    await record_audit(db, "privacy.data_exported", actor_user_id=user_id, target_type="user", target_id=user_id)
    return JSONResponse(
        jsonable_encoder(content),
        headers={
            "Content-Disposition": f"attachment; filename=xinhuo-{current_user['student_id']}-data.json",
            "Cache-Control": "private, no-store",
        },
    )
