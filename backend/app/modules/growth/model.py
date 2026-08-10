"""
Assessment & Role Model models for Group2: 任务匹配 + 榜样激励.

Covers: baseline assessments, student portraits, growth plans,
role models (榜样), and role model matching.
"""

from __future__ import annotations

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from ...db.base import Base, TimestampMixin


class GrowthTask(Base, TimestampMixin):
    """A growth task assigned to a student (system or custom).

    Maps to xh_growth_tasks. Composite key: user_id + task_id.
    """

    __tablename__ = "growth_tasks"

    id: Mapped[str] = mapped_column(
        String(120), primary_key=True, comment="user_id:task_id"
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True, comment="用户ID"
    )
    task_id: Mapped[str] = mapped_column(
        String(80), nullable=False, index=True, comment="任务编号"
    )
    semester_index: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, comment="学期序号 0-7"
    )
    title: Mapped[str] = mapped_column(String(120), nullable=False, comment="任务标题")
    note: Mapped[str] = mapped_column(Text, nullable=False, default="", comment="任务说明")
    type: Mapped[str] = mapped_column(String(30), nullable=False, default="", comment="任务类型")
    xp: Mapped[int] = mapped_column(Integer, nullable=False, default=0, comment="经验值 0-200")
    is_custom: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="0", comment="是否自定义任务"
    )

    __table_args__ = (
        {"comment": "成长任务"}
    )


class CloudState(Base, TimestampMixin):
    """Per-user lightweight JSON state store.

    Maps to xh_cloud_state. Allowed keys: ai_chat, resource_saved,
    career_saved, career_applied, interview_history.
    """

    __tablename__ = "cloud_states"

    id: Mapped[str] = mapped_column(
        String(120), primary_key=True, comment="user_id:state_key"
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True, comment="用户ID"
    )
    state_key: Mapped[str] = mapped_column(
        String(80), nullable=False, index=True, comment="状态键"
    )
    value: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="状态值（JSON字符串）"
    )

    __table_args__ = (
        {"comment": "用户云状态"}
    )


class BaselineAssessment(Base, TimestampMixin):
    """A student's baseline assessment — comprehensive initial evaluation.

    Captures: 高考成绩, 院校专业, 职业意向, 职业倾向, 专业基础能力, 性格特质, 软实力.
    One student can have multiple assessments over time (re-assessments).
    """

    __tablename__ = "baseline_assessments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, comment="主键")
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True, comment="学生用户ID"
    )
    student_profile_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("student_profiles.id"), nullable=True, comment="学生档案ID"
    )
    assessment_type: Mapped[str] = mapped_column(
        String(30), nullable=False, default="baseline", comment="类型: baseline | reassessment"
    )
    semester_index: Mapped[int | None] = mapped_column(
        Integer, nullable=True, comment="学期序号"
    )

    # ── Input data (snapshot at assessment time) ────────────
    gaokao_score: Mapped[float | None] = mapped_column(
        Numeric(8, 2), nullable=True, comment="高考总分"
    )
    gaokao_scores_detail: Mapped[dict | None] = mapped_column(
        JSON, nullable=True, comment="高考各科成绩JSON"
    )
    major_program_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("university_major_programs.id"), nullable=True, comment="当前专业"
    )
    career_interest: Mapped[str | None] = mapped_column(
        String(200), nullable=True, comment="职业意向（自由文本）"
    )
    career_orientation: Mapped[str | None] = mapped_column(
        String(80), nullable=True, comment="职业倾向类型"
    )
    professional_basis: Mapped[dict | None] = mapped_column(
        JSON, nullable=True, comment="专业基础能力评估"
    )
    personality_traits: Mapped[dict | None] = mapped_column(
        JSON, nullable=True, comment="性格特质"
    )
    soft_skills: Mapped[dict | None] = mapped_column(
        JSON, nullable=True, comment="软实力测评"
    )

    # ── Assessment results ─────────────────────────────────
    dimension_scores: Mapped[dict | None] = mapped_column(
        JSON, nullable=True,
        comment="各维度得分: 专业学习/项目实践/创新探索/沟通协作/职业准备"
    )
    overall_score: Mapped[int | None] = mapped_column(
        Integer, nullable=True, comment="综合评分"
    )
    confidence: Mapped[int | None] = mapped_column(
        Integer, nullable=True, comment="评估置信度 0-100"
    )
    weaknesses: Mapped[dict | None] = mapped_column(
        JSON, nullable=True, comment="能力短板分析"
    )
    strengths: Mapped[dict | None] = mapped_column(
        JSON, nullable=True, comment="能力优势分析"
    )

    # ── Generated outputs ──────────────────────────────────
    portrait_data: Mapped[dict | None] = mapped_column(
        JSON, nullable=True, comment="生成的基线画像数据"
    )
    recommendations: Mapped[dict | None] = mapped_column(
        JSON, nullable=True, comment="改进建议"
    )

    assessment_version: Mapped[str | None] = mapped_column(
        String(20), nullable=True, comment="评估算法版本，如 XH-EGM-2.0"
    )

    __table_args__ = (
        {"comment": "学生基线测评"}
    )


