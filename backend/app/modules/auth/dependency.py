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
)
from ...core.security import hash_token
from ...db.session import get_db
from ..users.repository import UserRepository
from ..users.service import UserService

logger = logging.getLogger("xinhuo.auth")

SESSION_COOKIE = "xinhuo_session"


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
    if not token and xinhuo_session:
        token = xinhuo_session

    if not token:
        raise AuthError("请先登录")

    session_id = hash_token(token)
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
    except AuthError:
        return None
