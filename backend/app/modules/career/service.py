"""Deterministic, evidence-bounded career matching engine."""

from __future__ import annotations

import re
from datetime import datetime, timezone

from ..growth.service import ABILITY_DIMENSIONS

ENGINE_VERSION = "XH-JFM-1.0"

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


def build_match(job: dict, portrait: dict, evidence: list[dict], target_role: str, interests: list[str]) -> dict:
    requirements = parse_requirements(job["title"], job["description"])
    scores = {item["name"]: item["score"] for item in portrait["dimensions"]}
    verified = [item for item in evidence if item["verificationStatus"] == "verified"]
    evidence_text = " ".join(f"{item['title']} {item['detail']} {item['evidenceRef']}" for item in verified).lower()
    matched = [req for req in requirements if req["keywords"] and any(keyword.lower() in evidence_text for keyword in req["keywords"])]
    weighted_total = sum(2 if req["priority"] == "required" else 1 for req in requirements if req["keywords"])
    weighted_hit = sum(2 if req["priority"] == "required" else 1 for req in matched)
    coverage = round(weighted_hit / weighted_total * 100) if weighted_total else 0
    projects = scores.get("项目实践", 0)
    learning = scores.get("专业学习", 0)
    innovation = scores.get("创新探索", 0)
    collaboration = scores.get("沟通协作", 0)
    readiness = scores.get("职业准备", 0)
    technical = round(learning * 0.35 + projects * 0.4 + coverage * 0.25)
    experience = round(projects * 0.7 + innovation * 0.3)
    intent_text = f"{target_role} {' '.join(interests)} {job['title']} {job['description']}".lower()
    intent = 65 if any(word in intent_text for word in ("后端", "算法", "数据", "产品", "科研", "实习")) else 50
    alignment = round(readiness * 0.6 + intent * 0.4)
    overall = round(technical * 0.3 + experience * 0.25 + collaboration * 0.15 + alignment * 0.3)
    clarity = min(100, 35 + len(job["description"].strip()) / 70 + min(20, len(requirements) * 3))
    confidence = round(min(100, portrait["confidence"] * 0.62 + clarity * 0.22 + min(16, len(verified) * 2.7)))
    verdict = "强匹配" if overall >= 75 else "较匹配" if overall >= 60 else "可尝试" if overall >= 45 else "需谨慎" if overall >= 30 else "暂不建议"
    gaps = [{
        "id": req["id"], "label": req["label"], "dimension": req["dimension"],
        "priority": req["priority"], "recommendation": GAP_ACTIONS[req["dimension"]],
    } for req in requirements if req not in matched][:5]
    return {
        "engineVersion": ENGINE_VERSION, "modelMode": "deterministic",
        "overallScore": overall, "confidence": confidence, "verdict": verdict,
        "formula": "岗位匹配=技能30%+项目经历25%+沟通协作15%+职业方向30%；只有已核验佐证参与计算。",
        "requirements": requirements,
        "dimensions": [
            {"name": "技能匹配", "score": technical, "weight": 30, "evidenceBasis": f"专业学习 {learning}、项目实践 {projects}、关键词佐证覆盖 {coverage}%"},
            {"name": "项目经历", "score": experience, "weight": 25, "evidenceBasis": f"项目实践 {projects}、创新探索 {innovation}"},
            {"name": "沟通协作", "score": collaboration, "weight": 15, "evidenceBasis": f"沟通协作 {collaboration}"},
            {"name": "职业方向", "score": alignment, "weight": 30, "evidenceBasis": f"职业准备 {readiness}、目标方向与岗位文本对照"},
        ],
        "strengths": [f"已核验成长材料中存在与“{item['label']}”相关的证据。" for item in matched[:3]] or (["已有已核验佐证，但尚未检索到岗位关键词的直接对应材料。"] if verified else ["当前没有已核验佐证，系统不会用默认经历抬高匹配分数。"]),
        "gaps": gaps,
        "manualChecks": ["请在投递前人工确认岗位发布日期、截止日期、城市与实习周期。", "岗位资格信息请以企业官方页面为准。"],
        "evidenceBasis": {"verifiedEvidence": len(verified), "portraitConfidence": portrait["confidence"], "matchedRequirements": len(matched), "totalRequirements": len(requirements)},
        "calculatedAt": datetime.now(timezone.utc).isoformat(),
    }
