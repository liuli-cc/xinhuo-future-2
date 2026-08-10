"""
Growth module: growth tasks and cloud state.

Maps to xh_growth_tasks and xh_cloud_state collections.
"""

from __future__ import annotations

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

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
