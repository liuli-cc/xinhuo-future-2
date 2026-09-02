"""Import repository — batch and row CRUD for staging layer."""

from __future__ import annotations

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from .model import DataImportBatch, DataImportRow


class ImportRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_batch(self, data: dict) -> dict:
        batch = DataImportBatch(**data)
        self.db.add(batch)
        await self.db.flush()
        await self.db.refresh(batch)
        return self._batch_to_dict(batch)

    async def get_batch(self, batch_id: int) -> dict | None:
        stmt = select(DataImportBatch).where(DataImportBatch.id == batch_id)
        result = await self.db.execute(stmt)
        b = result.scalar_one_or_none()
        return self._batch_to_dict(b) if b else None

    async def update_batch(self, batch_id: int, data: dict) -> None:
        batch = await self.db.get(DataImportBatch, batch_id)
        if batch:
            for k, v in data.items():
                setattr(batch, k, v)
            await self.db.flush()

    async def list_batches(
        self, source_type: str | None = None, limit: int = 50
    ) -> list[dict]:
        stmt = select(DataImportBatch).order_by(DataImportBatch.created_at.desc())
        if source_type:
            stmt = stmt.where(DataImportBatch.source_type == source_type)
        stmt = stmt.limit(limit)
        result = await self.db.execute(stmt)
        return [self._batch_to_dict(b) for b in result.scalars().all()]

    async def create_rows(self, rows: list[dict]) -> int:
        """Bulk insert rows. Returns count inserted."""
        for row_data in rows:
            row = DataImportRow(**row_data)
            self.db.add(row)
        await self.db.flush()
        return len(rows)

    async def list_rows(
        self, batch_id: int, status: str | None = None, limit: int = 500
    ) -> list[dict]:
        stmt = (
            select(DataImportRow)
            .where(DataImportRow.batch_id == batch_id)
            .order_by(DataImportRow.row_number)
        )
        if status:
            stmt = stmt.where(DataImportRow.normalized_status == status)
        stmt = stmt.limit(limit)
        result = await self.db.execute(stmt)
        return [self._row_to_dict(r) for r in result.scalars().all()]

    def _batch_to_dict(self, b: DataImportBatch) -> dict:
        return {
            "id": b.id,
            "source_type": b.source_type,
            "source_filename": b.source_filename,
            "source_year": b.source_year,
            "imported_by": b.imported_by,
            "started_at": b.started_at,
            "finished_at": b.finished_at,
            "status": b.status,
            "total_rows": b.total_rows,
            "success_rows": b.success_rows,
            "failed_rows": b.failed_rows,
            "notes": b.notes,
            "created_at": b.created_at.isoformat() if b.created_at else None,
        }

    def _row_to_dict(self, r: DataImportRow) -> dict:
        return {
            "id": r.id,
            "batch_id": r.batch_id,
            "row_number": r.row_number,
            "raw_data": r.raw_data,
            "normalized_status": r.normalized_status,
            "target_table": r.target_table,
            "target_id": r.target_id,
            "error_message": r.error_message,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
