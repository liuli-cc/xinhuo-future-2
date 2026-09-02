"""File schemas."""

from __future__ import annotations

from pydantic import BaseModel, Field


class FileInfo(BaseModel):
    id: str
    owner_type: str
    owner_id: str | None = None
    object_key: str | None = None
    original_filename: str
    mime_type: str
    file_size: int
    sha256: str | None = None
    created_at: str | None = None


class FileUploadResponse(BaseModel):
    file: FileInfo
    upload_url: str | None = None  # Pre-signed URL for direct COS upload (future)
