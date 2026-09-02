"""Core student growth loop and evidence-based portrait algorithm."""

from __future__ import annotations

import json
import math
import time
from datetime import date, datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.exceptions import ConflictError, ForbiddenError, NotFoundError, ValidationError
from ..admin.audit import record_audit
from ...integrations.storage import get_storage_client
from ..evidence.model import Evidence, EvidenceReview
from ..files.model import File
from .model import CloudState, GrowthTask, StudentPortrait

ABILITY_DIMENSIONS = ["专业学习", "项目实践", "创新探索", "沟通协作", "职业准备"]
SOURCE_RELIABILITY = {
    "course_record": 90,
    "project_artifact": 82,
    "competition_certificate": 92,
    "teacher_review": 95,
    "peer_review": 70,
    "self_report": 45,
}
NEXT_ACTION = {
    "专业学习": "添加近期课程成绩、课程作品或教师评价。",
    "项目实践": "补充真实项目中的个人职责、交付物和可量化结果。",
    "创新探索": "提交一次竞赛、调研、创意方案或创新实践的成果证据。",
    "沟通协作": "邀请团队成员或教师对协作、表达与责任履行给出评价。",
    "职业准备": "补充职业调研、简历评审、模拟面试或实习申请记录。",
}
ALGORITHM_VERSION = "XH-EGM-2.0"
ALLOWED_STATE_KEYS = {
    "ai_chat", "resource_saved", "career_saved", "career_applied", "interview_history"
}


def _milliseconds(value: datetime | None) -> int | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return int(value.timestamp() * 1000)


def evidence_dict(item: Evidence, attachment: File | None = None, base_url: str = "") -> dict:
    attachment_url = None
    if attachment:
        attachment_url = f"{base_url}/api/v1/files/{attachment.id}/download"
    return {
        "id": item.id,
        "studentId": item.student_id,
        "taskId": item.task_id or "",
        "taskTitle": item.task_title or "",
        "title": item.title,
        "category": item.category,
        "dimension": item.dimension,
        "detail": item.detail,
        "evidenceRef": item.evidence_ref or "",
        "evidenceDate": item.evidence_date,
        "sourceType": item.source_type,
        "sourceReliability": item.source_reliability,
        "relevance": item.relevance,
        "quality": item.quality,
        "contribution": item.contribution,
        "verificationStatus": item.verification_status,
        "reviewerNote": item.reviewer_note or "",
        "reviewedAt": item.reviewed_at,
        "createdAt": _milliseconds(item.created_at) or 0,
        "attachmentId": item.attachment_id,
        "attachmentName": attachment.original_filename if attachment else None,
        "attachmentMime": attachment.mime_type if attachment else None,
        "attachmentBytes": attachment.file_size if attachment else None,
        "attachmentSha256": attachment.sha256 if attachment else None,
        "attachmentVersion": 1 if attachment else None,
        "attachmentUrl": attachment_url,
    }


def _recency_weight(value: str, now: date) -> float:
    try:
        days = max(0, (now - date.fromisoformat(value)).days)
    except ValueError:
        return 0.65
    if days <= 180:
        return 1.0
    if days <= 365:
        return 0.9
    if days <= 730:
        return 0.78
    return 0.65


