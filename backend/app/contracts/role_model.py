"""
Role model contract — owned by Group2.

Source tables: role_models, role_model_matches
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class RoleModelMatchSummary(BaseModel):
    """A role model matched to a student.

    Consumer: Group2 (榜样激励 dashboard), Group3 (optional enrichment)
    Owner: Group2
    """

    role_model_id: int
    display_name: str = Field(..., description="展示名称")
    match_score: int = Field(..., ge=0, le=100, description="匹配分数")
    matched_dimensions: list[str] = Field(
        default_factory=list, description="匹配的维度"
    )
    match_rationale: str = Field(default="", description="匹配理由")
    background_summary: str = Field(default="", description="背景摘要")
    final_offer: str | None = Field(default=None, description="最终offer")
    graduation_year: int | None = Field(default=None, description="毕业年份")
    key_experiences: list[str] = Field(
        default_factory=list, description="关键经历标题(最多5条)"
    )