class StudentPortrait(Base, TimestampMixin):
    """Cached student ability portrait — the computed five-dimension profile.

    Historically computed on-the-fly from evidence. This table persists the
    latest computed portrait for efficient queries by other modules (Group1, Group3).
    """

    __tablename__ = "student_portraits"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, comment="主键")
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, unique=True, index=True,
        comment="学生用户ID"
    )
    portrait_data: Mapped[dict] = mapped_column(
        JSON, nullable=False, comment="完整画像数据JSON"
    )
    dimensions: Mapped[dict] = mapped_column(
        JSON, nullable=False, comment="五维能力分数: {专业学习,项目实践,创新探索,沟通协作,职业准备}"
    )
    overall_score: Mapped[int] = mapped_column(Integer, nullable=False, comment="综合评分")
    completeness: Mapped[int] = mapped_column(Integer, nullable=False, default=0, comment="完整度 0-100")
    confidence: Mapped[int] = mapped_column(Integer, nullable=False, default=0, comment="置信度 0-100")
    total_evidence: Mapped[int] = mapped_column(Integer, nullable=False, default=0, comment="总证据数")
    verified_evidence: Mapped[int] = mapped_column(Integer, nullable=False, default=0, comment="已验证证据数")
    algorithm_version: Mapped[str | None] = mapped_column(
        String(20), nullable=True, comment="算法版本，如 XH-EGM-2.0"
    )
    calculated_at: Mapped[int] = mapped_column(
        Integer, nullable=True, comment="计算时间戳"
    )

    __table_args__ = (
        {"comment": "学生能力画像（缓存）"}
    )


class GrowthPlan(Base, TimestampMixin):
    """A semester-based growth plan that groups growth tasks.

    One plan covers one semester. Tasks reference this plan.
    """

    __tablename__ = "growth_plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, comment="主键")
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True, comment="学生用户ID"
    )
    semester_index: Mapped[int] = mapped_column(
        Integer, nullable=False, comment="学期序号 0-7"
    )
    semester_label: Mapped[str] = mapped_column(
        String(40), nullable=False, comment="学期标签，如「大一上」"
    )
    focus_dimensions: Mapped[list | None] = mapped_column(
        JSON, nullable=True, comment="本阶段重点能力维度"
    )
    target_xp: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, comment="目标经验值"
    )
    earned_xp: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0", comment="已获得经验值"
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="active", server_default="'active'",
        comment="状态: active | completed | archived"
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True, comment="阶段备注")

    __table_args__ = (
        {"comment": "学期成长计划"}
    )


class GrowthTaskProgress(Base, TimestampMixin):
    """Progress tracking for individual growth tasks.

    Tracks completion, check-in records, and stage progress.
    """

    __tablename__ = "growth_task_progress"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, comment="主键")
    growth_task_id: Mapped[str] = mapped_column(
        String(120), ForeignKey("growth_tasks.id"), nullable=False, index=True, comment="成长任务ID"
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True, comment="学生用户ID"
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="not_started",
        comment="状态: not_started | in_progress | completed | verified"
    )
    progress_pct: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0", comment="完成进度 0-100"
    )
    check_in_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0", comment="打卡次数"
    )
    last_check_in_at: Mapped[int | None] = mapped_column(
        Integer, nullable=True, comment="最后打卡时间戳"
    )
    completed_at: Mapped[int | None] = mapped_column(
        Integer, nullable=True, comment="完成时间戳"
    )
    verified_at: Mapped[int | None] = mapped_column(
        Integer, nullable=True, comment="核验通过时间戳"
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True, comment="进度备注")

    __table_args__ = (
        {"comment": "成长任务进度"}
    )