def calculate_portrait(records: list[dict], now: datetime | None = None) -> dict:
    instant = now or datetime.now(timezone.utc)
    scored: list[dict] = []
    for record in records:
        recency = _recency_weight(record["evidenceDate"], instant.date())
        verification = 1 if record["verificationStatus"] == "verified" else 0
        effective = (
            max(0, min(100, record["sourceReliability"])) / 100
            * max(0, min(100, record["relevance"])) / 100
            * max(0, min(100, record["quality"])) / 100
            * max(0, min(100, record["contribution"])) / 100
            * recency
            * verification
        )
        scored.append({
            **record,
            "recencyWeight": round(recency, 2),
            "effectiveWeight": round(effective, 3),
            "impact": round(effective * 18, 1),
        })

    verified = [item for item in scored if item["verificationStatus"] == "verified"]
    dimensions: list[dict] = []
    for name in ABILITY_DIMENSIONS:
        items = sorted(
            (item for item in verified if item["dimension"] == name),
            key=lambda item: item["effectiveWeight"],
            reverse=True,
        )
        source_counts: dict[str, int] = {}
        weight_sum = 0.0
        factors = [1.0, 0.72, 0.52, 0.38]
        for item in items:
            repeated = source_counts.get(item["sourceType"], 0)
            source_counts[item["sourceType"]] = repeated + 1
            weight_sum += item["effectiveWeight"] * factors[min(repeated, 3)]
        diversity = len(source_counts)
        adjusted = weight_sum * (1 + min(0.16, max(0, diversity - 1) * 0.04))
        average_reliability = (
            sum(item["sourceReliability"] for item in items) / len(items) if items else 0
        )
        evidence_confidence = 1 - math.exp(-adjusted / 1.8)
        confidence = round(min(100, evidence_confidence * 62 + min(1, diversity / 3) * 18 + average_reliability * 0.2)) if items else 0
        raw_score = 100 * (1 - math.exp(-adjusted / 2.15))
        score = round(min(100, raw_score * (0.72 + confidence / 100 * 0.28)))
        dimensions.append({
            "name": name,
            "score": score,
            "confidence": confidence,
            "evidenceCount": len(items),
            "verifiedCount": len(items),
            "weightSum": round(adjusted, 2),
            "sourceDiversity": diversity,
        })
    overall = round(sum(item["score"] for item in dimensions) / len(ABILITY_DIMENSIONS))
    confidence = round(sum(item["confidence"] for item in dimensions) / len(ABILITY_DIMENSIONS))
    completeness = round(
        (len([item for item in dimensions if item["evidenceCount"]]) / len(ABILITY_DIMENSIONS) * 0.65
         + min(1, len(verified) / 12) * 0.35) * 100
    )
    priority = sorted(dimensions, key=lambda item: (item["evidenceCount"] > 0, item["score"]))[0]
    return {
        "algorithmVersion": ALGORITHM_VERSION,
        "overallScore": overall,
        "completeness": completeness,
        "confidence": confidence,
        "totalEvidence": len(scored),
        "verifiedEvidence": len(verified),
        "pendingEvidence": len([item for item in scored if item["verificationStatus"] == "pending"]),
        "dimensions": dimensions,
        "evidence": scored,
        "nextAction": {
            "dimension": priority["name"],
            "title": (
                f"继续验证“{priority['name']}”" if priority["evidenceCount"]
                else f"首先建立“{priority['name']}”证据"
            ),
            "detail": NEXT_ACTION[priority["name"]],
        },
        "calculatedAt": instant.isoformat(),
    }


class GrowthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _delete_attachment(self, attachment_id: str | None) -> None:
        if not attachment_id:
            return
        attachment = await self.db.get(File, attachment_id)
        if not attachment:
            return
        if attachment.object_key:
            await get_storage_client().delete(attachment.object_key)
        await self.db.delete(attachment)

    async def list_tasks(self, user_id: int) -> list[dict]:
        tasks = list((await self.db.execute(
            select(GrowthTask).where(GrowthTask.user_id == user_id).order_by(GrowthTask.semester_index, GrowthTask.created_at)
        )).scalars())
        evidence = list((await self.db.execute(
            select(Evidence).where(Evidence.user_id == user_id).order_by(Evidence.created_at)
        )).scalars())
        latest = {item.task_id: item for item in evidence if item.task_id}
        return [self._task_dict(task, latest.get(task.task_id)) for task in tasks]

    @staticmethod
    def _task_dict(task: GrowthTask, evidence: Evidence | None) -> dict:
        status = evidence.verification_status if evidence else "none"
        return {
            "id": task.task_id,
            "taskId": task.task_id,
            "semesterIndex": task.semester_index,
            "title": task.title,
            "note": task.note,
            "type": task.type,
            "xp": task.xp,
            "isCustom": bool(task.is_custom),
            "completed": status == "verified",
            "evidenceStatus": status,
            "evidenceId": evidence.id if evidence else None,
        }

    async def save_custom_task(self, user_id: int, data: dict) -> list[dict]:
        task_id = data["taskId"]
        if not task_id.startswith("custom-"):
            raise ValidationError("自定义任务编号格式错误")
        key = f"{user_id}:{task_id}"
        task = await self.db.get(GrowthTask, key)
        values = {
            "semester_index": data["semesterIndex"], "title": data["title"].strip(),
            "note": data.get("note", "").strip(), "type": data.get("type", "自定义").strip(),
            "xp": data.get("xp", 20), "is_custom": True,
        }
        if task:
            for field, value in values.items():
                setattr(task, field, value)
        else:
            self.db.add(GrowthTask(id=key, user_id=user_id, task_id=task_id, **values))
        await self.db.flush()
        return await self.list_tasks(user_id)

    async def delete_custom_task(self, user_id: int, task_id: str) -> list[dict]:
        task = await self.db.get(GrowthTask, f"{user_id}:{task_id}")
        if not task or not task.is_custom:
            raise NotFoundError("自定义任务不存在")
        evidence = list((await self.db.execute(select(Evidence).where(
            Evidence.user_id == user_id, Evidence.task_id == task_id
        ))).scalars())
        if any(item.verification_status == "verified" for item in evidence):
            raise ConflictError("已核验任务不能直接删除，请联系审核人员更正")
        for item in evidence:
            await self.db.execute(delete(EvidenceReview).where(EvidenceReview.evidence_id == item.id))
            await self._delete_attachment(item.attachment_id)
            await self.db.delete(item)
        await self.db.delete(task)
        await record_audit(self.db, "growth_task.deleted", actor_user_id=user_id, target_type="growth_task", target_id=task_id)
        await self.db.flush()
        return await self.list_tasks(user_id)

    async def submit_evidence(self, user: dict, data: dict, *, with_task: bool) -> dict:
        title = (data.get("evidenceTitle") or data.get("title") or "").strip()
        if len(title) < 2:
            raise ValidationError("佐证名称至少需要 2 个字")
        if not data.get("attachmentId") and len(data.get("evidenceRef", "").strip()) < 6:
            raise ValidationError("请上传文件或填写可核验来源")
        attachment_id = data.get("attachmentId") or None
        if attachment_id:
            attachment = await self.db.get(File, attachment_id)
            if not attachment or attachment.created_by != user["id"]:
                raise ForbiddenError("佐证附件不存在或不属于当前账号")

        task_id = data.get("taskId") if with_task else None
        if with_task and not task_id:
            raise ValidationError("缺少成长任务编号")
        if with_task:
            key = f"{user['id']}:{task_id}"
            task = await self.db.get(GrowthTask, key)
            values = {
                "semester_index": data["semesterIndex"],
                "title": data.get("taskTitle") or title,
                "note": data.get("taskNote", ""),
                "type": data.get("taskType", ""),
                "xp": data.get("xp", 0),
                "is_custom": bool(data.get("isCustom", False)),
            }
            if task:
                for field, value in values.items():
                    setattr(task, field, value)
            else:
                self.db.add(GrowthTask(id=key, user_id=user["id"], task_id=task_id, **values))

        existing = None
        if task_id:
            existing = (await self.db.execute(
                select(Evidence).where(Evidence.user_id == user["id"], Evidence.task_id == task_id)
                .order_by(Evidence.created_at.desc()).limit(1)
            )).scalar_one_or_none()
        if existing and existing.verification_status == "verified":
            raise ConflictError("该任务已有通过核验的佐证")
        previous_attachment_id = existing.attachment_id if existing else None
        values = {
            "student_id": user["student_id"], "task_id": task_id,
            "task_title": data.get("taskTitle") or None, "title": title,
            "category": data["category"], "dimension": data["dimension"],
            "detail": data["detail"].strip(), "evidence_ref": data.get("evidenceRef", "").strip() or None,
            "evidence_date": data["evidenceDate"], "source_type": data["sourceType"],
            "source_reliability": SOURCE_RELIABILITY[data["sourceType"]],
            "relevance": data["relevance"], "quality": data["quality"],
            "contribution": data["contribution"], "attachment_id": attachment_id,
            "verification_status": "pending", "reviewer_note": None,
            "reviewed_at": None, "reviewer_id": None,
        }
        if existing:
            for field, value in values.items():
                setattr(existing, field, value)
            evidence = existing
        else:
            evidence = Evidence(user_id=user["id"], **values)
            self.db.add(evidence)
        if attachment_id:
            attachment = await self.db.get(File, attachment_id)
            attachment.owner_type = "evidence"
        await self.db.flush()
        if attachment_id:
            attachment.owner_id = str(evidence.id)
        if previous_attachment_id and previous_attachment_id != attachment_id:
            await self._delete_attachment(previous_attachment_id)
        await record_audit(
            self.db, "growth_task.evidence_submitted" if with_task else "evidence.submitted",
            actor_user_id=user["id"], target_type="evidence", target_id=evidence.id,
            details={"taskId": task_id, "dimension": evidence.dimension},
        )
        return {"evidence": evidence, "tasks": await self.list_tasks(user["id"])}

    async def portrait(self, user_id: int, base_url: str = "") -> dict:
        rows = (await self.db.execute(
            select(Evidence, File)
            .outerjoin(File, File.id == Evidence.attachment_id)
            .where(Evidence.user_id == user_id)
            .order_by(Evidence.created_at.desc())
        )).all()
        result = calculate_portrait([evidence_dict(item, attachment, base_url) for item, attachment in rows])
        existing = (await self.db.execute(
            select(StudentPortrait).where(StudentPortrait.user_id == user_id).limit(1)
        )).scalar_one_or_none()
        now_ms = int(time.time() * 1000)
        values = {
            "portrait_data": result, "dimensions": result["dimensions"],
            "overall_score": result["overallScore"], "completeness": result["completeness"],
            "confidence": result["confidence"], "total_evidence": result["totalEvidence"],
            "verified_evidence": result["verifiedEvidence"], "algorithm_version": ALGORITHM_VERSION,
            "calculated_at": now_ms,
        }
        if existing:
            for field, value in values.items():
                setattr(existing, field, value)
        else:
            self.db.add(StudentPortrait(user_id=user_id, **values))
        await self.db.flush()
        return result

    async def delete_evidence(self, user_id: int, evidence_id: int, base_url: str = "") -> dict:
        item = await self.db.get(Evidence, evidence_id)
        if not item or item.user_id != user_id:
            raise NotFoundError("成长佐证不存在")
        if item.verification_status == "verified":
            raise ConflictError("已核验佐证不能直接删除，请联系审核人员更正")
        await self.db.execute(delete(EvidenceReview).where(EvidenceReview.evidence_id == item.id))
        await self._delete_attachment(item.attachment_id)
        await self.db.delete(item)
        await record_audit(self.db, "evidence.deleted", actor_user_id=user_id, target_type="evidence", target_id=evidence_id)
        await self.db.flush()
        return await self.portrait(user_id, base_url)

    async def get_state(self, user_id: int, key: str):
        self._validate_state_key(key)
        item = await self.db.get(CloudState, f"{user_id}:{key}")
        if not item or item.value is None:
            return None
        try:
            return json.loads(item.value)
        except json.JSONDecodeError:
            return None

    async def save_state(self, user_id: int, key: str, value: object) -> object:
        self._validate_state_key(key)
        encoded = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
        if len(encoded.encode()) > 256 * 1024:
            raise ValidationError("云端状态不能超过 256KB")
        item = await self.db.get(CloudState, f"{user_id}:{key}")
        if item:
            item.value = encoded
        else:
            self.db.add(CloudState(id=f"{user_id}:{key}", user_id=user_id, state_key=key, value=encoded))
        return value

    async def clear_state(self, user_id: int, key: str) -> None:
        self._validate_state_key(key)
        await self.db.execute(delete(CloudState).where(CloudState.id == f"{user_id}:{key}"))

    @staticmethod
    def _validate_state_key(key: str) -> None:
        if key not in ALLOWED_STATE_KEYS:
            raise ValidationError("不支持的云端状态键")
