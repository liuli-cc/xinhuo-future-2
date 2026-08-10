#!/usr/bin/env python3
"""Append the V2 interview-report and OCR-boundary update to the existing guide."""

from io import BytesIO
from pathlib import Path
import sys

from pypdf import PdfReader, PdfWriter
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def paragraph(text, style):
    return Paragraph(text.replace("\n", "<br/>"), style)


def build_update_pages() -> BytesIO:
    pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))
    buffer = BytesIO()
    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title="薪火未来平台使用指南 V2 - 面试报告更新",
    )
    title = ParagraphStyle("title", fontName="STSong-Light", fontSize=20, leading=28, textColor=HexColor("#16324F"), spaceAfter=8)
    subtitle = ParagraphStyle("subtitle", fontName="STSong-Light", fontSize=10, leading=16, textColor=HexColor("#53718C"), spaceAfter=18)
    heading = ParagraphStyle("heading", fontName="STSong-Light", fontSize=14, leading=22, textColor=HexColor("#0E7490"), spaceBefore=10, spaceAfter=7)
    body = ParagraphStyle("body", fontName="STSong-Light", fontSize=10.5, leading=18, textColor=HexColor("#263746"), spaceAfter=7)
    note = ParagraphStyle("note", fontName="STSong-Light", fontSize=9.5, leading=15, textColor=HexColor("#4A5568"), backColor=HexColor("#EFF8FF"), borderColor=HexColor("#BAE6FD"), borderWidth=0.5, borderPadding=8, spaceBefore=5, spaceAfter=10)

    story = [
        paragraph("V2 更新：面试报告与简历识别边界", title),
        paragraph("更新日期：2026-07-30　　适用于薪火未来18模拟面试页面", subtitle),
        paragraph("本更新页附加在上一版《薪火未来平台使用指南》之后。上一版内容和代码包均保留，不做覆盖或删除。", note),
        paragraph("一、简历识别现在能做到什么", heading),
        paragraph("1. 支持 PDF、DOCX、TXT，单个文件最大 3MB。文本型 PDF 会提取可复制文字，再识别姓名、学历、专业、技能、项目经历、实习经历和竞赛奖项。", body),
        paragraph("2. 结构化识别支持常见中英文栏目标题、同一行标签、多行项目描述、日期和学校/专业组合；所有结果会进入可编辑预览区，用户确认后才进入面试。", body),
        paragraph("3. 当前没有内置 OCR。扫描件、照片、证书截图、信息图以及 PDF 页面图片里的文字不会被识别。重要信息若只存在于图片中，请先用系统或办公软件做 OCR，或改传原始 DOCX/TXT。", body),
        paragraph("4. 系统不会根据图片或缺失栏目猜测、补写经历。字段为空时应在预览区人工补充。", body),
        paragraph("简历上传正确步骤", heading),
    ]
    steps = [
        ["1", "登录平台后，进入“模拟面试”页面。"],
        ["2", "点击“上传简历文件”，选择小于 3MB 的 PDF、DOCX 或 TXT 简历。"],
        ["3", "等待“解析结果（请确认和修改）”出现，检查姓名、学历、专业、技能、项目、实习和竞赛证书。"],
        ["4", "若某个字段未完全识别，可直接在预览输入框中修改；确认后点击“确认简历，下一步”。"],
        ["5", "填写或选择岗位，生成面试提纲，再开始与林老师的连续模拟面试。"],
    ]
    table = Table([[paragraph(a, body), paragraph(b, body)] for a, b in steps], colWidths=[12 * mm, 158 * mm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), HexColor("#E0F2FE")),
        ("TEXTCOLOR", (0, 0), (0, -1), HexColor("#075985")),
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 0), (-1, -1), 0.25, HexColor("#D7E5EE")),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story += [table, Spacer(1, 8), paragraph("OCR 处理建议", heading)]
    story += [
        paragraph("macOS 可在“预览”或支持文字识别的办公软件中先把扫描件转成可搜索 PDF；也可以复制 OCR 结果并保存为 TXT。完成后请手动核对姓名、日期、数字和专有名词。", body),
        paragraph("OCR 暂不作为本版本上线条件，避免引入大型识别模型、额外云服务费用和隐私传输风险。", note),
        PageBreak(),
        paragraph("二、模拟面试报告", heading),
        paragraph("报告生成条件：至少完成一轮回答。达到面试时长/轮次上限时自动生成；也可以随时点击“结束并生成报告”。未提交的当前输入不会计入报告。", body),
    ]
    dimensions = [
        ["经历与内容质量", "30", "信息完整、量化结果、个人贡献"],
        ["岗位匹配度", "20", "回答与岗位技能和职责的关联"],
        ["专业深度", "20", "方案选择、分析、指标和验证"],
        ["逻辑结构", "15", "STAR 框架和因果结构"],
        ["语言表达", "15", "语速、停顿、口头语和完整度"],
    ]
    score_table = Table(
        [[paragraph("评分维度", body), paragraph("满分", body), paragraph("主要依据", body)]]
        + [[paragraph(a, body), paragraph(b, body), paragraph(c, body)] for a, b, c in dimensions],
        colWidths=[43 * mm, 20 * mm, 107 * mm],
        repeatRows=1,
    )
    score_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), HexColor("#E0F2FE")),
        ("TEXTCOLOR", (0, 0), (-1, 0), HexColor("#075985")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.25, HexColor("#D7E5EE")),
        ("ALIGN", (1, 1), (1, -1), "CENTER"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story += [
        score_table,
        Spacer(1, 8),
        paragraph("报告包括：综合得分、五维得分、回答亮点、改进建议、三步行动计划、逐题回答原文、证据提示、风险点和可用的语音表达指标。", body),
        paragraph("云端保存失败时，页面仍会先显示本地报告，并提供“重试云端保存”。用户可以直接点击“下载报告”导出 Markdown，或点击“打印 / 保存 PDF”使用浏览器标准打印功能。", body),
        paragraph("报告分数由 XH-SCORE-V2.1 规则引擎计算。外部 AI 只负责生成问题和提取证据，不直接决定最终分数；报告仅用于练习反馈，不代表真实招聘结果。", note),
        paragraph("推荐使用流程", heading),
    ]
    report_steps = [
        ["1", "使用桌面版 Chrome 登录并允许麦克风；权限不可用时可以直接使用文字回答。"],
        ["2", "上传并确认简历，选择岗位，使用免费本地模式或外部 AI 增强模式生成提纲。"],
        ["3", "完成连续面试；希望提前结束时点击“结束并生成报告”，不要直接关闭页面。"],
        ["4", "查看五维得分和逐题反馈，下载 Markdown；需要 PDF 时点击“打印 / 保存 PDF”。"],
        ["5", "按三步行动计划修改回答，再开始新面试并比较前后报告。"],
    ]
    report_table = Table([[paragraph(a, body), paragraph(b, body)] for a, b in report_steps], colWidths=[12 * mm, 158 * mm])
    report_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), HexColor("#E0F2FE")),
        ("TEXTCOLOR", (0, 0), (0, -1), HexColor("#075985")),
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 0), (-1, -1), 0.25, HexColor("#D7E5EE")),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story += [
        report_table,
        Spacer(1, 8),
        paragraph("本版本交付文件：薪火未来平台使用指南_V2.pdf；薪火未来18_当前生产源码_V2.zip。上一版文件夹继续保留。", body),
        paragraph("正式平台：https://xinhuo-d8gxyksn2f7095c5a-1459723948.tcloudbaseapp.com/interview", note),
    ]
    document.build(story)
    buffer.seek(0)
    return buffer


def main():
    if len(sys.argv) != 3:
        raise SystemExit("Usage: update_pdf_guide.py SOURCE_GUIDE OUTPUT_GUIDE")
    source = Path(sys.argv[1])
    output = Path(sys.argv[2])
    writer = PdfWriter()
    for page in PdfReader(str(source)).pages:
        writer.add_page(page)
    for page in PdfReader(build_update_pages()).pages:
        writer.add_page(page)
    with output.open("wb") as file:
        writer.write(file)


if __name__ == "__main__":
    main()
