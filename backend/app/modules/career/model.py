"""
Career module: shared job board, campus announcements, evidence-based matches,
applications, events, favorites, candidate pushes, and student authorizations.

Group3 domain: 智能岗位匹配. 术语见根目录 CONTEXT.md：
招聘岗位/校招公告/投递(阶段+结束原因)/收藏 —— 岗位与公告全链路分表（ADR-0002）。
"""

from __future__ import annotations

from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, JSON, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from ...db.base import Base, TimestampMixin


class CareerJob(Base, TimestampMixin):
    """A shared job posting (岗位) — imported by staff or self-saved by a student.

    source='custom' + visibility='private' 时是学生的自定义岗位，只进本人工作台；
    其余为岗位大厅公共条目（ADR-0002）。
    """

    __tablename__ = "career_jobs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, comment="UUID主键")
    created_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True,
        comment="录入人ID（导入=管理员/教师；custom=学生本人）",
    )
    title: Mapped[str] = mapped_column(String(100), nullable=False, comment="岗位名称")
    company: Mapped[str] = mapped_column(String(80), nullable=False, comment="公司名称")
    city: Mapped[str | None] = mapped_column(String(200), nullable=True, comment="城市/工作地点原文")
    employment_type: Mapped[str | None] = mapped_column(
        String(30), nullable=True, comment="展示用类型: 实习 | 校招 | 兼职 | 科研助理"
    )
    salary: Mapped[str | None] = mapped_column(String(40), nullable=True, comment="薪资范围")
    source_url: Mapped[str | None] = mapped_column(String(500), nullable=True, comment="投递网址")
    source_name: Mapped[str | None] = mapped_column(String(60), nullable=True, comment="来源名称")
    description: Mapped[str] = mapped_column(Text, nullable=False, comment="岗位描述/要求原文")
    requirements: Mapped[dict | None] = mapped_column(JSON, nullable=True, comment="关键词规则解析的岗位要求（降级路径产物）")
    employer_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("employers.id"), nullable=True, index=True,
        comment="企业ID（关联去重后的企业库，可空）",
    )
    tags: Mapped[list | None] = mapped_column(JSON, nullable=True, comment="岗位标签")

    # ── 大厅维度（v2） ──────────────────────────────────────
    category: Mapped[str] = mapped_column(
        String(20), nullable=False, default="social", server_default="social", index=True,
        comment="招聘类别: intern | campus | social",
    )
    majors_text: Mapped[str | None] = mapped_column(String(500), nullable=True, comment="专业限制原文")
    industries: Mapped[str | None] = mapped_column(String(200), nullable=True, comment="行业标签（逗号分隔）")
    company_nature: Mapped[str | None] = mapped_column(String(40), nullable=True, comment="企业性质: 国企 | 央企 | 民企 | ...")
    published_at: Mapped[int | None] = mapped_column(BigInteger, nullable=True, index=True, comment="发布/录入时间戳（默认排序依据）")
    deadline: Mapped[int | None] = mapped_column(BigInteger, nullable=True, comment="截止时间戳（空=按发布+3个月自动过期）")
    source: Mapped[str] = mapped_column(
        String(20), nullable=False, default="custom", server_default="custom",
        comment="来源: import | school_coop | custom",
    )
    visibility: Mapped[str] = mapped_column(
        String(20), nullable=False, default="public", server_default="public",
        comment="可见性: public | private（custom 岗位为 private）",
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="active", server_default="active",
        comment="上架状态: active | offline（过期由 published_at+deadline 规则动态判定，不落库）",
    )
    requirement_profile: Mapped[dict | None] = mapped_column(
        JSON, nullable=True, comment="AI 结构化需求档案: {skills:[{name,required}], majors:[], hardReqs:[]}"
    )

    __table_args__ = ({"comment": "招聘岗位（共享池 + 学生自定义）"},)


