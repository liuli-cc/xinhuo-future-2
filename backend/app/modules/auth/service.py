"""
Auth service — registration, login, session management.
"""

from __future__ import annotations

import logging
import time

from sqlalchemy.ext.asyncio import AsyncSession

from ...core.security import (
    derive_password,
    generate_session_token,
    hash_token,
    verify_password,
)
from ..users.repository import UserRepository

logger = logging.getLogger("xinhuo.auth")


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = UserRepository(db)

    async def login(self, student_id: str, password: str) -> tuple[dict, str] | None:
        """Authenticate user and return (user_dict, session_token) or None."""
        user = await self.repo.get_user_by_student_id(student_id)
        if not user:
            return None

        # Check lockout
        locked_until = user.get("locked_until") or 0
        if locked_until > int(time.time() * 1000):
            return None

        # Verify password
        if not verify_password(password, user["password_salt"], user["password_hash"]):
            # Increment failed count
            attempts = (user.get("failed_login_count") or 0) + 1
            locked = int(time.time() * 1000) + 15 * 60 * 1000 if attempts >= 5 else None
            await self.repo.update_user(user["id"], {
                "failed_login_count": 0 if locked else attempts,
                "locked_until": locked,
            })
            return None

        # Check account status
        status = user.get("account_status", "active")
        if status != "active":
            return None  # Handled by dependency layer

        # Create session
        token = generate_session_token()
        session_id = hash_token(token)
        now_ms = int(time.time() * 1000)
        await self.repo.create_session({
            "id": session_id,
            "user_id": user["id"],
            "created_at": now_ms,
            "last_seen_at": now_ms,
            "expires_at": now_ms + 7 * 24 * 60 * 60 * 1000,
            "revoked_at": None,
            "device_id": "web",
            "device_name": "Web Browser",
            "user_agent_hash": "",
            "ip_hash": "",
        })

        # Clear lockout on success
        await self.repo.update_user(user["id"], {
            "failed_login_count": 0,
            "locked_until": None,
            "last_login_at": now_ms,
        })

        return user, token

    async def register(self, payload: dict) -> dict:
        """Register a new account (pending status)."""
        student_id = payload.get("studentId", "").strip()
        existing = await self.repo.get_user_by_student_id(student_id)
        if existing:
            return {"error": "该学号或工号已经注册，请直接登录或申请找回密码", "status": 409}

        credentials = derive_password(payload["password"])
        now_ms = int(time.time() * 1000)
        user_data = {
            "student_id": student_id,
            "name": payload.get("name", "").strip(),
            "email": payload.get("email", "").strip().lower(),
            "role": payload.get("accountType", "student"),
            "account_status": "pending",
            "account_review_note": None,
            "account_reviewed_at": None,
            "account_reviewed_by": None,
            "force_password_change": False,
            "password_hash": credentials["hash"],
            "password_salt": credentials["salt"],
            "failed_login_count": 0,
            "locked_until": None,
            "deleted_at": None,
            "college": payload.get("college", "").strip(),
            "major": payload.get("major", "").strip(),
            "class_name": payload.get("className", "").strip(),
            "grade": payload.get("grade", "").strip(),
            "phone": "",
            "bio": "",
            "target_role": "探索方向",
            "development_track": "exploration",
            "interests": [],
            "consent_at": now_ms,
            "last_login_at": None,
            "created_at": now_ms,
            "updated_at": now_ms,
        }

        user = await self.repo.create_user(user_data)
        return {
            "pending": True,
            "role": user["role"],
            "message": (
                "教师账号已提交，需由管理员核验工号、院系和负责班级后才能登录"
                if user["role"] == "teacher"
                else "学生账号已提交，需由本班教师或管理员审核通过后才能登录"
            ),
            "status": 201,
        }
