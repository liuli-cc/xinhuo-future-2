"""
FastAPI dependency for authentication.

Injects the current authenticated user into route handlers.
"""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import Cookie, Depends, Header, Request
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.exceptions import (
    AccountPendingError,
    AccountRejectedError,
    AccountSuspendedError,
    AuthError,
    ConflictError,
)
from ...core.config import get_settings
from ...core.security import hash_token
from ...db.session import get_db
from ..users.repository import UserRepository
from ..users.service import UserService

logger = logging.getLogger("xinhuo.auth")

SESSION_COOKIE = get_settings().SESSION_COOKIE_NAME


async def get_current_user(
    request: Request,
    authorization: str | None = Header(default=None),
    xinhuo_session: str | None = Cookie(default=None, alias=SESSION_COOKIE),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """FastAPI dependency: returns the current authenticated user or raises AuthError.

    Supports both Bearer token and HttpOnly cookie authentication,
    matching the existing CloudBase backend behavior.
    """
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:].strip()
        request.state.auth_mode = "bearer"
    if not token and xinhuo_session:
        token = xinhuo_session
        request.state.auth_mode = "cookie"

    if not token:
        raise AuthError("请先登录")

    session_id = hash_token(token)
    request.state.session_id = session_id
    repo = UserRepository(db)
    session = await repo.get_session(session_id)

    if not session:
        raise AuthError("请先登录")

    import time
    now_ms = int(time.time() * 1000)
    if session.get("expires_at") and int(session["expires_at"]) <= now_ms:
        raise AuthError("登录已过期，请重新登录")

    if session.get("revoked_at"):
        raise AuthError("会话已失效，请重新登录")

    user_id = session["user_id"]
    user = await repo.get_user_by_id(user_id)
    if not user:
        raise AuthError("用户不存在")

    if user.get("deleted_at"):
        raise AuthError("账号已注销")

    status = user.get("account_status", "active")
    if status == "pending":
        raise AccountPendingError()
    if status == "rejected":
        note = user.get("account_review_note", "")
        raise AccountRejectedError(f"账号审核未通过{f'：{note}' if note else ''}")
    if status == "suspended":
        note = user.get("account_review_note", "")
        raise AccountSuspendedError(f"账号已被停用{f'：{note}' if note else ''}，请联系平台管理员")

    if user.get("force_password_change"):
        allowed = {
            "/api/v1/auth/me",
            "/api/v1/auth/logout",
            "/api/v1/account",
            "/api/v1/account/sessions",
        }
        if request.url.path not in allowed:
            raise ConflictError("首次登录必须先修改临时密码")

    # Touch last_seen
    await repo.touch_session(session_id, now_ms)

    return user


CurrentUser = Annotated[dict, Depends(get_current_user)]


async def get_optional_user(
    request: Request,
    authorization: str | None = Header(default=None),
    xinhuo_session: str | None = Cookie(default=None, alias=SESSION_COOKIE),
    db: AsyncSession = Depends(get_db),
) -> dict | None:
    """Like get_current_user but returns None instead of raising AuthError."""
    try:
        return await get_current_user(request, authorization, xinhuo_session, db)
    except (AuthError, AccountPendingError, AccountRejectedError, AccountSuspendedError):
        return None
