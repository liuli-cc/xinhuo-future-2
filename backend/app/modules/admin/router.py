"""Scoped account governance, evidence review and operations dashboard."""

from __future__ import annotations

import secrets
import time
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request
from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.config import get_settings
from ...core.exceptions import ConflictError, ForbiddenError, NotFoundError, ValidationError
from ...core.permissions import can_access_target, can_manage_accounts, can_manage_system, can_review_evidence
from ...core.security import derive_password, sha256_hex
from ...db.session import get_db
from ...integrations.storage import get_storage_client
from ..admission.model import StudentAdmission, StudentAdmissionScore
from ..auth.dependency import CurrentUser
from ..career.model import (
    CandidatePush, CareerApplication, CareerEvent, CareerJob, CareerMatch,
    RecommendationFeedback, StudentDataAuthorization,
)
from ..employment.model import EmploymentReview, GraduateAdministration, StudentEmployment, StudyAbroadRecord
from ..evidence.model import Evidence, EvidenceFile, EvidenceReview
from ..files.model import File
from ..growth.model import (
    BaselineAssessment, CloudState, GrowthPlan, GrowthTask, GrowthTaskProgress,
    RoleModelMatch, StudentPortrait,
)
from ..growth.service import evidence_dict
from ..imports.model import DataImportBatch
from ..interview.model import InterviewSession, ResumeUploadChunk
from ..resume.model import GeneratedResume
from ..users.model import StudentPrivateProfile, StudentProfile, TeacherProfile, User, UserSession
from ..users.repository import UserRepository
from ..users.service import public_user
from .audit import record_audit
from .model import AuditLog, DeletionRequest, RecoveryRequest
from .schema import AccountActionInput, DeletionCompleteInput, EvidenceReviewInput, RecoveryCompleteInput, StaffInput

router = APIRouter(tags=["administration"])


def _ms(value) -> int | None:
    if value is None:
        return None
    if isinstance(value, int):
        return value
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return int(value.timestamp() * 1000)


def _scope_users(actor: dict, users: list[dict]) -> list[dict]:
    return [item for item in users if can_access_target(actor, item)]


async def _require_target(db: AsyncSession, actor: dict, target_id: int) -> dict:
    target = await UserRepository(db).get_user_by_id(target_id)
    if not target:
        raise NotFoundError("目标账号不存在")
    if not can_access_target(actor, target):
        raise ForbiddenError("目标账号超出你的管理范围")
    return target


def _account_dict(item: dict) -> dict:
    data = public_user(item)
    data["createdAt"] = _ms(item.get("created_at"))
    return data


async def _managed_accounts(db: AsyncSession, actor: dict) -> list[dict]:
    users = _scope_users(actor, await UserRepository(db).list_users(limit=1000))
    return [_account_dict(item) for item in users if item["id"] != actor["id"] or actor["role"] in ("school_admin", "admin")]


