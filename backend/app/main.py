"""
FastAPI application entry point.

Creates the FastAPI app, registers middleware, exception handlers,
and includes all module routers.
"""

from __future__ import annotations

import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .core.config import get_settings
from .core.exceptions import AppError
from .core.logging import setup_logging


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup / shutdown events."""
    setup_logging()
    yield


app = FastAPI(
    title="薪火未来 API",
    description="Xinhuo Future — Student Growth & Career Decision Platform",
    version="0.4.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# ── CORS (compatible with existing frontend) ─────────────────
settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.WEB_ORIGIN, "http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "Cookie"],
)


# ── Global Exception Handler ─────────────────────────────────
@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "data": None,
            "message": exc.message,
            "error_code": exc.error_code,
            "request_id": request.headers.get("X-Request-ID", ""),
        },
    )


@app.exception_handler(Exception)
async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    # Log the full error but return a generic message
    import logging
    logger = logging.getLogger("xinhuo")
    logger.exception("Unhandled exception: %s", exc)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "data": None,
            "message": "服务器内部错误",
            "error_code": "internal_error",
            "request_id": request.headers.get("X-Request-ID", ""),
        },
    )


# ── Health Check ─────────────────────────────────────────────
@app.get("/health", tags=["system"])
async def health_check():
    """Basic health check — verifies the API is running."""
    return {
        "ok": True,
        "service": "xinhuo-api",
        "version": "0.4.0",
        "storage": "mysql",
        "mode": "fastapi",
    }


@app.get("/api/health", tags=["system"])
async def health_check_api():
    """Health check at /api/health for consistency with old paths."""
    return {
        "ok": True,
        "service": "xinhuo-api",
        "version": "0.4.0",
        "storage": "mysql",
        "mode": "fastapi",
    }


# ── Register Module Routers ──────────────────────────────────
# Each module registers its own router with appropriate prefix.
# Import order matters — auth must come first for middleware.

from .modules.auth.router import router as auth_router
from .modules.users.router import router as users_router
from .modules.reference.router import router as reference_router
from .modules.organization.router import router as organization_router
from .modules.files.router import router as files_router
from .modules.imports.router import router as imports_router

app.include_router(auth_router, prefix="/api/v1")
app.include_router(users_router, prefix="/api/v1")
app.include_router(reference_router, prefix="/api/v1")
app.include_router(organization_router, prefix="/api/v1")
app.include_router(files_router, prefix="/api/v1")
app.include_router(imports_router, prefix="/api/v1")
