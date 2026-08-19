"""
Application configuration loaded from environment variables.

Never hardcode secrets. All sensitive values come from env vars or .env file.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Central application settings."""

    # ── Application ──────────────────────────────────────────
    APP_NAME: str = "xinhuo-api"
    APP_VERSION: str = "0.7.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"  # development | staging | production

    # ── Server ───────────────────────────────────────────────
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    WEB_ORIGIN: str = "http://localhost:3000"
    TRUSTED_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"
    TRUST_PROXY_HEADERS: bool = False

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
    SESSION_COOKIE_SECURE: bool = False
    RETURN_SESSION_TOKEN: bool = True
    LOGIN_RATE_LIMIT: int = 10
    LOGIN_RATE_WINDOW_SECONDS: int = 300

    # ── Tencent Cloud COS ────────────────────────────────────
    COS_SECRET_ID: str = ""
    COS_SECRET_KEY: str = ""
    COS_BUCKET: str = ""
    COS_REGION: str = "ap-guangzhou"
    FILE_STORAGE_BACKEND: str = "local"  # local | cos
    LOCAL_STORAGE_PATH: str = "./storage"
    MAX_UPLOAD_BYTES: int = 5 * 1024 * 1024

    # ── LLM / AI ─────────────────────────────────────────────
    LLM_API_KEY: str = ""
    DEEPSEEK_API_KEY: str = ""
    LLM_PROVIDER: str = "deepseek"
    LLM_MODEL: str = "deepseek-chat"
    LLM_TIMEOUT_SECONDS: int = 30
    LLM_MAX_CONCURRENCY: int = 4
    ALLOW_CLIENT_LLM_KEYS: bool = False

    # ── Tencent Cloud ASR / TTS ──────────────────────────────
    TENCENT_SECRET_ID: str = ""
    TENCENT_SECRET_KEY: str = ""

    # ── Logging ──────────────────────────────────────────────
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"  # json | console
    METRICS_TOKEN: str = ""

    # ── Privacy / operations ────────────────────────────────
    PRIVACY_VERSION: str = "2026-08-13"
    TERMS_VERSION: str = "2026-08-13"
    ACCOUNT_DELETION_GRACE_DAYS: int = 7
    AUDIT_RETENTION_DAYS: int = 365

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }

    @property
    def trusted_origins(self) -> list[str]:
        values = [self.WEB_ORIGIN, *self.TRUSTED_ORIGINS.split(",")]
        return list(dict.fromkeys(value.strip().rstrip("/") for value in values if value.strip()))

    @property
    def local_storage_path(self) -> Path:
        return Path(self.LOCAL_STORAGE_PATH).expanduser().resolve()

    def validate_runtime(self) -> None:
        """Fail fast for unsafe production settings.

        Development keeps convenient defaults. Production must explicitly
        provide secrets, HTTPS origins, and durable object storage.
        """
        if self.ENVIRONMENT != "production":
            return
        errors: list[str] = []
        if self.DEBUG:
            errors.append("DEBUG must be false")
        if self.SECRET_KEY.startswith("change-me-") or len(self.SECRET_KEY) < 48:
            errors.append("SECRET_KEY must be a random value of at least 48 characters")
        if self.MYSQL_PASSWORD == "xinhuo-dev-pwd" and not self.DATABASE_URL:
            errors.append("default database password is forbidden")
        if not self.SESSION_COOKIE_SECURE:
            errors.append("SESSION_COOKIE_SECURE must be true")
        if self.RETURN_SESSION_TOKEN:
            errors.append("RETURN_SESSION_TOKEN must be false")
        if any(not origin.startswith("https://") for origin in self.trusted_origins):
            errors.append("all trusted origins must use HTTPS")
        if len(self.METRICS_TOKEN) < 32:
            errors.append("METRICS_TOKEN must contain at least 32 characters")
        if self.FILE_STORAGE_BACKEND != "cos":
            errors.append("production FILE_STORAGE_BACKEND must be cos")
        if self.FILE_STORAGE_BACKEND == "cos" and not all(
            (self.COS_SECRET_ID, self.COS_SECRET_KEY, self.COS_BUCKET, self.COS_REGION)
        ):
            errors.append("COS credentials, bucket and region are required")
        if errors:
            raise RuntimeError("Unsafe production configuration: " + "; ".join(errors))


@lru_cache
def get_settings() -> Settings:
    return Settings()