@router.get("/management/accounts")
async def management_accounts(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    if not can_review_evidence(current_user):
        raise ForbiddenError()
    return {
        "accounts": await _managed_accounts(db, current_user),
        "scope": {"role": current_user["role"], "college": current_user["college"], "className": current_user["class_name"]},
    }


@router.patch("/management/accounts")
async def update_managed_account(payload: AccountActionInput, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    target = await _require_target(db, current_user, payload.targetId)
    if target["id"] == current_user["id"]:
        raise ForbiddenError("不能在此处操作自己的账号")
    if payload.action == "placement":
        if not can_manage_accounts(current_user):
            raise ForbiddenError("只有管理员可以调整院系与班级归属")
        if not payload.college or not payload.major or not payload.className:
            raise ValidationError("院系、专业/岗位和班级不能为空")
        updates = {"college": payload.college, "major": payload.major, "class_name": payload.className, "grade": payload.grade or ""}
        action = "account.placement_updated"
    else:
        if current_user["role"] in ("teacher", "counselor") and target["role"] != "student":
            raise ForbiddenError("教师只能审核本班学生账号")
        mapping = {"approve": "active", "reject": "rejected", "suspend": "suspended", "activate": "active"}
        if payload.action in ("reject", "suspend") and len(payload.note.strip()) < 2:
            raise ValidationError("请填写至少 2 个字的具体原因")
        updates = {
            "account_status": mapping[payload.action],
            "account_review_note": payload.note.strip() or None,
            "account_reviewed_at": int(time.time() * 1000),
            "account_reviewed_by": current_user["id"],
        }
        action = f"account.{payload.action}"
    await UserRepository(db).update_user(target["id"], updates)
    if payload.action in ("reject", "suspend"):
        await db.execute(update(UserSession).where(UserSession.user_id == target["id"], UserSession.revoked_at.is_(None)).values(revoked_at=int(time.time() * 1000)))
    await record_audit(db, action, actor_user_id=current_user["id"], target_type="user", target_id=target["id"], details={"note": payload.note[:300]})
    return {"accounts": await _managed_accounts(db, current_user)}


async def _review_rows(db: AsyncSession, actor: dict, base_url: str) -> list[dict]:
    rows = (await db.execute(
        select(Evidence, User, File)
        .join(User, User.id == Evidence.user_id)
        .outerjoin(File, File.id == Evidence.attachment_id)
        .where(Evidence.verification_status == "pending")
        .order_by(Evidence.created_at)
    )).all()
    result = []
    for item, owner, attachment in rows:
        owner_dict = UserRepository(db)._to_dict(owner)
        if not can_access_target(actor, owner_dict):
            continue
        data = evidence_dict(item, attachment, base_url)
        data["studentName"] = owner.name
        result.append(data)
    return result


@router.get("/admin/evidence")
async def admin_evidence(request: Request, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    if not can_review_evidence(current_user):
        raise ForbiddenError()
    return {"reviews": await _review_rows(db, current_user, str(request.base_url).rstrip("/"))}


@router.patch("/admin/evidence")
async def review_evidence(payload: EvidenceReviewInput, request: Request, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    if not can_review_evidence(current_user):
        raise ForbiddenError()
    item = await db.get(Evidence, payload.id)
    if not item:
        raise NotFoundError("佐证不存在")
    owner = await _require_target(db, current_user, item.user_id)
    if item.verification_status != "pending":
        raise ConflictError("该佐证已处理，请刷新列表")
    if payload.status == "rejected" and len(payload.reviewerNote.strip()) < 2:
        raise ValidationError("驳回时必须填写具体原因")
    previous = item.verification_status
    now = int(time.time() * 1000)
    item.verification_status = payload.status
    item.reviewer_note = payload.reviewerNote.strip() or None
    item.reviewer_id = current_user["id"]
    item.reviewed_at = now
    item.relevance = payload.relevance
    item.quality = payload.quality
    item.contribution = payload.contribution
    db.add(EvidenceReview(
        id=uuid.uuid4().hex, evidence_id=item.id, reviewer_id=current_user["id"],
        previous_status=previous, next_status=payload.status, reviewer_note=item.reviewer_note,
    ))
    await record_audit(db, f"evidence.{payload.status}", actor_user_id=current_user["id"], target_type="evidence", target_id=item.id, details={"studentId": owner["student_id"], "dimension": item.dimension})
    await db.flush()
    return {"reviews": await _review_rows(db, current_user, str(request.base_url).rstrip("/"))}


@router.get("/admin/overview")
async def admin_overview(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    if not can_manage_accounts(current_user):
        raise ForbiddenError()
    users = _scope_users(current_user, await UserRepository(db).list_users(limit=5000))
    ids = [item["id"] for item in users] or [-1]
    counts = {}
    for name, model in (("growthTasks", GrowthTask), ("evidence", Evidence), ("cloudStates", CloudState), ("evidenceFiles", File)):
        column = model.created_by if model is File else model.user_id
        counts[name] = (await db.execute(select(func.count()).select_from(model).where(column.in_(ids)))).scalar_one()
    estimated = (await db.execute(select(func.coalesce(func.sum(File.file_size), 0)).where(File.created_by.in_(ids)))).scalar_one()
    limit = 5 * 1024 * 1024 * 1024
    percent = round(estimated / limit * 100, 1)
    recent = sorted(users, key=lambda item: _ms(item["created_at"]) or 0, reverse=True)[:8]
    return {"overview": {
        "accounts": {
            "total": len(users), "students": len([u for u in users if u["role"] == "student"]),
            "staff": len([u for u in users if u["role"] in ("teacher", "counselor")]),
            "admins": len([u for u in users if u["role"] in ("college_admin", "school_admin", "admin")]),
            "pending": len([u for u in users if u["account_status"] == "pending"]),
        },
        "records": counts,
        "storage": {"estimatedBytes": estimated, "databaseLimitBytes": limit, "usagePercent": percent, "warning": percent >= 75, "critical": percent >= 90, "method": "file-metadata-sum"},
        "recentUsers": [_account_dict(item) for item in recent],
    }}


async def _staff(db: AsyncSession, actor: dict) -> list[dict]:
    users = _scope_users(actor, await UserRepository(db).list_users(limit=1000))
    return [{
        **_account_dict(item), "school": "内蒙古师范大学", "canReview": can_review_evidence(item),
    } for item in users if item["role"] != "student"]


@router.get("/admin/staff")
async def list_staff(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    if not can_manage_accounts(current_user):
        raise ForbiddenError()
    return {"staff": await _staff(db, current_user)}


@router.post("/admin/staff")
async def create_staff(payload: StaffInput, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    if not can_manage_accounts(current_user):
        raise ForbiddenError()
    allowed = {"college_admin": {"teacher", "counselor"}, "school_admin": {"teacher", "counselor", "college_admin"}, "admin": {"teacher", "counselor", "college_admin", "school_admin"}}
    if payload.role not in allowed.get(current_user["role"], set()):
        raise ForbiddenError("不能创建同级或更高权限账号")
    if await UserRepository(db).get_user_by_student_id(payload.studentId):
        raise ConflictError("该工号已经存在")
    temporary = f"Xh{secrets.token_urlsafe(8)}9"
    credentials = derive_password(temporary)
    user = await UserRepository(db).create_user({
        "student_id": payload.studentId, "name": payload.name, "email": payload.email,
        "role": payload.role, "account_status": "active", "password_hash": credentials["hash"],
        "password_salt": credentials["salt"], "failed_login_count": 0, "force_password_change": True,
        "college": payload.college, "major": payload.role, "class_name": payload.className,
        "grade": "", "phone": "", "bio": "", "target_role": "探索方向",
        "development_track": "staff", "interests": [], "consent_at": int(time.time() * 1000),
        "consent_version": "staff-provisioned", "privacy_version": "staff-provisioned",
    })
    await record_audit(db, "staff.created", actor_user_id=current_user["id"], target_type="user", target_id=user["id"], details={"role": payload.role})
    return {"staff": await _staff(db, current_user), "temporaryPassword": temporary}


@router.get("/admin/audit")
async def audit_logs(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    if not can_manage_system(current_user):
        raise ForbiddenError()
    rows = (await db.execute(select(AuditLog, User.name).outerjoin(User, User.id == AuditLog.actor_user_id).order_by(AuditLog.created_at.desc()).limit(200))).all()
    return {"logs": [{"id": item.id, "action": item.action, "targetType": item.target_type, "targetId": item.target_id or "", "details": item.details or {}, "createdAt": item.created_at, "actorName": name or "系统"} for item, name in rows]}


@router.get("/admin/deletions")
async def deletion_requests(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    if not can_manage_system(current_user):
        raise ForbiddenError()
    rows = (await db.execute(select(DeletionRequest, User).join(User, User.id == DeletionRequest.user_id).where(DeletionRequest.cancelled_at.is_(None), DeletionRequest.completed_at.is_(None)).order_by(DeletionRequest.requested_at))).all()
    return {"requests": [{"id": item.id, "userId": user.id, "requestedAt": item.requested_at, "scheduledAt": item.scheduled_at, "studentId": user.student_id, "name": user.name, "email": user.email} for item, user in rows]}


@router.post("/admin/deletions")
async def complete_deletion(payload: DeletionCompleteInput, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    if not can_manage_system(current_user):
        raise ForbiddenError()
    if payload.userId == current_user["id"]:
        raise ForbiddenError("不能执行自己的账号注销，必须由另一位学校或平台管理员处理")
    request_item = (await db.execute(select(DeletionRequest).where(DeletionRequest.user_id == payload.userId, DeletionRequest.cancelled_at.is_(None), DeletionRequest.completed_at.is_(None)).order_by(DeletionRequest.requested_at.desc()).limit(1))).scalar_one_or_none()
    if not request_item:
        raise NotFoundError("注销申请不存在")
    if request_item.scheduled_at > int(time.time() * 1000):
        raise ConflictError("注销撤销期尚未结束")
    user = await _require_target(db, current_user, payload.userId)
    now = datetime.now(timezone.utc)

    files = list((await db.execute(select(File).where(File.created_by == payload.userId))).scalars())
    legacy_files = list((await db.execute(select(EvidenceFile).where(EvidenceFile.user_id == payload.userId))).scalars())
    storage = get_storage_client()
    for object_key in [item.object_key for item in [*files, *legacy_files] if item.object_key]:
        await storage.delete(object_key)

    student_profile = (await db.execute(select(StudentProfile).where(StudentProfile.user_id == payload.userId))).scalar_one_or_none()
    student_profile_id = student_profile.id if student_profile else None

    # Preserve shared records while removing the deleted account as reviewer/importer.
    await db.execute(update(User).where(User.account_reviewed_by == payload.userId).values(account_reviewed_by=None))
    await db.execute(update(Evidence).where(Evidence.reviewer_id == payload.userId, Evidence.user_id != payload.userId).values(reviewer_id=None))
    await db.execute(update(EvidenceReview).where(EvidenceReview.reviewer_id == payload.userId).values(reviewer_id=None))
    await db.execute(update(EmploymentReview).where(EmploymentReview.reviewer_id == payload.userId).values(reviewer_id=None))
    await db.execute(update(CandidatePush).where(CandidatePush.pushed_by == payload.userId, CandidatePush.user_id != payload.userId).values(pushed_by=None))
    await db.execute(update(CandidatePush).where(CandidatePush.career_job_id.in_(select(CareerJob.id).where(CareerJob.user_id == payload.userId))).values(career_job_id=None))
    await db.execute(update(GeneratedResume).where(GeneratedResume.career_job_id.in_(select(CareerJob.id).where(CareerJob.user_id == payload.userId)), GeneratedResume.user_id != payload.userId).values(career_job_id=None))
    await db.execute(update(RecoveryRequest).where(RecoveryRequest.completed_by == payload.userId, RecoveryRequest.user_id != payload.userId).values(completed_by=None))
    await db.execute(update(DataImportBatch).where(DataImportBatch.imported_by == payload.userId).values(imported_by=None))
    await db.execute(update(AuditLog).where(AuditLog.actor_user_id == payload.userId).values(actor_user_id=None))

    await db.execute(delete(UserSession).where(UserSession.user_id == payload.userId))
    await db.execute(delete(RecoveryRequest).where(RecoveryRequest.user_id == payload.userId))
    await db.execute(delete(ResumeUploadChunk).where(ResumeUploadChunk.user_id == payload.userId))
    await db.execute(delete(InterviewSession).where(InterviewSession.user_id == payload.userId))
    await db.execute(delete(CareerEvent).where(CareerEvent.user_id == payload.userId))
    await db.execute(delete(CareerApplication).where(CareerApplication.user_id == payload.userId))
    await db.execute(delete(CareerMatch).where(CareerMatch.user_id == payload.userId))
    await db.execute(delete(RecommendationFeedback).where(RecommendationFeedback.user_id == payload.userId))
    await db.execute(delete(CandidatePush).where(CandidatePush.user_id == payload.userId))
    await db.execute(delete(StudentDataAuthorization).where(StudentDataAuthorization.user_id == payload.userId))
    await db.execute(delete(GeneratedResume).where(GeneratedResume.user_id == payload.userId))
    await db.execute(delete(CareerJob).where(CareerJob.user_id == payload.userId))
    await db.execute(delete(EvidenceReview).where(EvidenceReview.evidence_id.in_(select(Evidence.id).where(Evidence.user_id == payload.userId))))
    await db.execute(delete(EvidenceFile).where(EvidenceFile.user_id == payload.userId))
    await db.execute(delete(Evidence).where(Evidence.user_id == payload.userId))
    await db.execute(delete(StudentPortrait).where(StudentPortrait.user_id == payload.userId))
    await db.execute(delete(BaselineAssessment).where(BaselineAssessment.user_id == payload.userId))
    await db.execute(delete(RoleModelMatch).where(RoleModelMatch.user_id == payload.userId))
    await db.execute(delete(GrowthTaskProgress).where(GrowthTaskProgress.user_id == payload.userId))
    await db.execute(delete(GrowthPlan).where(GrowthPlan.user_id == payload.userId))
    await db.execute(delete(GrowthTask).where(GrowthTask.user_id == payload.userId))
    await db.execute(delete(CloudState).where(CloudState.user_id == payload.userId))
    await db.execute(delete(File).where(File.created_by == payload.userId))

    if student_profile_id is not None:
        admission_ids = select(StudentAdmission.id).where(StudentAdmission.student_id == student_profile_id)
        employment_ids = select(StudentEmployment.id).where(StudentEmployment.student_id == student_profile_id)
        await db.execute(delete(StudentAdmissionScore).where(StudentAdmissionScore.admission_id.in_(admission_ids)))
        await db.execute(delete(StudentAdmission).where(StudentAdmission.student_id == student_profile_id))
        await db.execute(delete(EmploymentReview).where(EmploymentReview.employment_id.in_(employment_ids)))
        await db.execute(delete(StudentEmployment).where(StudentEmployment.student_id == student_profile_id))
        await db.execute(delete(StudyAbroadRecord).where(StudyAbroadRecord.student_id == student_profile_id))
        await db.execute(delete(GraduateAdministration).where(GraduateAdministration.student_id == student_profile_id))
        await db.execute(delete(StudentPrivateProfile).where(StudentPrivateProfile.student_id == student_profile_id))
        await db.execute(delete(StudentProfile).where(StudentProfile.id == student_profile_id))
    await db.execute(delete(TeacherProfile).where(TeacherProfile.user_id == payload.userId))

    credentials = derive_password(secrets.token_urlsafe(32))
    student_id_hash = sha256_hex(user["student_id"].encode(), get_settings().SECRET_KEY.encode())[:16]
    await UserRepository(db).update_user(payload.userId, {
        "student_id": f"d{payload.userId}-{uuid.uuid4().hex[:6]}",
        "deleted_at": now, "name": "已注销用户", "email": "", "phone": "", "bio": "",
        "password_hash": credentials["hash"], "password_salt": credentials["salt"],
        "account_status": "suspended", "account_review_note": None,
        "account_reviewed_at": None, "account_reviewed_by": None,
        "force_password_change": False, "failed_login_count": 0, "locked_until": None,
        "college": "", "major": "", "class_name": "", "grade": "",
        "target_role": "", "development_track": "deleted", "interests": [],
        "consent_at": None, "consent_version": None, "privacy_version": None,
        "last_login_at": None,
    })
    request_item.completed_at = int(now.timestamp() * 1000)
    await record_audit(db, "privacy.deletion_completed", actor_user_id=current_user["id"], target_type="user", target_id=payload.userId, details={"studentIdHash": student_id_hash})
    return await deletion_requests(current_user, db)


@router.post("/auth/recovery")
async def request_recovery(payload: dict, db: AsyncSession = Depends(get_db)):
    student_id = str(payload.get("studentId", "")).strip()
    name = str(payload.get("name", "")).strip()
    user = await UserRepository(db).get_user_by_student_id(student_id)
    # Deliberately return the same response to prevent account enumeration.
    if user and secrets.compare_digest(user["name"], name):
        existing = (await db.execute(select(RecoveryRequest).where(RecoveryRequest.user_id == user["id"], RecoveryRequest.completed_at.is_(None)).limit(1))).scalar_one_or_none()
        if not existing:
            now = int(time.time() * 1000)
            item = RecoveryRequest(id=uuid.uuid4().hex, user_id=user["id"], requested_at=now)
            db.add(item)
            await record_audit(db, "account.recovery_requested", actor_user_id=user["id"], target_type="recovery_request", target_id=item.id)
    return {"message": "若账号信息匹配，管理员会在核验后处理找回申请"}


@router.get("/admin/recovery")
async def recovery_requests(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    if not can_manage_system(current_user):
        raise ForbiddenError()
    rows = (await db.execute(select(RecoveryRequest, User).join(User, User.id == RecoveryRequest.user_id).where(RecoveryRequest.completed_at.is_(None)).order_by(RecoveryRequest.requested_at))).all()
    return {"requests": [{"id": item.id, "userId": user.id, "requestedAt": item.requested_at, "studentId": user.student_id, "name": user.name, "email": user.email, "role": user.role} for item, user in rows]}


@router.post("/admin/recovery")
async def complete_recovery(payload: RecoveryCompleteInput, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    if not can_manage_system(current_user):
        raise ForbiddenError()
    item = await db.get(RecoveryRequest, payload.requestId)
    if not item or item.completed_at:
        raise NotFoundError("找回申请不存在")
    temporary = f"Xh{secrets.token_urlsafe(8)}7"
    credentials = derive_password(temporary)
    await UserRepository(db).update_user(item.user_id, {"password_hash": credentials["hash"], "password_salt": credentials["salt"], "force_password_change": True, "failed_login_count": 0, "locked_until": None})
    await db.execute(update(UserSession).where(UserSession.user_id == item.user_id, UserSession.revoked_at.is_(None)).values(revoked_at=int(time.time() * 1000)))
    item.completed_at = int(time.time() * 1000)
    item.completed_by = current_user["id"]
    await record_audit(db, "account.recovery_completed", actor_user_id=current_user["id"], target_type="user", target_id=item.user_id)
    response = await recovery_requests(current_user, db)
    response["temporaryPassword"] = temporary
    return response
