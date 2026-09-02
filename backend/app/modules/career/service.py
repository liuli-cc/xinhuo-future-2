"""Career domain services: job/announcement parsing, requirement profiles,
deterministic matching, expiry rules and serializers.

术语见根目录 CONTEXT.md。匹配分数由规则引擎唯一裁决，AI 只在入库时做
需求结构化解析（ADR-0001）；本模块是匹配规则的唯一实现处，前端禁止复制。
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..employment.model import Employer
from .model import CareerAnnouncement, CareerApplication, CareerEvent, CareerJob
from .stages import OUTCOME_LABELS, STAGE_LABELS

ENGINE_VERSION = "XH-JFM-2.0"

# 过期阈值（设计文档 §一）：岗位 3 个月、公告 6 个月；有 deadline 按 deadline
JOB_EXPIRY_MS = 92 * 86400 * 1000
ANNOUNCEMENT_EXPIRY_MS = 183 * 86400 * 1000

RULES = [
    ("Java / Spring", "项目实践", ["java", "spring", "springboot"]),
    ("Go / 服务端", "项目实践", ["golang", "go语言", "服务端"]),
    ("Python", "专业学习", ["python"]),
    ("数据库与 SQL", "项目实践", ["mysql", "postgresql", "sql", "redis", "数据库"]),
    ("接口与工程质量", "项目实践", ["接口", "api", "测试", "部署", "日志", "性能", "并发"]),
    ("机器学习 / 深度学习", "创新探索", ["机器学习", "深度学习", "pytorch", "tensorflow", "算法"]),
    ("数据分析", "专业学习", ["数据分析", "数据处理", "数据挖掘", "excel", "可视化"]),
    ("需求与产品思维", "沟通协作", ["需求分析", "用户研究", "产品", "原型", "优先级"]),
    ("沟通与团队协作", "沟通协作", ["沟通", "协作", "团队", "跨部门", "表达"]),
    ("科研与实验能力", "创新探索", ["论文", "实验", "复现", "科研", "调研"]),
    ("职业材料与面试准备", "职业准备", ["简历", "面试", "实习", "校招", "求职"]),
]

GAP_ACTIONS = {
    "专业学习": "整理知识清单，并完成一份可核验的课程或练习成果。",
    "项目实践": "完成含个人职责、代码或作品链接、结果复盘的项目佐证。",
    "创新探索": "用调研、实验或竞赛成果补充能力证据。",
    "沟通协作": "完成一次协作实践，并获取教师或团队成员评价。",
    "职业准备": "完成专项准备，提交简历、岗位对照或模拟面试报告作为佐证。",
}

_HARD_REQ_PATTERNS = [
    r"本科[^，。;；\n]{0,6}(以上|学历|及以上)?", r"硕士", r"研究生学历", r"博士",
    r"英语四六级?", r"英语四级", r"英语六级", r"计算机二级", r"[Cc][Ee][Tt][- ]?[46]",
    r"党员(含预备党员)?", r"驾照", r"教师资格证", r"法律职业资格",
]

_MAJORS_SPLIT = re.compile(r"[，,、;；/／|\s]+")


# ── 解析（导入与粘贴草稿共用） ────────────────────────────────────


def infer_category(title: str, employment_type: str | None) -> str:
    """招聘类别推断。

    数据源以校园招聘为主（团队数据决定，见 docs/G3-EMPLOYMENT-DESIGN.md）：
    明确实习信号 → intern；明确社招信号 → social；其余一律归 campus，
    管理员可在治理接口按条目改判。
    """
    text = f"{title} {employment_type or ''}"
    if re.search(r"实习|兼职|科研助理", text, re.I):
        return "intern"
    if re.search(r"社招|社会招聘|有工作经验|\d+年以上工作", text):
        return "social"
    return "campus"


def split_majors(majors_text: str | None) -> list[str]:
    """专业限制原文 → 专业列表；"不限"或空 → 空列表（表示不限专业）。"""
    text = (majors_text or "").strip()
    if not text or re.search(r"不限|无|专业不限", text):
        return []
    return [part.strip() for part in _MAJORS_SPLIT.split(text) if len(part.strip()) >= 2][:30]


def extract_hard_requirements(*texts: str | None) -> list[str]:
    """从文本中提取明确的硬性条件（学历/证书/政治面貌等），最多 6 条。"""
    source = "\n".join(t for t in texts if t)
    found: list[str] = []
    for pattern in _HARD_REQ_PATTERNS:
        match = re.search(pattern, source)
        if match:
            value = match.group(0).strip()
            if value and value not in found:
                found.append(value)
    return found[:6]


def parse_requirements(title: str, description: str) -> list[dict]:
    source = f"{title}\n{description}".lower()
    found = []
    for label, dimension, keywords in RULES:
        if not any(keyword.lower() in source for keyword in keywords):
            continue
        first = min((source.find(keyword.lower()) for keyword in keywords if keyword.lower() in source), default=0)
        nearby = source[max(0, first - 38): first + 80]
        priority = "required" if re.search(r"必须|必需|要求|熟悉|掌握|具备|优先", nearby) else "preferred"
        found.append({"id": f"req-{len(found) + 1}", "label": label, "dimension": dimension, "priority": priority, "keywords": keywords})
    return found or [{"id": "req-core", "label": "岗位核心能力", "dimension": "职业准备", "priority": "required", "keywords": []}]


def parse_job_text(text: str, source_url: str = "") -> dict:
    cleaned = "\n".join(line.strip() for line in text.splitlines() if line.strip())[:12000]
    lines = cleaned.splitlines()
    title = next((line.split("：", 1)[-1].strip() for line in lines if re.search(r"岗位|职位", line[:15])), lines[0] if lines else "")[:100]
    company = next((line.split("：", 1)[-1].strip() for line in lines if re.search(r"公司|单位", line[:15])), "")[:80]
    city_match = re.search(r"(?:城市|地点|工作地)[：:\s]*([^\n，,；;]{2,20})", cleaned)
    salary_match = re.search(r"(?:\d+[kK][-~至]\d+[kK]|\d+[-~至]\d+\s*/\s*天)", cleaned)
    employment_type = "实习" if "实习" in cleaned else "校招" if re.search(r"校招|应届", cleaned) else "兼职" if "兼职" in cleaned else "科研助理" if "科研助理" in cleaned else "实习"
    missing = [label for label, value in (("岗位名称", title), ("公司/单位", company), ("城市", city_match.group(1).strip() if city_match else "")) if not value]
    confidence = max(30, 100 - len(missing) * 20)
    return {
        "title": title,
        "company": company,
        "city": city_match.group(1).strip()[:40] if city_match else "",
        "employmentType": employment_type,
        "salary": salary_match.group(0) if salary_match else "",
        "sourceUrl": source_url,
        "sourceName": "用户粘贴",
        "description": cleaned,
        "confidence": confidence,
        "missing": missing,
    }


# ── 需求档案（第 1 层：入库时结构化，LLM 优先、规则降级） ────────────

_PROFILE_PROMPT = """你是招聘 JD 解析引擎。只输出一个 JSON 对象，不要输出任何解释或代码围栏。
格式：{"skills":[{"name":"技能名","required":true}],"majors":["专业名"],"hardReqs":["硬性条件"]}
要求：skills 最多 10 条，技能名简短规范（如 Java、SQL、数据分析、沟通协作），required 表示是否为明确必须；
majors 从专业限制提取，专业不限则给空数组；hardReqs 只收明确硬性条件（学历、证书、政治面貌等），最多 5 条，没有给空数组。
岗位名称：{title}
专业限制：{majors_text}
岗位描述：{description}"""


def rule_profile(title: str, description: str, majors_text: str | None) -> dict:
    skills = [
        {"name": item["label"], "required": item["priority"] == "required", "dimension": item["dimension"]}
        for item in parse_requirements(title, description)
        if item.get("keywords")
    ]
    return {
        "engine": "rules",
        "skills": skills,
        "majors": split_majors(majors_text),
        "hardReqs": extract_hard_requirements(description, majors_text),
    }


def _strip_json_fence(text: str) -> str:
    return re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip())


async def build_requirement_profile(title: str, description: str, majors_text: str | None) -> dict:
    """LLM 结构化需求档案；任何失败自动降级为规则解析（绝不抛出）。"""
    from ...integrations.llm.client import get_llm_client

    client = get_llm_client()
    if client.configured:
        try:
            response = await client.chat(
                [{"role": "system", "content": "你是严谨的招聘 JD 解析引擎，只输出 JSON。"},
                 {"role": "user", "content": _PROFILE_PROMPT.format(
                     title=title[:80], majors_text=(majors_text or "未注明")[:200],
                     description=description[:1500])}],
                temperature=0.1, max_tokens=700,
            )
            data = json.loads(_strip_json_fence(response["content"]))
            skills = [
                {"name": str(item.get("name", "")).strip()[:40], "required": bool(item.get("required", True)), "dimension": None}
                for item in (data.get("skills") or [])[:10] if str(item.get("name", "")).strip()
            ]
            majors = [str(m).strip()[:40] for m in (data.get("majors") or [])[:20] if str(m).strip()]
            hard = [str(h).strip()[:40] for h in (data.get("hardReqs") or [])[:6] if str(h).strip()]
            if skills:
                return {"engine": "llm", "skills": skills,
                        "majors": majors or split_majors(majors_text), "hardReqs": hard}
        except Exception:  # noqa: BLE001 — 降级是既定设计（ADR-0001）
            pass
    return rule_profile(title, description, majors_text)


# ── 过期规则（查询时动态判定，不落库） ────────────────────────────


def expires_at_ms(published_at: int | None, deadline: int | None, fallback_ms: int) -> int | None:
    if deadline:
        return int(deadline)
    if published_at:
        return int(published_at) + fallback_ms
    return None


def is_expired(published_at: int | None, deadline: int | None, fallback_ms: int, now_ms: int | None = None) -> bool:
    expire_at = expires_at_ms(published_at, deadline, fallback_ms)
    if expire_at is None:
        return False
    now = now_ms or int(datetime.now(timezone.utc).timestamp() * 1000)
    return expire_at < now


# ── 匹配引擎 v2（第 3 层：纯确定性计算） ─────────────────────────


def _graduation_year(grade: str | None) -> int | None:
    """入学年级 + 4 = 本科毕业届。无法解析时返回 None。"""
    match = re.search(r"(19|20)\d{2}", grade or "")
    return int(match.group(0)) + 4 if match else None


def evaluate_hard_filter(profile: dict, student: dict) -> list[str]:
    """硬性条件过滤：返回不通过原因列表（空 = 通过）。v1 只能核验专业维度。"""
    reasons: list[str] = []
    majors = profile.get("majors") or []
    student_major = (student.get("major") or "").strip()
    if majors and not student_major:
        reasons.append("岗位限定专业，但你的资料未填写专业")
    elif majors and student_major and not any(
        major in student_major or student_major in major for major in majors
    ):
        reasons.append(f"岗位专业限制：{'、'.join(majors[:6])}，与你的专业「{student_major}」不符")
    return reasons


def build_match(job: dict, portrait: dict, evidence: list[dict], student: dict) -> dict:
    """岗位 × 学生 匹配。

    job: 含 title/description/category/deadline/published_at/requirement_profile
    portrait: 五维画像 [{"name","score"},...]
    evidence: 已核验佐证列表（只有已核验的参与计算）
    student: {major, grade, target_role, interests}
    """
    profile = job.get("requirement_profile") or rule_profile(job["title"], job["description"], job.get("majors_text"))
    verified = [item for item in evidence if item["verificationStatus"] == "verified"]
    evidence_text = " ".join(f"{item['title']} {item['detail']} {item['evidenceRef']}" for item in verified).lower()

    # ① 硬性条件
    hard_reasons = evaluate_hard_filter(profile, student)

    # ② 技能覆盖（required 权重 ×2）
    skills = profile.get("skills") or []
    skill_rows = []
    weighted_total = weighted_hit = 0
    for skill in skills:
        name = skill.get("name", "")
        required = bool(skill.get("required"))
        alias = (name or "").lower()
        hit_title = next((item["title"] for item in verified if alias and alias in f"{item['title']} {item['detail']} {item['evidenceRef']}".lower()), None)
        hit = hit_title is not None
        weight = 2 if required else 1
        if skills:
            weighted_total += weight
            weighted_hit += weight if hit else 0
        skill_rows.append({"name": name, "required": required, "matched": hit, "evidence": hit_title})
    coverage = round(weighted_hit / weighted_total * 100) if weighted_total else 0

    # ③ 画像维度
    scores = {item["name"]: item["score"] for item in portrait.get("dimensions", [])}
    projects = scores.get("项目实践", 0)
    learning = scores.get("专业学习", 0)
    innovation = scores.get("创新探索", 0)
    collaboration = scores.get("沟通协作", 0)
    readiness = scores.get("职业准备", 0)

    # ④ 年级契合（毕业届 vs 招聘截止年份）
    grad_year = _graduation_year(student.get("grade"))
    job_year = None
    if job.get("deadline"):
        job_year = datetime.fromtimestamp(job["deadline"] / 1000, tz=timezone.utc).year
    elif job.get("published_at"):
        job_year = datetime.fromtimestamp(job["published_at"] / 1000, tz=timezone.utc).year + 1
    if grad_year and job_year:
        gap = job_year - grad_year
        year_fit = 100 if gap == 0 else 85 if gap == 1 else 65 if gap == 2 else 45 if gap >= 3 else 50
        year_note = f"你预计 {grad_year} 届毕业，岗位面向约 {job_year} 年"
    else:
        year_fit, year_note = 70, "年级信息不完整，按中性值计"

    # ⑤ 方向一致
    intent_text = f"{student.get('target_role', '')} {' '.join(student.get('interests') or [])} {job['title']} {job['description']}".lower()
    intent = 65 if any(word in intent_text for word in ("后端", "算法", "数据", "产品", "科研", "实习", "开发")) else 50

    if hard_reasons:
        overall = 0
        verdict = "条件不符"
    else:
        technical = round(coverage * 0.55 + learning * 0.25 + projects * 0.20)
        overall = round(technical * 0.30 + (projects * 0.6 + innovation * 0.4) * 0.40
                        + year_fit * 0.15 + (readiness * 0.6 + intent * 0.4) * 0.15)
        verdict = "强匹配" if overall >= 75 else "较匹配" if overall >= 60 else "可尝试" if overall >= 45 else "需谨慎" if overall >= 30 else "暂不建议"

    clarity = min(100, 35 + len(job["description"].strip()) / 70 + min(20, len(skills) * 3))
    confidence = round(min(100, portrait.get("confidence", 0) * 0.62 + clarity * 0.22 + min(16, len(verified) * 2.7)))

    matched_skills = [row for row in skill_rows if row["matched"]]
    missing_skills = [row for row in skill_rows if not row["matched"]]
    gaps = [{
        "id": f"gap-{index + 1}", "label": row["name"],
        "dimension": row.get("dimension") or "职业准备", "priority": "required" if row["required"] else "preferred",
        "recommendation": GAP_ACTIONS.get(row.get("dimension") or "职业准备", GAP_ACTIONS["职业准备"]),
    } for index, row in enumerate(missing_skills[:5])]

    return {
        "engineVersion": ENGINE_VERSION, "modelMode": "deterministic",
        "profileEngine": profile.get("engine"),
        "overallScore": overall, "confidence": confidence, "verdict": verdict,
        "formula": "岗位匹配=技能覆盖30%+画像实力40%+年级契合15%+职业方向15%；硬性条件不符直接判 0 分；只有已核验佐证参与计算。",
        "hardFilter": {"passed": not hard_reasons, "reasons": hard_reasons,
                       "unverifiable": [f"{item}（平台无法自动核验，投递前请自查）" for item in (profile.get("hardReqs") or [])]},
        "skills": skill_rows,
        "requirements": [{"id": f"req-{index + 1}", "label": row["name"],
                          "priority": "required" if row["required"] else "preferred"} for index, row in enumerate(skill_rows)],
        "dimensions": [
            {"name": "技能覆盖", "score": coverage, "weight": 30, "evidenceBasis": f"需求技能 {len(skill_rows)} 项，已核验佐证命中 {len(matched_skills)} 项"},
            {"name": "画像实力", "score": round(projects * 0.6 + innovation * 0.4), "weight": 40, "evidenceBasis": f"项目实践 {projects}、创新探索 {innovation}（五维画像）"},
            {"name": "年级契合", "score": year_fit, "weight": 15, "evidenceBasis": year_note},
            {"name": "职业方向", "score": round(readiness * 0.6 + intent * 0.4), "weight": 15, "evidenceBasis": f"职业准备 {readiness}、目标方向与岗位文本对照"},
        ],
        "strengths": [f"已核验材料《{row['evidence']}》对应技能「{row['name']}」。" for row in matched_skills[:3]]
        or (["已有已核验佐证，但尚未覆盖岗位明确要求的技能。"] if verified else ["当前没有已核验佐证，系统不会用默认经历抬高匹配分数。"]),
        "gaps": gaps,
        "manualChecks": ["请在投递前人工确认岗位发布日期、截止日期、城市与实习周期。", "岗位资格信息请以企业官方页面为准。"],
        "evidenceBasis": {"verifiedEvidence": len(verified), "portraitConfidence": portrait.get("confidence", 0),
                          "matchedSkills": len(matched_skills), "totalSkills": len(skill_rows)},
        "calculatedAt": datetime.now(timezone.utc).isoformat(),
    }


# ── 企业去重 ─────────────────────────────────────────────────────


def normalize_company_name(name: str) -> str:
    """Normalize a company name for deduplication: trim whitespace + lowercase."""
    return (name or "").strip().lower()


async def find_or_create_employer(
    db: AsyncSession,
    *,
    name: str,
    credit_code: str | None = None,
    organization_type: str | None = None,
    industry: str | None = None,
    province: str | None = None,
    city: str | None = None,
    district: str | None = None,
    address: str | None = None,
    postal_code: str | None = None,
) -> Employer:
    """Return an existing employer (deduped) or create a new one.

    Deduplication order:
      1. unified social credit code (unique column)
      2. normalized company name (case-insensitive, trimmed)
    """
    name = (name or "").strip()
    if not name:
        raise ValueError("企业名称不能为空")

    if credit_code:
        credit_code = credit_code.strip()
        existing = (
            await db.execute(
                select(Employer).where(Employer.unified_social_credit_code == credit_code)
            )
        ).scalar_one_or_none()
        if existing:
            return existing

    key = normalize_company_name(name)
    if key:
        existing = (
            await db.execute(select(Employer).where(func.lower(Employer.name) == key))
        ).scalars().first()
        if existing:
            return existing

    employer = Employer(
        name=name,
        unified_social_credit_code=credit_code or None,
        organization_type=organization_type,
        industry=industry,
        province=province,
        city=city,
        district=district,
        address=address,
        postal_code=postal_code,
    )
    db.add(employer)
    await db.flush()
    return employer


# ── 序列化（camelCase 输出，前端唯一依赖的形状） ───────────────────


def _ms(value) -> int | None:
    return int(value.timestamp() * 1000) if value else None


def job_dict(item: CareerJob, *, match: dict | None = None, application: dict | None = None,
             favorited: bool | None = None, expired: bool | None = None) -> dict:
    profile = item.requirement_profile or {}
    return {
        "id": item.id, "title": item.title, "company": item.company,
        "city": item.city or "", "employmentType": item.employment_type or "",
        "category": item.category, "salary": item.salary or "",
        "majorsText": item.majors_text or "", "industries": [s for s in (item.industries or "").split(",") if s],
        "companyNature": item.company_nature or "", "tags": item.tags or [],
        "source": item.source, "visibility": item.visibility, "status": item.status,
        "sourceUrl": item.source_url or "", "sourceName": item.source_name or "",
        "description": item.description,
        "requirements": item.requirements or [],
        "skills": [{"name": s.get("name"), "required": bool(s.get("required"))} for s in (profile.get("skills") or [])],
        "employerId": item.employer_id,
        "publishedAt": item.published_at or _ms(item.created_at) or 0,
        "deadline": item.deadline,
        "expired": bool(expired),
        "createdAt": _ms(item.created_at) or 0, "updatedAt": _ms(item.updated_at) or 0,
        "match": match,
        "application": application,
        "favorited": favorited,
    }


def announcement_dict(item: CareerAnnouncement, *, favorited: bool | None = None,
                      application: dict | None = None, expired: bool | None = None) -> dict:
    return {
        "id": item.id, "title": item.title, "company": item.company,
        "cityText": item.city_text or "", "cohort": item.cohort or "",
        "positionsText": item.positions_text or "",
        "industries": [s for s in (item.industries or "").split(",") if s],
        "companyNature": item.company_nature or "",
        "detailUrl": item.detail_url or "", "applyUrl": item.apply_url or "",
        "description": item.description or "",
        "source": item.source, "status": item.status,
        "publishedAt": item.published_at or _ms(item.created_at) or 0,
        "deadline": item.deadline, "expired": bool(expired),
        "createdAt": _ms(item.created_at) or 0, "updatedAt": _ms(item.updated_at) or 0,
        "favorited": favorited, "application": application,
    }


def application_dict(item: CareerApplication | dict, target: dict, event_count: int = 0) -> dict:
    return {
        "id": item.id, "stage": item.stage, "outcome": item.outcome,
        "stageLabel": STAGE_LABELS.get(item.stage, item.stage),
        "outcomeLabel": (OUTCOME_LABELS.get(item.outcome, "") if item.outcome else ""),
        "note": item.note or "", "submittedAt": item.submitted_at, "lastEventAt": item.last_event_at,
        "closedAt": item.closed_at, "eventCount": event_count,
        "createdAt": _ms(item.created_at) or 0, "updatedAt": _ms(item.updated_at) or 0,
        "title": target.get("title", ""), "company": target.get("company", ""),
        "city": target.get("city", "") or target.get("cityText", ""),
        "cohort": target.get("cohort", ""),
        "employmentType": target.get("employmentType", ""), "category": target.get("category", ""),
        "sourceUrl": target.get("sourceUrl", "") or target.get("applyUrl", ""),
        "matchScore": target.get("matchScore"), "matchVerdict": target.get("matchVerdict"),
    }


def event_dict(item: CareerEvent) -> dict:
    return {"id": item.id, "stage": item.stage, "note": item.note or "", "createdAt": _ms(item.created_at) or 0}
