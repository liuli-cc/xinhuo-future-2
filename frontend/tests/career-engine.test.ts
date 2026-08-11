import assert from "node:assert/strict";
import test from "node:test";
import { buildCareerGapTasks, buildCareerMatch, deriveCareerRequirements } from "../lib/career-engine.ts";
import type { EvidenceRecord } from "../lib/growth-engine.ts";

function evidence(overrides: Partial<EvidenceRecord>): EvidenceRecord {
  return {
    id: 1,
    studentId: "20251106304",
    taskId: "project-api",
    title: "后端项目接口与数据库优化",
    category: "项目成果",
    dimension: "项目实践",
    detail: "我负责 Java Spring Boot 接口、PostgreSQL 数据库设计和日志优化，最终将查询耗时降低 35%。",
    evidenceRef: "https://example.com/project",
    evidenceDate: "2026-06-01",
    sourceType: "project_artifact",
    sourceReliability: 82,
    relevance: 92,
    quality: 88,
    contribution: 90,
    verificationStatus: "verified",
    reviewerNote: "项目材料完整",
    reviewedAt: 1,
    createdAt: 1,
    ...overrides,
  };
}

test("岗位文本可提取可解释的能力要求", () => {
  const requirements = deriveCareerRequirements({
    title: "后端开发实习生",
    company: "示例企业",
    city: "呼和浩特",
    employmentType: "实习",
    description: "要求熟悉 Java、Spring Boot、MySQL，具备接口设计、日志和团队协作能力。",
  });
  assert.ok(requirements.some(item => item.label === "Java / Spring"));
  assert.ok(requirements.some(item => item.label === "数据库与 SQL"));
  assert.ok(requirements.some(item => item.dimension === "沟通协作"));
});

test("已核验项目佐证会提高岗位匹配，未核验材料不计入", () => {
  const job = { title: "后端开发实习生", company: "示例企业", city: "呼和浩特", employmentType: "实习", description: "要求熟悉 Java、Spring Boot、PostgreSQL、接口和日志。" };
  const supported = buildCareerMatch({ job, evidence: [evidence({})], targetRole: "backend", interests: ["后端", "数据库"], now: 1_780_000_000_000 });
  const unsupported = buildCareerMatch({ job, evidence: [evidence({ verificationStatus: "pending" })], targetRole: "backend", interests: ["后端"], now: 1_780_000_000_000 });
  assert.ok(supported.overallScore > unsupported.overallScore);
  assert.equal(unsupported.evidenceBasis.verifiedEvidence, 0);
  assert.equal(supported.modelMode, "deterministic");
});

test("岗位缺口可转换为需要佐证核验的成长任务", () => {
  const result = buildCareerMatch({
    job: { title: "算法实习生", company: "示例企业", city: "北京", employmentType: "实习", description: "要求熟悉 Python、机器学习、实验和论文复现。" },
    evidence: [],
    targetRole: "algorithm",
    interests: [],
    now: 1_780_000_000_000,
  });
  const tasks = buildCareerGapTasks("12345678-1234-1234-1234-123456789abc", "算法实习生", result, 3);
  assert.ok(tasks.length > 0);
  assert.match(tasks[0].taskId, /^career-/);
  assert.equal(tasks[0].isCustom, true);
});