class CareerAnnouncement(Base, TimestampMixin):
    """A campus recruitment announcement (校招公告) — one company, one hiring wave.

    含多个岗位（positions_text 为清单原文），有届数；不做匹配打分（ADR-0001/0002）。
    """

    __tablename__ = "career_announcements"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, comment="UUID主键")
    created_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True, comment="录入人ID"
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False, comment="简章标题")
    company: Mapped[str] = mapped_column(String(80), nullable=False, comment="公司名称")
    employer_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("employers.id"), nullable=True, index=True, comment="企业ID"
    )
    city_text: Mapped[str | None] = mapped_column(String(300), nullable=True, comment="工作城市（逗号分隔原文）")
    cohort: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True, comment="届数，如 27届")
    positions_text: Mapped[str | None] = mapped_column(Text, nullable=True, comment="招聘岗位清单原文")
    industries: Mapped[str | None] = mapped_column(String(200), nullable=True, comment="行业标签（逗号分隔）")
    company_nature: Mapped[str | None] = mapped_column(String(40), nullable=True, comment="企业性质")
    detail_url: Mapped[str | None] = mapped_column(String(1000), nullable=True, comment="详情链接")
    apply_url: Mapped[str | None] = mapped_column(String(1000), nullable=True, comment="投递链接")
    description: Mapped[str | None] = mapped_column(Text, nullable=True, comment="公司描述/备注")
    published_at: Mapped[int | None] = mapped_column(BigInteger, nullable=True, index=True, comment="发布/录入时间戳")
    deadline: Mapped[int | None] = mapped_column(BigInteger, nullable=True, comment="截止时间戳（空=发布+6个月自动过期）")
    source: Mapped[str] = mapped_column(
        String(20), nullable=False, default="import", server_default="import",
        comment="来源: import | school_coop",
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="active", server_default="active",
        comment="上架状态: active | offline",
    )

    __table_args__ = ({"comment": "校招公告"},)


class CareerMatch(Base, TimestampMixin):
    """Evidence-based job match result (cached)."""

    __tablename__ = "career_matches"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, comment="UUID主键")
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True, comment="用户ID"
    )
    job_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("career_jobs.id"), nullable=False, index=True, comment="岗位ID"
    )
    overall_score: Mapped[int] = mapped_column(Integer, nullable=False, comment="综合匹配分数")
    confidence: Mapped[int] = mapped_column(Integer, nullable=False, comment="置信度")
    verdict: Mapped[str] = mapped_column(String(20), nullable=False, comment="匹配结论")
    result: Mapped[dict] = mapped_column(JSON, nullable=False, comment="完整匹配结果JSON")

    __table_args__ = ({"comment": "岗位匹配结果"},)


class CareerApplication(Base, TimestampMixin):
    """A student's application (投递) to a job posting.

    两层状态（CONTEXT.md）：stage 七选一 + outcome 结束原因二选一（可空）。
    """

    __tablename__ = "career_applications"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, comment="UUID主键")
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True, comment="用户ID"
    )
    job_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("career_jobs.id"), nullable=False, index=True, comment="岗位ID"
    )
    stage: Mapped[str] = mapped_column(
        String(30), nullable=False, default="saved", server_default="saved", index=True,
        comment="阶段: saved | applied | written_test_pending | written_test | interview_pending | interview | offer",
    )
    outcome: Mapped[str | None] = mapped_column(
        String(20), nullable=True, index=True, comment="结束原因: rejected(未通过) | withdrawn(已终止)；进行中为空",
    )
    closed_at: Mapped[int | None] = mapped_column(Integer, nullable=True, comment="结束时间戳")
    note: Mapped[str | None] = mapped_column(Text, nullable=True, comment="最近一次复盘")
    submitted_at: Mapped[int | None] = mapped_column(Integer, nullable=True, comment="投递时间戳")
    last_event_at: Mapped[int | None] = mapped_column(Integer, nullable=True, comment="最后事件时间戳")

    __table_args__ = ({"comment": "岗位投递记录"},)


