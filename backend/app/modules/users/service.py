"""User service — business logic for user operations."""

from __future__ import annotations

import re

from sqlalchemy.ext.asyncio import AsyncSession

from ...core.exceptions import ForbiddenError, NotFoundError, ValidationError
from ...core.security import derive_password, validate_password_strength, verify_password
from .repository import UserRepository


PUBLIC_FIELD_MAP = {
    "student_id": "studentId",
    "account_status": "accountStatus",
    "account_review_note": "accountReviewNote",
    "account_reviewed_at": "accountReviewedAt",
    "account_reviewed_by": "accountReviewedBy",
    "force_password_change": "forcePasswordChange",
    "class_name": "className",
    "target_role": "targetRole",
    "development_track": "developmentTrack",
    "consent_at": "consentAt",
    "consent_version": "consentVersion",
    "privacy_version": "privacyVersion",
    "last_login_at": "lastLoginAt",
    "created_at": "createdAt",
    "updated_at": "updatedAt",
}


def public_user(user: dict) -> dict:
    excluded = {"password_hash", "password_salt", "failed_login_count", "locked_until", "deleted_at"}
    return {
        PUBLIC_FIELD_MAP.get(key, key): value.isoformat() if hasattr(value, "isoformat") else value
        for key, value in user.items()
        if key not in excluded
    }


class UserService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = UserRepository(db)

    async def get_public_profile(self, user_id: int) -> dict:
        user = await self.repo.get_user_by_id(user_id)
        if not user:
            raise NotFoundError("用户不存在")
        return public_user(user)

    async def update_profile(self, user_id: int, data: dict) -> dict:
        user = await self.repo.get_user_by_id(user_id)
        if not user:
            raise NotFoundError("用户不存在")

        aliases = {
            "className": "class_name",
            "targetRole": "target_role",
            "developmentTrack": "development_track",
        }
        normalized = {aliases.get(k, k): v for k, v in data.items()}
        allowed = {
            "name", "email", "college", "major", "class_name",
            "grade", "phone", "bio", "target_role", "development_track", "interests",
        }
        updates = {k: v for k, v in normalized.items() if k in allowed}
        if user["role"] != "student":
            for key in ("college", "major", "class_name", "grade"):
                updates.pop(key, None)
        for key in ("name", "email", "phone", "bio", "target_role", "development_track"):
            if key in updates and isinstance(updates[key], str):
                updates[key] = updates[key].strip()
        if "interests" in updates:
            if not isinstance(updates["interests"], list):
                raise ValidationError("兴趣标签格式错误")
            updates["interests"] = [str(item).strip()[:30] for item in updates["interests"] if str(item).strip()][:8]
        if updates.get("email") and not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", updates["email"]):
            raise ValidationError("邮箱格式不正确")
        await self.repo.update_user(user_id, updates)
        return await self.get_public_profile(user_id)

    async def change_password(self, user_id: int, current_pwd: str, new_pwd: str) -> None:
        user = await self.repo.get_user_by_id(user_id)
        if not user:
            raise NotFoundError("用户不存在")
        if not verify_password(current_pwd, user["password_salt"], user["password_hash"]):
            raise ValidationError("当前密码不正确")
        password_error = validate_password_strength(new_pwd)
        if password_error:
            raise ValidationError(password_error)

        creds = derive_password(new_pwd)
        await self.repo.update_user(user_id, {
            "password_hash": creds["hash"],
            "password_salt": creds["salt"],
            "force_password_change": False,
        })
