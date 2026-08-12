"""Validated request schemas for growth, evidence and cloud state flows."""

from __future__ import annotations

from datetime import date

from pydantic import BaseModel, Field, field_validator


class GrowthTaskInput(BaseModel):
    taskId: str = Field(..., min_length=2, max_length=80)
    semesterIndex: int = Field(..., ge=0, le=7)
    title: str = Field(..., min_length=2, max_length=120)
    note: str = Field(default="", max_length=1000)
    type: str = Field(default="自定义", max_length=30)
    xp: int = Field(default=20, ge=0, le=200)


class EvidenceInput(BaseModel):
    studentId: str | None = Field(default=None, max_length=20)
    taskId: str | None = Field(default=None, max_length=80)
    semesterIndex: int = Field(default=0, ge=0, le=7)
    taskTitle: str | None = Field(default=None, max_length=120)
    taskNote: str = Field(default="", max_length=1000)
    taskType: str = Field(default="", max_length=30)
    xp: int = Field(default=0, ge=0, le=200)
    isCustom: bool = False
    evidenceTitle: str | None = Field(default=None, max_length=120)
    title: str | None = Field(default=None, max_length=120)
    category: str = Field(..., min_length=2, max_length=40)
    dimension: str = Field(..., max_length=40)
    detail: str = Field(..., min_length=12, max_length=5000)
    evidenceRef: str = Field(default="", max_length=500)
    evidenceDate: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    sourceType: str = Field(..., max_length=40)
    relevance: int = Field(default=80, ge=0, le=100)
    quality: int = Field(default=75, ge=0, le=100)
    contribution: int = Field(default=70, ge=0, le=100)
    attachmentId: str | None = Field(default=None, max_length=80)

    @field_validator("dimension")
    @classmethod
    def valid_dimension(cls, value: str) -> str:
        if value not in {"专业学习", "项目实践", "创新探索", "沟通协作", "职业准备"}:
            raise ValueError("无效的能力维度")
        return value

    @field_validator("sourceType")
    @classmethod
    def valid_source(cls, value: str) -> str:
        if value not in {
            "course_record", "project_artifact", "competition_certificate",
            "teacher_review", "peer_review", "self_report",
        }:
            raise ValueError("无效的佐证来源")
        return value

    @field_validator("evidenceDate")
    @classmethod
    def valid_evidence_date(cls, value: str) -> str:
        try:
            parsed = date.fromisoformat(value)
        except ValueError as error:
            raise ValueError("佐证日期无效") from error
        if parsed > date.today():
            raise ValueError("佐证日期不能晚于今天")
        return value


class CloudStateInput(BaseModel):
    value: object
