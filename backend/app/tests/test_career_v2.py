"""Employment v2 — 状态机 / 大厅过滤 / 导入 / 公告投递 的验收测试.

对应 docs/G3-EMPLOYMENT-DESIGN.md 的 T1/T3/T4/T5/T6/T7/T8 验收标准.
"""

from __future__ import annotations

import io
import time

import pytest
from httpx import AsyncClient
from openpyxl import Workbook

from ..core.security import derive_password
from ..modules.career.model import CareerJob
from ..modules.career.service import (
    JOB_EXPIRY_MS,
    evaluate_hard_filter,
    infer_category,
    rule_profile,
    split_majors,
)
from ..modules.career.stages import validate_target
from ..modules.users.model import User
from ..core.exceptions import ConflictError, ValidationError

DAY_MS = 86400 * 1000


# ── 单元：状态机 ─────────────────────────────────────────────────


@pytest.mark.unit
def test_stage_forward_and_skip():
    assert validate_target("saved", None, "applied", None) == ("applied", None)
    assert validate_target("applied", None, "interview_pending", None)[0] == "interview_pending"  # 允许跳级
    assert validate_target("saved", None, None, "withdrawn") == ("saved", "withdrawn")  # 未投递可放弃


@pytest.mark.unit
def test_stage_rejects_backward_and_bad_endings():
    with pytest.raises(ConflictError):
        validate_target("interview", None, "written_test", None)  # 回退
    with pytest.raises(ConflictError):
        validate_target("saved", None, None, "rejected")  # 未投递谈不上未通过
    with pytest.raises(ValidationError):
        validate_target("applied", None, "nonexistent", None)
    with pytest.raises(ConflictError):
        validate_target("applied", "rejected", "offer", None)  # 已终态


# ── 单元：需求档案与硬条件 ────────────────────────────────────────


@pytest.mark.unit
def test_split_majors_and_category():
    assert split_majors("计算机科学与技术，软件工程、网络安全") == ["计算机科学与技术", "软件工程", "网络安全"]
    assert split_majors("专业不限") == []
    assert split_majors("") == []
    assert infer_category("后端开发实习生", None) == "intern"
    assert infer_category("2027届校园招聘-开发岗", None) == "campus"
    assert infer_category("总行科技岗管培生", None) == "campus"  # 数据源以校招为主，默认 campus
    assert infer_category("销售代表（社招，5年工作经验）", None) == "social"


@pytest.mark.unit
def test_rule_profile_and_hard_filter():
    profile = rule_profile("Java后端实习生", "熟悉 Java 与 Spring，掌握 MySQL，具备良好的沟通能力。要求本科及以上学历。", "计算机科学与技术、软件工程")
    assert profile["engine"] == "rules"
    assert any(skill["name"].startswith("Java") for skill in profile["skills"])
    assert profile["majors"] == ["计算机科学与技术", "软件工程"]
    assert any("本科" in req for req in profile["hardReqs"])

    passed = evaluate_hard_filter(profile, {"major": "计算机科学与技术（大数据方向）"})
    assert passed == []
    failed = evaluate_hard_filter(profile, {"major": "会计学"})
    assert failed and "专业" in failed[0]


# ── 夹具 ────────────────────────────────────────────────────────


async def _seed_user(factory, student_id: str, role: str = "student", major: str = "计算机科学与技术",
                     grade: str = "2024级", employment_admin: bool = False) -> int:
    credentials = derive_password("StrongPass9")
    async with factory() as db:
        user = User(
            student_id=student_id, name=f"用户{student_id}", email="t@example.edu.cn", role=role,
            account_status="active", password_hash=credentials["hash"], password_salt=credentials["salt"],
            college="人工智能学院", major=major, class_name="计科2401", grade=grade, phone="", bio="",
            target_role="后端开发", development_track="employment", interests=["Java"],
            consent_at=1, consent_version="2026-08-13", privacy_version="2026-08-13",
            employment_admin=employment_admin,
        )
        db.add(user)
        await db.commit()
        return user.id


async def _login(client: AsyncClient, student_id: str) -> str:
    response = await client.post("/api/v1/auth/login", json={"studentId": student_id, "password": "StrongPass9"},
                                 headers={"Origin": "http://localhost:3000"})
    assert response.status_code == 200, response.text
    return response.json()["sessionToken"]


