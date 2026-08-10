"""User service — business logic for user operations."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from ...core.exceptions import ForbiddenError, NotFoundError, ValidationError
from ...core.security import derive_password, password_hash, verify_password
from .repository import UserRepository


class UserService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = UserRepository(db)

    async def get_public_profile(self, user_id: int) -> dict:
        user = await self.repo.get_user_by_id(user_id)
        if not user:
            raise NotFoundError("用户不存在")
        excluded = {"password_hash", "password_salt", "failed_login_count", "locked_until", "deleted_at"}
        return {k: v for k, v in user.items() if k not in excluded}

    async def update_profile(self, user_id: int, data: dict) -> dict:
        user = await self.repo.get_user_by_id(user_id)
        if not user:
            raise NotFoundError("用户不存在")

        allowed = {
            "name", "email", "college", "major", "class_name",
            "grade", "phone", "bio", "target_role", "development_track", "interests",
        }
        updates = {k: v for k, v in data.items() if k in allowed}
        await self.repo.update_user(user_id, updates)
        return await self.get_public_profile(user_id)

    async def change_password(self, user_id: int, current_pwd: str, new_pwd: str) -> None:
        user = await self.repo.get_user_by_id(user_id)
        if not user:
            raise NotFoundError("用户不存在")
        if not verify_password(current_pwd, user["password_salt"], user["password_hash"]):
            raise ValidationError("当前密码不正确")
        # Validate new password (simplified)
        if len(new_pwd) < 10:
            raise ValidationError("密码长度必须为 10-128 位")

        creds = derive_password(new_pwd)
        await self.repo.update_user(user_id, {
            "password_hash": creds["hash"],
            "password_salt": creds["salt"],
            "force_password_change": False,
        })
