"""Admin and review request schemas."""

from pydantic import BaseModel, Field


class EvidenceReviewInput(BaseModel):
    id: int
    status: str = Field(..., pattern=r"^(verified|rejected)$")
    reviewerNote: str = Field(default="", max_length=300)
    relevance: int = Field(default=80, ge=0, le=100)
    quality: int = Field(default=75, ge=0, le=100)
    contribution: int = Field(default=70, ge=0, le=100)


class AccountActionInput(BaseModel):
    targetId: int
    action: str = Field(..., pattern=r"^(approve|reject|suspend|activate|placement|grant_employment|revoke_employment)$")
    note: str = Field(default="", max_length=300)
    college: str | None = Field(default=None, max_length=80)
    major: str | None = Field(default=None, max_length=80)
    className: str | None = Field(default=None, max_length=80)
    grade: str | None = Field(default=None, max_length=20)


class StaffInput(BaseModel):
    studentId: str = Field(..., min_length=6, max_length=20)
    name: str = Field(..., min_length=2, max_length=30)
    email: str = Field(default="", max_length=120)
    role: str = Field(..., pattern=r"^(teacher|counselor|college_admin|school_admin)$")
    school: str = Field(default="内蒙古师范大学", max_length=80)
    college: str = Field(..., min_length=2, max_length=80)
    className: str = Field(default="", max_length=80)


class DeletionCompleteInput(BaseModel):
    userId: int


class RecoveryCompleteInput(BaseModel):
    requestId: str = Field(..., min_length=8, max_length=64)