def _job_xlsx(rows: list[dict]) -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    sheet.append(["序号", "行业", "公司名称", "企业性质", "岗位名称", "岗位要求/工作要求", "专业限制", "截止时间", "工作地点", "投递网址"])
    for index, row in enumerate(rows, start=1):
        sheet.append([index, row.get("行业", "科技"), row["公司名称"], row.get("企业性质", "民企"), row["岗位名称"],
                      row["岗位要求"], row.get("专业限制", "不限"), row.get("截止时间", ""), row.get("工作地点", "呼和浩特市"),
                      row.get("投递网址", "https://example.com/apply")])
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def _announcement_xlsx(rows: list[dict]) -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    sheet.append(["录入时间", "招聘简章", "公司名称", "更新时间", "工作城市", "详情链接", "☆投递链接☆",
                  "毕业年限", "标签", "截止时间", "招聘岗位", "投递难度（5分制）", "公司描述"])
    for row in rows:
        sheet.append([row.get("录入时间", "2026-08-20"), row["招聘简章"], row["公司名称"], row.get("更新时间", ""),
                      row.get("工作城市", "呼和浩特"), row.get("详情链接", "https://mp.weixin.qq.com/s/x"),
                      row.get("投递链接", "https://campus.example.com"), row.get("毕业年限", "27届"),
                      row.get("标签", "科技"), row.get("截止时间", "未告知"), row.get("招聘岗位", "研发岗、职能岗"),
                      "3", row.get("公司描述", "中国互联网百强")])
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


# ── 集成：大厅 / 过期 / fitForMe / 导入 ──────────────────────────


