"""Xinhuo Future FastAPI application entry point."""

from __future__ import annotations

import logging
import secrets
import time
import uuid
from collections import defaultdict, deque
from contextlib import asynccontextmanager

from fastapi import FastAPI, Header, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
from pydantic import ValidationError as PydanticValidationError
from sqlalchemy import text

from .core.config import get_settings
from .core.exceptions import AppError, RateLimitError
from .core.logging import setup_logging
from .db.session import get_session_factory

settings = get_settings()
logger = logging.getLogger("xinhuo")

REQUEST_COUNT: dict[tuple[str, int], int] = defaultdict(int)
REQUEST_DURATION_SUM: dict[str, float] = defaultdict(float)
LOGIN_ATTEMPTS: dict[str, deque[float]] = defaultdict(deque)


def _apply_security_headers(response, request: Request, request_id: str):
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), payment=()"
    if request.url.path.startswith(("/api/", "/health", "/metrics")):
        response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
    if request.url.path.startswith("/api/"):
        response.headers.setdefault("Cache-Control", "private, no-store")
    if settings.ENVIRONMENT == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    settings.validate_runtime()
    if settings.FILE_STORAGE_BACKEND == "local":
        settings.local_storage_path.mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(
    title="薪火未来 API",
    description="Xinhuo Future — Student Growth & Career Decision Platform",
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
    openapi_url="/openapi.json" if settings.ENVIRONMENT != "production" else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.trusted_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "Cookie", "X-Request-ID"],
    expose_headers=["X-Request-ID"],
)


@app.middleware("http")
async def security_observability_middleware(request: Request, call_next):
    supplied_request_id = request.headers.get("x-request-id", "")[:64]
    request_id = supplied_request_id if supplied_request_id and all(char.isalnum() or char in "-_" for char in supplied_request_id) else uuid.uuid4().hex
    request.state.request_id = request_id
    started = time.perf_counter()

    bearer_auth = request.headers.get("authorization", "").startswith("Bearer ")
    if request.method in {"POST", "PUT", "PATCH", "DELETE"} and request.cookies.get(settings.SESSION_COOKIE_NAME) and not bearer_auth:
        origin = request.headers.get("origin")
        if not origin or origin.rstrip("/") not in settings.trusted_origins:
            return _apply_security_headers(
                JSONResponse(status_code=403, content={"success": False, "error": "请求来源校验失败", "error_code": "csrf_origin_rejected", "request_id": request_id}),
                request, request_id,
            )

    login_bucket = None
    if request.url.path.endswith("/auth/login") and request.method == "POST":
        forwarded = request.headers.get("x-forwarded-for", "").split(",", 1)[0].strip() if settings.TRUST_PROXY_HEADERS else ""
        key = forwarded or (request.client.host if request.client else "unknown")
        now = time.monotonic()
        bucket = LOGIN_ATTEMPTS[key]
        login_bucket = bucket
        while bucket and now - bucket[0] > settings.LOGIN_RATE_WINDOW_SECONDS:
            bucket.popleft()
        if len(bucket) >= settings.LOGIN_RATE_LIMIT:
            exc = RateLimitError("登录请求过于频繁，请稍后再试")
            return _apply_security_headers(
                JSONResponse(status_code=exc.status_code, content={"success": False, "error": exc.message, "message": exc.message, "error_code": exc.error_code, "request_id": request_id}),
                request, request_id,
            )
        bucket.append(now)

    try:
        response = await call_next(request)
    finally:
        duration = time.perf_counter() - started
    route_object = request.scope.get("route")
    route = getattr(route_object, "path", request.url.path)
    if login_bucket is not None and response.status_code < 400:
        login_bucket.clear()
    REQUEST_COUNT[(route, response.status_code)] += 1
    REQUEST_DURATION_SUM[route] += duration
    _apply_security_headers(response, request, request_id)
    if not route.startswith("/health"):
        logger.info({"event": "http_request", "request_id": request_id, "method": request.method, "path": route, "status": response.status_code, "duration_ms": round(duration * 1000, 2)})
    return response


