"""User request/response schemas."""

from __future__ import annotations

from pydantic import BaseModel, Field


class UserPublicProfile(BaseModel):
    id: int
    studentId: str = ""
    name: str = ""
    email: str = ""
    role: str = "student"
    accountStatus: str = "active"
    college: str = ""
    major: str = ""
    className: str = ""
    grade: str = ""
    phone: str = ""
    bio: str = ""
    targetRole: str = "探索方向"
    developmentTrack: str = "exploration"
    interests: list = Field(default_factory=list)


class ProfileUpdateRequest(BaseModel):
    action: str = Field(default="profile")
    name: str | None = Field(default=None, min_length=2, max_length=30)
    email: str | None = Field(default=None, max_length=120)
    college: str | None = Field(default=None, max_length=80)
    major: str | None = Field(default=None, max_length=80)
    className: str | None = Field(default=None, max_length=80)
    grade: str | None = Field(default=None, max_length=20)
    phone: str | None = Field(default=None, max_length=30)
    bio: str | None = Field(default=None, max_length=2000)
    targetRole: str | None = Field(default=None, max_length=80)
    developmentTrack: str | None = Field(default=None, max_length=80)
    interests: list[str] | None = Field(default=None, max_length=8)


class PasswordChangeRequest(BaseModel):
    action: str = Field(default="password")
    currentPassword: str
    newPassword: str = Field(..., min_length=10, max_length=128)
