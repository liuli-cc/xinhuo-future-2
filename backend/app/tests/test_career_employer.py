"""Group3 G3-01 — 岗位资源管理：企业库去重 + 岗位标签 + 岗位-企业关联."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from ..core.security import derive_password
from ..modules.career.service import find_or_create_employer, normalize_company_name
from ..modules.users.model import User


@pytest.mark.unit
def test_normalize_company_name():
    assert normalize_company_name(" 阿里巴巴 ") == "阿里巴巴"
    assert normalize_company_name("AliBaBa") == "alibaba"
    assert normalize_company_name("") == ""


@pytest.mark.unit
@pytest.mark.anyio
async def test_employer_dedup_by_credit_code(db_factory):
    async with db_factory() as db:
        first = await find_or_create_employer(db, name="阿里巴巴", credit_code="91330000MA27U0X39L")
        await db.commit()
        second = await find_or_create_employer(db, name="阿里巴巴", credit_code="91330000MA27U0X39L")
        await db.commit()
        assert first.id == second.id


@pytest.mark.unit
@pytest.mark.anyio
async def test_employer_dedup_by_name(db_factory):
    async with db_factory() as db:
        first = await find_or_create_employer(db, name="腾讯科技")
        await db.commit()
        second = await find_or_create_employer(db, name=" 腾讯科技 ")
        await db.commit()
        assert first.id == second.id


async def _seed_student(factory, student_id: str = "20240101"):
    credentials = derive_password("StrongPass9")
    async with factory() as db:
        user = User(
            student_id=student_id,
            name="测试学生",
            email="t@example.edu.cn",
            role="student",
            account_status="active",
            password_hash=credentials["hash"],
            password_salt=credentials["salt"],
            college="人工智能学院",
            major="计算机科学与技术",
            class_name="计科2401",
            grade="2024级",
            phone="",
            bio="",
            target_role="后端开发",
            development_track="employment",
            interests=["Java"],
            consent_at=1,
            consent_version="2026-08-13",
            privacy_version="2026-08-13",
        )
        db.add(user)
        await db.commit()
        return user.id


async def _login(client: AsyncClient, student_id: str = "20240101") -> str:
    response = await client.post(
        "/api/v1/auth/login",
        json={"studentId": student_id, "password": "StrongPass9"},
        headers={"Origin": "http://localhost:3000"},
    )
    assert response.status_code == 200, response.text
    return response.json()["sessionToken"]


@pytest.mark.integration
@pytest.mark.anyio
async def test_create_job_links_employer_and_tags(client: AsyncClient, db_factory):
    await _seed_student(db_factory)
    token = await _login(client)
    headers = {"Authorization": f"Bearer {token}"}

    description = "负责 Java Spring 接口开发，需要 MySQL、SQL、Redis 数据库能力，以及接口测试、部署、日志与沟通协作能力。"

    first = await client.post(
        "/api/v1/career/jobs",
        json={"title": "Java后端实习生", "company": "测试科技", "description": description, "tags": ["Java", "后端", "Java"]},
        headers=headers,
    )
    assert first.status_code == 200, first.text
    job = first.json()["job"]
    assert job["employerId"]
    assert job["tags"] == ["Java", "后端"]  # 去重

    second = await client.post(
        "/api/v1/career/jobs",
        json={"title": "后端开发工程师", "company": "测试科技", "description": description},
        headers=headers,
    )
    assert second.status_code == 200, second.text
    assert second.json()["job"]["employerId"] == job["employerId"]  # 同一企业复用

    employers = await client.get("/api/v1/career/employers", headers=headers)
    assert employers.status_code == 200, employers.text
    assert any(e["id"] == job["employerId"] and e["name"] == "测试科技" for e in employers.json()["employers"])
