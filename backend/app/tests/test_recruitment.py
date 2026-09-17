"""Real database integration tests for consent, ownership and resume persistence."""
import pytest
from .test_platform_flow import seed_user, login, auth
from ..modules.evidence.model import Evidence


@pytest.mark.anyio
async def test_resume_application_lifecycle(client, db_factory):
    student_id = await seed_user(db_factory, "20241111", "student")
    enterprise_id = await seed_user(db_factory, "900011", "enterprise")
    await seed_user(db_factory, "900012", "enterprise")
    await seed_user(db_factory, "20242222", "student")
    student = auth(await login(client, "20241111"))
    enterprise = auth(await login(client, "900011"))
    other = auth(await login(client, "900012"))
    other_student = auth(await login(client, "20242222"))
    base = "/api/v1/recruitment"
    assert (await client.get(base + "/resume", headers=enterprise)).status_code == 403
    draft = {"data": {"name": "测试同学", "role": "开发实习生", "school": "测试大学", "summary": "完成校园项目", "experiences": [{"id": 1, "title": "校园项目", "org": "学校", "period": "2026", "detail": "开发页面"}]}, "template": "mint"}
    assert (await client.put(base + "/resume", json=draft, headers=student)).status_code == 200
    loaded = (await client.get(base + "/resume", headers=student)).json()
    assert loaded["data"]["school"] == "测试大学" and loaded["template"] == "mint"
    assert (await client.get(base + "/resume", headers=other_student)).json()["data"]["school"] == ""
    async with db_factory() as db:
        for status in ("verified", "pending"):
            db.add(Evidence(user_id=student_id, student_id="20241111", title=status, category="项目", dimension="项目实践", detail="完成开发", evidence_date="2026-09-17", source_type="student", verification_status=status))
        await db.commit()
    payload = {"enterprise_id": enterprise_id, "consent": False}
    assert (await client.post(base + "/applications", json=payload, headers=student)).status_code == 400
    payload["consent"] = True
    created = await client.post(base + "/applications", json=payload, headers=student)
    assert created.status_code == 201, created.text
    app_id = created.json()["id"]
    assert (await client.post(base + "/applications", json=payload, headers=student)).json()["alreadySubmitted"]
    rows = (await client.get(base + "/applications", headers=enterprise)).json()["applications"]
    assert len(rows) == 1 and len(rows[0]["resume"]["tasks"]) == 1
    assert rows[0]["resume"]["tasks"][0]["title"] == "verified"
    assert (await client.get(base + "/applications", headers=other)).json()["applications"] == []
    assert (await client.patch(base + "/applications/" + app_id, json={"status": "已收藏"}, headers=other)).status_code == 404
    assert (await client.patch(base + "/applications/" + app_id, json={"status": "已收藏"}, headers=enterprise)).status_code == 200
    assert (await client.get(base + "/applications", headers=student)).json()["applications"][0]["status"] == "已收藏"
    draft["data"]["summary"] = "修改后未重新分享"
    await client.put(base + "/resume", json=draft, headers=student)
    assert (await client.get(base + "/applications", headers=enterprise)).json()["applications"][0]["resume"]["summary"] == "完成校园项目"
    assert (await client.delete(base + "/applications/" + app_id, headers=other_student)).status_code == 404
    assert (await client.delete(base + "/applications/" + app_id, headers=student)).status_code == 200
    assert (await client.get(base + "/applications", headers=enterprise)).json()["applications"] == []


@pytest.mark.anyio
async def test_ai_uses_provider_and_preserves_draft(client, db_factory, monkeypatch):
    from ..modules.recruitment import router as module
    await seed_user(db_factory, "20243333", "student")
    headers = auth(await login(client, "20243333"))
    base = "/api/v1/recruitment/resume"
    draft = {"data": {"name": "学生", "role": "开发", "summary": "真实经历"}}
    await client.put(base, json=draft, headers=headers)
    class Provider:
        configured = True
        async def chat(self, messages, **kwargs):
            assert "真实经历" in messages[1]["content"]
            return {"content": '{"summary":"润色后的真实经历"}', "model": "test-provider"}
    provider = Provider()
    monkeypatch.setattr(module, "get_llm_client", lambda: provider)
    result = await client.post(base + "/optimize", json=draft, headers=headers)
    assert result.status_code == 200, result.text
    assert result.json()["summary"] == "润色后的真实经历"
    assert (await client.get(base, headers=headers)).json()["data"]["summary"] == "真实经历"
    provider.configured = False
    assert (await client.post(base + "/optimize", json=draft, headers=headers)).status_code == 502
    provider.configured = True
    async def invalid(*args, **kwargs):
        return {"content": "not valid JSON", "model": "test-provider"}
    monkeypatch.setattr(provider, "chat", invalid)
    assert (await client.post(base + "/optimize", json=draft, headers=headers)).status_code == 502
    assert (await client.get(base, headers=headers)).json()["data"]["summary"] == "真实经历"
