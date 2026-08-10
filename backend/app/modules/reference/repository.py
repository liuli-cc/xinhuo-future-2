"""Reference repository — read operations for standard dictionaries."""

from __future__ import annotations

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from .model import RefCodeValue, RefJobStandard, RefMajorStandard


class ReferenceRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Major Standard ───────────────────────────────────────

    async def list_majors(
        self,
        discipline: str | None = None,
        category: str | None = None,
        search: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[dict]:
        stmt = select(RefMajorStandard).where(RefMajorStandard.is_active == True)
        if discipline:
            stmt = stmt.where(RefMajorStandard.discipline_name == discipline)
        if category:
            stmt = stmt.where(RefMajorStandard.major_category_name == category)
        if search:
            stmt = stmt.where(RefMajorStandard.major_name.contains(search))
        stmt = stmt.order_by(RefMajorStandard.discipline_name, RefMajorStandard.major_category_name)
        stmt = stmt.offset(offset).limit(limit)
        result = await self.db.execute(stmt)
        return [self._major_to_dict(r) for r in result.scalars().all()]

    async def count_majors(
        self, discipline: str | None = None, search: str | None = None
    ) -> int:
        stmt = select(func.count()).select_from(RefMajorStandard).where(RefMajorStandard.is_active == True)
        if discipline:
            stmt = stmt.where(RefMajorStandard.discipline_name == discipline)
        if search:
            stmt = stmt.where(RefMajorStandard.major_name.contains(search))
        result = await self.db.execute(stmt)
        return result.scalar() or 0

    async def get_major(self, major_id: int) -> dict | None:
        stmt = select(RefMajorStandard).where(RefMajorStandard.id == major_id)
        result = await self.db.execute(stmt)
        major = result.scalar_one_or_none()
        return self._major_to_dict(major) if major else None

    async def list_disciplines(self) -> list[str]:
        stmt = (
            select(RefMajorStandard.discipline_name)
            .where(RefMajorStandard.is_active == True)
            .distinct()
            .order_by(RefMajorStandard.discipline_name)
        )
        result = await self.db.execute(stmt)
        return [r[0] for r in result.all()]

    # ── Job Standard ─────────────────────────────────────────

    async def list_jobs(
        self,
        domain: str | None = None,
        category: str | None = None,
        search: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[dict]:
        stmt = select(RefJobStandard).where(RefJobStandard.is_active == True)
        if domain:
            stmt = stmt.where(RefJobStandard.job_domain == domain)
        if category:
            stmt = stmt.where(RefJobStandard.job_category == category)
        if search:
            stmt = stmt.where(RefJobStandard.job_name.contains(search))
        stmt = stmt.order_by(RefJobStandard.job_domain, RefJobStandard.job_category)
        stmt = stmt.offset(offset).limit(limit)
        result = await self.db.execute(stmt)
        return [self._job_to_dict(r) for r in result.scalars().all()]

    async def get_job(self, job_id: int) -> dict | None:
        stmt = select(RefJobStandard).where(RefJobStandard.id == job_id)
        result = await self.db.execute(stmt)
        job = result.scalar_one_or_none()
        return self._job_to_dict(job) if job else None

    async def list_job_domains(self) -> list[str]:
        stmt = (
            select(RefJobStandard.job_domain)
            .where(RefJobStandard.is_active == True)
            .distinct()
            .order_by(RefJobStandard.job_domain)
        )
        result = await self.db.execute(stmt)
        return [r[0] for r in result.all()]

    # ── Code Values ──────────────────────────────────────────

    async def list_code_values(self, namespace: str) -> list[dict]:
        stmt = (
            select(RefCodeValue)
            .where(RefCodeValue.namespace == namespace, RefCodeValue.is_active == True)
            .order_by(RefCodeValue.code)
        )
        result = await self.db.execute(stmt)
        return [self._cv_to_dict(r) for r in result.scalars().all()]

    # ── Helpers ──────────────────────────────────────────────

    def _major_to_dict(self, m: RefMajorStandard) -> dict:
        return {
            "id": m.id,
            "discipline_name": m.discipline_name,
            "major_category_name": m.major_category_name,
            "major_name": m.major_name,
            "major_code": m.major_code,
            "source": m.source,
            "source_version": m.source_version,
            "is_active": m.is_active,
            "created_at": m.created_at.isoformat() if m.created_at else None,
            "updated_at": m.updated_at.isoformat() if m.updated_at else None,
        }

    def _job_to_dict(self, j: RefJobStandard) -> dict:
        return {
            "id": j.id,
            "job_domain": j.job_domain,
            "job_category": j.job_category,
            "job_name": j.job_name,
            "aliases": j.aliases,
            "is_active": j.is_active,
            "created_at": j.created_at.isoformat() if j.created_at else None,
            "updated_at": j.updated_at.isoformat() if j.updated_at else None,
        }

    def _cv_to_dict(self, cv: RefCodeValue) -> dict:
        return {
            "id": cv.id,
            "namespace": cv.namespace,
            "code": cv.code,
            "label": cv.label,
            "parent_code": cv.parent_code,
            "metadata": cv.metadata_,
            "is_active": cv.is_active,
        }
