"""
Student portrait & growth contracts — owned by Group2.

Source tables: student_portraits, baseline_assessments, growth_tasks
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class DimensionScore(BaseModel):
    """A single ability dimension score."""

    name: str = Field(..., description="维度名称: 专业学习/项目实践/创新探索/沟通协作/职业准备")
    score: int = Field(..., ge=0, le=100, description="得分 0-100")
    confidence: int = Field(default=0, ge=0, le=100, description="置信度")
    evidence_count: int = Field(default=0, description="该维度证据数")


class WeaknessItem(BaseModel):
    """Identified ability weakness for improvement targeting."""

    dimension: str
    gap: int = Field(..., description="与基准的差距")
    recommendation: str = Field(default="", description="改进建议")


class StudentPortraitSummary(BaseModel):
    """Student five-dimension ability portrait.

    Computed by Group2 from evidence data. Cached in student_portraits table.
    Consumer: Group1 (resume generation context), Group3 (job matching input)
    Owner: Group2
    """

    user_id: int
    overall_score: int = Field(..., ge=0, le=100, description="综合评分")
    completeness: int = Field(..., ge=0, le=100, description="数据完整度")
    confidence: int = Field(..., ge=0, le=100, description="置信度")
    dimensions: list[DimensionScore] = Field(
        default_factory=list, description="五维能力分数"
    )
    weaknesses: list[WeaknessItem] = Field(
        default_factory=list, description="能力短板"
    )
    total_evidence: int = Field(default=0, description="总证据数")
    verified_evidence: int = Field(default=0, description="已验证证据数")
    algorithm_version: str | None = Field(
        default=None, description="算法版本"
    )
    calculated_at: int | None = Field(
        default=None, description="计算时间戳"
    )


class GrowthProgressSummary(BaseModel):
    """Student's growth task completion progress.

    Aggregated by Group2 from growth_tasks + growth_task_progress.
    Consumer: Group3 (job matching — evaluates growth completion rate)
    Owner: Group2
    """

    user_id: int
    semester_index: int = Field(..., description="当前学期序号")
    total_tasks: int = Field(default=0, description="总任务数")
    completed_tasks: int = Field(default=0, description="已完成任务数")
    verified_tasks: int = Field(default=0, description="已核验任务数")
    total_xp: int = Field(default=0, description="总经验值")
    earned_xp: int = Field(default=0, description="已获得经验值")
    completion_rate: float = Field(default=0.0, description="完成率 0.0-1.0")
    focus_dimensions: list[str] = Field(
        default_factory=list, description="当前阶段重点维度"
    )
    recent_completions: list[str] = Field(
        default_factory=list, description="最近完成的任务标题(最多5条)"
    )
