"""
Import / Staging layer.

All raw Excel/CSV data enters through data_import_batches and data_import_rows
BEFORE being cleaned, normalized, and inserted into business tables.

This decouples the raw source format from the business schema — critical
when different years have different column layouts.
"""

from __future__ import annotations

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ...db.base import Base, TimestampMixin


class DataImportBatch(Base, TimestampMixin):
    """A single import batch — one Excel file or data source upload."""

    __tablename__ = "data_import_batches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, comment="主键")
    source_type: Mapped[str] = mapped_column(
        String(40), nullable=False, index=True,
        comment="数据来源类型: admission | employment | major_standard | job_standard | university_major"
    )
    source_filename: Mapped[str | None] = mapped_column(
        String(300), nullable=True, comment="源文件名"
    )
    source_year: Mapped[int | None] = mapped_column(
        Integer, nullable=True, index=True, comment="数据年份"
    )
    imported_by: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True, comment="导入人ID"
    )
    started_at: Mapped[int | None] = mapped_column(
        Integer, nullable=True, comment="开始时间戳"
    )
    finished_at: Mapped[int | None] = mapped_column(
        Integer, nullable=True, comment="完成时间戳"
    )
    status: Mapped[str] = mapped_column(
        String(20), default="pending",
        comment="状态: pending | importing | completed | partial | failed"
    )
    total_rows: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0", comment="总行数"
    )
    success_rows: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0", comment="成功行数"
    )
    failed_rows: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0", comment="失败行数"
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True, comment="备注")

    rows: Mapped[list["DataImportRow"]] = relationship(
        back_populates="batch", lazy="selectin", cascade="all, delete-orphan"
    )

    __table_args__ = (
        {"comment": "数据导入批次"}
    )


class DataImportRow(Base, TimestampMixin):
    """A single row from an import batch — raw data before normalization.

    raw_data holds the complete original row as JSON, preserving all columns
    even if they don't match the current business schema.
    """

    __tablename__ = "data_import_rows"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, comment="主键")
    batch_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("data_import_batches.id"), nullable=False, index=True, comment="批次ID"
    )
    row_number: Mapped[int] = mapped_column(
        Integer, nullable=False, comment="原始行号"
    )
    raw_data: Mapped[dict] = mapped_column(
        JSON, nullable=False, comment="原始行数据（完整JSON）"
    )
    normalized_status: Mapped[str] = mapped_column(
        String(20), default="pending",
        comment="标准化状态: pending | matched | partial | skipped | error"
    )
    target_table: Mapped[str | None] = mapped_column(
        String(80), nullable=True, comment="目标业务表名"
    )
    target_id: Mapped[str | None] = mapped_column(
        String(64), nullable=True, comment="目标业务记录ID"
    )
    error_message: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="错误信息"
    )

    batch: Mapped["DataImportBatch"] = relationship(back_populates="rows")

    __table_args__ = (
        {"comment": "导入数据行（原始数据暂存）"}
    )
