"""
Admission data layer.

student_admissions     — per-student admission record per year
student_admission_scores — flexible subject-score rows (not fixed columns)
"""

from __future__ import annotations

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ...db.base import Base, TimestampMixin


class StudentAdmission(Base, TimestampMixin):
    """One admission record per student — typically one row per student.

    Captures the original admission snapshot from the enrollment system.
    """

    __tablename__ = "student_admissions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, comment="主键")
    student_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("student_profiles.id"), nullable=False, index=True, comment="学生档案ID"
    )
    candidate_no: Mapped[str | None] = mapped_column(
        String(30), nullable=True, index=True, comment="考生号"
    )
    source_province: Mapped[str | None] = mapped_column(
        String(30), nullable=True, comment="生源省份"
    )
    source_city: Mapped[str | None] = mapped_column(
        String(60), nullable=True, comment="生源地市/区县"
    )
    original_major_name: Mapped[str | None] = mapped_column(
        String(160), nullable=True, comment="原录取专业名称"
    )
    normalized_major_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("university_major_programs.id"), nullable=True, comment="规范后专业ID"
    )
    teaching_language: Mapped[str | None] = mapped_column(
        String(20), nullable=True, comment="授课语种"
    )
    teacher_training_type: Mapped[str | None] = mapped_column(
        String(30), nullable=True, comment="师范生类型"
    )
    subject_stream: Mapped[str | None] = mapped_column(
        String(20), nullable=True, comment="科类（文科/理科/综合）"
    )
    special_note: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="特殊说明（专项计划等）"
    )
    candidate_type: Mapped[str | None] = mapped_column(
        String(30), nullable=True, comment="考生类型"
    )
    filing_score: Mapped[float | None] = mapped_column(
        Numeric(8, 2), nullable=True, comment="投档成绩"
    )
    foreign_language_type: Mapped[str | None] = mapped_column(
        String(30), nullable=True, comment="外语语种"
    )
    admission_year: Mapped[int | None] = mapped_column(
        Integer, nullable=True, index=True, comment="入学年份"
    )
    raw_import_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("data_import_batches.id"), nullable=True, comment="来源导入批次ID"
    )

    scores: Mapped[list["StudentAdmissionScore"]] = relationship(
        back_populates="admission", lazy="selectin", cascade="all, delete-orphan"
    )

    __table_args__ = (
        {"comment": "招生录取记录"}
    )


class StudentAdmissionScore(Base, TimestampMixin):
    """Individual subject scores for an admission record.

    Key-value design: supports new-gaokao (3+1+2), old-gaokao, and future
    exam models without schema changes. Each row = one subject score.
    """

    __tablename__ = "student_admission_scores"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, comment="主键")
    admission_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("student_admissions.id"), nullable=False, index=True, comment="录取记录ID"
    )
    subject_code: Mapped[str] = mapped_column(
        String(20), nullable=False, comment="科目代码，如 chinese, math, english"
    )
    subject_name: Mapped[str] = mapped_column(
        String(40), nullable=False, comment="科目名称，如 语文、数学、外语"
    )
    score: Mapped[float | None] = mapped_column(
        Numeric(8, 2), nullable=True, comment="分数"
    )

    admission: Mapped["StudentAdmission"] = relationship(back_populates="scores")

    __table_args__ = (
        {"comment": "录取科目成绩（键值设计，支持不同高考模式扩展）"}
    )
