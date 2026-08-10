"""
Application configuration loaded from environment variables.

Never hardcode secrets. All sensitive values come from env vars or .env file.
"""

from __future__ import annotations

import os
from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Central application settings."""

    # ── Application ──────────────────────────────────────────
    APP_NAME: str = "xinhuo-api"
    APP_VERSION: str = "0.4.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"  # development | staging | production

    # ── Server ───────────────────────────────────────────────
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    WEB_ORIGIN: str = "http://localhost:3000"

    # ── Database ─────────────────────────────────────────────
    DATABASE_URL: str = ""  # Full DSN; if set, takes priority
    MYSQL_HOST: str = "mysql"
    MYSQL_PORT: int = 3306
    MYSQL_DATABASE: str = "xinhuo"
    MYSQL_USER: str = "xinhuo"
    MYSQL_PASSWORD: str = "xinhuo-dev-pwd"

    @property
    def database_url(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL
        return (
            f"mysql+pymysql://{self.MYSQL_USER}:{self.MYSQL_PASSWORD}"
            f"@{self.MYSQL_HOST}:{self.MYSQL_PORT}/{self.MYSQL_DATABASE}"
            "?charset=utf8mb4"
        )

    # ── Session / Auth ───────────────────────────────────────
    SESSION_COOKIE_NAME: str = "xinhuo_session"
    SESSION_MAX_AGE_SECONDS: int = 7 * 24 * 60 * 60  # 7 days
    PASSWORD_ITERATIONS: int = 310_000
    LEGACY_PASSWORD_ITERATIONS: int = 60_000
    SECRET_KEY: str = "change-me-in-production-use-random-64-chars"

    # ── Tencent Cloud COS ────────────────────────────────────
    COS_SECRET_ID: str = ""
    COS_SECRET_KEY: str = ""
    COS_BUCKET: str = ""
    COS_REGION: str = "ap-guangzhou"

    # ── LLM / AI ─────────────────────────────────────────────
    LLM_API_KEY: str = ""
    DEEPSEEK_API_KEY: str = ""

    # ── Tencent Cloud ASR / TTS ──────────────────────────────
    TENCENT_SECRET_ID: str = ""
    TENCENT_SECRET_KEY: str = ""

    # ── Logging ──────────────────────────────────────────────
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"  # json | console

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


@lru_cache
def get_settings() -> Settings:
    return Settings()
