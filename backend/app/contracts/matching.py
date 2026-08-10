"""
Job matching contracts — owned by Group3.

Source tables: career_matches, career_applications
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from .portrait import StudentPortraitSummary


class JobMatchRequest(BaseModel):
    """Input for computing a student-job match score.

    Assembled by Group3 from data owned by multiple groups.
    Each field maps to a specific owner module.
    """

    user_id: int

    # From Shared/Core
    student_profile_id: int | None = None
    academic_profile: dict | None = Field(
        default=None, description="StudentAcademicProfile (Shared)"
    )
    career_intent: dict | None = Field(
        default=None, description="StudentCareerIntent (Shared/Group2)"
    )

    # From Group2
    portrait: dict | None = Field(
        default=None, description="StudentPortraitSummary (Group2)"
    )
    growth_progress: dict | None = Field(
        default=None, description="GrowthProgressSummary (Group2)"
    )

    # From Group1
    resume: dict | None = Field(
        default=None, description="GeneratedResumeSummary (Group1)"
    )
    interview_assessment: dict | None = Field(
        default=None, description="InterviewAssessmentSummary (Group1)"
    )

    # From Group3 (own data)
    job_id: str = Field(..., description="目标岗位ID")
    job_requirements: dict | None = Field(
        default=None, description="JobRequirementProfile"
    )


class JobGapItem(BaseModel):
    """A single capability gap between student and job requirements."""

    dimension: str = Field(..., description="能力维度")
    required_level: int = Field(..., ge=0, le=100, description="岗位要求水平")
    current_level: int = Field(..., ge=0, le=100, description="学生当前水平")
    gap: int = Field(..., description="差距")
    priority: str = Field(default="medium", description="critical | high | medium | low")
    recommendation: str = Field(default="", description="补强建议")


class JobMatchResult(BaseModel):
    """Computed job match result with breakdown and gap analysis.

    Consumer: Group2 (gaps → growth tasks), Group1 (interview focus areas)
    Owner: Group3
    """

    match_id: str = Field(..., description="career_matches.id")
    user_id: int
    job_id: str
    job_title: str = Field(default="")
    company: str = Field(default="")
    overall_score: int = Field(..., ge=0, le=100, description="综合匹配分数")
    confidence: int = Field(default=0, ge=0, le=100, description="置信度")
    verdict: str = Field(..., description="匹配结论: 强匹配 | 较匹配 | 可尝试 | 需谨慎 | 暂不建议")

    # Breakdown
    skill_match_score: int = Field(default=0, ge=0, le=100, description="技能匹配")
    experience_match_score: int = Field(default=0, ge=0, le=100, description="经历匹配")
    education_match_score: int = Field(default=0, ge=0, le=100, description="学历匹配")
    potential_score: int = Field(default=0, ge=0, le=100, description="发展潜力")
    intent_match_score: int = Field(default=0, ge=0, le=100, description="意向匹配")

    # Gaps
    gaps: list[JobGapItem] = Field(default_factory=list, description="能力缺口列表")

    # Explanation
    match_rationale: str = Field(default="", description="匹配理由")
    strengths_matched: list[str] = Field(default_factory=list, description="匹配的优势点")
    formula: str = Field(default="", description="算法公式说明")
    calculated_at: str = Field(default="", description="计算时间")
