"""Authenticated, content-validated file upload and download endpoints."""

from __future__ import annotations

import hashlib
import re
import uuid
from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter, Depends, Form, UploadFile
from fastapi.responses import RedirectResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.config import get_settings
from ...core.exceptions import FileTooLargeError, ForbiddenError, InvalidFileTypeError, NotFoundError
from ...core.permissions import can_access_target
from ...db.session import get_db
from ...integrations.storage import get_storage_client
from ..auth.dependency import CurrentUser
from ..users.repository import UserRepository
from .repository import FileRepository

router = APIRouter(prefix="/files", tags=["files"])

ALLOWED_MIME_TYPES = {
    "application/pdf", "image/jpeg", "image/png", "image/webp", "text/plain",
    "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


def _safe_filename(value: str | None) -> str:
    name = Path(value or "upload.bin").name
    name = re.sub(r"[\x00-\x1f\x7f]", "", name).strip().replace("/", "_")
    return name[:200] or "upload.bin"


def _detected_mime(content: bytes, declared: str | None) -> str:
    if content.startswith(b"%PDF-"):
        return "application/pdf"
    if content.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "image/webp"
    if content.startswith(b"PK\x03\x04") and declared == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        return declared
    if content.startswith(b"\xd0\xcf\x11\xe0") and declared == "application/msword":
        return declared
    if declared == "text/plain":
        try:
            content.decode("utf-8")
            return declared
        except UnicodeDecodeError:
            pass
    raise InvalidFileTypeError("文件内容与允许的 PDF、图片、TXT、DOC 或 DOCX 格式不符")


async def _store_file(
    file: UploadFile,
    owner_type: str,
    current_user: dict,
    db: AsyncSession,
) -> dict:
    if file.content_type and file.content_type not in ALLOWED_MIME_TYPES:
        raise InvalidFileTypeError("不支持的文件类型")
    max_size = get_settings().MAX_UPLOAD_BYTES
    content = await file.read(max_size + 1)
    if len(content) > max_size:
        raise FileTooLargeError(f"文件大小不能超过 {max_size // 1024 // 1024}MB")
    if not content:
        raise InvalidFileTypeError("不能上传空文件")
    filename = _safe_filename(file.filename)
    mime_type = _detected_mime(content, file.content_type)
    file_id = uuid.uuid4().hex
    object_key = f"{owner_type}/{current_user['id']}/{file_id}/{filename}"
    storage = get_storage_client()
    await storage.upload(object_key, content, mime_type)
    try:
        return await FileRepository(db).create_file({
            "id": file_id,
            "owner_type": owner_type,
            "owner_id": None,
            "object_key": object_key,
            "original_filename": filename,
            "mime_type": mime_type,
            "file_size": len(content),
            "sha256": hashlib.sha256(content).hexdigest(),
            "created_by": current_user["id"],
            "is_public": False,
        })
    except Exception:
        await storage.delete(object_key)
        raise


@router.post("/upload")
async def upload_file(
    file: UploadFile,
    owner_type: str = "general",
    current_user: CurrentUser = None,
    db: AsyncSession = Depends(get_db),
):
    if owner_type not in {"general", "evidence", "resume", "interview_report", "avatar"}:
        raise InvalidFileTypeError("无效的文件用途")
    return {"file": await _store_file(file, owner_type, current_user, db)}


@router.post("/evidence-upload", include_in_schema=False)
async def upload_evidence_file(
    file: UploadFile,
    taskId: str = Form(default=""),
    current_user: CurrentUser = None,
    db: AsyncSession = Depends(get_db),
):
    return {"file": await _store_file(file, "evidence", current_user, db)}


async def _authorize_file(db: AsyncSession, actor: dict, info: dict) -> None:
    if info["is_public"] or info["created_by"] == actor["id"]:
        return
    owner = await UserRepository(db).get_user_by_id(info["created_by"] or 0)
    if not owner or not can_access_target(actor, owner):
        raise ForbiddenError("无权访问该文件")


@router.get("/{file_id}")
async def get_file_info(file_id: str, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    info = await FileRepository(db).get_file(file_id)
    if not info:
        raise NotFoundError("文件不存在")
    await _authorize_file(db, current_user, info)
    return {"file": {
        key: value for key, value in info.items()
        if key not in {"created_by", "owner_id", "object_key"}
    }}


@router.get("/{file_id}/download")
async def download_file(file_id: str, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    info = await FileRepository(db).get_file(file_id, include_storage_key=True)
    if not info or not info.get("object_key"):
        raise NotFoundError("文件不存在")
    await _authorize_file(db, current_user, info)
    storage = get_storage_client()
    redirect_url = await storage.presigned_url(info["object_key"])
    if redirect_url:
        return RedirectResponse(redirect_url, status_code=307)
    content = await storage.read(info["object_key"])
    return Response(
        content,
        media_type=info["mime_type"],
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{quote(info['original_filename'])}",
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, no-store",
        },
    )
