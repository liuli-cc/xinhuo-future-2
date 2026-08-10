"""
Interview contract — owned by Group1.

Source tables: interview_sessions
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class InterviewAssessmentSummary(BaseModel):
    """Mock interview assessment result.

    Consumer: Group3 (job matching — evaluates interview readiness)
    Owner: Group1
    """

    session_id: str = Field(..., description="interview_sessions.id")
    user_id: int
    target_role: str = Field(..., description="目标岗位")
    difficulty: str = Field(default="标准", description="难度: 入门 | 标准 | 进阶")
    overall_score: int | None = Field(
        default=None, ge=0, le=100, description="综合面试评分"
    )
    strengths: list[str] = Field(
        default_factory=list, description="面试中体现的优势"
    )
    weaknesses: list[str] = Field(
        default_factory=list, description="面试中发现的能力短板"
    )
    communication_score: int | None = Field(
        default=None, ge=0, le=100, description="沟通表达分数"
    )
    technical_score: int | None = Field(
        default=None, ge=0, le=100, description="技术/专业分数"
    )
    improvement_suggestions: list[str] = Field(
        default_factory=list, description="改进建议"
    )
    answer_count: int = Field(default=0, description="回答数量")
    created_at: str | None = Field(default=None, description="面试时间")
