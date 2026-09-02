"""
Unified exception hierarchy for the application.

All HTTP-facing exceptions inherit from AppError and are caught
by the global exception handler registered in main.py.
"""

from __future__ import annotations

from typing import Any


class AppError(Exception):
    """Base application error with HTTP status code and error code."""

    status_code: int = 500
    error_code: str = "internal_error"
    message: str = "服务器内部错误"

    def __init__(
        self,
        message: str | None = None,
        error_code: str | None = None,
        status_code: int | None = None,
        details: Any = None,
    ):
        self.message = message or self.message
        self.error_code = error_code or self.error_code
        self.status_code = status_code or self.status_code
        self.details = details
        super().__init__(self.message)


# ── Auth / Permission ───────────────────────────────────────

class AuthError(AppError):
    status_code = 401
    error_code = "unauthorized"
    message = "请先登录"


class ForbiddenError(AppError):
    status_code = 403
    error_code = "forbidden"
    message = "没有权限执行此操作"


class TokenExpiredError(AuthError):
    error_code = "token_expired"
    message = "登录已过期，请重新登录"


class AccountPendingError(AppError):
    status_code = 403
    error_code = "account_pending"
    message = "账号正在等待审核"


class AccountRejectedError(AppError):
    status_code = 403
    error_code = "account_rejected"
    message = "账号审核未通过"


class AccountSuspendedError(AppError):
    status_code = 403
    error_code = "account_suspended"
    message = "账号已被停用"


class RateLimitError(AppError):
    status_code = 429
    error_code = "rate_limited"
    message = "尝试次数过多，请稍后再试"


# ── Resource ────────────────────────────────────────────────

class NotFoundError(AppError):
    status_code = 404
    error_code = "not_found"
    message = "资源不存在"


class ConflictError(AppError):
    status_code = 409
    error_code = "conflict"
    message = "资源冲突"


class ValidationError(AppError):
    status_code = 400
    error_code = "validation_error"
    message = "请求参数无效"


# ── File / Storage ──────────────────────────────────────────

class FileTooLargeError(AppError):
    status_code = 413
    error_code = "file_too_large"
    message = "文件大小超过限制"


class InvalidFileTypeError(AppError):
    status_code = 400
    error_code = "invalid_file_type"
    message = "不支持的文件类型"


# ── External Service ────────────────────────────────────────

class ExternalServiceError(AppError):
    status_code = 502
    error_code = "external_service_error"
    message = "外部服务暂时不可用"


class LLMServiceError(ExternalServiceError):
    error_code = "llm_service_error"
    message = "模型服务暂时不可用"


class COSError(ExternalServiceError):
    error_code = "cos_error"
    message = "文件存储服务异常"
