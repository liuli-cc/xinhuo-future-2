"""End-to-end business and security acceptance tests for v0.5."""

from __future__ import annotations

from datetime import date

import pytest
from httpx import AsyncClient

from ..core.security import derive_password
from ..modules.users.model import User


async def seed_user(factory, student_id: str, role: str, *, class_name: str = "计科2401", college: str = "人工智能学院"):
    credentials = derive_password("StrongPass9")
    async with factory() as db:
        user = User(
            student_id=student_id,
            name="测试学生" if role == "student" else "测试教师",
            email="test@example.edu.cn",
            role=role,
            account_status="active",
            password_hash=credentials["hash"],
            password_salt=credentials["salt"],
            college=college,
            major="计算机科学与技术",
            class_name=class_name,
            grade="2024级",
            phone="",
            bio="",
            target_role="后端开发",
            development_track="employment",
            interests=["Java", "数据库"],
            consent_at=1,
            consent_version="2026-08-13",
            privacy_version="2026-08-13",
        )
        db.add(user)
        await db.commit()
        return user.id


async def login(client: AsyncClient, student_id: str) -> str:
    response = await client.post(
        "/api/v1/auth/login",
        json={"studentId": student_id, "password": "StrongPass9"},
        headers={"Origin": "http://localhost:3000"},
    )
    assert response.status_code == 200, response.text
    return response.json()["sessionToken"]


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.integration
@pytest.mark.anyio
async def test_student_teacher_growth_loop(client: AsyncClient, db_factory):
    await seed_user(db_factory, "20240001", "student")
    await seed_user(db_factory, "900001", "teacher")
    student = await login(client, "20240001")
    teacher = await login(client, "900001")

    task = {
        "taskId": "custom-0-api", "semesterIndex": 0, "title": "完成后端项目",
        "note": "接口与测试", "type": "项目", "xp": 35,
    }
    response = await client.post("/api/v1/growth-path", json=task, headers=auth(student))
    assert response.status_code == 200

    upload = await client.post(
        "/api/v1/evidence-files",
        files={"file": ("evidence.txt", b"verified project delivery and test report", "text/plain")},
        headers=auth(student),
    )
    assert upload.status_code == 200, upload.text
    file_id = upload.json()["file"]["id"]

    evidence = {
        **task,
        "taskTitle": task["title"], "taskNote": task["note"], "taskType": task["type"],
        "isCustom": True, "evidenceTitle": "项目交付与测试报告", "category": "项目实践",
        "dimension": "项目实践", "detail": "独立完成接口、数据库迁移并通过自动化测试。",
        "evidenceRef": "TEST-REPORT-001", "evidenceDate": date.today().isoformat(),
        "sourceType": "project_artifact", "relevance": 90, "quality": 90,
        "contribution": 90, "attachmentId": file_id,
    }
    response = await client.post("/api/v1/growth-path/evidence", json=evidence, headers=auth(student))
    assert response.status_code == 200, response.text
    assert response.json()["tasks"][0]["evidenceStatus"] == "pending"

    pending = await client.get("/api/v1/admin/evidence", headers=auth(teacher))
    assert pending.status_code == 200, pending.text
    review_id = pending.json()["reviews"][0]["id"]
    reviewed = await client.patch(
        "/api/v1/admin/evidence",
        json={"id": review_id, "status": "verified", "reviewerNote": "材料有效", "relevance": 90, "quality": 90, "contribution": 90},
        headers=auth(teacher),
    )
    assert reviewed.status_code == 200, reviewed.text

    portrait = await client.get("/api/v1/portrait", headers=auth(student))
    assert portrait.status_code == 200
    assert portrait.json()["portrait"]["verifiedEvidence"] == 1
    assert portrait.json()["portrait"]["overallScore"] > 0

    jobs = await client.post(
        "/api/v1/career/jobs",
        json={"title": "Java后端实习生", "company": "测试科技", "city": "呼和浩特", "employmentType": "实习", "description": "负责 Java Spring 接口开发，需要 MySQL SQL 数据库、测试、沟通协作能力。"},
        headers=auth(student),
    )
    job_id = jobs.json()["job"]["id"]
    matched = await client.post(f"/api/v1/career/jobs/{job_id}/match", headers=auth(student))
    assert matched.status_code == 200, matched.text
    assert matched.json()["match"]["evidenceBasis"]["verifiedEvidence"] == 1


@pytest.mark.integration
@pytest.mark.anyio
async def test_scope_privacy_and_account_rights(client: AsyncClient, db_factory):
    student_id = await seed_user(db_factory, "20240002", "student", class_name="计科2402")
    await seed_user(db_factory, "900002", "teacher", class_name="计科2401")
    student = await login(client, "20240002")
    teacher = await login(client, "900002")

    forbidden = await client.get(f"/api/v1/users/{student_id}", headers=auth(teacher))
    assert forbidden.status_code == 403

    sessions = await client.get("/api/v1/account/sessions", headers=auth(student))
    assert sessions.status_code == 200
    assert any(item["current"] for item in sessions.json()["sessions"])

    exported = await client.get("/api/v1/account/export", headers=auth(student))
    assert exported.status_code == 200
    body = exported.json()
    assert "passwordHash" not in body["profile"]
    assert "passwordSalt" not in body["profile"]
    assert body["profile"]["studentId"] == "20240002"

    requested = await client.post("/api/v1/account/deletion", json={"currentPassword": "StrongPass9"}, headers=auth(student))
    assert requested.status_code == 200
    assert requested.json()["request"]["scheduledAt"] > requested.json()["request"]["requestedAt"]
    cancelled = await client.delete("/api/v1/account/deletion", headers=auth(student))
    assert cancelled.status_code == 200
    assert cancelled.json()["request"] is None


@pytest.mark.unit
@pytest.mark.anyio
async def test_security_headers_and_request_id(client: AsyncClient):
    response = await client.get("/health")
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["x-request-id"]

    rejected = await client.post(
        "/api/v1/auth/logout",
        cookies={"xinhuo_session": "not-a-real-session"},
    )
    assert rejected.status_code == 403
    assert rejected.json()["error_code"] == "csrf_origin_rejected"
    assert rejected.headers["x-content-type-options"] == "nosniff"
    assert rejected.headers["x-frame-options"] == "DENY"
    assert rejected.headers["x-request-id"]
