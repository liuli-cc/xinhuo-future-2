import type { InterviewReportV2 } from "./scoring-v2";

export type InterviewReportExportContext = {
  targetRole: string;
  durationSeconds: number;
};

const dimensionRows = [
  ["经历与内容质量", "content", 30],
  ["岗位匹配度", "roleMatch", 20],
  ["专业深度", "professionalDepth", 20],
  ["逻辑结构", "logicStructure", 15],
  ["语言表达", "languageExpression", 15],
] as const;

function formatDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}分${String(seconds).padStart(2, "0")}秒`;
}

function asList(items: string[], emptyText: string): string {
  return items.length ? items.map(item => `- ${item}`).join("\n") : `- ${emptyText}`;
}

export function interviewReportFileName(targetRole: string, calculatedAt: string): string {
  const safeRole = targetRole.trim().replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, "-") || "通用能力";
  const date = Number.isNaN(Date.parse(calculatedAt))
    ? new Date().toISOString().slice(0, 10)
    : new Date(calculatedAt).toISOString().slice(0, 10);
  return `薪火未来-模拟面试报告-${safeRole}-${date}.md`;
}

export function interviewReportFileStem(targetRole: string, calculatedAt: string): string {
  return interviewReportFileName(targetRole, calculatedAt).replace(/\.md$/i, "");
}

export function buildInterviewReportMarkdown(
  report: InterviewReportV2,
  context: InterviewReportExportContext,
): string {
  const dimensions = dimensionRows
    .map(([label, key, max]) => `| ${label} | ${report.dimensions[key]} | ${max} |`)
    .join("\n");
  const details = report.scoredAnswers.map((item, index) => {
    const speech = item.speechMetrics
      ? `\n- 语速：${item.speechMetrics.wordsPerMinute} 字/分\n- 停顿占比：${item.speechMetrics.pauseRatio}%\n- 开口前思考：${(item.speechMetrics.thinkingBeforeAnswerMs / 1000).toFixed(1)} 秒\n- 口头语密度：${item.speechMetrics.fillerWordsPerMinute} 次/分\n- STAR 完整度：${item.speechMetrics.starCompleteness}/4`
      : "\n- 本题未记录语音指标";
    const risks = item.riskPoints.length ? item.riskPoints.join("；") : "无明显风险点";
    return [
      `### ${index + 1}. ${item.question}`,
      "",
      `- 本题得分：${item.score}/100`,
      `- 回答时长：${formatDuration(item.seconds)}`,
      `- 回答亮点：${item.evidence.highlight}`,
      `- 改进方向：${item.evidence.gap}`,
      `- 风险提示：${risks}`,
      speech,
      "",
      "**回答原文**",
      "",
      item.answer,
    ].join("\n");
  }).join("\n\n");

  return [
    "# 薪火未来模拟面试报告",
    "",
    `- 目标岗位：${context.targetRole}`,
    `- 综合得分：${report.overallScore}/100`,
    `- 面试时长：${formatDuration(context.durationSeconds)}`,
    `- 回答数量：${report.scoredAnswers.length}`,
    `- 生成时间：${new Date(report.calculatedAt).toLocaleString("zh-CN", { hour12: false })}`,
    `- 评分引擎：${report.engineVersion}`,
    "",
    "## 五维得分",
    "",
    "| 维度 | 得分 | 满分 |",
    "| --- | ---: | ---: |",
    dimensions,
    "",
    "## 回答亮点",
    "",
    asList(report.strengths, "暂未形成稳定优势，请结合逐题反馈继续练习。"),
    "",
    "## 改进建议",
    "",
    asList(report.improvements, "当前没有明显短板，建议继续保持并增加岗位针对性。"),
    "",
    "## 下一步行动",
    "",
    asList(report.actionPlan ?? [], "完成一次新的模拟面试并对比前后得分。"),
    "",
    "## 口语表达观察",
    "",
    `- 有效语音回答：${report.expressionSummary.answersWithVoice} 轮`,
    `- 平均语速：${report.expressionSummary.averageWordsPerMinute} 字/分`,
    `- 平均停顿占比：${report.expressionSummary.averagePauseRatio}%`,
    `- 平均开口前思考：${report.expressionSummary.averageThinkingSeconds} 秒`,
    `- 口头语总计：${report.expressionSummary.totalFillers} 次（${report.expressionSummary.fillerWordsPerMinute} 次/分）`,
    `- 观察结论：${report.expressionSummary.observation}`,
    "",
    "## 逐题复盘",
    "",
    details,
    "",
    "---",
    "说明：外部 AI 仅用于提问和提取回答证据，最终分数由 XH-SCORE 规则引擎计算；本报告用于练习反馈，不代表真实招聘结果。",
    "",
  ].join("\n");
}
