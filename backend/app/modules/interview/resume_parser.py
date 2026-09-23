"""Bounded document extraction and section-aware resume parsing without an AI provider."""
from __future__ import annotations

import re
import unicodedata
import zipfile
from io import BytesIO
from pathlib import PurePath
from xml.etree import ElementTree

from ...core.exceptions import ValidationError

ALIASES = {
    "education": ("教育背景", "教育经历", "学习经历", "学历", "毕业院校", "Education"),
    "major": ("所学专业", "主修专业", "专业名称", "专业"),
    "skills": ("专业技能", "技术技能", "技能特长", "掌握技能", "技术栈", "技能", "语言能力", "Technical Skills", "Skills"),
    "projects": ("项目经历", "项目经验", "科研项目", "项目实践", "课程项目", "科研经历", "Project Experience", "Projects"),
    "internships": ("实习经历", "工作经历", "实习经验", "工作经验", "社会实践", "Work Experience", "Professional Experience", "Internship Experience", "Experience"),
    "competitions": ("竞赛与荣誉经历", "竞赛荣誉经历", "竞赛经历", "所获奖项", "Awards and Honors", "获奖情况", "竞赛获奖", "荣誉奖项", "荣誉证书", "竞赛", "获奖", "证书", "Awards"),
    "selfEval": ("自我评价", "个人评价", "自我介绍", "个人简介", "关于我", "个人优势", "Summary"),
    "contact": ("联系方式", "联系信息", "基本信息", "个人信息", "求职意向"),
}
HEADING = re.compile(r"^\s*(?:#{1,6}\s*)?(?:[一二三四五六七八九十0-9]+[、.．）)]\s*)?")
ACTION = re.compile(r"^(?:项目描述|项目介绍|工作描述|工作内容|主要工作|主要职责|岗位职责|负责内容|个人职责|职责|技术栈|核心技术|项目成果|工作成果|成果|内容|描述|负责|参与|完成|开发|实现|设计|搭建|使用|通过|基于|优化|主导|协助|担任|构建|采用|推动|带领|维护|收集|分析|Worked|Built|Developed|Led)", re.I)


DATE_RANGE = re.compile(r"(?:19|20)\d{2}(?:[./年-]\d{1,2}月?)?\s*(?:-|–|—|至|~|～)\s*(?:(?:19|20)\d{2}(?:[./年-]\d{1,2}月?)?|至今|现在)")
ROLE = re.compile(r"(?:(?:前端|后端|全栈|软件|算法|测试|产品|运营|数据|网络|运维|行政|财务|人力资源|市场|销售|研究|科研|设计)(?:开发)?|开发)?(?:实习生|工程师|专员|助理|经理|主管|负责人|成员|组长|队长)")
DEGREE = re.compile(r"博士研究生|博士|硕士研究生|硕士|本科|学士|大学专科|大专|专科|高职|中专|高中")


def sections(text: str) -> tuple[list[str], dict[str, list[str]]]:
    blocks = {key: [] for key in ALIASES}
    preamble: list[str] = []
    active = None
    for line in text.splitlines():
        stripped = HEADING.sub("", line).strip().strip("*# ")
        matched = False
        for field, aliases in ALIASES.items():
            for label in aliases:
                exact = re.fullmatch(re.escape(label) + r"(?:\s*[|｜/·•\-—–]?\s*[A-Za-z][A-Za-z &/_-]{0,45})?[:：]?", stripped, re.I)
                match = re.match(r"^" + re.escape(label) + r"\s*[:：]\s*(.+)$", stripped, re.I)
                if field == "skills" and active in ("projects", "internships") and not exact:
                    continue
                if exact or match:
                    active = field
                    if match and not exact and match.group(1).strip():
                        blocks[field].append(match.group(1).strip())
                    matched = True
                    break
            if matched:
                break
        if not matched:
            (blocks[active] if active else preamble).append(line.strip())
    return preamble, blocks


def pairs(lines: list[str]) -> list[dict]:
    result: list[dict] = []
    current = None
    gap = False
    for raw in lines:
        if not raw:
            gap = True
            continue
        bullet = bool(re.match(r"^[•·●○►\-–—*]\s*", raw))
        line = re.sub(r"^[•·●○►\-–—*]\s*", "", raw).strip()
        is_title = not bullet and not ACTION.match(line) and len(line) < 85 and not re.search(r"[。；;]", line)
        if current is None or (is_title and (gap or bool(DATE_RANGE.search(line)) or bool(re.search(r"项目|系统|平台|网站|小程序|课题|公司|集团|研究院|实验室", line))) and not re.search(r"[，,]", line)):
            current = {"name": line[:100], "description": ""}
            result.append(current)
        else:
            current["description"] += ("\n" if current["description"] else "") + line
        gap = False
    return result[:20]


