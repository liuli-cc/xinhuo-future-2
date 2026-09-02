"""Organization repository — colleges and major programs."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from .model import College, University, UniversityMajorProgram


class OrganizationRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_universities(self) -> list[dict]:
        stmt = select(University).where(University.is_active == True)
        result = await self.db.execute(stmt)
        return [self._uni_to_dict(u) for u in result.scalars().all()]

    async def list_colleges(self, university_id: int | None = None) -> list[dict]:
        stmt = select(College).where(College.is_active == True)
        if university_id:
            stmt = stmt.where(College.university_id == university_id)
        stmt = stmt.order_by(College.name)
        result = await self.db.execute(stmt)
        return [self._college_to_dict(c) for c in result.scalars().all()]

    async def get_college(self, college_id: int) -> dict | None:
        stmt = select(College).where(College.id == college_id)
        result = await self.db.execute(stmt)
        c = result.scalar_one_or_none()
        return self._college_to_dict(c) if c else None

    async def list_major_programs(
        self,
        college_id: int | None = None,
        search: str | None = None,
        limit: int = 200,
    ) -> list[dict]:
        stmt = (
            select(UniversityMajorProgram)
            .where(UniversityMajorProgram.is_active == True)
            .options(selectinload(UniversityMajorProgram.college))
        )
        if college_id:
            stmt = stmt.where(UniversityMajorProgram.college_id == college_id)
        if search:
            stmt = stmt.where(UniversityMajorProgram.major_name.contains(search))
        stmt = stmt.order_by(UniversityMajorProgram.major_name).limit(limit)
        result = await self.db.execute(stmt)
        return [self._prog_to_dict(p) for p in result.unique().scalars().all()]

    async def get_major_program(self, program_id: int) -> dict | None:
        stmt = (
            select(UniversityMajorProgram)
            .where(UniversityMajorProgram.id == program_id)
            .options(selectinload(UniversityMajorProgram.college))
        )
        result = await self.db.execute(stmt)
        p = result.scalar_one_or_none()
        return self._prog_to_dict(p) if p else None

    # ── Helpers ──────────────────────────────────────────────

    def _uni_to_dict(self, u: University) -> dict:
        return {
            "id": u.id,
            "name": u.name,
            "short_name": u.short_name,
            "code": u.code,
            "province": u.province,
            "city": u.city,
        }

    def _college_to_dict(self, c: College) -> dict:
        return {
            "id": c.id,
            "university_id": c.university_id,
            "name": c.name,
            "short_name": c.short_name,
            "official_url": c.official_url,
        }

    def _prog_to_dict(self, p: UniversityMajorProgram) -> dict:
        return {
            "id": p.id,
            "university_id": p.university_id,
            "college_id": p.college_id,
            "college_name": p.college.name if p.college else None,
            "standard_major_id": p.standard_major_id,
            "major_code": p.major_code,
            "major_name": p.major_name,
            "degree_category": p.degree_category,
            "study_years": p.study_years,
            "mapping_status": p.mapping_status,
        }
