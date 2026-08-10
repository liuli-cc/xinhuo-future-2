"""
Career module: job snapshots, evidence-based matches, applications, and events.

Maps to xh_career_jobs, xh_career_matches, xh_career_applications,
xh_career_events, xh_recommendation_feedback collections.
"""

from __future__ import annotations

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

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
    source_name: Mapped[str | None] = mapped_column(
        String(60), nullable=True, comment="来源名称"
    )
    description: Mapped[str] = mapped_column(Text, nullable=False, comment="岗位描述")
    requirements: Mapped[dict | None] = mapped_column(
        JSON, nullable=True, comment="解析出的岗位要求"
    )

    __table_args__ = (
        {"comment": "岗位快照"}
    )


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

    __table_args__ = (
        {"comment": "岗位匹配结果"}
    )


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
    submitted_at: Mapped[int | None] = mapped_column(
        Integer, nullable=True, comment="投递时间戳"
    )
    last_event_at: Mapped[int | None] = mapped_column(
        Integer, nullable=True, comment="最后事件时间戳"
    )

    __table_args__ = (
        {"comment": "岗位投递记录"}
    )


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

    __table_args__ = (
        {"comment": "投递事件/复盘记录"}
    )


class RecommendationFeedback(Base, TimestampMixin):
    """Student feedback on career recommendations."""

    __tablename__ = "recommendation_feedback"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, comment="UUID主键")
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True, comment="用户ID"
    )
    target_role: Mapped[str | None] = mapped_column(
        String(40), nullable=True, comment="目标岗位"
    )
    recommendation_id: Mapped[str] = mapped_column(
        String(120), nullable=False, comment="推荐ID"
    )
    feedback: Mapped[str] = mapped_column(
        String(20), nullable=False, comment="反馈: accepted | completed | dismissed"
    )

    __table_args__ = (
        {"comment": "推荐反馈"}
    )
