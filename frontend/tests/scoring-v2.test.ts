import assert from "node:assert/strict";
import test from "node:test";
import { scoreAnswerV2, generateReportV2 } from "../lib/scoring-v2.ts";
import { defaultSpeechMetrics } from "../lib/speech-analysis.ts";

test("评分算法：STAR完整 + 量化 = 更高分", () => {
  const weak = scoreAnswerV2("介绍项目", "我参加了一个项目。", 15, [], null);
  const strong = scoreAnswerV2(
    "介绍项目",
    "在课程项目中，我负责后端接口设计。目标是在两周内完成核心模块。我先拆分接口，增加日志和测试，最终按期上线12个接口，查询耗时降低35%。",
    82,
    ["Java", "Spring"],
    null,
  );
  assert.ok(strong.score > weak.score, `strong ${strong.score} should > weak ${weak.score}`);
  assert.ok(strong.dimensions.content >= 15, `content=${strong.dimensions.content}`);
});

test("包含语音指标的报告", () => {
  const metrics = defaultSpeechMetrics();
  metrics.wordsPerMinute = 160;
  metrics.starCompleteness = 4;
  const scored = scoreAnswerV2("测试问题", "完整回答内容，包含情境、任务、行动和结果，并有所量化。", 60, ["JavaScript"], metrics);
  assert.ok(scored.speechMetrics !== null);
  assert.equal(scored.speechMetrics!.wordsPerMinute, 160);
  const report = generateReportV2([scored]);
  assert.equal(report.expressionSummary.answersWithVoice, 1);
});

test("合理思考停顿不扣分，口头语密度过高会影响语言表达", () => {
  const natural = defaultSpeechMetrics();
  natural.wordsPerMinute = 160;
  natural.pauseRatio = 22;
  natural.thinkingBeforeAnswerMs = 5_000;
  natural.fillerWordsPerMinute = 1.5;
  const excessive = { ...natural, thinkingBeforeAnswerMs: 20_000, fillerWordsPerMinute: 10 };
  const answer = "在项目中我负责接口设计，目标是提升稳定性。我先分析日志并完成优化，最终故障率降低30%。";
  const naturalScore = scoreAnswerV2("介绍项目", answer, 70, [], natural);
  const excessiveScore = scoreAnswerV2("介绍项目", answer, 70, [], excessive);
  assert.ok(naturalScore.dimensions.languageExpression > excessiveScore.dimensions.languageExpression);
  assert.ok(excessiveScore.riskPoints.some(point => point.includes("口头语")));
});

test("不同学生数据隔离（userId在服务端）", () => {
  // 评分函数本身不依赖userId，隔离由服务端数据库查询保证
  // 此测试验证评分不因候选人差异而改变算法行为
  const a1 = scoreAnswerV2("Q1", "回答A", 30, ["Java"], null);
  const a2 = scoreAnswerV2("Q1", "回答A", 30, ["Java"], null);
  assert.equal(a1.score, a2.score);
  assert.deepEqual(a1.dimensions, a2.dimensions);
});

test("空答案报告处理", () => {
  const report = generateReportV2([]);
  assert.equal(report.overallScore, 0);
  assert.equal(report.scoredAnswers.length, 0);
});

test("多题报告总分在0-100范围内", () => {
  const answers = [
    scoreAnswerV2("Q1", "当时我需要优化系统性能，目标是将查询耗时降到50ms以内。我首先分析慢查询日志，然后重写了关键SQL并增加了索引。最终将平均查询耗时降到了35ms。", 75, ["Java", "SQL"], null),
    scoreAnswerV2("Q2", "我们团队使用敏捷开发，我负责每日站会主持和任务分配。在一次迭代中我们在截止日前完成了所有功能。", 60, ["Java"], null),
  ];
  const report = generateReportV2(answers);
  assert.ok(report.overallScore >= 0);
  assert.ok(report.overallScore <= 100);
  assert.equal(
    report.overallScore,
    Object.values(report.dimensions).reduce((sum, score) => sum + score, 0),
  );
  assert.ok(Array.isArray(report.strengths));
  assert.ok(report.improvements.length > 0);
  assert.equal(report.actionPlan.length, 3);
});

test("五维分值按30+20+20+15+15直接合成百分制总分", () => {
  const scored = scoreAnswerV2(
    "请介绍一个项目",
    "在课程项目中，我负责接口设计，目标是两周内完成核心模块。我先分析需求和数据指标，再对比两套方案并完成12个接口，最终查询耗时降低35%。",
    90,
    ["接口", "数据"],
    null,
  );
  assert.equal(
    scored.score,
    Object.values(scored.dimensions).reduce((sum, score) => sum + score, 0),
  );
  assert.ok(scored.score >= 60, `score=${scored.score}`);
});
