"""
Career module: job snapshots, evidence-based matches, applications, events,
candidate pushes, and student authorizations.

Group3 domain: 智能岗位匹配.
"""

from __future__ import annotations

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from ...db.base import Base, TimestampMixin


class CareerJob(Base, TimestampMixin):
    """A job snapshot imported by a student."""

    __tablename__ = "career_jobs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, comment="UUID主键")
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True, comment="用户ID"
    )
    title: Mapped[str] = mapped_column(String(100), nullable=False, comment="岗位名称")
    company: Mapped[str] = mapped_column(String(80), nullable=False, comment="公司名称")
    city: Mapped[str | None] = mapped_column(String(40), nullable=True, comment="城市")
    employment_type: Mapped[str | None] = mapped_column(
        String(30), nullable=True, comment="类型: 实习 | 校招 | 社招"
    )
    salary: Mapped[str | None] = mapped_column(String(40), nullable=True, comment="薪资范围")
    source_url: Mapped[str | None] = mapped_column(String(500), nullable=True, comment="来源URL")
    source_name: Mapped[str | None] = mapped_column(String(60), nullable=True, comment="来源名称")
    description: Mapped[str] = mapped_column(Text, nullable=False, comment="岗位描述")
    requirements: Mapped[dict | None] = mapped_column(JSON, nullable=True, comment="解析出的岗位要求")

    __table_args__ = ({"comment": "岗位快照"},)


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
    """A student's application to a saved job."""

    __tablename__ = "career_applications"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, comment="UUID主键")
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True, comment="用户ID"
    )
    job_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("career_jobs.id"), nullable=False, index=True, comment="岗位ID"
    )
    status: Mapped[str] = mapped_column(
        String(30), default="saved",
        comment="状态: saved | applied | written_test | interview | offer | rejected | withdrawn"
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True, comment="备注/复盘")
    submitted_at: Mapped[int | None] = mapped_column(Integer, nullable=True, comment="投递时间戳")
    last_event_at: Mapped[int | None] = mapped_column(Integer, nullable=True, comment="最后事件时间戳")

    __table_args__ = ({"comment": "岗位投递记录"},)


class CareerEvent(Base, TimestampMixin):
    """A single event/status change in an application lifecycle."""

    __tablename__ = "career_events"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, comment="UUID主键")
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True, comment="用户ID"
    )
    application_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("career_applications.id"), nullable=False, index=True,
        comment="投递记录ID"
    )
    status: Mapped[str] = mapped_column(String(30), nullable=False, comment="状态")
    note: Mapped[str | None] = mapped_column(Text, nullable=True, comment="备注")

    __table_args__ = ({"comment": "投递事件/复盘记录"},)


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
