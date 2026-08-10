import assert from "node:assert/strict";
import test from "node:test";
import { analyzeSpeechMetrics, describeExpression, defaultSpeechMetrics } from "../lib/speech-analysis.ts";

test("语速计算", () => {
  const text = "我在大学期间参与了多个项目开发，主要负责后端接口的设计和实现。在项目中使用Spring Boot框架，数据库使用MySQL。最终完成了12个接口的开发。";
  const metrics = analyzeSpeechMetrics(text, 45000, 35000, [], 2000, [50, 55, 60, 58], 180000);
  assert.ok(metrics.wordsPerMinute > 0);
  assert.equal(metrics.totalAnswerSeconds, 45);
});

test("停顿计算", () => {
  const metrics = analyzeSpeechMetrics("测试回答", 30000, 20000, [1500, 2000, 3000], 3000, [], 180000);
  assert.equal(metrics.pauseCount, 3);
  assert.ok(metrics.pauseRatio > 0);
});

test("口头语统计", () => {
  const text = "嗯，就是说，我在那个项目中，然后负责了那个接口开发，就是说完成了任务。然后呢，还有就是嗯，跟团队协作。";
  const metrics = analyzeSpeechMetrics(text, 20000, 18000, [], 1000, [], 180000);
  assert.ok(metrics.fillerWordCounts["就是说"] >= 2);
  assert.ok(Object.values(metrics.fillerWordCounts).reduce((a, b) => a + b, 0) > 0);
  assert.ok(metrics.fillerWordsPerMinute > 0);
});

test("STAR结构检测", () => {
  const fullStar = "当时我们面临系统性能问题，目标是降低50%的查询耗时。我负责优化数据库索引，先分析慢查询日志，然后重写了关键SQL。最终将查询耗时降低了55%，获得了团队的认可。";
  const metrics = analyzeSpeechMetrics(fullStar, 30000, 28000, [], 1000, [], 180000);
  assert.equal(metrics.starCompleteness, 4);

  const incomplete = "我做了这个项目，用了一些技术，完成了一些功能。";
  const metrics2 = analyzeSpeechMetrics(incomplete, 10000, 8000, [], 1000, [], 180000);
  assert.ok(metrics2.starCompleteness < 3);
});

test("表达状态描述（不包含心理诊断）", () => {
  const text = "我在项目中负责了后端开发。";
  const metrics = analyzeSpeechMetrics(text, 10000, 8000, [], 1000, [50, 52, 48, 51], 180000);
  const desc = describeExpression(metrics);
  assert.ok(typeof desc.pace === "string");
  assert.ok(typeof desc.overall === "string");
  // 不包含心理诊断术语
  assert.ok(!desc.overall.includes("焦虑"));
  assert.ok(!desc.overall.includes("抑郁"));
  assert.ok(!desc.overall.includes("不稳定"));
});

test("默认指标为全零", () => {
  const m = defaultSpeechMetrics();
  assert.equal(m.wordsPerMinute, 0);
  assert.equal(m.pauseCount, 0);
  assert.equal(m.starCompleteness, 0);
});
