"""
Student-related contract schemas — owned by Shared/Core.

Used by all groups. Fields are based on actual DB columns in:
  users, student_profiles, student_admissions
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class StudentSummary(BaseModel):
    """Minimal student identity — safe to include in any context.

    Source tables: users, student_profiles
    Owner: Shared/Core
    """

    user_id: int = Field(..., description="用户账号ID (users.id)")
    student_no: str = Field(..., description="学号 (student_profiles.student_no)")
    name: str = Field(..., description="姓名 (users.name)")
    college: str = Field(default="", description="院系名称 (users.college)")
    major: str = Field(default="", description="专业 (users.major)")
    class_name: str = Field(default="", description="班级 (users.class_name)")
    grade: str = Field(default="", description="年级 (users.grade)")
    role: str = Field(default="student", description="角色 (users.role)")


class StudentAcademicProfile(BaseModel):
    """Academic background for assessment and matching contexts.

    Source tables: student_profiles, student_admissions
    Owner: Shared/Core
    Consumers: Group2 (baseline assessment), Group3 (job matching)
    """

    user_id: int
    student_no: str
    college_id: int | None = None
    college_name: str | None = None
    major_program_id: int | None = None
    major_name: str | None = None
    degree_category: str | None = Field(
        default=None, description="授予学位门类 (university_major_programs.degree_category)"
    )
    education_level: str | None = Field(
        default=None, description="学历层次 (student_profiles.education_level)"
    )
    enrollment_date: str | None = Field(
        default=None, description="入学日期 (student_profiles.enrollment_date)"
    )
    graduation_date: str | None = Field(
        default=None, description="预计毕业日期 (student_profiles.graduation_date)"
    )
    admission_year: int | None = Field(
        default=None, description="入学年份 (student_admissions.admission_year)"
    )
    source_province: str | None = Field(
        default=None, description="生源省份 (student_admissions.source_province)"
    )
    filing_score: float | None = Field(
        default=None, description="投档成绩 (student_admissions.filing_score)"
    )
    teaching_language: str | None = Field(
        default=None, description="授课语种 (student_admissions.teaching_language)"
    )


class StudentCareerIntent(BaseModel):
    """Student's career intention — used by all groups for personalization.

    Source tables: users, baseline_assessments
    Owner: Shared (users fields) + Group2 (assessment fields)
    """

    user_id: int
    target_role: str = Field(
        default="探索方向", description="目标职业方向 (users.target_role)"
    )
    development_track: str = Field(
        default="exploration", description="发展路径 (users.development_track)"
    )
    career_interest: str | None = Field(
        default=None, description="职业意向自由文本 (baseline_assessments.career_interest)"
    )
    career_orientation: str | None = Field(
        default=None, description="职业倾向类型 (baseline_assessments.career_orientation)"
    )
    expected_city: str | None = Field(
        default=None, description="期望城市"
    )
    expected_salary: str | None = Field(
        default=None, description="期望薪资范围"
    )
    target_industries: list[str] = Field(
        default_factory=list, description="目标行业列表"
    )
