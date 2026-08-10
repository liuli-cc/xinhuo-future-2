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
    name: str | None = None
    email: str | None = None
    college: str | None = None
    major: str | None = None
    className: str | None = None
    grade: str | None = None
    phone: str | None = None
    bio: str | None = None
    targetRole: str | None = None
    developmentTrack: str | None = None
    interests: list | None = None


class PasswordChangeRequest(BaseModel):
    action: str = Field(default="password")
    currentPassword: str
    newPassword: str = Field(..., min_length=10, max_length=128)
