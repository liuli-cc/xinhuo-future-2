"""
Structured logging configuration.

Sensitive fields (passwords, tokens, IDs, phone numbers) are
automatically masked before they reach log output.
"""

from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timezone

from .config import get_settings

SENSITIVE_FIELD_PATTERNS = [
    "password",
    "token",
    "secret",
    "api_key",
    "apikey",
    "authorization",
    "cookie",
    "id_card",
    "phone",
    "email",
]


def _should_mask(key: str) -> bool:
    lower = key.lower().replace("-", "").replace("_", "")
    return any(pattern in lower for pattern in SENSITIVE_FIELD_PATTERNS)


class SensitiveDataFilter(logging.Filter):
    """Redact sensitive field values from log records."""

    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, dict):
            record.msg = _redact_dict(record.msg)
        if record.args and isinstance(record.args, dict):
            record.args = _redact_dict(record.args)
        return True


def _redact_dict(data: dict) -> dict:
    result = {}
    for key, value in data.items():
        if _should_mask(str(key)):
            result[key] = "***REDACTED***"
        elif isinstance(value, dict):
            result[key] = _redact_dict(value)
        elif isinstance(value, list):
            result[key] = [
                _redact_dict(item) if isinstance(item, dict) else item
                for item in value
            ]
        else:
            result[key] = value
    return result


class JsonFormatter(logging.Formatter):
    """JSON log formatter for structured logging."""

    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }
        if record.exc_info and record.exc_info[1]:
            log_entry["exception"] = str(record.exc_info[1])
        return json.dumps(log_entry, ensure_ascii=False)


def setup_logging() -> None:
    """Configure application logging."""
    settings = get_settings()
    level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)

    root = logging.getLogger()
    root.setLevel(level)

    # Remove existing handlers
    for handler in root.handlers[:]:
        root.removeHandler(handler)

    handler = logging.StreamHandler(sys.stdout)
    handler.addFilter(SensitiveDataFilter())

    if settings.LOG_FORMAT == "json":
        handler.setFormatter(JsonFormatter())
    else:
        handler.setFormatter(
            logging.Formatter(
                "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
                datefmt="%Y-%m-%dT%H:%M:%S",
            )
        )

    root.addHandler(handler)

    # Quiet noisy libraries
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
