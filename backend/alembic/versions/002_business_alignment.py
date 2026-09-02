"""Phase 1.1 business alignment — add resume, assessment, role model, and enterprise tables.

Revision ID: 002
Revises: 001
Create Date: 2026-08-10

Adds tables required by corrected Group ownership:
  Group1 (AI简历+AI模拟面试): generated_resumes, resume_templates
  Group2 (任务匹配+榜样激励): baseline_assessments, student_portraits,
      growth_plans, growth_task_progress, role_models,
      role_model_experiences, role_model_milestones, role_model_matches
  Group3 (智能岗位匹配): candidate_pushes, student_data_authorizations
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Group1: Resume Generation ──────────────────────────
    op.create_table(
        "resume_templates",
        sa.Column("id", sa.String(64), nullable=False, comment="UUID主键"),
        sa.Column("name", sa.String(120), nullable=False, comment="模板名称"),
        sa.Column("category", sa.String(40), nullable=True, comment="分类"),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("preview_image_key", sa.String(500), nullable=True),
        sa.Column("layout_config", sa.JSON(), nullable=False, comment="布局配置"),
        sa.Column("style_config", sa.JSON(), nullable=False, comment="样式配置"),
        sa.Column("section_definitions", sa.JSON(), nullable=False, comment="段落定义"),
        sa.Column("is_default", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        comment="简历模板",
        mysql_charset="utf8mb4",
    )

    op.create_table(
        "generated_resumes",
        sa.Column("id", sa.String(64), nullable=False, comment="UUID主键"),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("student_profile_id", sa.Integer(), sa.ForeignKey("student_profiles.id"), nullable=True),
        sa.Column("career_job_id", sa.String(64), sa.ForeignKey("career_jobs.id"), nullable=True),
        sa.Column("job_title", sa.String(160), nullable=True, comment="岗位名称"),
        sa.Column("company", sa.String(160), nullable=True, comment="公司名称"),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1", comment="版本号"),
        sa.Column("template_id", sa.String(64), nullable=True),
        sa.Column("title", sa.String(200), nullable=False, comment="简历标题"),
        sa.Column("raw_content", sa.JSON(), nullable=True, comment="AI生成内容"),
        sa.Column("rendered_text", sa.Text(), nullable=True),
        sa.Column("rendered_html", sa.Text(), nullable=True),
        sa.Column("ats_score", sa.Integer(), nullable=True, comment="ATS评分"),
        sa.Column("ats_feedback", sa.JSON(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft", comment="状态"),
        sa.Column("is_current", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("source_evidence_ids", sa.JSON(), nullable=True, comment="引用证据ID"),
        sa.Column("generated_by", sa.String(80), nullable=True, comment="生成模型"),
        sa.Column("generation_config", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        comment="AI生成简历",
        mysql_charset="utf8mb4",
    )
    op.create_index("ix_gr_user", "generated_resumes", ["user_id"])
    op.create_index("ix_gr_job", "generated_resumes", ["career_job_id"])

    # ── Group2: Assessment & Portrait ──────────────────────
    op.create_table(
        "baseline_assessments",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False, comment="主键"),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("student_profile_id", sa.Integer(), sa.ForeignKey("student_profiles.id"), nullable=True),
        sa.Column("assessment_type", sa.String(30), nullable=False, server_default="baseline"),
        sa.Column("semester_index", sa.Integer(), nullable=True),
        sa.Column("gaokao_score", sa.Numeric(8, 2), nullable=True, comment="高考总分"),
        sa.Column("gaokao_scores_detail", sa.JSON(), nullable=True, comment="高考各科成绩"),
        sa.Column("major_program_id", sa.Integer(), sa.ForeignKey("university_major_programs.id"), nullable=True),
        sa.Column("career_interest", sa.String(200), nullable=True, comment="职业意向"),
        sa.Column("career_orientation", sa.String(80), nullable=True, comment="职业倾向"),
        sa.Column("professional_basis", sa.JSON(), nullable=True, comment="专业基础能力"),
        sa.Column("personality_traits", sa.JSON(), nullable=True, comment="性格特质"),
        sa.Column("soft_skills", sa.JSON(), nullable=True, comment="软实力"),
        sa.Column("dimension_scores", sa.JSON(), nullable=True, comment="各维度得分"),
        sa.Column("overall_score", sa.Integer(), nullable=True),
        sa.Column("confidence", sa.Integer(), nullable=True),
        sa.Column("weaknesses", sa.JSON(), nullable=True, comment="能力短板"),
        sa.Column("strengths", sa.JSON(), nullable=True, comment="能力优势"),
        sa.Column("portrait_data", sa.JSON(), nullable=True, comment="基线画像数据"),
        sa.Column("recommendations", sa.JSON(), nullable=True, comment="改进建议"),
        sa.Column("assessment_version", sa.String(20), nullable=True, comment="算法版本"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        comment="学生基线测评",
        mysql_charset="utf8mb4",
    )
    op.create_index("ix_ba_user", "baseline_assessments", ["user_id"])

    op.create_table(
        "student_portraits",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False, comment="主键"),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, unique=True),
        sa.Column("portrait_data", sa.JSON(), nullable=False, comment="完整画像"),
        sa.Column("dimensions", sa.JSON(), nullable=False, comment="五维能力分数"),
        sa.Column("overall_score", sa.Integer(), nullable=False),
        sa.Column("completeness", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("confidence", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_evidence", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("verified_evidence", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("algorithm_version", sa.String(20), nullable=True),
        sa.Column("calculated_at", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        comment="学生能力画像（缓存）",
        mysql_charset="utf8mb4",
    )
    op.create_index("ix_sp_user", "student_portraits", ["user_id"])

    # ── Group2: Growth Plans & Progress ────────────────────
    op.create_table(
        "growth_plans",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False, comment="主键"),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("semester_index", sa.Integer(), nullable=False, comment="学期序号"),
        sa.Column("semester_label", sa.String(40), nullable=False, comment="学期标签"),
        sa.Column("focus_dimensions", sa.JSON(), nullable=True, comment="重点维度"),
        sa.Column("target_xp", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("earned_xp", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        comment="学期成长计划",
        mysql_charset="utf8mb4",
    )
    op.create_index("ix_gp_user", "growth_plans", ["user_id"])

    op.create_table(
        "growth_task_progress",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False, comment="主键"),
        sa.Column("growth_task_id", sa.String(120), sa.ForeignKey("growth_tasks.id"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="not_started"),
        sa.Column("progress_pct", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("check_in_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_check_in_at", sa.Integer(), nullable=True),
        sa.Column("completed_at", sa.Integer(), nullable=True),
        sa.Column("verified_at", sa.Integer(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        comment="成长任务进度",
        mysql_charset="utf8mb4",
    )
    op.create_index("ix_gtp_task", "growth_task_progress", ["growth_task_id"])
    op.create_index("ix_gtp_user", "growth_task_progress", ["user_id"])

    # ── Group2: Role Models ────────────────────────────────
    op.create_table(
        "role_models",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False, comment="主键"),
        sa.Column("name", sa.String(30), nullable=False, comment="姓名"),
        sa.Column("display_name", sa.String(60), nullable=True, comment="展示名称"),
        sa.Column("avatar_file_id", sa.String(64), nullable=True),
        sa.Column("background_tags", sa.JSON(), nullable=True, comment="背景标签"),
        sa.Column("gaokao_score_range", sa.String(30), nullable=True, comment="高考分数段"),
        sa.Column("university_name", sa.String(160), nullable=True, comment="本科学校"),
        sa.Column("major_name", sa.String(160), nullable=True, comment="本科专业"),
        sa.Column("target_industry", sa.String(80), nullable=True, comment="目标行业"),
        sa.Column("target_job_category", sa.String(80), nullable=True, comment="目标岗位类别"),
        sa.Column("final_offer", sa.String(300), nullable=True, comment="最终offer"),
        sa.Column("final_employer", sa.String(300), nullable=True, comment="最终入职单位"),
        sa.Column("graduation_year", sa.Integer(), nullable=True, comment="毕业年份"),
        sa.Column("summary", sa.Text(), nullable=True, comment="案例摘要"),
        sa.Column("full_story", sa.Text(), nullable=True, comment="完整故事"),
        sa.Column("is_published", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_featured", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        comment="榜样/优秀案例",
        mysql_charset="utf8mb4",
    )

    op.create_table(
        "role_model_experiences",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False, comment="主键"),
        sa.Column("role_model_id", sa.Integer(), sa.ForeignKey("role_models.id"), nullable=False),
        sa.Column("experience_type", sa.String(40), nullable=False, comment="类型"),
        sa.Column("title", sa.String(200), nullable=False, comment="经历标题"),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("semester_label", sa.String(20), nullable=True, comment="发生学期"),
        sa.Column("date_range", sa.String(60), nullable=True),
        sa.Column("dimension", sa.String(40), nullable=True, comment="能力维度"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        comment="榜样成长经历",
        mysql_charset="utf8mb4",
    )
    op.create_index("ix_rme_rm", "role_model_experiences", ["role_model_id"])

    op.create_table(
        "role_model_milestones",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False, comment="主键"),
        sa.Column("role_model_id", sa.Integer(), sa.ForeignKey("role_models.id"), nullable=False),
        sa.Column("title", sa.String(200), nullable=False, comment="里程碑标题"),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("milestone_date", sa.String(20), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        comment="榜样成长里程碑",
        mysql_charset="utf8mb4",
    )
    op.create_index("ix_rmm_rm", "role_model_milestones", ["role_model_id"])

    op.create_table(
        "role_model_matches",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False, comment="主键"),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("role_model_id", sa.Integer(), sa.ForeignKey("role_models.id"), nullable=False),
        sa.Column("match_score", sa.Integer(), nullable=False, comment="匹配分数"),
        sa.Column("matched_dimensions", sa.JSON(), nullable=True, comment="匹配维度"),
        sa.Column("match_rationale", sa.Text(), nullable=True, comment="匹配理由"),
        sa.Column("is_viewed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("feedback", sa.String(20), nullable=True, comment="反馈"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        comment="学生-榜样匹配记录",
        mysql_charset="utf8mb4",
    )
    op.create_index("ix_rmatch_user", "role_model_matches", ["user_id"])
    op.create_index("ix_rmatch_rm", "role_model_matches", ["role_model_id"])

    # ── Group3: Enterprise Collaboration ───────────────────
    op.create_table(
        "candidate_pushes",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False, comment="主键"),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("employer_id", sa.Integer(), sa.ForeignKey("employers.id"), nullable=True),
        sa.Column("career_job_id", sa.String(64), sa.ForeignKey("career_jobs.id"), nullable=True),
        sa.Column("pushed_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True, comment="推送人"),
        sa.Column("authorization_status", sa.String(20), nullable=False, server_default="pending", comment="授权状态"),
        sa.Column("authorized_at", sa.Integer(), nullable=True),
        sa.Column("authorization_scope", sa.JSON(), nullable=True, comment="授权范围"),
        sa.Column("enterprise_viewed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("enterprise_viewed_at", sa.Integer(), nullable=True),
        sa.Column("enterprise_feedback", sa.String(40), nullable=True, comment="企业反馈"),
        sa.Column("enterprise_note", sa.Text(), nullable=True),
        sa.Column("push_result", sa.String(30), nullable=True, comment="推送结果"),
        sa.Column("result_note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        comment="候选人推送记录",
        mysql_charset="utf8mb4",
    )
    op.create_index("ix_cp_user", "candidate_pushes", ["user_id"])
    op.create_index("ix_cp_employer", "candidate_pushes", ["employer_id"])

    op.create_table(
        "student_data_authorizations",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False, comment="主键"),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("employer_id", sa.Integer(), sa.ForeignKey("employers.id"), nullable=True),
        sa.Column("share_resume", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("share_portrait", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("share_scores", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("share_evidence", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("share_contact", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("expires_at", sa.Integer(), nullable=True),
        sa.Column("revoked_at", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        comment="学生数据授权记录",
        mysql_charset="utf8mb4",
    )
    op.create_index("ix_sda_user", "student_data_authorizations", ["user_id"])
    op.create_index("ix_sda_employer", "student_data_authorizations", ["employer_id"])


def downgrade() -> None:
    op.drop_table("student_data_authorizations")
    op.drop_table("candidate_pushes")
    op.drop_table("role_model_matches")
    op.drop_table("role_model_milestones")
    op.drop_table("role_model_experiences")
    op.drop_table("role_models")
    op.drop_table("growth_task_progress")
    op.drop_table("growth_plans")
    op.drop_table("student_portraits")
    op.drop_table("baseline_assessments")
    op.drop_table("generated_resumes")
    op.drop_table("resume_templates")
