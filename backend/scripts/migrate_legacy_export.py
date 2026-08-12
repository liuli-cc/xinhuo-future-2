#!/usr/bin/env python3
"""Validate or import a JSON export from the legacy CloudBase backend.

Dry-run is the default. Use ``--apply`` only after taking a database backup.
Accepted top-level arrays: users, growthTasks, evidence, cloudStates.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from pathlib import Path

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.security import derive_password
from app.modules.evidence.model import Evidence
from app.modules.growth.model import CloudState, GrowthTask
from app.modules.users.model import User


def database_url() -> str:
    value = os.getenv("DATABASE_URL", "")
    if value:
        return value.replace("mysql+aiomysql://", "mysql+pymysql://")
    return (
        f"mysql+pymysql://{os.getenv('MYSQL_USER', 'xinhuo')}:{os.getenv('MYSQL_PASSWORD', 'xinhuo-dev-pwd')}"
        f"@{os.getenv('MYSQL_HOST', 'localhost')}:{os.getenv('MYSQL_PORT', '3306')}/"
        f"{os.getenv('MYSQL_DATABASE', 'xinhuo')}?charset=utf8mb4"
    )


def clean(value, limit: int) -> str:
    return str(value or "").strip()[:limit]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("export", type=Path)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true")
    mode.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    raw = args.export.read_bytes()
    payload = json.loads(raw)
    if not isinstance(payload, dict):
        raise SystemExit("export root must be an object")
    digest = hashlib.sha256(raw).hexdigest()
    source_counts = {key: len(payload.get(key, [])) for key in ("users", "growthTasks", "evidence", "cloudStates")}
    print(json.dumps({"mode": "apply" if args.apply else "dry-run", "sha256": digest, "sourceCounts": source_counts}, ensure_ascii=False))

    errors: list[str] = []
    student_ids: set[str] = set()
    for index, item in enumerate(payload.get("users", [])):
        student_id = clean(item.get("studentId") or item.get("student_id"), 20)
        if len(student_id) < 6:
            errors.append(f"users[{index}] missing valid studentId")
        if student_id in student_ids:
            errors.append(f"duplicate user studentId: {student_id}")
        student_ids.add(student_id)
    if errors:
        print(json.dumps({"errors": errors[:100], "errorCount": len(errors)}, ensure_ascii=False))
        return 2
    if not args.apply:
        print("Dry-run passed; no database writes were performed.")
        return 0

    engine = create_engine(database_url(), pool_pre_ping=True)
    stats = {"usersInserted": 0, "usersSkipped": 0, "tasksUpserted": 0, "evidenceInserted": 0, "statesUpserted": 0}
    with Session(engine) as db, db.begin():
        by_student: dict[str, User] = {}
        for item in payload.get("users", []):
            student_id = clean(item.get("studentId") or item.get("student_id"), 20)
            user = db.scalar(select(User).where(User.student_id == student_id))
            if user:
                stats["usersSkipped"] += 1
            else:
                credentials = derive_password(clean(item.get("temporaryPassword"), 128) or hashlib.sha256(f"legacy:{student_id}".encode()).hexdigest())
                user = User(
                    student_id=student_id, name=clean(item.get("name"), 30) or "待核验用户",
                    email=clean(item.get("email"), 120), role=clean(item.get("role"), 30) or "student",
                    account_status=clean(item.get("accountStatus"), 20) or "pending",
                    password_hash=credentials["hash"], password_salt=credentials["salt"],
                    force_password_change=True, college=clean(item.get("college"), 80),
                    major=clean(item.get("major"), 80), class_name=clean(item.get("className"), 80),
                    grade=clean(item.get("grade"), 20), phone="", bio=clean(item.get("bio"), 2000),
                    target_role=clean(item.get("targetRole"), 80) or "探索方向",
                    development_track=clean(item.get("developmentTrack"), 80) or "exploration",
                    interests=item.get("interests") if isinstance(item.get("interests"), list) else [],
                    consent_at=item.get("consentAt"), consent_version="legacy-import", privacy_version="legacy-import",
                )
                db.add(user)
                db.flush()
                stats["usersInserted"] += 1
            by_student[student_id] = user

        for item in payload.get("growthTasks", []):
            student_id = clean(item.get("studentId"), 20)
            user = by_student.get(student_id)
            if not user:
                continue
            task_id = clean(item.get("taskId"), 80)
            key = f"{user.id}:{task_id}"
            task = db.get(GrowthTask, key)
            values = dict(user_id=user.id, task_id=task_id, semester_index=max(0, min(7, int(item.get("semesterIndex", 0)))), title=clean(item.get("title"), 120) or task_id, note=clean(item.get("note"), 1000), type=clean(item.get("type"), 30), xp=max(0, min(200, int(item.get("xp", 0)))), is_custom=bool(item.get("isCustom")))
            if task:
                for key_name, value in values.items():
                    setattr(task, key_name, value)
            else:
                db.add(GrowthTask(id=key, **values))
            stats["tasksUpserted"] += 1

        existing_refs = set(db.scalars(select(Evidence.evidence_ref).where(Evidence.evidence_ref.like("legacy:%"))))
        for index, item in enumerate(payload.get("evidence", [])):
            user = by_student.get(clean(item.get("studentId"), 20))
            if not user:
                continue
            legacy_id = clean(item.get("id"), 100) or str(index)
            marker = f"legacy:{legacy_id}"
            if marker in existing_refs:
                continue
            db.add(Evidence(
                user_id=user.id, student_id=user.student_id, task_id=clean(item.get("taskId"), 80) or None,
                task_title=clean(item.get("taskTitle"), 120) or None, title=clean(item.get("title"), 120) or "旧系统佐证",
                category=clean(item.get("category"), 40) or "其他", dimension=clean(item.get("dimension"), 40) or "项目实践",
                detail=clean(item.get("detail"), 5000) or "由旧系统导入", evidence_ref=marker,
                evidence_date=clean(item.get("evidenceDate"), 20) or "1970-01-01",
                source_type=clean(item.get("sourceType"), 40) or "self_report",
                source_reliability=max(0, min(100, int(item.get("sourceReliability", 45)))),
                relevance=max(0, min(100, int(item.get("relevance", 80)))), quality=max(0, min(100, int(item.get("quality", 75)))),
                contribution=max(0, min(100, int(item.get("contribution", 70)))),
                verification_status=clean(item.get("verificationStatus"), 20) or "pending",
            ))
            stats["evidenceInserted"] += 1

        for item in payload.get("cloudStates", []):
            user = by_student.get(clean(item.get("studentId"), 20))
            key_name = clean(item.get("key") or item.get("stateKey"), 80)
            if not user or key_name not in {"ai_chat", "resource_saved", "career_saved", "career_applied", "interview_history"}:
                continue
            key = f"{user.id}:{key_name}"
            state = db.get(CloudState, key)
            encoded = json.dumps(item.get("value"), ensure_ascii=False)
            if state:
                state.value = encoded
            else:
                db.add(CloudState(id=key, user_id=user.id, state_key=key_name, value=encoded))
            stats["statesUpserted"] += 1
    print(json.dumps({"committed": True, **stats}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
