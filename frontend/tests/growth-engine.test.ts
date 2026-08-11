import assert from "node:assert/strict";
import test from "node:test";
import { calculatePortrait, scoreEvidence, type EvidenceRecord } from "../lib/growth-engine.ts";

const now = new Date("2026-07-16T08:00:00Z").getTime();
const base: EvidenceRecord = {
  id: 1,
  studentId: "test-student",
  taskId: "task-1",
  title: "课程项目成果",
  category: "项目实践",
  dimension: "项目实践",
  detail: "独立完成核心功能并通过课程验收",
  evidenceRef: "https://example.edu/project/1",
  evidenceDate: "2026-07-01",
  sourceType: "project_artifact",
  sourceReliability: 82,
  relevance: 80,
  quality: 75,
  contribution: 70,
  verificationStatus: "pending",
  reviewerNote: "",
  reviewedAt: null,
  createdAt: now,
};

test("没有证据时不生成虚构分数", () => {
  const result = calculatePortrait([], now);
  assert.equal(result.overallScore, 0);
  assert.equal(result.completeness, 0);
  assert.equal(result.totalEvidence, 0);
  assert.ok(result.dimensions.every(item => item.score === 0));
});

test("只有已核验证据才更新对应能力维度", () => {
  const result = calculatePortrait([{ ...base, verificationStatus: "verified" }], now);
  const project = result.dimensions.find(item => item.name === "项目实践");
  assert.ok(project && project.score > 0);
  assert.equal(project?.evidenceCount, 1);
  assert.ok(result.dimensions.filter(item => item.name !== "项目实践").every(item => item.score === 0));
});

test("核验证据比未核验证据权重更高", () => {
  const pending = scoreEvidence(base, now);
  const verified = scoreEvidence({ ...base, verificationStatus: "verified" }, now);
  assert.ok(verified.effectiveWeight > pending.effectiveWeight);
  assert.ok(verified.impact > pending.impact);
  assert.equal(pending.impact, 0);
  assert.equal(calculatePortrait([base], now).overallScore, 0);
  assert.equal(calculatePortrait([base], now).completeness, 0);
});

test("较新证据比两年前证据权重更高", () => {
  const recent = scoreEvidence({ ...base, verificationStatus: "verified" }, now);
  const old = scoreEvidence({ ...base, verificationStatus: "verified", evidenceDate: "2023-01-01" }, now);
  assert.ok(recent.recencyWeight > old.recencyWeight);
  assert.ok(recent.impact > old.impact);
});

test("增加同维度有效证据会提升分数和完整度", () => {
  const verified = { ...base, verificationStatus: "verified" as const };
  const one = calculatePortrait([verified], now);
  const two = calculatePortrait([verified, { ...verified, id: 2, title: "第二份项目作品", sourceReliability: 90 }], now);
  assert.ok(two.overallScore > one.overallScore);
  assert.ok(two.completeness > one.completeness);
});