class CareerAnnouncementApplication(Base, TimestampMixin):
    """A student's application (公告投递) to a campus announcement — 与岗位投递分表（ADR-0002），
    阶段/结束原因/事件规则完全一致。"""

    __tablename__ = "career_announcement_applications"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, comment="UUID主键")
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True, comment="用户ID"
    )
    announcement_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("career_announcements.id"), nullable=False, index=True, comment="公告ID"
    )
    stage: Mapped[str] = mapped_column(
        String(30), nullable=False, default="saved", server_default="saved", index=True,
        comment="阶段: 同 career_applications.stage",
    )
    outcome: Mapped[str | None] = mapped_column(
        String(20), nullable=True, index=True, comment="结束原因: rejected | withdrawn",
    )
    closed_at: Mapped[int | None] = mapped_column(Integer, nullable=True, comment="结束时间戳")
    note: Mapped[str | None] = mapped_column(Text, nullable=True, comment="最近一次复盘")
    submitted_at: Mapped[int | None] = mapped_column(Integer, nullable=True, comment="投递时间戳")
    last_event_at: Mapped[int | None] = mapped_column(Integer, nullable=True, comment="最后事件时间戳")

    __table_args__ = ({"comment": "校招公告投递记录"},)


class CareerEvent(Base, TimestampMixin):
    """A single stage change in a job application lifecycle (时间线事件，只增不改)."""

    __tablename__ = "career_events"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, comment="UUID主键")
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True, comment="用户ID"
    )
    application_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("career_applications.id"), nullable=False, index=True,
        comment="岗位投递记录ID"
    )
    stage: Mapped[str] = mapped_column(String(30), nullable=False, comment="阶段（进入的阶段）")
    note: Mapped[str | None] = mapped_column(Text, nullable=True, comment="复盘/备注")

    __table_args__ = ({"comment": "岗位投递事件/复盘记录"},)


class CareerAnnouncementEvent(Base, TimestampMixin):
    """A single stage change in an announcement application lifecycle."""

    __tablename__ = "career_announcement_events"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, comment="UUID主键")
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True, comment="用户ID"
    )
    application_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("career_announcement_applications.id"), nullable=False, index=True,
        comment="公告投递记录ID"
    )
    stage: Mapped[str] = mapped_column(String(30), nullable=False, comment="阶段（进入的阶段）")
    note: Mapped[str | None] = mapped_column(Text, nullable=True, comment="复盘/备注")

    __table_args__ = ({"comment": "公告投递事件/复盘记录"},)


class CareerFavorite(Base, TimestampMixin):
    """A student's bookmark on a job posting (收藏，独立于投递)."""

    __tablename__ = "career_favorites"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, comment="UUID主键")
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True, comment="用户ID"
    )
    job_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("career_jobs.id"), nullable=False, index=True, comment="岗位ID"
    )

    __table_args__ = (
        UniqueConstraint("user_id", "job_id", name="uq_career_favorites_user_job"),
        {"comment": "岗位收藏"},
    )


class CareerAnnouncementFavorite(Base, TimestampMixin):
    """A student's bookmark on a campus announcement."""

    __tablename__ = "career_announcement_favorites"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, comment="UUID主键")
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True, comment="用户ID"
    )
    announcement_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("career_announcements.id"), nullable=False, index=True, comment="公告ID"
    )

    __table_args__ = (
        UniqueConstraint("user_id", "announcement_id", name="uq_career_ann_favorites_user_ann"),
        {"comment": "校招公告收藏"},
    )


class RecommendationFeedback(Base, TimestampMixin):
    """Student feedback on career recommendations."""

    __tablename__ = "recommendation_feedback"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, comment="UUID主键")
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True, comment="用户ID"
    )
    target_role: Mapped[str | None] = mapped_column(String(40), nullable=True, comment="目标岗位")
    recommendation_id: Mapped[str] = mapped_column(String(120), nullable=False, comment="推荐ID")
    feedback: Mapped[str] = mapped_column(
        String(20), nullable=False, comment="反馈: accepted | completed | dismissed"
    )

    __table_args__ = ({"comment": "推荐反馈"},)


