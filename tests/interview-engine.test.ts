import assert from "node:assert/strict";
import test from "node:test";
import { scoreInterview, scoreInterviewAnswer } from "../lib/interview-engine.ts";

test("结构完整且量化的岗位回答获得更高分", () => {
  const weak = scoreInterviewAnswer({ question: "介绍项目", answer: "我参加了一个项目，做了一些工作。", seconds: 20 }, "后端开发");
  const strong = scoreInterviewAnswer({
    question: "介绍项目",
    answer: "在课程项目期间，我负责接口和数据库设计。目标是在两周内完成核心模块。我先拆分接口，再增加日志和测试，最终按期上线 12 个接口，查询耗时降低 35%。",
    seconds: 82,
  }, "后端开发");
  assert.ok(strong.score > weak.score);
  assert.equal(strong.signals.quantified, true);
  assert.equal(strong.signals.starElements, 4);
  assert.ok(strong.signals.matchedKeywords.length >= 2);
});

test("面试报告由四项公开指标合成", () => {
  const report = scoreInterview([
    { question: "介绍项目", answer: "当时我负责用户需求分析，我先访谈 8 位用户，最终推动两轮迭代并把完成时间缩短 20%。", seconds: 70 },
  ], "产品经理");
  assert.equal(report.modelMode, "deterministic");
  assert.equal(report.evidence.answerCount, 1);
  assert.ok(report.overallScore >= 0 && report.overallScore <= 100);
  assert.equal(Object.keys(report.metrics).length, 4);
});

test("模型分析只改变报告模式，不绕过规则评分", () => {
  const answer = {
    question: "介绍项目",
    answer: "当时我负责接口设计，我先补充日志和测试，最终将平均耗时降低 30%。",
    seconds: 65,
  };
  const deterministic = scoreInterview([answer], "后端开发");
  const hybrid = scoreInterview([{
    ...answer,
    modelInsight: {
      summary: "候选人描述了性能优化。",
      strengths: ["包含量化结果"],
      gaps: [],
      evidence: ["耗时降低 30%"],
      nextFocus: "验证方法",
    },
  }], "后端开发", { provider: "deepseek", modelName: "deepseek-v4-flash" });
  assert.equal(hybrid.modelMode, "hybrid");
  assert.equal(hybrid.model?.assistedAnswers, 1);
  assert.equal(hybrid.overallScore, deterministic.overallScore);
});