@pytest.mark.integration
@pytest.mark.anyio
async def test_board_visibility_fitforme_and_expiry(client: AsyncClient, db_factory):
    await _seed_user(db_factory, "20240101")
    await _seed_user(db_factory, "20061001", role="teacher", employment_admin=True)
    student_headers = {"Authorization": f"Bearer {await _login(client, '20240101')}"}
    teacher_headers = {"Authorization": f"Bearer {await _login(client, '20061001')}"}

    upload = await client.post(
        "/api/v1/admin/career/jobs/import",
        files={"file": ("jobs.xlsx", _job_xlsx([
            {"公司名称": "云智科技", "岗位名称": "Java后实习生", "岗位要求": "熟悉 Java、Spring、MySQL 与接口测试。",
             "专业限制": "计算机科学与技术、软件工程", "截止时间": "2026-12-31"},
            {"公司名称": "诚信会计师事务所", "岗位名称": "审计助理", "岗位要求": "负责审计底稿与函证，熟悉 Excel。",
             "专业限制": "会计学、审计学", "截止时间": "2026-12-31"},
            {"公司名称": "过气网络", "岗位名称": "运营专员", "岗位要求": "内容运营与活动执行，沟通协作良好。",
             "专业限制": "不限", "截止时间": ""},
        ]), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        headers=teacher_headers,
    )
    assert upload.status_code == 200, upload.text
    assert upload.json()["imported"] == 3

    repeat = await client.post(
        "/api/v1/admin/career/jobs/import",
        files={"file": ("jobs.xlsx", _job_xlsx([
            {"公司名称": "云智科技", "岗位名称": "Java后实习生", "岗位要求": "熟悉 Java、Spring、MySQL 与接口测试。"}]),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        headers=teacher_headers,
    )
    assert repeat.status_code == 200 and repeat.json()["imported"] == 0 and repeat.json()["duplicates"] == 1

    board = await client.get("/api/v1/career/jobs", headers=student_headers)
    assert board.status_code == 200
    assert board.json()["total"] == 3  # 学生看不到 private 自定义岗位，这里全是公共导入

    fit = await client.get("/api/v1/career/jobs?fitForMe=1", headers=student_headers)
    titles = [item["title"] for item in fit.json()["items"]]
    assert "Java后实习生" in titles and all(item["match"]["overallScore"] is not None for item in fit.json()["items"])
    assert "审计助理" not in titles  # 专业硬条件不符 → 不进「适合我」

    # 过期规则：无截止时间 → 发布 + 3 个月
    async with db_factory() as db:
        stale = CareerJob(
            id="stale0000000000000000000000000001", created_by=1, title="过期岗位", company="旧公司",
            description="这是一条用于测试自动过期规则的岗位描述，超过三个月。", employment_type=None,
            category="social", published_at=int(time.time() * 1000) - int(JOB_EXPIRY_MS) - DAY_MS,
            source="import", visibility="public", status="active",
        )
        db.add(stale)
        await db.commit()

    default_board = await client.get("/api/v1/career/jobs", headers=student_headers)
    assert "过期岗位" not in [item["title"] for item in default_board.json()["items"]]
    with_expired = await client.get("/api/v1/career/jobs?includeExpired=1", headers=student_headers)
    assert "过期岗位" in [item["title"] for item in with_expired.json()["items"]]


@pytest.mark.integration
@pytest.mark.anyio
async def test_application_stage_machine_and_timeline(client: AsyncClient, db_factory):
    await _seed_user(db_factory, "20240101")
    headers = {"Authorization": f"Bearer {await _login(client, '20240101')}"}

    created = await client.post("/api/v1/career/jobs", json={
        "title": "Java后端实习生", "company": "测试科技",
        "description": "负责 Java Spring 接口开发，需要 MySQL、SQL、Redis 数据库能力，以及接口测试、部署、日志与沟通协作能力。",
    }, headers=headers)
    job_id = created.json()["job"]["id"]

    applied = await client.post("/api/v1/career/applications", json={"jobId": job_id}, headers=headers)
    application_id = applied.json()["application"]["id"]

    back = await client.post(f"/api/v1/career/applications/{application_id}/events",
                             json={"outcome": "rejected", "note": "还没投递就想标记未通过"}, headers=headers)
    assert back.status_code == 409

    for stage, note in [("applied", "已在学校就业系统投递"), ("written_test_pending", "收到笔试通知"),
                        ("written_test", "完成笔试，等待结果"), ("interview_pending", "笔试通过，约面试"),
                        ("interview", "完成一面"), ("offer", "收到录用意向")]:
        step = await client.post(f"/api/v1/career/applications/{application_id}/events",
                                 json={"stage": stage, "note": note}, headers=headers)
        assert step.status_code == 200, step.text

    closed = await client.post(f"/api/v1/career/applications/{application_id}/events",
                               json={"outcome": "withdrawn", "note": "接受了另一家"}, headers=headers)
    assert closed.status_code == 200
    again = await client.post(f"/api/v1/career/applications/{application_id}/events",
                              json={"stage": "applied", "note": "结束后不能再改"}, headers=headers)
    assert again.status_code == 409

    timeline = await client.get(f"/api/v1/career/applications/{application_id}/events", headers=headers)
    stages_in_timeline = [event["stage"] for event in timeline.json()["events"]]
    assert stages_in_timeline[0] == "applied" and stages_in_timeline[-1] == "withdrawn"

    listing = await client.get("/api/v1/career/applications?outcome=withdrawn", headers=headers)
    assert listing.json()["total" ] if False else listing.json()["counts"].get("withdrawn") == 1


# ── 集成：公告导入 / 投递 / 收藏 ─────────────────────────────────


@pytest.mark.integration
@pytest.mark.anyio
async def test_announcement_import_apply_and_favorite(client: AsyncClient, db_factory):
    await _seed_user(db_factory, "20240101")
    await _seed_user(db_factory, "20061001", role="teacher", employment_admin=True)
    student_headers = {"Authorization": f"Bearer {await _login(client, '20240101')}"}
    teacher_headers = {"Authorization": f"Bearer {await _login(client, '20061001')}"}

    upload = await client.post(
        "/api/v1/admin/career/announcements/import",
        files={"file": ("ann.xlsx", _announcement_xlsx([
            {"招聘简章": "TCL 2027届全球校园招聘正式启动", "公司名称": "TCL", "工作城市": "天津,呼和浩特,上海",
             "毕业年限": "27届", "标签": "制造业,科技"},
            {"招聘简章": "好未来2027届校园招聘启动", "公司名称": "好未来", "工作城市": "北京,上海",
             "毕业年限": "27届", "标签": "教育,互联网"},
        ]), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        headers=teacher_headers,
    )
    assert upload.status_code == 200, upload.text
    assert upload.json()["imported"] == 2

    no_permission = await client.post(
        "/api/v1/admin/career/announcements/import",
        files={"file": ("ann.xlsx", _announcement_xlsx([{"招聘简章": "x公司校招", "公司名称": "x公司"}]),
                              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        headers=student_headers,
    )
    assert no_permission.status_code == 403

    listing = await client.get("/api/v1/career/announcements?cohort=27届", headers=student_headers)
    items = listing.json()["items"]
    assert len(items) == 2 and items[0]["cohort"] == "27届"
    announcement_id = items[0]["id"]

    fav = await client.post("/api/v1/career/announcement-favorites",
                            json={"announcementId": announcement_id}, headers=student_headers)
    assert fav.status_code == 200
    fav_list = await client.get("/api/v1/career/announcement-favorites", headers=student_headers)
    assert any(item["id"] == announcement_id for item in fav_list.json()["favorites"])

    applied = await client.post("/api/v1/career/announcement-applications",
                                json={"announcementId": announcement_id}, headers=student_headers)
    application_id = applied.json()["application"]["id"]
    stage = await client.post(f"/api/v1/career/announcement-applications/{application_id}/events",
                              json={"stage": "applied", "note": "已网申提交"}, headers=student_headers)
    assert stage.status_code == 200
    timeline = await client.get(f"/api/v1/career/announcement-applications/{application_id}/events", headers=student_headers)
    assert timeline.json()["events"][0]["stage"] == "applied"

    tracker = await client.get("/api/v1/career/announcement-applications", headers=student_headers)
    assert tracker.json()["counts"].get("applied") == 1
