"""empty init — required to start migration history.

Revision ID: 001
Revises:
Create Date: 2026-08-10

Initial migration: create all core tables for xinhuo-future platform.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Reference Layer ──────────────────────────────────────
    op.create_table(
        "ref_major_standard",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False, comment="主键"),
        sa.Column("discipline_name", sa.String(80), nullable=False, comment="学科门类"),
        sa.Column("major_category_name", sa.String(120), nullable=False, comment="专业类"),
        sa.Column("major_name", sa.String(160), nullable=False, comment="专业名称"),
        sa.Column("major_code", sa.String(20), nullable=True, comment="专业代码"),
        sa.Column("source", sa.String(80), nullable=False, server_default="moa_national_standard"),
        sa.Column("source_version", sa.String(40), nullable=True),
        sa.Column("is_active", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        comment="本科专业国家标准目录",
        mysql_charset="utf8mb4",
    )
    op.create_index("ix_ref_major_standard_discipline", "ref_major_standard", ["discipline_name"])
    op.create_index("ix_ref_major_standard_major_name", "ref_major_standard", ["major_name"])

    op.create_table(
        "ref_job_standard",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False, comment="主键"),
        sa.Column("job_domain", sa.String(80), nullable=False, comment="岗位大类"),
        sa.Column("job_category", sa.String(120), nullable=False, comment="岗位类"),
        sa.Column("job_name", sa.String(160), nullable=False, comment="岗位名称"),
        sa.Column("aliases", sa.JSON(), nullable=True, comment="岗位别名"),
        sa.Column("is_active", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        comment="岗位标准化分类",
        mysql_charset="utf8mb4",
    )
    op.create_index("ix_ref_job_standard_domain", "ref_job_standard", ["job_domain"])
    op.create_index("ix_ref_job_standard_job_name", "ref_job_standard", ["job_name"])

    op.create_table(
        "ref_code_values",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False, comment="主键"),
        sa.Column("namespace", sa.String(80), nullable=False, comment="命名空间"),
        sa.Column("code", sa.String(40), nullable=False, comment="代码值"),
        sa.Column("label", sa.String(160), nullable=False, comment="显示名称"),
        sa.Column("parent_code", sa.String(40), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column("is_active", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        comment="通用代码字典",
        mysql_charset="utf8mb4",
    )
    op.create_index("ix_ref_code_values_namespace", "ref_code_values", ["namespace"])

    # ── Organization Layer ───────────────────────────────────
    op.create_table(
        "universities",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False, comment="主键"),
        sa.Column("name", sa.String(160), nullable=False, comment="学校名称"),
        sa.Column("short_name", sa.String(80), nullable=True),
        sa.Column("code", sa.String(20), nullable=True, unique=True),
        sa.Column("province", sa.String(40), nullable=True),
        sa.Column("city", sa.String(40), nullable=True),
        sa.Column("is_active", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        comment="学校/院校",
        mysql_charset="utf8mb4",
    )
    op.create_index("ix_universities_name", "universities", ["name"])

    op.create_table(
        "colleges",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False, comment="主键"),
        sa.Column("university_id", sa.Integer(), sa.ForeignKey("universities.id"), nullable=False),
        sa.Column("name", sa.String(120), nullable=False, comment="学院名称"),
        sa.Column("short_name", sa.String(60), nullable=True),
        sa.Column("official_url", sa.String(500), nullable=True),
        sa.Column("is_active", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        comment="学院/系",
        mysql_charset="utf8mb4",
    )
    op.create_index("ix_colleges_name", "colleges", ["name"])

    op.create_table(
        "university_major_programs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False, comment="主键"),
        sa.Column("university_id", sa.Integer(), sa.ForeignKey("universities.id"), nullable=False),
        sa.Column("college_id", sa.Integer(), sa.ForeignKey("colleges.id"), nullable=False),
        sa.Column("standard_major_id", sa.Integer(), sa.ForeignKey("ref_major_standard.id"), nullable=True),
        sa.Column("major_code", sa.String(20), nullable=True, comment="专业代码"),
        sa.Column("major_name", sa.String(160), nullable=False, comment="专业名称"),
        sa.Column("degree_category", sa.String(40), nullable=True),
        sa.Column("study_years", sa.Integer(), nullable=True),
        sa.Column("mapping_status", sa.String(20), nullable=True, server_default="unmapped"),
        sa.Column("is_active", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        comment="学校现设本科专业",
        mysql_charset="utf8mb4",
    )
    op.create_index("ix_ump_major_code", "university_major_programs", ["major_code"])
    op.create_index("ix_ump_major_name", "university_major_programs", ["major_name"])

    # ── Users Layer ──────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False, comment="主键"),
        sa.Column("student_id", sa.String(20), nullable=False, unique=True, comment="学号或工号"),
        sa.Column("name", sa.String(30), nullable=False, comment="姓名"),
        sa.Column("email", sa.String(120), nullable=False, server_default=""),
        sa.Column("role", sa.String(30), nullable=False, server_default="student", comment="角色"),
        sa.Column("account_status", sa.String(20), nullable=False, server_default="pending", comment="账号状态"),
        sa.Column("account_review_note", sa.String(300), nullable=True),
        sa.Column("account_reviewed_at", sa.Integer(), nullable=True),
        sa.Column("account_reviewed_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("force_password_change", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("password_hash", sa.String(200), nullable=False),
        sa.Column("password_salt", sa.String(200), nullable=False),
        sa.Column("failed_login_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("locked_until", sa.Integer(), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("college", sa.String(80), nullable=False, server_default=""),
        sa.Column("major", sa.String(80), nullable=False, server_default=""),
        sa.Column("class_name", sa.String(80), nullable=False, server_default=""),
        sa.Column("grade", sa.String(20), nullable=False, server_default=""),
        sa.Column("phone", sa.String(30), nullable=False, server_default=""),
        # MySQL rejects defaults on TEXT/BLOB/JSON columns. Application writes
        # the empty-string default explicitly, so the database column only
        # needs to remain non-nullable here.
        sa.Column("bio", sa.Text(), nullable=False),
        sa.Column("target_role", sa.String(80), nullable=False, server_default="探索方向"),
        sa.Column("development_track", sa.String(80), nullable=False, server_default="exploration"),
        sa.Column("interests", sa.JSON(), nullable=False),
        sa.Column("consent_at", sa.Integer(), nullable=True),
        sa.Column("last_login_at", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        comment="用户账号",
        mysql_charset="utf8mb4",
    )
    op.create_index("ix_users_student_id", "users", ["student_id"])
    op.create_index("ix_users_role", "users", ["role"])
    op.create_index("ix_users_account_status", "users", ["account_status"])

    op.create_table(
        "user_sessions",
        sa.Column("id", sa.String(64), nullable=False, comment="SHA256(token)"),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("expires_at", sa.Integer(), nullable=False),
        sa.Column("last_seen_at", sa.Integer(), nullable=False),
        sa.Column("revoked_at", sa.Integer(), nullable=True),
        sa.Column("device_id", sa.String(80), nullable=True),
        sa.Column("device_name", sa.String(80), nullable=True),
        sa.Column("user_agent_hash", sa.String(64), nullable=True),
        sa.Column("ip_hash", sa.String(64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        comment="用户会话",
        mysql_charset="utf8mb4",
    )
    op.create_index("ix_sessions_user_id", "user_sessions", ["user_id"])

    op.create_table(
        "student_profiles",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False, comment="主键"),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, unique=True),
        sa.Column("student_no", sa.String(20), nullable=False, unique=True, comment="学号"),
        sa.Column("candidate_no", sa.String(30), nullable=True),
        sa.Column("college_id", sa.Integer(), sa.ForeignKey("colleges.id"), nullable=True),
        sa.Column("major_program_id", sa.Integer(), sa.ForeignKey("university_major_programs.id"), nullable=True),
        sa.Column("class_name", sa.String(80), nullable=True),
        sa.Column("enrollment_date", sa.String(10), nullable=True),
        sa.Column("graduation_date", sa.String(10), nullable=True),
        sa.Column("education_level", sa.String(20), nullable=True),
        sa.Column("study_mode", sa.String(20), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        comment="学生档案",
        mysql_charset="utf8mb4",
    )
    op.create_index("ix_student_profiles_user", "student_profiles", ["user_id"])
    op.create_index("ix_student_profiles_no", "student_profiles", ["student_no"])

    op.create_table(
        "student_private_profiles",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False, comment="主键"),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("student_profiles.id"), nullable=False, unique=True),
        sa.Column("real_name", sa.String(30), nullable=False),
        sa.Column("id_card", sa.String(18), nullable=True),
        sa.Column("gender", sa.String(10), nullable=True),
        sa.Column("phone", sa.String(20), nullable=True),
        sa.Column("email", sa.String(120), nullable=True),
        sa.Column("qq", sa.String(20), nullable=True),
        sa.Column("household_location", sa.String(300), nullable=True),
        sa.Column("address", sa.String(500), nullable=True),
        sa.Column("ethnicity", sa.String(30), nullable=True),
        sa.Column("political_status", sa.String(30), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        comment="学生敏感个人信息",
        mysql_charset="utf8mb4",
    )
    op.create_index("ix_spp_student_id", "student_private_profiles", ["student_id"])

    op.create_table(
        "teacher_profiles",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False, comment="主键"),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, unique=True),
        sa.Column("staff_no", sa.String(20), nullable=False, unique=True),
        sa.Column("college_id", sa.Integer(), sa.ForeignKey("colleges.id"), nullable=True),
        sa.Column("title", sa.String(40), nullable=True),
        sa.Column("position", sa.String(80), nullable=True),
        sa.Column("office", sa.String(120), nullable=True),
        sa.Column("is_mentor", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        comment="教师档案",
        mysql_charset="utf8mb4",
    )

    # ── Admission Layer ──────────────────────────────────────
    op.create_table(
        "student_admissions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False, comment="主键"),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("student_profiles.id"), nullable=False),
        sa.Column("candidate_no", sa.String(30), nullable=True),
        sa.Column("source_province", sa.String(30), nullable=True),
        sa.Column("source_city", sa.String(60), nullable=True),
        sa.Column("original_major_name", sa.String(160), nullable=True),
        sa.Column("normalized_major_id", sa.Integer(), sa.ForeignKey("university_major_programs.id"), nullable=True),
        sa.Column("teaching_language", sa.String(20), nullable=True),
        sa.Column("teacher_training_type", sa.String(30), nullable=True),
        sa.Column("subject_stream", sa.String(20), nullable=True),
        sa.Column("special_note", sa.Text(), nullable=True),
        sa.Column("candidate_type", sa.String(30), nullable=True),
        sa.Column("filing_score", sa.Numeric(8, 2), nullable=True),
        sa.Column("foreign_language_type", sa.String(30), nullable=True),
        sa.Column("admission_year", sa.Integer(), nullable=True),
        # The import batch table is created later because it also references
        # users. Add this foreign key after both tables exist (MySQL does not
        # allow a forward reference to a table that has not been created).
        sa.Column("raw_import_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        comment="招生录取记录",
        mysql_charset="utf8mb4",
    )
    op.create_index("ix_admissions_student", "student_admissions", ["student_id"])
    op.create_index("ix_admissions_candidate_no", "student_admissions", ["candidate_no"])
    op.create_index("ix_admissions_year", "student_admissions", ["admission_year"])

    op.create_table(
        "student_admission_scores",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False, comment="主键"),
        sa.Column("admission_id", sa.Integer(), sa.ForeignKey("student_admissions.id"), nullable=False),
        sa.Column("subject_code", sa.String(20), nullable=False, comment="科目代码"),
        sa.Column("subject_name", sa.String(40), nullable=False, comment="科目名称"),
        sa.Column("score", sa.Numeric(8, 2), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        comment="录取科目成绩",
        mysql_charset="utf8mb4",
    )
    op.create_index("ix_scores_admission", "student_admission_scores", ["admission_id"])

    # ── Employment Layer ─────────────────────────────────────
    op.create_table(
        "employers",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False, comment="主键"),
        sa.Column("name", sa.String(300), nullable=False, comment="单位名称"),
        sa.Column("unified_social_credit_code", sa.String(18), nullable=True, unique=True),
        sa.Column("organization_type", sa.String(80), nullable=True),
        sa.Column("industry", sa.String(80), nullable=True),
        sa.Column("province", sa.String(30), nullable=True),
        sa.Column("city", sa.String(40), nullable=True),
        sa.Column("district", sa.String(60), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("postal_code", sa.String(10), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        comment="用人单位",
        mysql_charset="utf8mb4",
    )
    op.create_index("ix_employers_name", "employers", ["name"])
    op.create_index("ix_employers_uscc", "employers", ["unified_social_credit_code"])

    op.create_table(
        "student_employments",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False, comment="主键"),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("student_profiles.id"), nullable=False),
        sa.Column("employer_id", sa.Integer(), sa.ForeignKey("employers.id"), nullable=True),
        sa.Column("destination_code", sa.String(20), nullable=True),
        sa.Column("destination_name", sa.String(80), nullable=True),
        sa.Column("job_standard_id", sa.Integer(), sa.ForeignKey("ref_job_standard.id"), nullable=True),
        sa.Column("job_title_raw", sa.String(200), nullable=True),
        sa.Column("employment_status", sa.String(30), nullable=True),
        sa.Column("employment_source", sa.String(30), nullable=True),
        sa.Column("work_province", sa.String(30), nullable=True),
        sa.Column("work_city", sa.String(40), nullable=True),
        sa.Column("work_district", sa.String(60), nullable=True),
        sa.Column("reported_at", sa.String(10), nullable=True),
        sa.Column("audit_status", sa.String(20), nullable=True, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        comment="学生就业记录",
        mysql_charset="utf8mb4",
    )
    op.create_index("ix_employments_student", "student_employments", ["student_id"])
    op.create_index("ix_employments_employer", "student_employments", ["employer_id"])

    op.create_table(
        "employment_reviews",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False, comment="主键"),
        sa.Column("employment_id", sa.Integer(), sa.ForeignKey("student_employments.id"), nullable=False),
        sa.Column("reviewer_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("reviewed_at", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        comment="就业审核记录",
        mysql_charset="utf8mb4",
    )
    op.create_index("ix_emp_reviews_employment", "employment_reviews", ["employment_id"])

    op.create_table(
        "study_abroad_records",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False, comment="主键"),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("student_profiles.id"), nullable=False),
        sa.Column("institution_name", sa.String(300), nullable=True),
        sa.Column("country_region", sa.String(80), nullable=True),
        sa.Column("education_level", sa.String(30), nullable=True),
        sa.Column("major_name_cn", sa.String(160), nullable=True),
        sa.Column("major_name_foreign", sa.String(300), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        comment="留学/海外升学记录",
        mysql_charset="utf8mb4",
    )

    op.create_table(
        "graduate_administration",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False, comment="主键"),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("student_profiles.id"), nullable=False, unique=True),
        sa.Column("archive_destination", sa.Text(), nullable=True),
        sa.Column("archive_address", sa.Text(), nullable=True),
        sa.Column("household_migration_type", sa.String(40), nullable=True),
        sa.Column("household_migration_address", sa.Text(), nullable=True),
        sa.Column("contact_person", sa.String(30), nullable=True),
        sa.Column("contact_phone", sa.String(20), nullable=True),
        sa.Column("mailing_address", sa.Text(), nullable=True),
        sa.Column("mailing_postal_code", sa.String(10), nullable=True),
        sa.Column("raw_data", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        comment="毕业生行政信息",
        mysql_charset="utf8mb4",
    )

    # ── Evidence Layer ───────────────────────────────────────
    op.create_table(
        "evidence",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False, comment="主键"),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("student_id", sa.String(20), nullable=False),
        sa.Column("task_id", sa.String(80), nullable=True),
        sa.Column("task_title", sa.String(120), nullable=True),
        sa.Column("title", sa.String(120), nullable=False),
        sa.Column("category", sa.String(40), nullable=False),
        sa.Column("dimension", sa.String(40), nullable=False),
        sa.Column("detail", sa.Text(), nullable=False),
        sa.Column("evidence_ref", sa.String(500), nullable=True),
        sa.Column("evidence_date", sa.String(20), nullable=False),
        sa.Column("source_type", sa.String(40), nullable=False),
        sa.Column("source_reliability", sa.Integer(), nullable=False, server_default="70"),
        sa.Column("relevance", sa.Integer(), nullable=False, server_default="80"),
        sa.Column("quality", sa.Integer(), nullable=False, server_default="75"),
        sa.Column("contribution", sa.Integer(), nullable=False, server_default="70"),
        sa.Column("attachment_id", sa.String(80), nullable=True),
        sa.Column("verification_status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("reviewer_note", sa.Text(), nullable=True),
        sa.Column("reviewed_at", sa.Integer(), nullable=True),
        sa.Column("reviewer_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        comment="成长证据/佐证",
        mysql_charset="utf8mb4",
    )
    op.create_index("ix_evidence_user", "evidence", ["user_id"])
    op.create_index("ix_evidence_task", "evidence", ["task_id"])
    op.create_index("ix_evidence_dimension", "evidence", ["dimension"])
    op.create_index("ix_evidence_status", "evidence", ["verification_status"])

    op.create_table(
        "evidence_reviews",
        sa.Column("id", sa.String(64), nullable=False),
        sa.Column("evidence_id", sa.Integer(), sa.ForeignKey("evidence.id"), nullable=False),
        sa.Column("reviewer_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("previous_status", sa.String(20), nullable=False),
        sa.Column("next_status", sa.String(20), nullable=False),
        sa.Column("reviewer_note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        comment="证据审核历史",
        mysql_charset="utf8mb4",
    )
    op.create_index("ix_er_evidence", "evidence_reviews", ["evidence_id"])

    op.create_table(
        "evidence_files",
        sa.Column("id", sa.String(64), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("evidence_id", sa.Integer(), sa.ForeignKey("evidence.id"), nullable=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("mime_type", sa.String(100), nullable=False),
        sa.Column("size", sa.Integer(), nullable=False),
        sa.Column("sha256", sa.String(64), nullable=False),
        sa.Column("object_key", sa.String(500), nullable=True),
        sa.Column("data_base64", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        comment="证据附件",
        mysql_charset="utf8mb4",
    )
    op.create_index("ix_ef_user", "evidence_files", ["user_id"])
    op.create_index("ix_ef_evidence", "evidence_files", ["evidence_id"])

    # ── Growth Layer ─────────────────────────────────────────
    op.create_table(
        "growth_tasks",
        sa.Column("id", sa.String(120), nullable=False, comment="user_id:task_id"),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("task_id", sa.String(80), nullable=False),
        sa.Column("semester_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("title", sa.String(120), nullable=False),
        sa.Column("note", sa.Text(), nullable=False),
        sa.Column("type", sa.String(30), nullable=False, server_default=""),
        sa.Column("xp", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_custom", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        comment="成长任务",
        mysql_charset="utf8mb4",
    )
    op.create_index("ix_gt_user", "growth_tasks", ["user_id"])
    op.create_index("ix_gt_task", "growth_tasks", ["task_id"])

    op.create_table(
        "cloud_states",
        sa.Column("id", sa.String(120), nullable=False, comment="user_id:state_key"),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("state_key", sa.String(80), nullable=False),
        sa.Column("value", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        comment="用户云状态",
        mysql_charset="utf8mb4",
    )
    op.create_index("ix_cs_user", "cloud_states", ["user_id"])
    op.create_index("ix_cs_key", "cloud_states", ["state_key"])

    # ── Career Layer ─────────────────────────────────────────
    op.create_table(
        "career_jobs",
        sa.Column("id", sa.String(64), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("title", sa.String(100), nullable=False),
        sa.Column("company", sa.String(80), nullable=False),
        sa.Column("city", sa.String(40), nullable=True),
        sa.Column("employment_type", sa.String(30), nullable=True),
        sa.Column("salary", sa.String(40), nullable=True),
        sa.Column("source_url", sa.String(500), nullable=True),
        sa.Column("source_name", sa.String(60), nullable=True),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("requirements", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        comment="岗位快照",
        mysql_charset="utf8mb4",
    )
    op.create_index("ix_cj_user", "career_jobs", ["user_id"])

    op.create_table(
        "career_matches",
        sa.Column("id", sa.String(64), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("job_id", sa.String(64), sa.ForeignKey("career_jobs.id"), nullable=False),
        sa.Column("overall_score", sa.Integer(), nullable=False),
        sa.Column("confidence", sa.Integer(), nullable=False),
        sa.Column("verdict", sa.String(20), nullable=False),
        sa.Column("result", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        comment="岗位匹配结果",
        mysql_charset="utf8mb4",
    )
    op.create_index("ix_cm_user", "career_matches", ["user_id"])
    op.create_index("ix_cm_job", "career_matches", ["job_id"])

    op.create_table(
        "career_applications",
        sa.Column("id", sa.String(64), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("job_id", sa.String(64), sa.ForeignKey("career_jobs.id"), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="saved"),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("submitted_at", sa.Integer(), nullable=True),
        sa.Column("last_event_at", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        comment="岗位投递记录",
        mysql_charset="utf8mb4",
    )

    op.create_table(
        "career_events",
        sa.Column("id", sa.String(64), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("application_id", sa.String(64), sa.ForeignKey("career_applications.id"), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        comment="投递事件/复盘记录",
        mysql_charset="utf8mb4",
    )

    op.create_table(
        "recommendation_feedback",
        sa.Column("id", sa.String(64), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("target_role", sa.String(40), nullable=True),
        sa.Column("recommendation_id", sa.String(120), nullable=False),
        sa.Column("feedback", sa.String(20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        comment="推荐反馈",
        mysql_charset="utf8mb4",
    )

    # ── Interview Layer ──────────────────────────────────────
    op.create_table(
        "interview_sessions",
        sa.Column("id", sa.String(64), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("target_role", sa.String(60), nullable=False),
        sa.Column("difficulty", sa.String(20), nullable=False),
        sa.Column("answers", sa.JSON(), nullable=True),
        sa.Column("report", sa.JSON(), nullable=True),
        sa.Column("report_v2", sa.JSON(), nullable=True),
        sa.Column("overall_score", sa.Integer(), nullable=True),
        sa.Column("application_id", sa.String(64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        comment="模拟面试记录",
        mysql_charset="utf8mb4",
    )
    op.create_index("ix_is_user", "interview_sessions", ["user_id"])

    op.create_table(
        "resume_upload_chunks",
        sa.Column("id", sa.String(100), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("upload_id", sa.String(64), nullable=False),
        sa.Column("index", sa.Integer(), nullable=False),
        sa.Column("total", sa.Integer(), nullable=False),
        sa.Column("data", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        comment="简历上传分片",
        mysql_charset="utf8mb4",
    )
    op.create_index("ix_ruc_user", "resume_upload_chunks", ["user_id"])
    op.create_index("ix_ruc_upload", "resume_upload_chunks", ["upload_id"])

    # ── Admin Layer ──────────────────────────────────────────
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.String(64), nullable=False),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("actor_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("target_type", sa.String(40), nullable=False),
        sa.Column("target_id", sa.String(100), nullable=True),
        sa.Column("details", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        comment="审计日志",
        mysql_charset="utf8mb4",
    )
    op.create_index("ix_al_action", "audit_logs", ["action"])
    op.create_index("ix_al_actor", "audit_logs", ["actor_user_id"])
    op.create_index("ix_al_target", "audit_logs", ["target_type"])
    op.create_index("ix_al_created", "audit_logs", ["created_at"])

    op.create_table(
        "recovery_requests",
        sa.Column("id", sa.String(64), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("requested_at", sa.Integer(), nullable=False),
        sa.Column("completed_at", sa.Integer(), nullable=True),
        sa.Column("completed_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        comment="密码找回申请",
        mysql_charset="utf8mb4",
    )

    op.create_table(
        "deletion_requests",
        sa.Column("id", sa.String(64), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("requested_at", sa.Integer(), nullable=False),
        sa.Column("scheduled_at", sa.Integer(), nullable=False),
        sa.Column("cancelled_at", sa.Integer(), nullable=True),
        sa.Column("completed_at", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        comment="账号注销申请",
        mysql_charset="utf8mb4",
    )

    # ── Files Layer ──────────────────────────────────────────
    op.create_table(
        "files",
        sa.Column("id", sa.String(64), nullable=False),
        sa.Column("owner_type", sa.String(40), nullable=False, comment="所有者类型"),
        sa.Column("owner_id", sa.String(64), nullable=True),
        sa.Column("object_key", sa.String(500), nullable=True, comment="COS对象键"),
        sa.Column("original_filename", sa.String(300), nullable=False),
        sa.Column("mime_type", sa.String(100), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("sha256", sa.String(64), nullable=True),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("is_public", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        comment="统一文件存储",
        mysql_charset="utf8mb4",
    )
    op.create_index("ix_files_owner_type", "files", ["owner_type"])
    op.create_index("ix_files_owner_id", "files", ["owner_id"])

    # ── Import / Staging Layer ───────────────────────────────
    op.create_table(
        "data_import_batches",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False, comment="主键"),
        sa.Column("source_type", sa.String(40), nullable=False, comment="数据来源类型"),
        sa.Column("source_filename", sa.String(300), nullable=True),
        sa.Column("source_year", sa.Integer(), nullable=True),
        sa.Column("imported_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("started_at", sa.Integer(), nullable=True),
        sa.Column("finished_at", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("total_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("success_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("failed_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        comment="数据导入批次",
        mysql_charset="utf8mb4",
    )
    op.create_index("ix_dib_source_type", "data_import_batches", ["source_type"])
    op.create_index("ix_dib_source_year", "data_import_batches", ["source_year"])
    op.create_foreign_key(
        "fk_student_admissions_raw_import_id",
        "student_admissions",
        "data_import_batches",
        ["raw_import_id"],
        ["id"],
    )

    op.create_table(
        "data_import_rows",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False, comment="主键"),
        sa.Column("batch_id", sa.Integer(), sa.ForeignKey("data_import_batches.id"), nullable=False),
        sa.Column("row_number", sa.Integer(), nullable=False),
        sa.Column("raw_data", sa.JSON(), nullable=False),
        sa.Column("normalized_status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("target_table", sa.String(80), nullable=True),
        sa.Column("target_id", sa.String(64), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        comment="导入数据行",
        mysql_charset="utf8mb4",
    )
    op.create_index("ix_dir_batch", "data_import_rows", ["batch_id"])


def downgrade() -> None:
    """Drop all tables in reverse dependency order."""
    op.drop_table("data_import_rows")
    op.drop_constraint(
        "fk_student_admissions_raw_import_id",
        "student_admissions",
        type_="foreignkey",
    )
    op.drop_table("data_import_batches")
    op.drop_table("files")
    op.drop_table("deletion_requests")
    op.drop_table("recovery_requests")
    op.drop_table("audit_logs")
    op.drop_table("resume_upload_chunks")
    op.drop_table("interview_sessions")
    op.drop_table("recommendation_feedback")
    op.drop_table("career_events")
    op.drop_table("career_applications")
    op.drop_table("career_matches")
    op.drop_table("career_jobs")
    op.drop_table("cloud_states")
    op.drop_table("growth_tasks")
    op.drop_table("evidence_files")
    op.drop_table("evidence_reviews")
    op.drop_table("evidence")
    op.drop_table("graduate_administration")
    op.drop_table("study_abroad_records")
    op.drop_table("employment_reviews")
    op.drop_table("student_employments")
    op.drop_table("employers")
    op.drop_table("student_admission_scores")
    op.drop_table("student_admissions")
    op.drop_table("teacher_profiles")
    op.drop_table("student_private_profiles")
    op.drop_table("student_profiles")
    op.drop_table("user_sessions")
    op.drop_table("users")
    op.drop_table("university_major_programs")
    op.drop_table("colleges")
    op.drop_table("universities")
    op.drop_table("ref_code_values")
    op.drop_table("ref_job_standard")
    op.drop_table("ref_major_standard")
