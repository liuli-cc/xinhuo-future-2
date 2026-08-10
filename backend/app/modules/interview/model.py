"""
Interview module: interview sessions with structured reports.

Maps to xh_interview_sessions collection.
"""

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from ...db.base import Base, TimestampMixin


class InterviewSession(Base, TimestampMixin):
    """A single interview practice session with its report."""

    __tablename__ = "interview_sessions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, comment="UUID主键")
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True, comment="用户ID"
    )
    target_role: Mapped[str] = mapped_column(String(60), nullable=False, comment="目标岗位")
    difficulty: Mapped[str] = mapped_column(
        String(20), nullable=False, comment="难度: 入门 | 标准 | 进阶"
    )
    answers: Mapped[dict | None] = mapped_column(
        JSON, nullable=True, comment="面试问答JSON"
    )
    report: Mapped[dict | None] = mapped_column(
        JSON, nullable=True, comment="面试报告JSON (V1)"
    )
    report_v2: Mapped[dict | None] = mapped_column(
        JSON, nullable=True, comment="面试报告JSON (V2)"
    )
    overall_score: Mapped[int | None] = mapped_column(
        Integer, nullable=True, comment="综合评分"
    )
    application_id: Mapped[str | None] = mapped_column(
        String(64), nullable=True, comment="关联投递记录ID"
    )

    __table_args__ = (
        {"comment": "模拟面试记录"}
    )


class ResumeUploadChunk(Base, TimestampMixin):
    """Chunk of a large resume upload — assembled server-side."""

    __tablename__ = "resume_upload_chunks"

    id: Mapped[str] = mapped_column(String(100), primary_key=True, comment="hash(userId:uploadId:index)")
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True, comment="用户ID"
    )
    upload_id: Mapped[str] = mapped_column(
        String(64), nullable=False, index=True, comment="上传会话ID"
    )
    index: Mapped[int] = mapped_column(Integer, nullable=False, comment="分片序号")
    total: Mapped[int] = mapped_column(Integer, nullable=False, comment="总分片数")
    data: Mapped[str] = mapped_column(Text, nullable=False, comment="Base64分片数据")

    __table_args__ = (
        {"comment": "简历上传分片"}
    )
