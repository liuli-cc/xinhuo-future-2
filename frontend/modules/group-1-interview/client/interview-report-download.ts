"use client";

import type { InterviewReportV2 } from "./scoring-v2";
import { interviewReportFileStem, type InterviewReportExportContext } from "./interview-report-export";

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function duration(totalSeconds: number) {
  const seconds = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(seconds / 60)}分${String(seconds % 60).padStart(2, "0")}秒`;
}

export async function downloadInterviewReportWord(
  report: InterviewReportV2,
  context: InterviewReportExportContext,
) {
  const {
    AlignmentType,
    Document,
    HeadingLevel,
    Packer,
    Paragraph,
    Table,
    TableCell,
    TableRow,
    TextRun,
    WidthType,
  } = await import("docx");

  const text = (value: string, bold = false) => new TextRun({
    text: value,
    bold,
    font: "Microsoft YaHei",
    size: 21,
  });
  const bullet = (value: string) => new Paragraph({
    children: [text(value)],
    bullet: { level: 0 },
    spacing: { after: 80 },
  });
  const dimensions = [
    ["经历与内容质量", report.dimensions.content, 30],
    ["岗位匹配度", report.dimensions.roleMatch, 20],
    ["专业深度", report.dimensions.professionalDepth, 20],
    ["逻辑结构", report.dimensions.logicStructure, 15],
    ["语言表达", report.dimensions.languageExpression, 15],
  ] as const;

  const children = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "薪火未来模拟面试报告", bold: true, font: "Microsoft YaHei", size: 34 })],
      spacing: { after: 240 },
    }),
    new Paragraph({ children: [text(`目标岗位：${context.targetRole}`, true)] }),
    new Paragraph({ children: [text(`综合得分：${report.overallScore}/100`, true)] }),
    new Paragraph({ children: [text(`面试时长：${duration(context.durationSeconds)}`)] }),
    new Paragraph({ children: [text(`评分引擎：${report.engineVersion}`)], spacing: { after: 220 } }),
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [text("五维得分", true)] }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: ["维度", "得分", "满分"].map(value => new TableCell({
            children: [new Paragraph({ children: [text(value, true)] })],
          })),
        }),
        ...dimensions.map(([label, score, max]) => new TableRow({
          children: [label, String(score), String(max)].map(value => new TableCell({
            children: [new Paragraph({ children: [text(value)] })],
          })),
        })),
      ],
    }),
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [text("口语表达观察", true)], spacing: { before: 260 } }),
    bullet(`平均语速：${report.expressionSummary.averageWordsPerMinute} 字/分`),
    bullet(`平均停顿占比：${report.expressionSummary.averagePauseRatio}%`),
    bullet(`平均开口前思考：${report.expressionSummary.averageThinkingSeconds} 秒`),
    bullet(`口头语：${report.expressionSummary.totalFillers} 次（${report.expressionSummary.fillerWordsPerMinute} 次/分）`),
    bullet(report.expressionSummary.observation),
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [text("回答亮点", true)], spacing: { before: 220 } }),
    ...report.strengths.map(bullet),
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [text("改进建议", true)], spacing: { before: 220 } }),
    ...report.improvements.map(bullet),
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [text("下一步行动", true)], spacing: { before: 220 } }),
    ...report.actionPlan.map(bullet),
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [text("逐题复盘", true)], spacing: { before: 220 } }),
    ...report.scoredAnswers.flatMap((answer, index) => [
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [text(`${index + 1}. ${answer.question}`, true)],
        spacing: { before: 180, after: 100 },
      }),
      new Paragraph({ children: [text(`本题得分：${answer.score}/100 · 回答时长：${duration(answer.seconds)}`)] }),
      new Paragraph({ children: [text(`回答亮点：${answer.evidence.highlight}`)] }),
      new Paragraph({ children: [text(`改进方向：${answer.evidence.gap}`)] }),
      ...(answer.speechMetrics ? [
        new Paragraph({ children: [text(`表达指标：语速 ${answer.speechMetrics.wordsPerMinute} 字/分；停顿 ${answer.speechMetrics.pauseRatio}%；开口前思考 ${(answer.speechMetrics.thinkingBeforeAnswerMs / 1000).toFixed(1)} 秒；口头语 ${answer.speechMetrics.fillerWordsPerMinute} 次/分`)] }),
      ] : []),
      new Paragraph({ children: [text(`回答原文：${answer.answer}`)], spacing: { after: 120 } }),
    ]),
    new Paragraph({
      children: [new TextRun({
        text: "说明：本报告用于模拟练习反馈，不代表真实招聘结果。外部 AI 只负责提问和提取证据，最终分数由规则引擎计算。",
        color: "666666",
        font: "Microsoft YaHei",
        size: 18,
      })],
      spacing: { before: 260 },
    }),
  ];

  const doc = new Document({
    creator: "薪火未来",
    title: "模拟面试报告",
    description: "薪火未来 AI 模拟面试练习反馈",
    sections: [{ properties: {}, children }],
  });
  const blob = await Packer.toBlob(doc);
  triggerDownload(blob, `${interviewReportFileStem(context.targetRole, report.calculatedAt)}.docx`);
}

export async function downloadInterviewReportPdf(
  report: InterviewReportV2,
  context: InterviewReportExportContext,
) {
  const { jsPDF } = await import("jspdf");
  const PAGE_WIDTH = 1240;
  const PAGE_HEIGHT = 1754;
  const MARGIN = 96;
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
  const pages: HTMLCanvasElement[] = [];
  let canvas!: HTMLCanvasElement;
  let drawing!: CanvasRenderingContext2D;
  let cursorY = MARGIN;

  const createPage = () => {
    canvas = document.createElement("canvas");
    canvas.width = PAGE_WIDTH;
    canvas.height = PAGE_HEIGHT;
    const context2d = canvas.getContext("2d");
    if (!context2d) throw new Error("浏览器无法创建 PDF 画布");
    drawing = context2d;
    drawing.fillStyle = "#ffffff";
    drawing.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
    pages.push(canvas);
    cursorY = MARGIN;
  };

  const font = (size: number, weight = 400) => {
    drawing.font = `${weight} ${size}px -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif`;
  };

  const wrap = (value: string, size: number, weight: number, maxWidth: number) => {
    font(size, weight);
    const result: string[] = [];
    let line = "";
    for (const character of Array.from(value || "—")) {
      const candidate = `${line}${character}`;
      if (line && drawing.measureText(candidate).width > maxWidth) {
        result.push(line);
        line = character;
      } else {
        line = candidate;
      }
    }
    if (line) result.push(line);
    return result;
  };

  const ensure = (height: number) => {
    if (cursorY + height <= PAGE_HEIGHT - MARGIN) return;
    createPage();
  };

  const drawText = (
    value: string,
    options: {
      size?: number;
      weight?: number;
      color?: string;
      indent?: number;
      lineHeight?: number;
      after?: number;
    } = {},
  ) => {
    const size = options.size ?? 26;
    const weight = options.weight ?? 400;
    const indent = options.indent ?? 0;
    const lineHeight = options.lineHeight ?? Math.round(size * 1.55);
    const lines = wrap(value, size, weight, CONTENT_WIDTH - indent);
    ensure(lines.length * lineHeight + (options.after ?? 12));
    font(size, weight);
    drawing.fillStyle = options.color ?? "#24283a";
    for (const line of lines) {
      drawing.fillText(line, MARGIN + indent, cursorY);
      cursorY += lineHeight;
    }
    cursorY += options.after ?? 12;
  };

  const drawRule = () => {
    ensure(28);
    drawing.strokeStyle = "#d9deea";
    drawing.lineWidth = 2;
    drawing.beginPath();
    drawing.moveTo(MARGIN, cursorY);
    drawing.lineTo(PAGE_WIDTH - MARGIN, cursorY);
    drawing.stroke();
    cursorY += 28;
  };

  const heading = (value: string) => {
    ensure(78);
    drawText(value, { size: 34, weight: 700, color: "#172033", after: 18 });
  };

  createPage();
  drawText("薪火未来", { size: 22, weight: 700, color: "#4c73d9", after: 18 });
  drawText("模拟面试报告", { size: 54, weight: 750, color: "#111827", lineHeight: 70, after: 26 });
  drawText(`目标岗位：${context.targetRole}`, { size: 26, color: "#50586d", after: 8 });
  drawText(`生成时间：${new Date(report.calculatedAt).toLocaleString("zh-CN", { hour12: false })}`, { size: 24, color: "#697085", after: 8 });
  drawText(`面试时长：${duration(context.durationSeconds)}　评分引擎：${report.engineVersion}`, { size: 24, color: "#697085", after: 26 });

  ensure(130);
  drawing.fillStyle = "#edf2ff";
  drawing.fillRect(MARGIN, cursorY, CONTENT_WIDTH, 104);
  font(52, 750);
  drawing.fillStyle = "#365fc4";
  drawing.fillText(`${report.overallScore}`, MARGIN + 28, cursorY + 68);
  font(24, 600);
  drawing.fillStyle = "#293248";
  drawing.fillText("/ 100　综合得分", MARGIN + 112, cursorY + 64);
  cursorY += 132;

  heading("五维得分");
  const dimensions = [
    ["经历与内容质量", report.dimensions.content, 30],
    ["岗位匹配度", report.dimensions.roleMatch, 20],
    ["专业深度", report.dimensions.professionalDepth, 20],
    ["逻辑结构", report.dimensions.logicStructure, 15],
    ["语言表达", report.dimensions.languageExpression, 15],
  ] as const;
  for (const [label, score, maximum] of dimensions) {
    drawText(`${label}　${score} / ${maximum}`, { size: 26, weight: 600, indent: 10, after: 9 });
  }

  drawRule();
  heading("口语表达观察");
  drawText(`平均语速 ${report.expressionSummary.averageWordsPerMinute} 字/分　·　平均停顿 ${report.expressionSummary.averagePauseRatio}%`, { size: 25 });
  drawText(`开口前思考 ${report.expressionSummary.averageThinkingSeconds} 秒　·　口头语 ${report.expressionSummary.totalFillers} 次（${report.expressionSummary.fillerWordsPerMinute} 次/分）`, { size: 25 });
  drawText(report.expressionSummary.observation, { size: 25, color: "#50586d", after: 24 });

  const drawList = (title: string, items: string[]) => {
    ensure(240);
    drawRule();
    heading(title);
    if (!items.length) drawText("暂无", { color: "#697085" });
    for (const item of items) drawText(`• ${item}`, { size: 25, indent: 8, after: 8 });
  };

  drawList("回答亮点", report.strengths);
  drawList("改进建议", report.improvements);
  drawList("下一步行动计划", report.actionPlan);

  ensure(240);
  drawRule();
  heading("逐题复盘");
  report.scoredAnswers.forEach((answer, index) => {
    ensure(170);
    drawText(`${index + 1}. ${answer.question}`, { size: 29, weight: 700, color: "#172033", after: 10 });
    drawText(`本题得分 ${answer.score}/100　·　回答时长 ${duration(answer.seconds)}`, { size: 23, color: "#4c73d9", after: 8 });
    drawText(`回答亮点：${answer.evidence.highlight}`, { size: 24, after: 6 });
    drawText(`改进方向：${answer.evidence.gap}`, { size: 24, after: 6 });
    if (answer.speechMetrics) {
      drawText(
        `表达指标：语速 ${answer.speechMetrics.wordsPerMinute} 字/分；停顿 ${answer.speechMetrics.pauseRatio}%；开口前思考 ${(answer.speechMetrics.thinkingBeforeAnswerMs / 1000).toFixed(1)} 秒；口头语 ${answer.speechMetrics.fillerWordsPerMinute} 次/分`,
        { size: 23, color: "#50586d", after: 8 },
      );
    }
    drawText(`回答原文：${answer.answer}`, { size: 24, color: "#3f4659", after: 26 });
  });

  drawRule();
  drawText("说明：本报告用于模拟练习反馈，不代表真实招聘结果。外部 AI 只负责提问和提取证据，最终分数由规则引擎计算。", {
    size: 21,
    color: "#747b8e",
    after: 0,
  });

  pages.forEach((pageCanvas, index) => {
    const pageContext = pageCanvas.getContext("2d");
    if (!pageContext) return;
    pageContext.font = '500 20px -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif';
    pageContext.fillStyle = "#8a91a3";
    pageContext.textAlign = "right";
    pageContext.fillText(`${index + 1} / ${pages.length}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 38);
  });

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  pages.forEach((pageCanvas, index) => {
    if (index > 0) pdf.addPage();
    pdf.addImage(pageCanvas.toDataURL("image/jpeg", 0.94), "JPEG", 0, 0, 210, 297, undefined, "FAST");
  });
  triggerDownload(
    pdf.output("blob"),
    `${interviewReportFileStem(context.targetRole, report.calculatedAt)}.pdf`,
  );
}
