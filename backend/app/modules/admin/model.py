"""
Admin module: audit logs, recovery requests, deletion requests.

Maps to xh_audit_logs, xh_recovery_requests, xh_deletion_requests.
"""

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from ...db.base import Base, TimestampMixin


class AuditLog(Base):
    """Immutable audit log for all critical operations."""

    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, comment="UUID主键")
    action: Mapped[str] = mapped_column(
        String(100), nullable=False, index=True, comment="操作类型"
    )
    actor_user_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True, index=True, comment="操作人ID"
    )
    target_type: Mapped[str] = mapped_column(
        String(40), nullable=False, index=True, comment="目标类型"
    )
    target_id: Mapped[str | None] = mapped_column(
        String(100), nullable=True, comment="目标ID"
    )
    details: Mapped[dict | None] = mapped_column(
        JSON, nullable=True, comment="操作详情JSON"
    )
    created_at: Mapped[int] = mapped_column(
        Integer, nullable=False, index=True, comment="创建时间戳"
    )

    __table_args__ = (
        {"comment": "审计日志"}
    )


class RecoveryRequest(Base, TimestampMixin):
    """Password recovery request — admin-mediated."""

    __tablename__ = "recovery_requests"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, comment="UUID主键")
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True, comment="用户ID"
    )
    requested_at: Mapped[int] = mapped_column(
        Integer, nullable=False, comment="申请时间戳"
    )
    completed_at: Mapped[int | None] = mapped_column(
        Integer, nullable=True, comment="完成时间戳"
    )
    completed_by: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True, comment="处理人ID"
    )

    __table_args__ = (
        {"comment": "密码找回申请"}
    )


class DeletionRequest(Base, TimestampMixin):
    """Account deletion request with 7-day grace period."""

    __tablename__ = "deletion_requests"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, comment="UUID主键")
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True, comment="用户ID"
    )
    requested_at: Mapped[int] = mapped_column(
        Integer, nullable=False, comment="申请时间戳"
    )
    scheduled_at: Mapped[int] = mapped_column(
        Integer, nullable=False, comment="计划执行时间戳（7天后）"
    )
    cancelled_at: Mapped[int | None] = mapped_column(
        Integer, nullable=True, comment="取消时间戳"
    )
    completed_at: Mapped[int | None] = mapped_column(
        Integer, nullable=True, comment="完成时间戳"
    )

    __table_args__ = (
        {"comment": "账号注销申请（7天撤销期）"}
    )
