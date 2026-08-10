"""
Evidence module: student evidence, evidence files, and evidence reviews.

Maps to xh_evidence, xh_evidence_files, xh_evidence_reviews collections.
"""

from __future__ import annotations

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ...db.base import Base, TimestampMixin


class Evidence(Base, TimestampMixin):
    """A piece of growth evidence submitted by a student."""

    __tablename__ = "evidence"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, comment="主键")
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True, comment="用户ID"
    )
    student_id: Mapped[str] = mapped_column(
        String(20), nullable=False, comment="学号（冗余，方便查询）"
    )
    task_id: Mapped[str | None] = mapped_column(
        String(80), nullable=True, index=True, comment="关联成长任务ID"
    )
    task_title: Mapped[str | None] = mapped_column(
        String(120), nullable=True, comment="关联成长任务标题"
    )
    title: Mapped[str] = mapped_column(String(120), nullable=False, comment="成果标题")
    category: Mapped[str] = mapped_column(String(40), nullable=False, comment="证据类型")
    dimension: Mapped[str] = mapped_column(
        String(40), nullable=False, index=True,
        comment="能力维度: 专业学习 | 项目实践 | 创新探索 | 沟通协作 | 职业准备"
    )
    detail: Mapped[str] = mapped_column(Text, nullable=False, comment="成果说明")
    evidence_ref: Mapped[str | None] = mapped_column(
        String(500), nullable=True, comment="可核验参考链接"
    )
    evidence_date: Mapped[str] = mapped_column(
        String(20), nullable=False, comment="发生日期 YYYY-MM-DD"
    )
    source_type: Mapped[str] = mapped_column(String(40), nullable=False, comment="证据来源类型")
    source_reliability: Mapped[int] = mapped_column(
        Integer, default=70, comment="来源可信度 0-100"
    )
    relevance: Mapped[int] = mapped_column(Integer, default=80, comment="相关性 0-100")
    quality: Mapped[int] = mapped_column(Integer, default=75, comment="质量 0-100")
    contribution: Mapped[int] = mapped_column(Integer, default=70, comment="贡献度 0-100")
    attachment_id: Mapped[str | None] = mapped_column(
        String(80), nullable=True, comment="附件ID"
    )
    verification_status: Mapped[str] = mapped_column(
        String(20), default="pending", index=True,
        comment="核验状态: pending | verified | rejected"
    )
    reviewer_note: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="审核备注"
    )
    reviewed_at: Mapped[int | None] = mapped_column(
        Integer, nullable=True, comment="审核时间戳"
    )
    reviewer_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True, comment="审核人ID"
    )

    __table_args__ = (
        {"comment": "成长证据/佐证"}
    )


class EvidenceReview(Base, TimestampMixin):
    """Review history for evidence — each review is a separate row."""

    __tablename__ = "evidence_reviews"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, comment="UUID主键")
    evidence_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("evidence.id"), nullable=False, index=True, comment="证据ID"
    )
    reviewer_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True, comment="审核人ID"
    )
    previous_status: Mapped[str] = mapped_column(
        String(20), nullable=False, comment="审核前状态"
    )
    next_status: Mapped[str] = mapped_column(
        String(20), nullable=False, comment="审核后状态"
    )
    reviewer_note: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="审核备注"
    )

    __table_args__ = (
        {"comment": "证据审核历史"}
    )


class EvidenceFile(Base, TimestampMixin):
    """File attachment for evidence — stored in COS, referenced here."""

    __tablename__ = "evidence_files"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, comment="UUID主键")
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True, comment="用户ID"
    )
    evidence_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("evidence.id"), nullable=True, index=True, comment="关联证据ID"
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False, comment="文件名称")
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False, comment="MIME类型")
    size: Mapped[int] = mapped_column(Integer, nullable=False, comment="文件大小(字节)")
    sha256: Mapped[str] = mapped_column(String(64), nullable=False, comment="SHA-256摘要")
    # When using COS, store object_key; for transition, can store data inline
    object_key: Mapped[str | None] = mapped_column(
        String(500), nullable=True, comment="COS对象键"
    )
    data_base64: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="Base64数据（仅过渡期，迁移至COS后废弃）"
    )

    __table_args__ = (
        {"comment": "证据附件"}
    )
