"""User router — public profile endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.exceptions import ForbiddenError
from ...db.session import get_db
from ..auth.dependency import CurrentUser, get_current_user
from .schema import PasswordChangeRequest, ProfileUpdateRequest
from .service import UserService

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/{user_id}")
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get user public profile by ID."""
    service = UserService(db)
    return {"user": await service.get_public_profile(user_id)}


@router.patch("/{user_id}")
async def update_user_profile(
    user_id: int,
    payload: ProfileUpdateRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Update user profile (self only, or admin)."""
    if current_user["id"] != user_id and current_user["role"] not in ("school_admin", "admin"):
        raise ForbiddenError("只能修改自己的档案")

    service = UserService(db)
    user = await service.update_profile(user_id, payload.model_dump(exclude_none=True))
    return {"user": user}
