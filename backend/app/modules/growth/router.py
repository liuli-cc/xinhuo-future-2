"""HTTP routes for the complete student growth loop."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.exceptions import ForbiddenError, NotFoundError
from ...core.permissions import can_access_target
from ...db.session import get_db
from ..auth.dependency import CurrentUser
from ..users.repository import UserRepository
from .schema import CloudStateInput, EvidenceInput, GrowthTaskInput
from .service import GrowthService

router = APIRouter(tags=["growth"])


@router.get("/growth-path")
async def growth_path(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    return {"tasks": await GrowthService(db).list_tasks(current_user["id"])}


@router.post("/growth-path")
async def save_growth_task(payload: GrowthTaskInput, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    return {"tasks": await GrowthService(db).save_custom_task(current_user["id"], payload.model_dump())}


@router.delete("/growth-path")
async def delete_growth_task(taskId: str = Query(..., min_length=2, max_length=80), current_user: CurrentUser = None, db: AsyncSession = Depends(get_db)):
    return {"tasks": await GrowthService(db).delete_custom_task(current_user["id"], taskId)}


@router.post("/growth-path/evidence")
async def submit_task_evidence(payload: EvidenceInput, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    result = await GrowthService(db).submit_evidence(current_user, payload.model_dump(), with_task=True)
    return {"tasks": result["tasks"], "message": "佐证已提交，审核通过后增加进度"}


async def _target_user(db: AsyncSession, actor: dict, student_id: str | None) -> dict:
    target = actor if not student_id or student_id == actor["student_id"] else await UserRepository(db).get_user_by_student_id(student_id)
    if not target:
        raise NotFoundError("学生不存在")
    if not can_access_target(actor, target):
        raise ForbiddenError("无权查看该学生的成长画像")
    return target


@router.get("/portrait")
async def get_portrait(request: Request, current_user: CurrentUser, studentId: str | None = None, db: AsyncSession = Depends(get_db)):
    target = await _target_user(db, current_user, studentId)
    return {"portrait": await GrowthService(db).portrait(target["id"], str(request.base_url).rstrip("/"))}


@router.post("/portrait")
async def submit_portrait_evidence(payload: EvidenceInput, request: Request, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    await GrowthService(db).submit_evidence(current_user, payload.model_dump(), with_task=False)
    return {"portrait": await GrowthService(db).portrait(current_user["id"], str(request.base_url).rstrip("/"))}


@router.delete("/portrait")
async def delete_portrait_evidence(request: Request, id: int, current_user: CurrentUser, studentId: str | None = None, db: AsyncSession = Depends(get_db)):
    target = await _target_user(db, current_user, studentId)
    if target["id"] != current_user["id"]:
        raise ForbiddenError("只有本人可以删除未核验佐证")
    return {"portrait": await GrowthService(db).delete_evidence(target["id"], id, str(request.base_url).rstrip("/"))}


@router.get("/cloud-state")
async def get_cloud_state(key: str, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    return {"value": await GrowthService(db).get_state(current_user["id"], key)}


@router.put("/cloud-state")
async def put_cloud_state(key: str, payload: CloudStateInput, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    return {"value": await GrowthService(db).save_state(current_user["id"], key, payload.value)}


@router.delete("/cloud-state")
async def delete_cloud_state(key: str, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    await GrowthService(db).clear_state(current_user["id"], key)
    return {"ok": True}