class RoleModel(Base, TimestampMixin):
    """A role model / mentor profile — 往届优秀学生/学长学姐案例.

    These are curated success stories used for benchmarking and motivation.
    Separate from faculty directory (teachers/professors).
    """

    __tablename__ = "role_models"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, comment="主键")
    name: Mapped[str] = mapped_column(String(30), nullable=False, comment="姓名（可脱敏展示）")
    display_name: Mapped[str | None] = mapped_column(
        String(60), nullable=True, comment="展示名称（如「2019级李学长」）"
    )
    avatar_file_id: Mapped[str | None] = mapped_column(
        String(64), nullable=True, comment="头像文件ID"
    )

    # ── Background tags ────────────────────────────────────
    background_tags: Mapped[dict | None] = mapped_column(
        JSON, nullable=True, comment="背景标签: 高考分数段/学校/专业/生源地 等"
    )
    gaokao_score_range: Mapped[str | None] = mapped_column(
        String(30), nullable=True, comment="高考分数段，如 '550-600'"
    )
    university_name: Mapped[str | None] = mapped_column(
        String(160), nullable=True, comment="本科学校"
    )
    major_name: Mapped[str | None] = mapped_column(
        String(160), nullable=True, comment="本科专业"
    )
    target_industry: Mapped[str | None] = mapped_column(
        String(80), nullable=True, comment="目标行业"
    )
    target_job_category: Mapped[str | None] = mapped_column(
        String(80), nullable=True, comment="目标岗位类别"
    )

    # ── Outcome ────────────────────────────────────────────
    final_offer: Mapped[str | None] = mapped_column(
        String(300), nullable=True, comment="最终offer/就业结果"
    )
    final_employer: Mapped[str | None] = mapped_column(
        String(300), nullable=True, comment="最终入职单位"
    )
    graduation_year: Mapped[int | None] = mapped_column(
        Integer, nullable=True, comment="毕业年份"
    )

    # ── Profile ────────────────────────────────────────────
    summary: Mapped[str | None] = mapped_column(Text, nullable=True, comment="案例摘要")
    full_story: Mapped[str | None] = mapped_column(Text, nullable=True, comment="完整成长故事")
    is_published: Mapped[bool] = mapped_column(
        "is_published", Integer, nullable=False, default=0, server_default="0",
        comment="是否已发布"
    )
    is_featured: Mapped[bool] = mapped_column(
        "is_featured", Integer, nullable=False, default=0, server_default="0",
        comment="是否精选案例"
    )

    __table_args__ = (
        {"comment": "榜样/优秀案例"}
    )


class RoleModelExperience(Base, TimestampMixin):
    """Key experiences on a role model's growth trajectory.

    Each row is one significant experience: competition, internship, certificate, etc.
    """

    __tablename__ = "role_model_experiences"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, comment="主键")
    role_model_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("role_models.id"), nullable=False, index=True, comment="榜样ID"
    )
    experience_type: Mapped[str] = mapped_column(
        String(40), nullable=False, comment="类型: competition | internship | certificate | project | research"
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False, comment="经历标题")
    description: Mapped[str | None] = mapped_column(Text, nullable=True, comment="经历描述")
    semester_label: Mapped[str | None] = mapped_column(
        String(20), nullable=True, comment="发生学期，如「大二下」"
    )
    date_range: Mapped[str | None] = mapped_column(
        String(60), nullable=True, comment="时间范围"
    )
    dimension: Mapped[str | None] = mapped_column(
        String(40), nullable=True, comment="能力维度: 专业学习/项目实践/..."
    )
    sort_order: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0", comment="排序"
    )

    __table_args__ = (
        {"comment": "榜样成长经历"}
    )


class RoleModelMilestone(Base, TimestampMixin):
    """Career milestones on a role model's trajectory.

    Key outcome points: offers, promotions, certifications, publications.
    """

    __tablename__ = "role_model_milestones"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, comment="主键")
    role_model_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("role_models.id"), nullable=False, index=True, comment="榜样ID"
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False, comment="里程碑标题")
    description: Mapped[str | None] = mapped_column(Text, nullable=True, comment="描述")
    milestone_date: Mapped[str | None] = mapped_column(
        String(20), nullable=True, comment="达成日期"
    )
    sort_order: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0", comment="排序"
    )

    __table_args__ = (
        {"comment": "榜样成长里程碑"}
    )


class RoleModelMatch(Base, TimestampMixin):
    """A match between a student and a role model.

    Stores the match score and which dimensions aligned.
    """

    __tablename__ = "role_model_matches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, comment="主键")
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True, comment="学生用户ID"
    )
    role_model_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("role_models.id"), nullable=False, index=True, comment="榜样ID"
    )
    match_score: Mapped[int] = mapped_column(Integer, nullable=False, comment="匹配分数 0-100")
    matched_dimensions: Mapped[list | None] = mapped_column(
        JSON, nullable=True, comment="匹配维度列表"
    )
    match_rationale: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="匹配理由"
    )
    is_viewed: Mapped[bool] = mapped_column(
        "is_viewed", Integer, nullable=False, default=0, server_default="0", comment="是否已查看"
    )
    feedback: Mapped[str | None] = mapped_column(
        String(20), nullable=True, comment="反馈: helpful | not_relevant"
    )

    __table_args__ = (
        {"comment": "学生-榜样匹配记录"}
    )
