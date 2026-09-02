"""Auth request/response schemas (Pydantic)."""

from __future__ import annotations

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    studentId: str = Field(..., min_length=6, max_length=20)
    password: str = Field(..., min_length=1)


class RegisterRequest(BaseModel):
    accountType: str = Field(default="student", pattern=r"^(student|teacher)$")
    studentId: str = Field(..., min_length=6, max_length=20)
    name: str = Field(..., min_length=2, max_length=30)
    email: str = Field(default="", max_length=120)
    password: str = Field(..., min_length=10, max_length=128)
    confirmPassword: str = Field(..., min_length=10, max_length=128)
    college: str = Field(..., min_length=2, max_length=80)
    major: str = Field(..., min_length=2, max_length=80)
    className: str = Field(..., min_length=2, max_length=80)
    grade: str = Field(default="", max_length=20)
    consent: bool = Field(default=False)

class PublicUser(BaseModel):
    """Public user profile — sensitive fields EXCLUDED."""
    id: int
    studentId: str
    name: str
    email: str = ""
    role: str
    accountStatus: str
    accountReviewNote: str | None = None
    forcePasswordChange: bool = False
    college: str = ""
    major: str = ""
    className: str = ""
    grade: str = ""
    phone: str = ""
    bio: str = ""
    targetRole: str = "探索方向"
    developmentTrack: str = "exploration"
    interests: list = Field(default_factory=list)
    consentAt: int | None = None
    createdAt: int | str | None = None
    updatedAt: int | str | None = None
    lastLoginAt: int | None = None


class LoginResponse(BaseModel):
    user: PublicUser
    sessionToken: str


class MeResponse(BaseModel):
    user: PublicUser


class HealthResponse(BaseModel):
    ok: bool = True
    service: str = "xinhuo-api"
    version: str = "0.5.0"
    storage: str = "mysql"
    mode: str = "fastapi"
