"""
Authentication and security utilities.

Mirrors the existing PBKDF2-SHA256 password hashing from the
CloudBase Node.js backend to maintain backward compatibility.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import os
import secrets
from datetime import datetime, timezone

from .config import get_settings


def _base64url(data: bytes) -> str:
    """Base64url-encode bytes (no padding)."""
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _base64url_decode(value: str) -> bytes:
    """Decode a base64url string."""
    padding = 4 - len(value) % 4
    if padding != 4:
        value += "=" * padding
    return base64.urlsafe_b64decode(value)


def random_token(byte_length: int = 32) -> str:
    """Generate a cryptographically random base64url token."""
    return _base64url(secrets.token_bytes(byte_length))


def sha256_hex(data: bytes, key: bytes | None = None) -> str:
    """SHA-256 hex digest, optionally as HMAC."""
    if key:
        return hmac.new(key, data, hashlib.sha256).hexdigest()
    return hashlib.sha256(data).hexdigest()


def hash_token(value: str) -> str:
    """SHA-256 hash a session token to produce the session ID."""
    return _base64url(hashlib.sha256(value.encode()).digest())


def password_hash(password: str, salt: str, iterations: int | None = None) -> str:
    """Derive a PBKDF2-SHA256 password hash (base64url encoded)."""
    if iterations is None:
        iterations = get_settings().PASSWORD_ITERATIONS
    dk = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode(),
        _base64url_decode(salt),
        iterations,
        dklen=32,
    )
    return _base64url(dk)


def derive_password(password: str) -> dict[str, str]:
    """Create salt + hash for a new password."""
    salt = random_token(16)
    return {"salt": salt, "hash": password_hash(password, salt)}


def verify_password(password: str, salt: str, expected: str) -> bool:
    """Verify password against stored hash (constant-time comparison).

    Also checks against legacy iteration count for backward compatibility.
    """
    settings = get_settings()
    current = password_hash(password, salt, settings.PASSWORD_ITERATIONS)
    if _constant_time_equal(current, expected):
        return True
    # Legacy compatibility
    legacy = password_hash(password, salt, settings.LEGACY_PASSWORD_ITERATIONS)
    return _constant_time_equal(legacy, expected)


def _constant_time_equal(a: str, b: str) -> bool:
    """Constant-time string comparison."""
    return hmac.compare_digest(a.encode(), b.encode())


def generate_session_token() -> str:
    """Generate a new session token."""
    return random_token(32)


def mask_sensitive(value: str | None, visible: int = 3) -> str:
    """Mask sensitive data for safe logging/display.

    Examples:
        mask_sensitive("13800138000") -> "138*****000"
        mask_sensitive("110101199001011234") -> "110************234"
    """
    if not value:
        return ""
    length = len(value)
    if length <= 6:
        return value[0] + "*" * (length - 2) + value[-1] if length > 2 else "***"
    return value[:visible] + "*" * (length - visible * 2) + value[-visible:]
