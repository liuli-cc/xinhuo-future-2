"""
Auth router — registration, login, logout, and session check.

API paths are kept compatible with the existing CloudBase backend:
  POST /auth/register
  POST /auth/login
  GET  /auth/me
  POST /auth/logout
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.config import get_settings
from ...core.exceptions import AuthError, ConflictError, ValidationError
from ...core.security import hash_token, sha256_hex
from ...db.session import get_db
from .dependency import CurrentUser, SESSION_COOKIE, get_current_user
from .schema import LoginRequest, MeResponse, PublicUser, RegisterRequest
from .service import AuthService
from ..users.repository import UserRepository
from ..users.service import public_user

router = APIRouter(prefix="/auth", tags=["auth"])


def _public_user(user: dict) -> dict:
    return public_user(user)


@router.get("/me", response_model=dict)
async def auth_me(current_user: CurrentUser):
    """Return the currently authenticated user profile."""
    return {"user": _public_user(current_user)}


@router.post("/login")
async def auth_login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Authenticate with studentId + password.

    Returns sessionToken and sets HttpOnly cookie.
    """
    service = AuthService(db)
    agent = request.headers.get("user-agent", "")
    forwarded = request.headers.get("x-forwarded-for", "").split(",", 1)[0].strip() if get_settings().TRUST_PROXY_HEADERS else ""
    peer = forwarded or (request.client.host if request.client else "")
    result = await service.login(
        payload.studentId,
        payload.password,
        device_name="Web Browser",
        user_agent_hash=sha256_hex(agent.encode()) if agent else "",
        ip_hash=sha256_hex(peer.encode(), get_settings().SECRET_KEY.encode()) if peer else "",
    )
    if not result:
        raise AuthError("学号或密码错误")

    user, token = result

    # Set cookie (7 days)
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        httponly=True,
        samesite="lax",
        max_age=get_settings().SESSION_MAX_AGE_SECONDS,
        secure=get_settings().SESSION_COOKIE_SECURE,
        path="/",
    )

    result = {"user": _public_user(user)}
    if get_settings().RETURN_SESSION_TOKEN:
        result["sessionToken"] = token
    return result


@router.post("/logout")
async def auth_logout(
    response: Response,
    request: Request,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Logout — revoke current session and clear cookie."""
    session_id = getattr(request.state, "session_id", "")
    if session_id:
        await UserRepository(db).revoke_session(session_id)
    response.delete_cookie(
        key=SESSION_COOKIE,
        path="/",
        httponly=True,
        samesite="lax",
        secure=get_settings().SESSION_COOKIE_SECURE,
    )
    return {"ok": True}


@router.post("/register", status_code=201)
async def auth_register(
    payload: RegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    """Register a new student or teacher account (pending approval)."""
    service = AuthService(db)

    if payload.password != payload.confirmPassword:
        raise ValidationError("两次输入的密码不一致，请重新确认")
    if not payload.consent:
        raise ValidationError("请先阅读并同意服务协议与隐私政策")

    result = await service.register(payload.model_dump())
    if "error" in result:
        if result.get("status") == 409:
            raise ConflictError(result["error"])
        raise ValidationError(result["error"])

    return result
