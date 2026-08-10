"""Import router — data import batch management and status."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.exceptions import NotFoundError
from ...db.session import get_db
from ..auth.dependency import CurrentUser
from .repository import ImportRepository

router = APIRouter(prefix="/imports", tags=["imports"])


@router.get("/batches")
async def list_import_batches(
    source_type: str | None = Query(None, description="来源类型"),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """List recent import batches."""
    repo = ImportRepository(db)
    return {"data": await repo.list_batches(source_type=source_type, limit=limit)}


@router.get("/batches/{batch_id}")
async def get_import_batch(batch_id: int, db: AsyncSession = Depends(get_db)):
    """Get import batch details."""
    repo = ImportRepository(db)
    batch = await repo.get_batch(batch_id)
    if not batch:
        raise NotFoundError("导入批次不存在")
    return {"data": batch}


@router.get("/batches/{batch_id}/rows")
async def list_import_rows(
    batch_id: int,
    status: str | None = Query(None, description="标准化状态过滤"),
    limit: int = Query(500, ge=1, le=2000),
    db: AsyncSession = Depends(get_db),
):
    """List rows in an import batch."""
    repo = ImportRepository(db)
    batch = await repo.get_batch(batch_id)
    if not batch:
        raise NotFoundError("导入批次不存在")
    rows = await repo.list_rows(batch_id, status=status, limit=limit)
    return {"data": rows, "batch": batch}
