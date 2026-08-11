import assert from "node:assert/strict";
import test from "node:test";
import { buildInterviewReportMarkdown, interviewReportFileName } from "../lib/interview-report-export.ts";
import { generateReportV2, scoreAnswerV2 } from "../lib/scoring-v2.ts";

test("面试报告导出包含岗位、五维得分、行动计划与逐题原文", () => {
  const answer = scoreAnswerV2(
    "请介绍项目经历",
    "在课程项目中，我负责接口设计。我先分析需求并实现核心接口，最终完成12个接口，响应时间降低35%。",
    70,
    ["接口"],
    null,
  );
  const report = generateReportV2([answer]);
  const markdown = buildInterviewReportMarkdown(report, {
    targetRole: "后端开发工程师",
    durationSeconds: 930,
  });

  assert.match(markdown, /后端开发工程师/);
  assert.match(markdown, /五维得分/);
  assert.match(markdown, /下一步行动/);
  assert.match(markdown, /完成12个接口/);
  assert.match(markdown, /15分30秒/);
});

test("报告文件名会移除路径非法字符", () => {
  assert.equal(
    interviewReportFileName("AI/后端:开发", "2026-07-30T00:00:00.000Z"),
    "薪火未来-模拟面试报告-AI-后端-开发-2026-07-30.md",
  );
});
