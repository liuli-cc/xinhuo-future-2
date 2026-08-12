#!/usr/bin/env python3
"""Purge expired ephemeral records and age out audit logs.

Dry-run is the default. Use ``--apply`` from a scheduled maintenance job after
reviewing the printed counts. Account deletion remains an explicit admin flow.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import create_engine, delete, func, or_, select
from sqlalchemy.orm import Session

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import Settings
from app.modules.admin.model import AuditLog, RecoveryRequest
from app.modules.interview.model import ResumeUploadChunk
from app.modules.users.model import UserSession


def database_url() -> str:
    value = os.getenv("DATABASE_URL", "")
    if value:
        return value.replace("mysql+aiomysql://", "mysql+pymysql://")
    settings = Settings()
    return settings.database_url.replace("mysql+aiomysql://", "mysql+pymysql://")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="delete rows instead of reporting only")
    args = parser.parse_args()
    now_ms = int(time.time() * 1000)
    audit_cutoff = now_ms - Settings().AUDIT_RETENTION_DAYS * 86_400_000
    chunk_cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    recovery_cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    predicates = {
        "sessions": (UserSession, or_(UserSession.expires_at < now_ms, UserSession.revoked_at.is_not(None))),
        "resumeChunks": (ResumeUploadChunk, ResumeUploadChunk.created_at < chunk_cutoff),
        "auditLogs": (AuditLog, AuditLog.created_at < audit_cutoff),
        "completedRecoveryRequests": (
            RecoveryRequest,
            RecoveryRequest.completed_at.is_not(None) & (RecoveryRequest.updated_at < recovery_cutoff),
        ),
    }
    engine = create_engine(database_url(), pool_pre_ping=True)
    counts: dict[str, int] = {}
    with Session(engine) as db, db.begin():
        for name, (model, predicate) in predicates.items():
            counts[name] = int(db.scalar(select(func.count()).select_from(model).where(predicate)) or 0)
            if args.apply:
                db.execute(delete(model).where(predicate))
    print(json.dumps({"mode": "apply" if args.apply else "dry-run", "counts": counts}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
