"""Resume import regression tests through the live API + actual PDF/DOCX payloads."""
import base64
from io import BytesIO
from pathlib import Path
import zipfile

import pytest
from pypdf import PdfWriter
from pypdf.generic import DictionaryObject, NameObject, DecodedStreamObject
from .test_platform_flow import seed_user, login, auth
from ..modules.interview.resume_parser import resume_from_text, resume_text_from_binary
from ..core.exceptions import ValidationError

TEXT = """个人简历
姓名：王晓明
求职意向：后端开发实习生
电话：13812345678 邮箱：student@example.com
教育背景
内蒙古师范大学 2024级 本科
专业：计算机科学与技术
专业技能
Python、SQL、Docker
项目经历
校园系统
负责接口设计，完成检索模块，将查询时间降低20%。

实习经历
某公司 后端开发实习生
参与数据平台开发，负责测试。
自我评价
喜欢分析问题，完成过独立的后端开发项目。
"""


def make_docx():
    stream = BytesIO()
    with zipfile.ZipFile(stream, "w") as archive:
        paragraphs = "".join(f"<w:p><w:r><w:t>{line}</w:t></w:r></w:p>" for line in TEXT.splitlines())
        archive.writestr("word/document.xml", '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + paragraphs + '</w:body></w:document>')
    return stream.getvalue()


def make_pdf(blank=False):
    writer = PdfWriter()
    page = writer.add_blank_page(width=600, height=800)
    if not blank:
        font = DictionaryObject({NameObject("/Type"): NameObject("/Font"), NameObject("/Subtype"): NameObject("/Type1"), NameObject("/BaseFont"): NameObject("/Helvetica")})
        page[NameObject("/Resources")] = DictionaryObject({NameObject("/Font"): DictionaryObject({NameObject("/F1"): writer._add_object(font)})})
        stream = DecodedStreamObject()
        stream.set_data(b"BT /F1 12 Tf 40 760 Td 18 TL (Alex Chen) Tj T* (Education) Tj T* (Example University) Tj T* (Skills) Tj T* (Python, SQL) Tj T* (Projects) Tj T* (Campus Platform) Tj T* (Built a search tool for students.) Tj ET")
        page[NameObject("/Contents")] = writer._add_object(stream)
    output = BytesIO()
    writer.write(output)
    return output.getvalue()


def test_section_boundaries_preserve_descriptions_and_contact_name():
    result = resume_from_text(TEXT)
    assert result["name"] == "王晓明"
    assert result["major"] == "计算机科学与技术"
    assert result["skills"] == ["Python", "SQL", "Docker"]
    assert len(result["projects"]) == 1
    assert result["projects"][0]["name"] == "校园系统"
    assert "降低20%" in result["projects"][0]["description"]
    assert "实习" not in result["projects"][0]["description"]
    assert "个人简历" not in result["name"]
    assert "后端开发" in result["selfEval"]


def test_docx_and_pdf_document_extraction():
    text = resume_text_from_binary(make_docx(), "application/octet-stream", "resume.docx")
    assert "姓名：王晓明\n" in text
    assert "降低20%" in text
    pdf = resume_text_from_binary(make_pdf(), "application/pdf", "resume.pdf")
    result = resume_from_text(pdf)
    assert result["name"] == "Alex Chen"
    assert result["skills"] == ["Python", "SQL"]
    assert result["projects"][0]["description"] == "Built a search tool for students."
    assert resume_text_from_binary(TEXT.encode("gb18030"), "text/plain", "resume.txt") == TEXT


def test_corrupt_and_scanned_documents_offer_actionable_errors():
    for content, filename, message in [(b"not a pdf", "fake.pdf", "有效 PDF"), (b"PK\x03\x04not a zip", "fake.docx", "无法读取"), (make_pdf(True), "scan.pdf", "OCR"), (b"legacy word", "resume.doc", "DOCX")]:
        with pytest.raises(ValidationError, match=message):
            resume_text_from_binary(content, "", filename)


@pytest.mark.anyio
async def test_chunked_resume_import_preserves_contacts_and_isolates_users(client, db_factory):
    await seed_user(db_factory, "20249001", "student")
    await seed_user(db_factory, "20249002", "student")
    headers = auth(await login(client, "20249001"))
    other = auth(await login(client, "20249002"))
    base = "/api/v1/interview/resume"
    data = base64.b64encode(make_docx()).decode()
    chunks = [data[index:index+128] for index in range(0, len(data), 128)]
    for index, chunk in enumerate(chunks):
        assert (await client.post(base + "/chunk", headers=headers, json={"uploadId": "docx-upload-case", "index": index, "total": len(chunks), "data": chunk})).status_code == 200
    request = {"uploadId": "docx-upload-case", "total": len(chunks), "fileName": "resume.docx", "mimeType": "application/octet-stream"}
    assert (await client.post(base + "/parse", headers=other, json=request)).status_code == 400
    response = await client.post(base + "/parse", headers=headers, json=request)
    assert response.status_code == 200, response.text
    assert response.json()["resume"]["name"] == "王晓明"
    assert "student@example.com" in response.json()["text"]
    assert (await client.post(base + "/parse", headers=headers, json=request)).status_code == 400
    # Browser OCR uses this same endpoint once it recognizes a scanned document.
    response = await client.post(base + "/parse-text", headers=headers, json={"text": TEXT, "source": "scan.png"})
    assert response.status_code == 200
    assert response.json()["resume"]["skills"] == ["Python", "SQL", "Docker"]


def test_compact_resume_descriptions_stay_with_their_project():
    text = (Path(__file__).resolve().parents[3] / "frontend/tests/fixtures/e2e-resume-rich.txt").read_text()
    result = resume_from_text(text)
    assert len(result["projects"]) == 1
    assert "智能推荐" in result["projects"][0]["description"]
    assert "PostgreSQL" in result["projects"][0]["description"]
    assert len(result["internships"]) == 1
    assert result["internships"][0]["role"] == "前端开发实习生"
    assert "接口联调" in result["internships"][0]["description"]
    assert result["competitions"][0]["award"] == "省级二等奖"


def test_chinese_ocr_spaces_and_bilingual_section_headings():
    result = resume_from_text("姓 名 ： 李 华\n教 育 背 景 EDUCATION\n东 北 大 学\n计 算 机 科 学 与 技 术 本 科\n专 业 技 能\nPython、React、数 据 分 析\n项 目 经 历\n校 园 招 聘 平 台\n负 责 前 端 开 发 与 接 口 联 调")
    assert result["name"] == "李华"
    assert result["major"] == "计算机科学与技术"
    assert result["skills"] == ["Python", "React", "数据分析"]
    assert len(result["projects"]) == 1
    assert "接口联调" in result["projects"][0]["description"]


@pytest.mark.anyio
async def test_upload_rejects_invalid_and_conflicting_chunks(client, db_factory):
    await seed_user(db_factory, "20249020", "student")
    headers = auth(await login(client, "20249020"))
    base = "/api/v1/interview/resume"
    valid = {"uploadId": "bounded-upload", "index": 0, "total": 2, "data": "dGVz"}
    assert (await client.post(base + "/chunk", headers=headers, json={**valid, "index": "bad"})).status_code == 400
    assert (await client.post(base + "/chunk", headers=headers, json={**valid, "data": "!invalid"})).status_code == 400
    assert (await client.post(base + "/chunk", headers=headers, json=valid)).status_code == 200
    assert (await client.post(base + "/chunk", headers=headers, json={**valid, "index": 1, "total": 3})).status_code == 400
    assert (await client.post(base + "/parse", headers=headers, json={"uploadId": "bounded-upload", "total": 0})).status_code == 400
