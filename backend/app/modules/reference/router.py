"""Reference router — standard major & job dictionaries."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.session import get_db
from .repository import ReferenceRepository

router = APIRouter(prefix="/reference", tags=["reference"])


@router.get("/majors")
async def list_majors(
    discipline: str | None = Query(None, description="学科门类"),
    category: str | None = Query(None, description="专业类"),
    search: str | None = Query(None, description="搜索专业名称"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """List standard undergraduate majors with optional filtering."""
    repo = ReferenceRepository(db)
    majors = await repo.list_majors(
        discipline=discipline, category=category, search=search,
        limit=limit, offset=offset,
    )
    total = await repo.count_majors(discipline=discipline, search=search)
    return {
        "data": majors,
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/majors/disciplines")
async def list_disciplines(db: AsyncSession = Depends(get_db)):
    """List all distinct discipline names."""
    repo = ReferenceRepository(db)
    return {"disciplines": await repo.list_disciplines()}


@router.get("/majors/{major_id}")
async def get_major(major_id: int, db: AsyncSession = Depends(get_db)):
    """Get a single standard major by ID."""
    repo = ReferenceRepository(db)
    major = await repo.get_major(major_id)
    if not major:
        from ...core.exceptions import NotFoundError
        raise NotFoundError("专业不存在")
    return {"data": major}


@router.get("/jobs")
async def list_jobs(
    domain: str | None = Query(None, description="岗位大类"),
    category: str | None = Query(None, description="岗位类"),
    search: str | None = Query(None, description="搜索岗位名称"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """List standard job classifications."""
    repo = ReferenceRepository(db)
    jobs = await repo.list_jobs(
        domain=domain, category=category, search=search,
        limit=limit, offset=offset,
    )
    return {
        "data": jobs,
        "limit": limit,
        "offset": offset,
    }


@router.get("/jobs/domains")
async def list_job_domains(db: AsyncSession = Depends(get_db)):
    """List all distinct job domains."""
    repo = ReferenceRepository(db)
    return {"domains": await repo.list_job_domains()}


@router.get("/jobs/{job_id}")
async def get_job(job_id: int, db: AsyncSession = Depends(get_db)):
    """Get a single standard job by ID."""
    repo = ReferenceRepository(db)
    job = await repo.get_job(job_id)
    if not job:
        from ...core.exceptions import NotFoundError
        raise NotFoundError("岗位不存在")
    return {"data": job}


@router.get("/codes/{namespace}")
async def list_code_values(
    namespace: str,
    db: AsyncSession = Depends(get_db),
):
    """List code values for a given namespace (education_level, etc.)."""
    repo = ReferenceRepository(db)
    return {"data": await repo.list_code_values(namespace)}