class CandidatePush(Base, TimestampMixin):
    """Record of a student candidate being pushed/recommended to an enterprise.

    Supports Group3's 校企定向通道: 合作企业 → 定向岗位 → 候选人推送 → 学生授权.
    """

    __tablename__ = "candidate_pushes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, comment="主键")
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True, comment="学生用户ID"
    )
    employer_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("employers.id"), nullable=True, index=True, comment="企业ID"
    )
    career_job_id: Mapped[str | None] = mapped_column(
        String(64), ForeignKey("career_jobs.id"), nullable=True, comment="岗位ID"
    )
    pushed_by: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True, comment="推送人（教师/管理员）ID"
    )

    # ── Authorization ──────────────────────────────────────
    authorization_status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pending",
        comment="授权状态: pending | authorized | declined | expired"
    )
    authorized_at: Mapped[int | None] = mapped_column(
        Integer, nullable=True, comment="授权时间戳"
    )
    authorization_scope: Mapped[dict | None] = mapped_column(
        JSON, nullable=True, comment="授权范围: {resume, portrait, scores, ...}"
    )

    # ── Enterprise side ────────────────────────────────────
    enterprise_viewed: Mapped[bool] = mapped_column(
        "enterprise_viewed", Integer, nullable=False, default=0, server_default="0",
        comment="企业是否已查看"
    )
    enterprise_viewed_at: Mapped[int | None] = mapped_column(
        Integer, nullable=True, comment="企业查看时间戳"
    )
    enterprise_feedback: Mapped[str | None] = mapped_column(
        String(40), nullable=True, comment="企业反馈: interested | not_interested | interview"
    )
    enterprise_note: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="企业备注"
    )

    # ── Outcome ────────────────────────────────────────────
    push_result: Mapped[str | None] = mapped_column(
        String(30), nullable=True,
        comment="推送结果: interview_invited | offer | hired | rejected | no_response"
    )
    result_note: Mapped[str | None] = mapped_column(Text, nullable=True, comment="结果备注")

    __table_args__ = (
        {"comment": "候选人推送记录（校企定向）"}
    )


class StudentDataAuthorization(Base, TimestampMixin):
    """Student consent record for sharing their data with specific enterprises.

    Required before any candidate push. Tracks what data the student allows
    to share and for how long.
    """

    __tablename__ = "student_data_authorizations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, comment="主键")
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True, comment="学生用户ID"
    )
    employer_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("employers.id"), nullable=True, index=True, comment="授权企业ID（NULL=通用授权）"
    )

    # ── Scope ──────────────────────────────────────────────
    share_resume: Mapped[bool] = mapped_column(
        "share_resume", Integer, nullable=False, default=0, server_default="0",
        comment="是否授权分享简历"
    )
    share_portrait: Mapped[bool] = mapped_column(
        "share_portrait", Integer, nullable=False, default=0, server_default="0",
        comment="是否授权分享能力画像"
    )
    share_scores: Mapped[bool] = mapped_column(
        "share_scores", Integer, nullable=False, default=0, server_default="0",
        comment="是否授权分享成绩"
    )
    share_evidence: Mapped[bool] = mapped_column(
        "share_evidence", Integer, nullable=False, default=0, server_default="0",
        comment="是否授权分享证据摘要"
    )
    share_contact: Mapped[bool] = mapped_column(
        "share_contact", Integer, nullable=False, default=0, server_default="0",
        comment="是否授权分享联系方式"
    )

    # ── Validity ───────────────────────────────────────────
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="active", server_default="'active'",
        comment="状态: active | revoked | expired"
    )
    expires_at: Mapped[int | None] = mapped_column(
        Integer, nullable=True, comment="授权过期时间戳"
    )
    revoked_at: Mapped[int | None] = mapped_column(
        Integer, nullable=True, comment="撤销时间戳"
    )

    __table_args__ = (
        {"comment": "学生数据授权记录"}
    )
