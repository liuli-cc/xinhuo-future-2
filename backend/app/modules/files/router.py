"""Files router — unified file upload/download endpoints.

All file uploads go through this module. Binary data stored in COS,
metadata stored in the files table.
"""

from __future__ import annotations

import hashlib
import uuid

from fastapi import APIRouter, Depends, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.exceptions import FileTooLargeError, InvalidFileTypeError, NotFoundError
from ...db.session import get_db
from ..auth.dependency import CurrentUser
from .repository import FileRepository

router = APIRouter(prefix="/files", tags=["files"])

# Allowed MIME types for general file upload
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "text/plain",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
MAX_FILE_SIZE = 3 * 1024 * 1024  # 3 MB


@router.post("/upload")
async def upload_file(
    file: UploadFile,
    owner_type: str = "general",
    current_user: CurrentUser = None,
    db: AsyncSession = Depends(get_db),
):
    """Upload a file. Returns file metadata.

    Phase 1: stores file metadata only (COS integration in Phase 2).
    For now, files up to 3MB are accepted.
    """
    if file.content_type and file.content_type not in ALLOWED_MIME_TYPES:
        raise InvalidFileTypeError(
            f"不支持的文件类型: {file.content_type}。支持的类型: PDF, JPG, PNG, WebP, TXT, DOC, DOCX"
        )

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise FileTooLargeError(f"文件大小不能超过 {MAX_FILE_SIZE // 1024 // 1024}MB")

    file_id = uuid.uuid4().hex
    sha256_hash = hashlib.sha256(content).hexdigest()

    file_record = await FileRepository(db).create_file({
        "id": file_id,
        "owner_type": owner_type,
        "owner_id": None,
        "object_key": None,  # COS integration in Phase 2
        "original_filename": file.filename or "unknown",
        "mime_type": file.content_type or "application/octet-stream",
        "file_size": len(content),
        "sha256": sha256_hash,
        "created_by": current_user["id"] if current_user else None,
        "is_public": False,
    })

    return {"file": file_record}


@router.get("/{file_id}")
async def get_file_info(
    file_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get file metadata by ID."""
    repo = FileRepository(db)
    file_info = await repo.get_file(file_id)
    if not file_info:
        raise NotFoundError("文件不存在")
    return {"file": file_info}
