#!/usr/bin/env python3
"""Create the first administrator in an empty database.

The password is read interactively so it is not stored in shell history. This
script refuses to overwrite an existing account.
"""

from __future__ import annotations

import argparse
import getpass
import os
import sys
import time
from pathlib import Path

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import Settings
from app.core.security import derive_password, validate_password_strength
from app.modules.users.model import User


def database_url() -> str:
    value = os.getenv("DATABASE_URL", "")
    if value:
        return value.replace("mysql+aiomysql://", "mysql+pymysql://")
    return Settings().database_url.replace("mysql+aiomysql://", "mysql+pymysql://")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--student-id", required=True, help="administrator staff number")
    parser.add_argument("--name", required=True)
    parser.add_argument("--role", choices=("school_admin", "admin"), default="school_admin")
    parser.add_argument("--college", default="内蒙古师范大学")
    args = parser.parse_args()
    if not 6 <= len(args.student_id.strip()) <= 20:
        raise SystemExit("student ID must contain 6-20 characters")
    password = getpass.getpass("Initial password: ")
    if password != getpass.getpass("Confirm password: "):
        raise SystemExit("passwords do not match")
    password_error = validate_password_strength(password)
    if password_error:
        raise SystemExit(password_error)
    credentials = derive_password(password)
    engine = create_engine(database_url(), pool_pre_ping=True)
    with Session(engine) as db, db.begin():
        existing = db.scalar(select(User).where(User.student_id == args.student_id.strip()))
        if existing:
            raise SystemExit("account already exists; no changes made")
        db.add(User(
            student_id=args.student_id.strip(), name=args.name.strip()[:30], email="",
            role=args.role, account_status="active", password_hash=credentials["hash"],
            password_salt=credentials["salt"], force_password_change=False,
            college=args.college.strip()[:80], major="平台管理", class_name="", grade="",
            phone="", bio="", target_role="", development_track="staff", interests=[],
            consent_at=int(time.time() * 1000), consent_version="staff-bootstrap",
            privacy_version="staff-bootstrap",
        ))
    print(f"Created {args.role} account {args.student_id.strip()}; password was not printed or logged.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