def resume_from_text(text: str, source: str = "") -> dict:
    clean = unicodedata.normalize("NFKC", text).replace("\r\n", "\n").replace("\r", "\n")
    clean = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", clean)
    clean = re.sub(r"([\u3400-\u9fff])[ \t]+(?=[\u3400-\u9fff])", r"\1", clean).strip()[:80_000]
    if len(re.sub(r"\s", "", clean)) < 20:
        raise ValidationError("简历文字过少，请使用更清晰的文件")
    preamble, blocks = sections(clean)
    explicit_name = re.search(r"(?:姓名|Name)\s*[:：]\s*([^\n|｜,，]{2,40})", clean, re.I)
    name = explicit_name.group(1).strip() if explicit_name else ""
    if not name:
        for line in preamble[:6]:
            candidate = re.sub(r"^#+\s*", "", line).strip()
            candidate = re.sub(r"\s*(?:个人简历|求职简历|简历|Resume|CV)\s*$", "", candidate, flags=re.I).strip()
            if re.fullmatch(r"[\u4e00-\u9fff·]{2,8}|[A-Za-z]+(?:[ .'-]+[A-Za-z]+){1,3}", candidate) and candidate not in ("个人信息", "基本信息", "求职意向"):
                name = candidate
                break
    education = "\n".join(filter(None, blocks["education"]))
    if not education:
        education = "\n".join(line for line in preamble if re.search(r"大学|学院|University|College", line, re.I))
    major = next((line for line in blocks["major"] if line), "")
    if not major:
        match = re.search(r"(?:专业|Major)\s*[:：]\s*([^\n|｜]+)", clean, re.I)
        major = match.group(1).strip() if match else ""
    skills = []
    for line in blocks["skills"]:
        for token in re.split(r"[,，、；;\n|｜]", re.sub(r"^[•·●○►\-–—*]\s*", "", line)):
            value = token.strip()
            if value and value not in skills:
                skills.append(value[:180])
    if not major:
        for line in blocks["education"]:
            degree = DEGREE.search(line)
            if degree:
                candidate = DATE_RANGE.sub("", line[:degree.start()])
                candidate = re.sub(r"^.*?(?:大学|学院)", "", candidate).strip(" |｜·")
                if 2 <= len(candidate) <= 50 and not re.search(r"大学|学院|\d", candidate):
                    major = candidate
                    break
    internships = []
    for item in pairs(blocks["internships"]):
        title = DATE_RANGE.sub("", item["name"]).strip()
        role = ROLE.search(title)
        company = title[:role.start()].strip(" |｜·-—") if role else title
        internships.append({"company": company or title, "role": role.group(0) if role else "", "description": item["description"]})
    awards = []
    for line in blocks["competitions"]:
        if not line.strip():
            continue
        award = re.search(r"(?:国家级|省级|市级|校级|院级)?(?:特等奖|一等奖|二等奖|三等奖|金奖|银奖|铜奖|优秀奖|优胜奖|入围奖|奖学金|证书)", line)
        awards.append({"name": line[:award.start()].strip(" :：") if award else line.strip(), "award": award.group(0) if award else ""})
    return {"name": name[:100], "education": education[:2000], "major": major[:120], "skills": skills[:40], "projects": pairs(blocks["projects"]), "internships": internships, "competitions": awards[:20], "selfEval": "\n".join(filter(None, blocks["selfEval"]))[:5000]}


def resume_text_from_binary(binary: bytes, mime: str, filename: str) -> str:
    extension = PurePath(filename.lower()).suffix
    if extension in (".txt", ".md", ".markdown") or (not extension and mime.startswith("text/")):
        if binary.startswith((b"\xff\xfe", b"\xfe\xff")):
            return binary.decode("utf-16")
        for encoding in ("utf-8-sig", "gb18030"):
            try:
                return binary.decode(encoding)
            except UnicodeDecodeError:
                continue
        raise ValidationError("文本编码无法读取，请另存为 UTF-8")
    if extension == ".docx":
        if not binary.startswith(b"PK\x03\x04"):
            raise ValidationError("DOCX 文件内容无效")
        try:
            with zipfile.ZipFile(BytesIO(binary)) as archive:
                info = archive.getinfo("word/document.xml")
                if info.file_size > 2 * 1024 * 1024:
                    raise ValidationError("DOCX 正文超过解析限制")
                xml = archive.read(info)
                if b"<!DOCTYPE" in xml.upper() or b"<!ENTITY" in xml.upper():
                    raise ValidationError("DOCX 包含不支持的文档结构")
                root = ElementTree.fromstring(xml)
                namespace = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
                paragraphs = []
                for paragraph in root.iter(namespace + "p"):
                    parts = []
                    for node in paragraph.iter():
                        if node.tag == namespace + "t":
                            parts.append(node.text or "")
                        elif node.tag in (namespace + "tab", namespace + "br", namespace + "cr"):
                            parts.append("\n" if node.tag != namespace + "tab" else "\t")
                    paragraphs.append("".join(parts))
                return "\n".join(paragraphs)
        except (zipfile.BadZipFile, KeyError, ElementTree.ParseError, RuntimeError, UnicodeError) as error:
            raise ValidationError("DOCX 正文无法读取，请重新导出文件") from error
    if extension == ".pdf":
        if not binary.lstrip().startswith(b"%PDF-"):
            raise ValidationError("文件不是有效 PDF，请重新导出")
        try:
            from pypdf import PdfReader
            reader = PdfReader(BytesIO(binary))
            if reader.is_encrypted and not reader.decrypt(""):
                raise ValidationError("PDF 已加密，请解除密码后重新上传")
            if len(reader.pages) > 30:
                raise ValidationError("请上传不超过 30 页的简历 PDF")
            text = "\n".join(page.extract_text() or "" for page in reader.pages)
        except ValidationError:
            raise
        except Exception as error:
            raise ValidationError("PDF 正文无法读取，请重新导出或使用 OCR") from error
        if len(re.sub(r"\s", "", text)) < 20:
            raise ValidationError("扫描版 PDF 请使用 OCR 识别")
        return text
    if extension == ".doc":
        raise ValidationError("请将旧版 DOC 简历另存为 DOCX 或 PDF 后上传")
    raise ValidationError("图片简历请使用 OCR 识别；文档支持 PDF、DOCX、TXT、Markdown")
