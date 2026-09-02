"""Tailored resume generation with an optional server-side LLM."""

from __future__ import annotations

import re

from fastapi import APIRouter, Body

from ...core.exceptions import ValidationError
from ...integrations.llm.client import get_llm_client
from ..auth.dependency import CurrentUser

router = APIRouter(prefix="/resume", tags=["resume"])

KEYWORDS = (
    "Python", "Java", "JavaScript", "TypeScript", "React", "Vue", "Node.js", "SQL",
    "MySQL", "Docker", "Git", "Figma", "Excel", "数据分析", "机器学习", "人工智能",
    "产品设计", "用户研究", "项目管理", "沟通协作", "需求分析", "敏捷开发",
)


def _keywords(candidate_facts: str, job_description: str) -> tuple[list[str], list[str]]:
    matched, missing = [], []
    candidate = candidate_facts.lower()
    job = job_description.lower()
    for keyword in KEYWORDS:
        if keyword.lower() not in job:
            continue
        (matched if keyword.lower() in candidate else missing).append(keyword)
    return matched[:8], missing[:8]


def _clean_lines(value: str, limit: int = 8) -> list[str]:
    return [line.strip(" -•\t")[:240] for line in re.split(r"[\n；;]+", value) if line.strip()][:limit]


def _deterministic_resume(candidate_facts: str, job_description: str, target_role: str, company: str) -> dict:
    """Safe fallback: reorganise supplied facts, never create achievements."""
    matched, missing = _keywords(candidate_facts, job_description)
    facts = _clean_lines(candidate_facts, limit=60)
    name = next((line.split("：", 1)[1].strip() for line in facts if line.startswith("姓名：")), "候选人")
    contact = [line for line in facts if line.startswith(("电话：", "邮箱：", "意向城市："))]
    education = [line for line in facts if line.startswith(("学校：", "学历：", "专业：", "就读时间：", "GPA", "主修课程："))]
    skills = [line for line in facts if line.startswith(("专业技能：", "常用工具：", "语言能力：", "证书："))]
    project = [line for line in facts if line.startswith(("项目名称：", "项目时间：", "担任角色：", "技术或方法：", "负责内容：", "结果与产出："))]
    internship = [line for line in facts if line.startswith(("公司或组织：", "岗位：", "任职时间：", "主要职责：", "成果与数据："))]
    extras = [line for line in facts if line.startswith(("奖项与荣誉：", "作品集或个人主页：", "其他经历："))]

    sections = [
        f"# {name}｜{target_role or '目标岗位'}",
        "\n".join(contact),
        f"\n## 求职意向\n{company or '目标企业'} · {target_role or '目标岗位'}",
    ]
    if education:
        sections.append("\n## 教育背景\n" + "\n".join(education))
    if skills or matched:
        lines = skills + ([f"岗位匹配关键词：{'、'.join(matched)}"] if matched else [])
        sections.append("\n## 专业技能\n" + "\n".join(lines))
    if project:
        sections.append("\n## 项目经历\n" + "\n".join(project))
    if internship:
        sections.append("\n## 实习 / 实践经历\n" + "\n".join(internship))
    if extras:
        sections.append("\n## 补充信息\n" + "\n".join(extras))
    if matched:
        sections.append("\n## 个人总结\n已基于所提供的真实经历，突出与岗位相关的 " + "、".join(matched) + " 能力。")

    return {
        "resumeMarkdown": "\n".join(section for section in sections if section.strip()).strip(),
        "matchingHighlights": [f"已突出：{item}" for item in matched] or ["已按目标岗位重组个人信息与经历"],
        "missingKeywords": missing or ["岗位关键词已基本覆盖；请继续用真实项目成果增强说服力"],
        "mode": "deterministic",
    }


@router.post("/generate")
async def generate_resume(payload: dict = Body(...), current_user: CurrentUser = None):
    candidate_facts = str(payload.get("candidateFacts", "")).strip()[:20_000]
    job_description = str(payload.get("jobDescription", "")).strip()[:20_000]
    target_role = str(payload.get("targetRole", "")).strip()[:100]
    company = str(payload.get("company", "")).strip()[:120]
    if len(candidate_facts) < 40:
        raise ValidationError("请至少填写一项真实的教育、项目或实践经历")
    if len(job_description) < 30:
        raise ValidationError("请粘贴不少于 30 个字的企业岗位需求")

    matched, missing = _keywords(candidate_facts, job_description)
    client = get_llm_client()
    if not client.configured:
        return _deterministic_resume(candidate_facts, job_description, target_role, company)

    prompt = f"""你是高校就业中心的简历顾问。只根据候选人提供的真实资料，生成一份中文 Markdown 简历。
严禁补造公司、项目、数据、证书、奖项、技能或经历；资料没有给出的内容必须省略。
目标企业：{company or '未填写'}
目标岗位：{target_role or '未填写'}
岗位需求：
{job_description}

候选人资料：
{candidate_facts}

输出顺序：姓名与联系方式、求职意向、教育背景、专业技能、项目经历、实习/实践经历、补充信息、个人总结。项目和实习内容优先突出与岗位匹配的真实关键词，使用简洁的动作-结果表述。不要输出解释、免责声明或虚构建议。"""
    answer = await client.chat(
        [{"role": "system", "content": "你必须忠实重组用户提供的事实，绝不编造简历内容。"}, {"role": "user", "content": prompt}],
        temperature=0.2,
        max_tokens=1600,
    )
    return {
        "resumeMarkdown": answer["content"].strip(),
        "matchingHighlights": [f"已突出：{item}" for item in matched] or ["已按岗位需求重新组织内容"],
        "missingKeywords": missing or ["岗位关键词已基本覆盖；请继续补充真实成果数据"],
        "mode": "llm",
        "model": answer.get("model", ""),
    }
