#!/usr/bin/env python3
"""
Import reference data from Excel files into MySQL staging tables.

Supports:
  - 本科专业标准层 (major_standard)
  - 岗位标准化分类层 (job_standard)
  - 现设本科专业目录 (university_major)

Usage:
  python scripts/import_reference_data.py --type major_standard
  python scripts/import_reference_data.py --type job_standard
  python scripts/import_reference_data.py --type university_major
  python scripts/import_reference_data.py --type all --dry-run

Design:
  - Openpyxl reads the Excel files
  - Data enters data_import_batches → data_import_rows (staging)
  - Then normalized into ref_major_standard / ref_job_standard / etc.
  - Idempotent: checks for existing records, skips duplicates
  - Supports --dry-run for validation without writing
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
import time
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import openpyxl
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger("import_reference")

# ── Configuration ────────────────────────────────────────────

DATA_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data"

FILE_MAP = {
    "major_standard": "1-本科专业标准层.xlsx",
    "job_standard": "2-岗位标准化分类层.xlsx",
    "university_major": "3-现设本科专业目录（96个）.xlsx",
    "admission": "4-招生数据字段.xlsx",
    "employment": "5-就业数据字段.xlsx",
}


def get_db_url() -> str:
    """Read database URL from environment or defaults."""
    db_url = os.getenv("DATABASE_URL", "")
    if db_url:
        return db_url
    host = os.getenv("MYSQL_HOST", "localhost")
    port = os.getenv("MYSQL_PORT", "3306")
    db = os.getenv("MYSQL_DATABASE", "xinhuo")
    user = os.getenv("MYSQL_USER", "xinhuo")
    pwd = os.getenv("MYSQL_PASSWORD", "xinhuo-dev-pwd")
    return f"mysql+pymysql://{user}:{pwd}@{host}:{port}/{db}?charset=utf8mb4"


def open_sheet(file_key: str):
    """Open an Excel file and return the active worksheet."""
    filename = FILE_MAP.get(file_key)
    if not filename:
        raise ValueError(f"Unknown file key: {file_key}")
    filepath = DATA_DIR / filename
    if not filepath.exists():
        raise FileNotFoundError(f"Data file not found: {filepath}")
    wb = openpyxl.load_workbook(str(filepath), read_only=True)
    return wb.active


# ── Importers ────────────────────────────────────────────────

def import_major_standard(session: Session, dry_run: bool = False):
    """Import 本科专业标准层 → ref_major_standard."""
    logger.info("Importing major standard data...")
    ws = open_sheet("major_standard")
    rows_data = []
    duplicates = 0

    for row_idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        if not row or not row[1]:  # Skip empty rows
            continue
        seq, discipline, category, major_name = row[0], row[1], row[2], row[3]
        if not major_name:
            continue

        # Check for duplicates
        existing = session.execute(
            text(
                "SELECT id FROM ref_major_standard "
                "WHERE discipline_name = :d AND major_category_name = :c AND major_name = :m"
            ),
            {"d": str(discipline).strip(), "c": str(category).strip(), "m": str(major_name).strip()},
        ).fetchone()
        if existing:
            duplicates += 1
            continue

        rows_data.append({
            "discipline_name": str(discipline).strip(),
            "major_category_name": str(category).strip(),
            "major_name": str(major_name).strip(),
            "source": "moa_national_standard",
        })

    if dry_run:
        logger.info(f"  [DRY RUN] Would insert {len(rows_data)} majors ({duplicates} duplicates skipped)")
        return len(rows_data), duplicates

    for data in rows_data:
        session.execute(
            text(
                "INSERT INTO ref_major_standard "
                "(discipline_name, major_category_name, major_name, source) "
                "VALUES (:discipline_name, :major_category_name, :major_name, :source)"
            ),
            data,
        )
    session.commit()
    logger.info(f"  Inserted {len(rows_data)} majors ({duplicates} duplicates skipped)")
    return len(rows_data), duplicates


def import_job_standard(session: Session, dry_run: bool = False):
    """Import 岗位标准化分类层 → ref_job_standard."""
    logger.info("Importing job standard data...")
    ws = open_sheet("job_standard")
    rows_data = []
    duplicates = 0

    for row_idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        if not row:
            continue
        values = [str(v).strip() if v else "" for v in row]
        # Columns: 序号, 岗位大类, 岗位类, 岗位名称
        if len(values) < 4:
            continue
        seq, domain, category, job_name = values[0], values[1], values[2], values[3]
        if not job_name:
            continue

        existing = session.execute(
            text(
                "SELECT id FROM ref_job_standard "
                "WHERE job_domain = :d AND job_category = :c AND job_name = :n"
            ),
            {"d": domain, "c": category, "n": job_name},
        ).fetchone()
        if existing:
            duplicates += 1
            continue

        rows_data.append({
            "job_domain": domain,
            "job_category": category,
            "job_name": job_name,
        })

    if dry_run:
        logger.info(f"  [DRY RUN] Would insert {len(rows_data)} jobs ({duplicates} duplicates skipped)")
        return len(rows_data), duplicates

    for data in rows_data:
        session.execute(
            text(
                "INSERT INTO ref_job_standard "
                "(job_domain, job_category, job_name) "
                "VALUES (:job_domain, :job_category, :job_name)"
            ),
            data,
        )
    session.commit()
    logger.info(f"  Inserted {len(rows_data)} jobs ({duplicates} duplicates skipped)")
    return len(rows_data), duplicates


def import_university_major(session: Session, dry_run: bool = False):
    """Import 现设本科专业目录 → university_major_programs.

    Requires universities and colleges to exist first.
    """
    logger.info("Importing university major programs...")

    # Ensure IMNU exists
    existing = session.execute(
        text("SELECT id FROM universities WHERE name = :name"),
        {"name": "内蒙古师范大学"},
    ).fetchone()
    if not existing:
        if dry_run:
            logger.info("  [DRY RUN] Would create university: 内蒙古师范大学")
        else:
            session.execute(
                text("INSERT INTO universities (name, short_name, province, city) VALUES (:name, :short, :prov, :city)"),
                {"name": "内蒙古师范大学", "short": "内师大", "prov": "内蒙古自治区", "city": "呼和浩特市"},
            )
            session.commit()
        university_id = -1 if dry_run else session.execute(
            text("SELECT id FROM universities WHERE name = '内蒙古师范大学'")
        ).fetchone()[0]
    else:
        university_id = existing[0]

    ws = open_sheet("university_major")
    insert_count = 0
    dup_count = 0

    for row_idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        if not row:
            continue
        values = [str(v).strip() if v else "" for v in row]
        if len(values) < 7:
            continue
        seq, college_name, degree, major_category, major_name, major_code, years = values[:7]

        if not major_name:
            continue

        # Find or create college
        if not dry_run:
            college = session.execute(
                text("SELECT id FROM colleges WHERE name = :n AND university_id = :uid"),
                {"n": college_name, "uid": university_id},
            ).fetchone()
            if not college:
                session.execute(
                    text("INSERT INTO colleges (university_id, name) VALUES (:uid, :n)"),
                    {"uid": university_id, "n": college_name},
                )
                session.commit()
                college = session.execute(
                    text("SELECT id FROM colleges WHERE name = :n AND university_id = :uid"),
                    {"n": college_name, "uid": university_id},
                ).fetchone()
            college_id = college[0]
        else:
            college_id = -1

        # Check duplicate
        if not dry_run:
            dup = session.execute(
                text("SELECT id FROM university_major_programs WHERE major_name = :n AND college_id = :cid"),
                {"n": major_name, "cid": college_id},
            ).fetchone()
            if dup:
                dup_count += 1
                continue

        study_years = None
        try:
            study_years = int(years.replace("年", "").replace("四", "4").replace("五", "5").replace("六", "6"))
        except (ValueError, AttributeError):
            study_years = 4

        if dry_run:
            insert_count += 1
            continue

        session.execute(
            text(
                "INSERT INTO university_major_programs "
                "(university_id, college_id, major_code, major_name, degree_category, study_years) "
                "VALUES (:uid, :cid, :code, :name, :degree, :years)"
            ),
            {
                "uid": university_id,
                "cid": college_id,
                "code": major_code or None,
                "name": major_name,
                "degree": degree or None,
                "years": study_years,
            },
        )
        insert_count += 1

    if not dry_run:
        session.commit()

    logger.info(f"  {'[DRY RUN] Would insert' if dry_run else 'Inserted'} {insert_count} programs ({dup_count} duplicates)")
    return insert_count, dup_count


# ── Main ─────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Import reference data into MySQL")
    parser.add_argument(
        "--type", "-t",
        choices=["major_standard", "job_standard", "university_major", "admission", "employment", "all"],
        default="all",
        help="Data type to import (default: all)",
    )
    parser.add_argument("--dry-run", action="store_true", help="Validate without writing")
    parser.add_argument("--db-url", default=None, help="Override database URL")
    args = parser.parse_args()

    db_url = args.db_url or get_db_url()
    logger.info(f"Database: {db_url.replace('://xinhuo:', '://xinhuo:***@')}")
    if args.dry_run:
        logger.info("MODE: DRY RUN — no data will be written")

    engine = create_engine(db_url)

    # Test connection
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info("Database connection OK")
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        sys.exit(1)

    types_to_import = (
        ["major_standard", "job_standard", "university_major"]
        if args.type == "all"
        else [args.type]
    )

    with Session(engine) as session:
        total_inserted = 0
        total_duplicates = 0

        for import_type in types_to_import:
            if import_type == "major_standard":
                ins, dup = import_major_standard(session, dry_run=args.dry_run)
            elif import_type == "job_standard":
                ins, dup = import_job_standard(session, dry_run=args.dry_run)
            elif import_type == "university_major":
                ins, dup = import_university_major(session, dry_run=args.dry_run)
            else:
                logger.warning(f"Skipping {import_type} — only staging import supported for now")
                continue
            total_inserted += ins
            total_duplicates += dup

        logger.info(f"Done. New: {total_inserted}, Duplicates skipped: {total_duplicates}")

    if args.dry_run:
        logger.info("DRY RUN complete — run without --dry-run to write data")


if __name__ == "__main__":
    main()
