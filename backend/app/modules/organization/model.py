"""
Organization layer: universities, colleges, and university major programs.

Represents the actual organizational structure of the school.
"""

from __future__ import annotations

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ...db.base import Base, TimestampMixin


class University(Base, TimestampMixin):
    """University / institution record.

    Currently scoped to 内蒙古师范大学 (Inner Mongolia Normal University).
    Designed to support multiple universities in the future.
    """

    __tablename__ = "universities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, comment="主键")
    name: Mapped[str] = mapped_column(
        String(160), nullable=False, index=True, comment="学校名称"
    )
    short_name: Mapped[str | None] = mapped_column(
        String(80), nullable=True, comment="简称"
    )
    code: Mapped[str | None] = mapped_column(
        String(20), nullable=True, unique=True, comment="院校代码"
    )
    province: Mapped[str | None] = mapped_column(String(40), nullable=True, comment="所在省份")
    city: Mapped[str | None] = mapped_column(String(40), nullable=True, comment="所在城市")
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="1", comment="是否启用"
    )

    colleges: Mapped[list["College"]] = relationship(back_populates="university", lazy="selectin")

    __table_args__ = (
        {"comment": "学校/院校"}
    )


class College(Base, TimestampMixin):
    """College / department within a university.

    Maps to the existing IMNU_COLLEGES set from the CloudBase backend.
    """

    __tablename__ = "colleges"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, comment="主键")
    university_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("universities.id"), nullable=False, comment="所属学校ID"
    )
    name: Mapped[str] = mapped_column(
        String(120), nullable=False, index=True, comment="学院名称"
    )
    short_name: Mapped[str | None] = mapped_column(String(60), nullable=True, comment="简称")
    official_url: Mapped[str | None] = mapped_column(String(500), nullable=True, comment="官网URL")
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="1", comment="是否启用"
    )

    university: Mapped["University"] = relationship(back_populates="colleges")
    major_programs: Mapped[list["UniversityMajorProgram"]] = relationship(
        back_populates="college", lazy="selectin"
    )

    __table_args__ = (
        {"comment": "学院/系"}
    )


class UniversityMajorProgram(Base, TimestampMixin):
    """Actual major programs offered by the university.

    Maps to the 96 IMNU undergraduate majors in the data.
    Each program should link to a standard major (ref_major_standard) if possible.
    """

    __tablename__ = "university_major_programs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, comment="主键")
    university_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("universities.id"), nullable=False, comment="所属学校ID"
    )
    college_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("colleges.id"), nullable=False, comment="所属学院ID"
    )
    standard_major_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("ref_major_standard.id"), nullable=True, comment="标准专业ID"
    )
    major_code: Mapped[str | None] = mapped_column(
        String(20), nullable=True, index=True, comment="专业代码，如 080901"
    )
    major_name: Mapped[str] = mapped_column(
        String(160), nullable=False, index=True, comment="专业名称"
    )
    degree_category: Mapped[str | None] = mapped_column(
        String(40), nullable=True, comment="授予学位门类，如 工学学士"
    )
    study_years: Mapped[int | None] = mapped_column(
        Integer, nullable=True, comment="学制年限"
    )
    mapping_status: Mapped[str | None] = mapped_column(
        String(20), nullable=True, default="unmapped",
        comment="标准专业映射状态: mapped | unmapped | review_needed"
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="1", comment="是否启用"
    )

    college: Mapped["College"] = relationship(back_populates="major_programs")
    standard_major: Mapped["RefMajorStandard | None"] = relationship(back_populates="university_major_programs")

    __table_args__ = (
        {"comment": "学校现设本科专业"}
    )
