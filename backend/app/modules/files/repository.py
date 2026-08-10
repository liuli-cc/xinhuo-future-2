"""File repository — metadata CRUD for the unified files table."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .model import File


class FileRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_file(self, data: dict) -> dict:
        file = File(**data)
        self.db.add(file)
        await self.db.flush()
        await self.db.refresh(file)
        return self._to_dict(file)

    async def get_file(self, file_id: str) -> dict | None:
        stmt = select(File).where(File.id == file_id)
        result = await self.db.execute(stmt)
        f = result.scalar_one_or_none()
        return self._to_dict(f) if f else None

    async def list_files_by_owner(
        self, owner_type: str, owner_id: str, limit: int = 100
    ) -> list[dict]:
        stmt = (
            select(File)
            .where(File.owner_type == owner_type, File.owner_id == owner_id)
            .order_by(File.created_at.desc())
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return [self._to_dict(f) for f in result.scalars().all()]

    def _to_dict(self, f: File) -> dict:
        return {
            "id": f.id,
            "owner_type": f.owner_type,
            "owner_id": f.owner_id,
            "object_key": f.object_key,
            "original_filename": f.original_filename,
            "mime_type": f.mime_type,
            "file_size": f.file_size,
            "sha256": f.sha256,
            "created_by": f.created_by,
            "is_public": f.is_public,
            "created_at": f.created_at.isoformat() if f.created_at else None,
        }
