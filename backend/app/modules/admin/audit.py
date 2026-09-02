"""Write-only audit helpers used by business modules."""

from __future__ import annotations

import time
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from .model import AuditLog


async def record_audit(
    db: AsyncSession,
    action: str,
    *,
    actor_user_id: int | None,
    target_type: str,
    target_id: str | int | None = None,
    details: dict | None = None,
) -> None:
    safe_details = {
        key: value
        for key, value in (details or {}).items()
        if key.lower() not in {"password", "token", "secret", "apikey", "api_key"}
    }
    db.add(
        AuditLog(
            id=uuid.uuid4().hex,
            action=action[:100],
            actor_user_id=actor_user_id,
            target_type=target_type[:40],
            target_id=str(target_id)[:100] if target_id is not None else None,
            details=safe_details or None,
            created_at=int(time.time() * 1000),
        )
    )
