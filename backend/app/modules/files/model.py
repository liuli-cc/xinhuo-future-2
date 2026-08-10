"""
Files module: unified file storage layer.

All file uploads (evidence, resume, interview reports, etc.) reference
files.id. Actual binary data stored in Tencent COS; this table holds
metadata and the COS object_key.
"""

from __future__ import annotations

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from ...db.base import Base, TimestampMixin


class File(Base, TimestampMixin):
    """Unified file metadata record.

    Any module that needs to store files uses this table via file_id.
    COS is the storage backend; base64 inline is only for transition.
    """

    __tablename__ = "files"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, comment="UUID主键")
    owner_type: Mapped[str] = mapped_column(
        String(40), nullable=False, index=True,
        comment="所有者类型: evidence | resume | interview_report | employment_proof | avatar"
    )
    owner_id: Mapped[str | None] = mapped_column(
        String(64), nullable=True, index=True, comment="所有者记录ID"
    )
    object_key: Mapped[str | None] = mapped_column(
        String(500), nullable=True, comment="COS对象键"
    )
    original_filename: Mapped[str] = mapped_column(
        String(300), nullable=False, comment="原始文件名"
    )
    mime_type: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="MIME类型"
    )
    file_size: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, comment="文件大小(字节)"
    )
    sha256: Mapped[str | None] = mapped_column(
        String(64), nullable=True, comment="SHA-256摘要"
    )
    created_by: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True, comment="上传者ID"
    )
    is_public: Mapped[bool] = mapped_column(
        "is_public", Integer, default=0, server_default="0", comment="是否公开访问"
    )

    __table_args__ = (
        {"comment": "统一文件存储"}
    )
