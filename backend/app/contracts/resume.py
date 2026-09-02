"""
Resume contract — owned by Group1.

Source tables: generated_resumes
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class GeneratedResumeSummary(BaseModel):
    """AI-generated resume metadata.

    Consumer: Group3 (job matching — evaluates resume quality & relevance),
              Group2 (optional — resume as evidence of growth)
    Owner: Group1
    """

    resume_id: str = Field(..., description="generated_resumes.id")
    user_id: int
    target_job_id: str | None = Field(
        default=None, description="目标岗位ID (career_jobs.id)"
    )
    job_title: str | None = Field(default=None, description="目标岗位名称")
    company: str | None = Field(default=None, description="目标公司")
    title: str = Field(..., description="简历标题")
    version: int = Field(default=1, description="版本号")
    status: str = Field(default="draft", description="draft | completed | archived")
    is_current: bool = Field(default=False, description="是否当前版本")
    ats_score: int | None = Field(default=None, description="ATS兼容性评分")
    generated_by: str | None = Field(default=None, description="生成模型")
    created_at: str | None = Field(default=None, description="创建时间")
