"""User repository — database read/write operations for users and sessions."""

from __future__ import annotations

from datetime import datetime, timezone
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from .model import User, UserSession


class UserRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── User CRUD ────────────────────────────────────────────

    async def get_user_by_id(self, user_id: int) -> dict | None:
        stmt = select(User).where(User.id == user_id)
        result = await self.db.execute(stmt)
        user = result.scalar_one_or_none()
        return self._to_dict(user) if user else None

    async def get_user_by_student_id(self, student_id: str) -> dict | None:
        stmt = select(User).where(User.student_id == student_id)
        result = await self.db.execute(stmt)
        user = result.scalar_one_or_none()
        return self._to_dict(user) if user else None

    async def create_user(self, data: dict) -> dict:
        user = User(**data)
        self.db.add(user)
        await self.db.flush()
        await self.db.refresh(user)
        return self._to_dict(user)

    async def update_user(self, user_id: int, data: dict) -> dict | None:
        data["updated_at"] = datetime.now(timezone.utc)
        stmt = update(User).where(User.id == user_id).values(**data)
        await self.db.execute(stmt)
        await self.db.flush()
        return await self.get_user_by_id(user_id)

    async def list_users(self, deleted: bool = False, limit: int = 100) -> list[dict]:
        stmt = select(User)
        if not deleted:
            stmt = stmt.where(User.deleted_at.is_(None))
        stmt = stmt.order_by(User.created_at.desc()).limit(limit)
        result = await self.db.execute(stmt)
        return [self._to_dict(u) for u in result.scalars().all()]

    # ── Session CRUD ─────────────────────────────────────────

    async def get_session(self, session_id: str) -> dict | None:
        stmt = select(UserSession).where(UserSession.id == session_id)
        result = await self.db.execute(stmt)
        session = result.scalar_one_or_none()
        return self._session_to_dict(session) if session else None

    async def create_session(self, data: dict) -> dict:
        session = UserSession(**data)
        self.db.add(session)
        await self.db.flush()
        return self._session_to_dict(session)

    async def touch_session(self, session_id: str, now_ms: int) -> None:
        stmt = (
            update(UserSession)
            .where(UserSession.id == session_id)
            .values(last_seen_at=now_ms)
        )
        await self.db.execute(stmt)

    async def revoke_session(self, session_id: str) -> None:
        import time
        now_ms = int(time.time() * 1000)
        stmt = (
            update(UserSession)
            .where(UserSession.id == session_id)
            .values(revoked_at=now_ms)
        )
        await self.db.execute(stmt)

    async def revoke_other_sessions(self, user_id: int, current_session_id: str) -> None:
        import time
        now_ms = int(time.time() * 1000)
        stmt = (
            update(UserSession)
            .where(
                UserSession.user_id == user_id,
                UserSession.id != current_session_id,
                UserSession.revoked_at.is_(None),
            )
            .values(revoked_at=now_ms)
        )
        await self.db.execute(stmt)

    async def list_sessions(self, user_id: int) -> list[dict]:
        stmt = (
            select(UserSession)
            .where(UserSession.user_id == user_id, UserSession.revoked_at.is_(None))
            .order_by(UserSession.last_seen_at.desc())
        )
        result = await self.db.execute(stmt)
        return [self._session_to_dict(s) for s in result.scalars().all()]

    # ── Helpers ──────────────────────────────────────────────

    def _to_dict(self, user: User) -> dict:
        return {
            "id": user.id,
            "student_id": user.student_id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "account_status": user.account_status,
            "account_review_note": user.account_review_note,
            "account_reviewed_at": user.account_reviewed_at,
            "account_reviewed_by": user.account_reviewed_by,
            "force_password_change": user.force_password_change,
            "password_hash": user.password_hash,
            "password_salt": user.password_salt,
            "failed_login_count": user.failed_login_count,
            "locked_until": user.locked_until,
            "deleted_at": user.deleted_at,
            "college": user.college,
            "major": user.major,
            "class_name": user.class_name,
            "grade": user.grade,
            "phone": user.phone,
            "bio": user.bio,
            "target_role": user.target_role,
            "development_track": user.development_track,
            "interests": user.interests or [],
            "consent_at": user.consent_at,
            "consent_version": user.consent_version,
            "privacy_version": user.privacy_version,
            "last_login_at": user.last_login_at,
            "created_at": user.created_at,
            "updated_at": user.updated_at,
        }

    def _session_to_dict(self, session: UserSession) -> dict:
        return {
            "id": session.id,
            "user_id": session.user_id,
            "expires_at": session.expires_at,
            "last_seen_at": session.last_seen_at,
            "revoked_at": session.revoked_at,
            "device_id": session.device_id,
            "device_name": session.device_name,
            "user_agent_hash": session.user_agent_hash,
            "ip_hash": session.ip_hash,
            "created_at": session.created_at,
            "updated_at": session.updated_at,
        }
