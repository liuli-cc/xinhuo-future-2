"""
Reference layer: standard dictionaries for majors, jobs, and code values.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ...db.base import Base, TimestampMixin


def _new_id() -> int:
    """Generate a numeric ID from timestamp + random."""
    import random
    return int(datetime.now(timezone.utc).timestamp() * 1000) + random.randint(1, 999)


class RefMajorStandard(Base, TimestampMixin):
    """National standard undergraduate major catalogue.

    Source: 教育部本科专业目录
    Current data: ~845 records, no major_code available yet.
    """

    __tablename__ = "ref_major_standard"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, comment="主键")
    discipline_name: Mapped[str] = mapped_column(
        String(80), nullable=False, index=True, comment="学科门类，如 工学、理学"
    )
    major_category_name: Mapped[str] = mapped_column(
        String(120), nullable=False, comment="专业类，如 计算机类"
    )
    major_name: Mapped[str] = mapped_column(
        String(160), nullable=False, index=True, comment="专业名称，如 计算机科学与技术"
    )
    major_code: Mapped[str | None] = mapped_column(
        String(20), nullable=True, comment="专业代码，暂缺，后续补充"
    )
    source: Mapped[str] = mapped_column(
        String(80), default="moa_national_standard", comment="数据来源"
    )
    source_version: Mapped[str | None] = mapped_column(
        String(40), nullable=True, comment="数据来源版本"
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="1", comment="是否启用"
    )

    # Reverse relationships
    university_major_programs: Mapped[list["UniversityMajorProgram"]] = relationship(
        back_populates="standard_major", lazy="selectin"
    )

    __table_args__ = (
        {"comment": "本科专业国家标准目录"}
    )


class RefJobStandard(Base, TimestampMixin):
    """Standardized job/position classification.

    Source: industry job taxonomy
    Current data: ~1043 records with domain/category/name hierarchy.
    """

    __tablename__ = "ref_job_standard"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, comment="主键")
    job_domain: Mapped[str] = mapped_column(
        String(80), nullable=False, index=True, comment="岗位大类，如 互联网/AI"
    )
    job_category: Mapped[str] = mapped_column(
        String(120), nullable=False, comment="岗位类，如 后端开发"
    )
    job_name: Mapped[str] = mapped_column(
        String(160), nullable=False, index=True, comment="岗位名称，如 Java"
    )
    aliases: Mapped[dict | None] = mapped_column(
        JSON, nullable=True, comment="岗位别名/同义词 JSON"
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="1", comment="是否启用"
    )

    __table_args__ = (
        {"comment": "岗位标准化分类"}
    )


class RefCodeValue(Base, TimestampMixin):
    """Extensible code-value dictionary.

    Used for education levels, employment destinations, organization types,
    industry codes, region codes, political status, training modes, etc.

    Design: namespace + code + label with optional parent for hierarchy.
    """

    __tablename__ = "ref_code_values"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, comment="主键")
    namespace: Mapped[str] = mapped_column(
        String(80), nullable=False, index=True, comment="命名空间，如 education_level, destination_code"
    )
    code: Mapped[str] = mapped_column(
        String(40), nullable=False, comment="代码值"
    )
    label: Mapped[str] = mapped_column(
        String(160), nullable=False, comment="显示名称"
    )
    parent_code: Mapped[str | None] = mapped_column(
        String(40), nullable=True, comment="父级代码，支持层级"
    )
    metadata_: Mapped[dict | None] = mapped_column(
        "metadata", JSON, nullable=True, comment="附加元数据"
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="1", comment="是否启用"
    )

    __table_args__ = (
        {"comment": "通用代码字典"}
    )
