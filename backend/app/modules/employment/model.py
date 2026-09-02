"""
Employment business layer.

Employers, student employment records, employment reviews,
study abroad records, and graduate administration.

This is NOT a single 104-column table. Data is split across
multiple related entities.
"""

from __future__ import annotations

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ...db.base import Base, TimestampMixin


class Employer(Base, TimestampMixin):
    """Employer / organization record.

    Unified Social Credit Code should have a unique constraint strategy.
    """

    __tablename__ = "employers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, comment="主键")
    name: Mapped[str] = mapped_column(
        String(300), nullable=False, index=True, comment="单位名称"
    )
    unified_social_credit_code: Mapped[str | None] = mapped_column(
        String(18), nullable=True, unique=True, index=True,
        comment="统一社会信用代码（18位）"
    )
    organization_type: Mapped[str | None] = mapped_column(
        String(80), nullable=True, comment="单位性质"
    )
    industry: Mapped[str | None] = mapped_column(
        String(80), nullable=True, comment="行业"
    )
    province: Mapped[str | None] = mapped_column(String(30), nullable=True, comment="省份")
    city: Mapped[str | None] = mapped_column(String(40), nullable=True, comment="城市")
    district: Mapped[str | None] = mapped_column(String(60), nullable=True, comment="区县")
    address: Mapped[str | None] = mapped_column(Text, nullable=True, comment="详细地址")
    postal_code: Mapped[str | None] = mapped_column(String(10), nullable=True, comment="邮政编码")

    employments: Mapped[list["StudentEmployment"]] = relationship(back_populates="employer", lazy="selectin")

    __table_args__ = (
        {"comment": "用人单位"}
    )


class StudentEmployment(Base, TimestampMixin):
    """A student's employment outcome.

    Maps raw job title to standard job classification via job_standard_id.
    Both raw and standardized values are preserved.
    """

    __tablename__ = "student_employments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, comment="主键")
    student_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("student_profiles.id"), nullable=False, index=True, comment="学生档案ID"
    )
    employer_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("employers.id"), nullable=True, index=True, comment="用人单位ID"
    )
    destination_code: Mapped[str | None] = mapped_column(
        String(20), nullable=True, comment="毕业去向代码"
    )
    destination_name: Mapped[str | None] = mapped_column(
        String(80), nullable=True, comment="毕业去向名称"
    )
    job_standard_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("ref_job_standard.id"), nullable=True, comment="标准岗位ID"
    )
    job_title_raw: Mapped[str | None] = mapped_column(
        String(200), nullable=True, comment="原始岗位名称"
    )
    employment_status: Mapped[str | None] = mapped_column(
        String(30), nullable=True, comment="就业状态"
    )
    employment_source: Mapped[str | None] = mapped_column(
        String(30), nullable=True, comment="就业数据来源"
    )
    work_province: Mapped[str | None] = mapped_column(String(30), nullable=True, comment="工作省份")
    work_city: Mapped[str | None] = mapped_column(String(40), nullable=True, comment="工作城市")
    work_district: Mapped[str | None] = mapped_column(String(60), nullable=True, comment="工作区县")
    reported_at: Mapped[str | None] = mapped_column(
        String(10), nullable=True, comment="上报日期"
    )
    audit_status: Mapped[str | None] = mapped_column(
        String(20), nullable=True, default="pending", comment="审核状态"
    )

    employer: Mapped["Employer | None"] = relationship(back_populates="employments")
    reviews: Mapped[list["EmploymentReview"]] = relationship(
        back_populates="employment", lazy="selectin", cascade="all, delete-orphan"
    )

    __table_args__ = (
        {"comment": "学生就业记录"}
    )


class EmploymentReview(Base, TimestampMixin):
    """Employment data review / audit trail.

    Does NOT overwrite employment record — each review is a new row.
    """

    __tablename__ = "employment_reviews"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, comment="主键")
    employment_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("student_employments.id"), nullable=False, index=True,
        comment="就业记录ID"
    )
    reviewer_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True, comment="审核人ID"
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, comment="审核结果"
    )
    reason: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="审核原因/备注"
    )
    reviewed_at: Mapped[int | None] = mapped_column(
        Integer, nullable=True, comment="审核时间戳"
    )

    employment: Mapped["StudentEmployment"] = relationship(back_populates="reviews")

    __table_args__ = (
        {"comment": "就业审核记录"}
    )


class StudyAbroadRecord(Base, TimestampMixin):
    """Overseas / study-abroad records — only created when destination is study abroad."""

    __tablename__ = "study_abroad_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, comment="主键")
    student_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("student_profiles.id"), nullable=False, index=True, comment="学生档案ID"
    )
    institution_name: Mapped[str | None] = mapped_column(
        String(300), nullable=True, comment="留学院校名称"
    )
    country_region: Mapped[str | None] = mapped_column(
        String(80), nullable=True, comment="国家/地区"
    )
    education_level: Mapped[str | None] = mapped_column(
        String(30), nullable=True, comment="学历层次"
    )
    major_name_cn: Mapped[str | None] = mapped_column(
        String(160), nullable=True, comment="专业名称（中文）"
    )
    major_name_foreign: Mapped[str | None] = mapped_column(
        String(300), nullable=True, comment="专业名称（外文）"
    )

    __table_args__ = (
        {"comment": "留学/海外升学记录"}
    )


class GraduateAdministration(Base, TimestampMixin):
    """Administrative data for graduates: archives, household registration, etc.

    Currently minimal — most fields stored as raw import JSON.
    Expanded as actual business requirements are confirmed.
    """

    __tablename__ = "graduate_administration"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, comment="主键")
    student_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("student_profiles.id"), nullable=False, unique=True, index=True,
        comment="学生档案ID"
    )
    archive_destination: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="档案转递单位"
    )
    archive_address: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="档案转递地址"
    )
    household_migration_type: Mapped[str | None] = mapped_column(
        String(40), nullable=True, comment="户口迁移类型"
    )
    household_migration_address: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="户口迁移地址"
    )
    contact_person: Mapped[str | None] = mapped_column(String(30), nullable=True, comment="联系人")
    contact_phone: Mapped[str | None] = mapped_column(String(20), nullable=True, comment="联系电话")
    mailing_address: Mapped[str | None] = mapped_column(Text, nullable=True, comment="邮寄地址")
    mailing_postal_code: Mapped[str | None] = mapped_column(
        String(10), nullable=True, comment="邮寄邮编"
    )
    raw_data: Mapped[dict | None] = mapped_column(
        "raw_data", JSON, nullable=True, comment="原始行政数据JSON（未结构化字段）"
    )

    __table_args__ = (
        {"comment": "毕业生行政信息（档案、户口、邮寄等）"}
    )
