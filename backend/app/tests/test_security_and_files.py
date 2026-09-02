"""Security guardrails, file parsing and destructive-flow regression tests."""

from __future__ import annotations

import io
import time
import zipfile

import pytest
from httpx import AsyncClient

from ..core.config import Settings
from ..core.security import derive_password
from ..modules.admin.model import DeletionRequest
from ..modules.interview.router import _resume_text_from_binary
from ..modules.users.model import User
from .test_platform_flow import auth, login, seed_user


@pytest.mark.unit
def test_production_configuration_rejects_unsafe_defaults():
    settings = Settings(ENVIRONMENT="production")
    with pytest.raises(RuntimeError) as error:
        settings.validate_runtime()
    message = str(error.value)
    assert "RETURN_SESSION_TOKEN must be false" in message
    assert "METRICS_TOKEN" in message
    assert "FILE_STORAGE_BACKEND must be cos" in message


@pytest.mark.unit
def test_docx_resume_text_extraction():
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, "w") as archive:
        archive.writestr("word/document.xml", "<w:document><w:body><w:p><w:r><w:t>张三</w:t></w:r></w:p><w:p><w:r><w:t>人工智能学院 本科</w:t></w:r></w:p></w:body></w:document>")
    text = _resume_text_from_binary(
        stream.getvalue(),
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "resume.docx",
    )
    assert "张三" in text
    assert "人工智能学院" in text


@pytest.mark.integration
@pytest.mark.anyio
async def test_forced_password_change_is_enforced(client: AsyncClient, db_factory):
    credentials = derive_password("Temporary9A")
    async with db_factory() as db:
        db.add(User(
            student_id="800001", name="临时管理员", email="", role="school_admin",
            account_status="active", password_hash=credentials["hash"], password_salt=credentials["salt"],
            force_password_change=True, college="人工智能学院", major="管理员", class_name="", grade="",
            phone="", bio="", target_role="", development_track="staff", interests=[], consent_at=1,
        ))
        await db.commit()
    response = await client.post("/api/v1/auth/login", json={"studentId": "800001", "password": "Temporary9A"})
    assert response.status_code == 200
    token = response.json()["sessionToken"]
    blocked = await client.get("/api/v1/admin/overview", headers=auth(token))
    assert blocked.status_code == 409
    changed = await client.patch(
        "/api/v1/account",
        headers=auth(token),
        json={"action": "password", "currentPassword": "Temporary9A", "newPassword": "Permanent9A"},
    )
    assert changed.status_code == 200
    allowed = await client.get("/api/v1/admin/overview", headers=auth(token))
    assert allowed.status_code == 200


@pytest.mark.integration
@pytest.mark.anyio
async def test_import_staging_requires_system_admin(client: AsyncClient, db_factory):
    await seed_user(db_factory, "20240010", "student")
    await seed_user(db_factory, "800010", "school_admin", class_name="")
    student = await login(client, "20240010")
    admin = await login(client, "800010")
    forbidden = await client.get("/api/v1/imports/batches", headers=auth(student))
    assert forbidden.status_code == 403
    allowed = await client.get("/api/v1/imports/batches", headers=auth(admin))
    assert allowed.status_code == 200


@pytest.mark.integration
@pytest.mark.anyio
async def test_deletion_requires_password_and_removes_file(client: AsyncClient, db_factory, tmp_path, monkeypatch):
    import app.integrations.storage as storage_module
    import app.modules.files.router as files_router_module
    import app.modules.admin.router as admin_router_module

    import app.core.config as config_module

    test_settings = config_module.get_settings().model_copy(update={"LOCAL_STORAGE_PATH": str(tmp_path / "storage")})
    monkeypatch.setattr(storage_module, "get_settings", lambda: test_settings)
    storage_module._storage_client = None
    files_router_module.get_storage_client = storage_module.get_storage_client
    admin_router_module.get_storage_client = storage_module.get_storage_client

    user_id = await seed_user(db_factory, "20240009", "student")
    await seed_user(db_factory, "800009", "school_admin", class_name="")
    student = await login(client, "20240009")
    admin = await login(client, "800009")
    uploaded = await client.post(
        "/api/v1/evidence-files",
        files={"file": ("proof.txt", b"personal proof to erase", "text/plain")},
        headers=auth(student),
    )
    assert uploaded.status_code == 200
    stored = list((tmp_path / "storage").rglob("proof.txt"))
    assert len(stored) == 1
    rejected = await client.post(
        "/api/v1/account/deletion", json={"currentPassword": "wrong"}, headers=auth(student),
    )
    assert rejected.status_code == 400
    requested = await client.post(
        "/api/v1/account/deletion", json={"currentPassword": "StrongPass9"}, headers=auth(student),
    )
    assert requested.status_code == 200
    async with db_factory() as db:
        item = await db.get(DeletionRequest, requested.json()["request"]["id"])
        item.scheduled_at = int(time.time() * 1000) - 1
        await db.commit()
    completed = await client.post(
        "/api/v1/admin/deletions", json={"userId": user_id}, headers=auth(admin),
    )
    assert completed.status_code == 200, completed.text
    assert not stored[0].exists()
    old_login = await client.post(
        "/api/v1/auth/login",
        json={"studentId": "20240009", "password": "StrongPass9"},
        headers={"Origin": "http://localhost:3000"},
    )
    assert old_login.status_code == 401
    storage_module._storage_client = None
