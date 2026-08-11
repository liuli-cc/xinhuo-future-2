import assert from "node:assert/strict";
import test from "node:test";
import { buildDecisionPlan } from "../lib/decision-engine.ts";
import { calculatePortrait, type EvidenceRecord } from "../lib/growth-engine.ts";

const now = new Date("2026-07-25T08:00:00Z").getTime();
const evidence: EvidenceRecord = {
  id: 1,
  studentId: "20250000001",
  taskId: "project-1",
  title: "后端课程项目",
  category: "项目实践",
  dimension: "项目实践",
  detail: "负责接口与数据库设计，完成测试和部署",
  evidenceRef: "https://example.edu/project",
  evidenceDate: "2026-07-01",
  sourceType: "teacher_review",
  sourceReliability: 95,
  relevance: 90,
  quality: 85,
  contribution: 80,
  verificationStatus: "verified",
  reviewerNote: "",
  reviewedAt: now,
  createdAt: now,
};

test("决策引擎不在无证据时虚构准备度", () => {
  const plan = buildDecisionPlan({ portrait: calculatePortrait([], now), targetRole: "backend", semesterIndex: 4 });
  assert.equal(plan.readiness, 0);
  assert.equal(plan.evidenceBasis, 0);
  assert.ok(plan.gaps.every(item => item.score === 0));
  assert.ok(plan.recommendations.length > 0);
  assert.match(plan.formula, /差距影响/);
});

test("目标权重改变能力差距排序且输出可解释因素", () => {
  const portrait = calculatePortrait([evidence], now);
  const plan = buildDecisionPlan({ portrait, targetRole: "后端开发", interests: ["数据库", "后端"], semesterIndex: 4 });
  assert.equal(plan.target.label, "后端开发");
  assert.ok(plan.readiness > 0);
  assert.ok(plan.recommendations[0].rationale.includes("目标基准"));
  assert.ok(plan.recommendations[0].factors.targetRelevance > 0);
  assert.equal(plan.modelMode, "deterministic");
});
