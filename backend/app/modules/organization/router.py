"""Organization router — colleges and major programs."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.exceptions import NotFoundError
from ...db.session import get_db
from .repository import OrganizationRepository

router = APIRouter(prefix="/organization", tags=["organization"])


@router.get("/universities")
async def list_universities(db: AsyncSession = Depends(get_db)):
    """List all active universities."""
    repo = OrganizationRepository(db)
    return {"data": await repo.list_universities()}


@router.get("/colleges")
async def list_colleges(
    university_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """List all active colleges, optionally filtered by university."""
    repo = OrganizationRepository(db)
    return {"data": await repo.list_colleges(university_id=university_id)}


@router.get("/colleges/{college_id}")
async def get_college(college_id: int, db: AsyncSession = Depends(get_db)):
    """Get a single college by ID."""
    repo = OrganizationRepository(db)
    college = await repo.get_college(college_id)
    if not college:
        raise NotFoundError("学院不存在")
    return {"data": college}


@router.get("/majors")
async def list_major_programs(
    college_id: int | None = Query(None),
    search: str | None = Query(None),
    limit: int = Query(200, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    """List all active university major programs."""
    repo = OrganizationRepository(db)
    return {"data": await repo.list_major_programs(
        college_id=college_id, search=search, limit=limit,
    )}


@router.get("/majors/{program_id}")
async def get_major_program(program_id: int, db: AsyncSession = Depends(get_db)):
    """Get a single major program by ID."""
    repo = OrganizationRepository(db)
    prog = await repo.get_major_program(program_id)
    if not prog:
        raise NotFoundError("专业不存在")
    return {"data": prog}
