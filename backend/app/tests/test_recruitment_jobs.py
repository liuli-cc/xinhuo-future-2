"""Exercise two-party hiring workflow, job isolation and time validation."""
from datetime import datetime, timedelta, timezone
import pytest
from .test_platform_flow import seed_user, login, auth


@pytest.mark.anyio
async def test_published_job_to_invitation_and_offer(client, db_factory):
    await seed_user(db_factory, "20249901", "student")
    company_id = await seed_user(db_factory, "900991", "enterprise")
    await seed_user(db_factory, "900992", "enterprise")
    student = auth(await login(client, "20249901"))
    company = auth(await login(client, "900991"))
    other = auth(await login(client, "900992"))
    base = "/api/v1/recruitment"
    job = {"title": "前端开发实习生", "department": "研发部", "location": "呼和浩特", "employmentType": "实习", "description": "参与校园产品的页面开发与交互测试", "requirements": "掌握 HTML 与 JavaScript"}
    assert (await client.post(base + "/jobs", json=job, headers=student)).status_code == 403
    response = await client.post(base + "/jobs", json=job, headers=company)
    assert response.status_code == 201, response.text
    first = response.json()["job"]["id"]
    second = (await client.post(base + "/jobs", json={**job, "title": "产品实习生"}, headers=company)).json()["job"]["id"]
    assert len((await client.get(base + "/jobs", headers=student)).json()["jobs"]) == 2
    assert (await client.get(base + "/jobs", headers=other)).json()["jobs"] == []
    assert (await client.patch(base + "/jobs/" + first, json={"status": "closed"}, headers=other)).status_code == 404
    draft = {"data": {"name": "预览学生", "role": "前端开发", "summary": "开发了校园页面"}}
    assert (await client.put(base + "/resume", json=draft, headers=student)).status_code == 200
    payload = {"enterprise_id": company_id, "job_id": first, "consent": True}
    application = await client.post(base + "/applications", json=payload, headers=student)
    assert application.status_code == 201, application.text
    application_id = application.json()["id"]
    assert (await client.post(base + "/applications", json=payload, headers=student)).json()["alreadySubmitted"] is True
    second_application = await client.post(base + "/applications", json={**payload, "job_id": second}, headers=student)
    assert second_application.status_code == 201 and not second_application.json()["alreadySubmitted"]
    invite = {"status": "面试邀请", "interview_at": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat(), "interview_location": "线上会议，链接另行沟通", "interview_note": "请准备项目介绍"}
    endpoint = base + "/applications/" + application_id
    assert (await client.patch(endpoint, json=invite, headers=other)).status_code == 404
    assert (await client.patch(endpoint, json={"status": "面试邀请"}, headers=company)).status_code == 400
    assert (await client.patch(endpoint, json={**invite, "interview_at": "2020-01-01T10:00:00+08:00"}, headers=company)).status_code == 400
    assert (await client.patch(endpoint, json=invite, headers=company)).status_code == 200
    rows = (await client.get(base + "/applications", headers=student)).json()["applications"]
    row = next(item for item in rows if item["id"] == application_id)
    assert row["job"]["title"] == job["title"] and row["interview"]["note"] == invite["interview_note"]
    export = (await client.get("/api/v1/account/export", headers=student)).json()
    assert len(export["recruitmentApplications"]) == 2 and export["resumes"][0]["data"]["name"] == "预览学生"
    company_export = (await client.get("/api/v1/account/export", headers=company)).json()
    other_export = (await client.get("/api/v1/account/export", headers=other)).json()
    assert len(company_export["publishedJobs"]) == 2 and len(company_export["recruitmentApplications"]) == 2
    assert other_export["publishedJobs"] == [] and other_export["recruitmentApplications"] == []
    assert (await client.patch(endpoint, json={"status": "已录用"}, headers=company)).status_code == 200
    assert (await client.patch(base + "/jobs/" + first, json={"status": "closed"}, headers=company)).status_code == 200
    assert len((await client.get(base + "/jobs", headers=student)).json()["jobs"]) == 1
    assert (await client.post(base + "/applications", json=payload, headers=student)).status_code == 400
    assert (await client.delete(endpoint, headers=student)).status_code == 200
    assert len((await client.get(base + "/applications", headers=company)).json()["applications"]) == 1
