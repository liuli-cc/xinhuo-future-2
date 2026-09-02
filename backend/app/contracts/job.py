"""
Job-related contracts — owned by Group3.

Source tables: career_jobs, employers
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class JobRequirementItem(BaseModel):
    """A single parsed requirement from a JD."""

    label: str = Field(..., description="要求标签，如 'Java', '3年以上'")
    dimension: str | None = Field(
        default=None, description="对应能力维度"
    )
    priority: str = Field(
        default="preferred", description="preferred | required | nice_to_have"
    )


class JobRequirementProfile(BaseModel):
    """Structured JD requirements parsed from raw job description.

    Consumer: Group1 (resume generation — tailors resume to requirements),
              Group2 (growth planning — identifies skill gaps to work on)
    Owner: Group3
    """

    job_id: str
    skills: list[str] = Field(default_factory=list, description="技能关键词")
    responsibilities: list[str] = Field(
        default_factory=list, description="职责列表"
    )
    experience_requirement: str | None = Field(
        default=None, description="经验要求，如 '3-5年'"
    )
    core_competencies: list[str] = Field(
        default_factory=list, description="核心能力要求"
    )
    structured_requirements: list[JobRequirementItem] = Field(
        default_factory=list, description="结构化要求列表"
    )
    difficulty: str = Field(
        default="standard", description="岗位难度: entry | standard | advanced"
    )


class JobSummary(BaseModel):
    """Minimal job info for display in resume, interview, and matching contexts.

    Consumer: Group1 (resume target, interview context),
              Group2 (growth task target)
    Owner: Group3
    """

    job_id: str = Field(..., description="career_jobs.id")
    title: str = Field(..., description="岗位名称")
    company: str = Field(default="", description="公司名称")
    city: str | None = None
    employment_type: str | None = None
    salary: str | None = None
    source_url: str | None = None
    description_snippet: str = Field(
        default="", description="JD摘要 (前200字)"
    )