@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False, "data": None, "error": exc.message, "message": exc.message,
            "error_code": exc.error_code, "request_id": getattr(request.state, "request_id", ""),
        },
    )


@app.exception_handler(RequestValidationError)
@app.exception_handler(PydanticValidationError)
async def pydantic_error_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "data": None,
            "error": "请求字段格式不正确",
            "message": "请求字段格式不正确",
            "error_code": "request_validation_error",
            "request_id": getattr(request.state, "request_id", ""),
        },
    )


@app.exception_handler(Exception)
async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled exception: %s", exc)
    return JSONResponse(status_code=500, content={"success": False, "data": None, "error": "服务器内部错误", "message": "服务器内部错误", "error_code": "internal_error", "request_id": getattr(request.state, "request_id", "")})


def _health() -> dict:
    return {"ok": True, "service": settings.APP_NAME, "version": settings.APP_VERSION, "storage": "mysql", "fileStorage": settings.FILE_STORAGE_BACKEND, "mode": "fastapi"}


@app.get("/health", tags=["system"])
@app.get("/health/live", tags=["system"])
@app.get("/api/health", tags=["system"])
async def health_live():
    return _health()


@app.get("/health/ready", tags=["system"])
async def health_ready():
    try:
        async with get_session_factory()() as db:
            await db.execute(text("SELECT 1"))
    except Exception:
        return JSONResponse(status_code=503, content={**_health(), "ok": False, "database": "unavailable"})
    return {**_health(), "database": "ready"}


@app.get("/metrics", response_class=PlainTextResponse, include_in_schema=False)
async def metrics(authorization: str | None = Header(default=None)):
    if settings.METRICS_TOKEN:
        supplied = authorization[7:] if authorization and authorization.startswith("Bearer ") else ""
        if not secrets.compare_digest(supplied, settings.METRICS_TOKEN):
            return PlainTextResponse("unauthorized\n", status_code=401)
    lines = ["# HELP xinhuo_http_requests_total Total HTTP requests", "# TYPE xinhuo_http_requests_total counter"]
    for (route, status), count in sorted(REQUEST_COUNT.items()):
        safe_route = route.replace('"', '')
        lines.append(f'xinhuo_http_requests_total{{route="{safe_route}",status="{status}"}} {count}')
    lines += ["# HELP xinhuo_http_request_duration_seconds_sum Sum of request durations", "# TYPE xinhuo_http_request_duration_seconds_sum counter"]
    for route, duration in sorted(REQUEST_DURATION_SUM.items()):
        lines.append(f'xinhuo_http_request_duration_seconds_sum{{route="{route.replace(chr(34), "")}"}} {duration:.6f}')
    return "\n".join(lines) + "\n"


from .modules.admin.router import router as admin_router
from .modules.auth.router import router as auth_router
from .modules.career.router import router as career_router
from .modules.files.router import router as files_router, upload_evidence_file
from .modules.growth.router import router as growth_router
from .modules.imports.router import router as imports_router
from .modules.interview.router import router as interview_router
from .modules.organization.router import router as organization_router
from .modules.platform_router import router as platform_router
from .modules.reference.router import router as reference_router
from .modules.resume.router import router as resume_router
from .modules.users.account_router import router as account_router
from .modules.users.router import router as users_router

for module_router in (
    auth_router, users_router, account_router, reference_router, organization_router,
    files_router, imports_router, growth_router, career_router, interview_router,
    resume_router, admin_router, platform_router,
):
    app.include_router(module_router, prefix="/api/v1")

# Compatibility alias used by the river frontend's multipart endpoint.
app.add_api_route(
    "/api/v1/evidence-files",
    upload_evidence_file,
    methods=["POST"],
    tags=["files"],
    include_in_schema=True,
)
