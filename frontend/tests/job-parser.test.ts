import assert from "node:assert/strict";
import test from "node:test";
import { parseJobDescription } from "../lib/job-parser.ts";

const SAMPLE_JOB = {
  title: "后端开发实习生",
  company: "字节跳动",
  description: `负责广告投放系统的后端开发与维护
参与需求分析和技术方案设计
优化系统性能，降低接口响应时间
使用Java、Spring Boot、MySQL进行开发
与产品、前端团队紧密协作
要求：计算机相关专业，熟悉Java和SQL，有项目经验者优先
加分项：了解Docker、Kubernetes、微服务架构
实习周期至少3个月`,
};

test("岗位技能提取", () => {
  const job = parseJobDescription(SAMPLE_JOB.title, SAMPLE_JOB.description, SAMPLE_JOB.company);
  assert.ok(job.skills.includes("Java"));
  assert.ok(job.skills.includes("SQL"));
  assert.ok(job.skills.includes("Docker"));
  assert.ok(job.skills.includes("SQL"));
});

test("岗位职责提取", () => {
  const job = parseJobDescription(SAMPLE_JOB.title, SAMPLE_JOB.description, SAMPLE_JOB.company);
  assert.ok(job.responsibilities.length >= 1);
  assert.ok(job.responsibilities.some(r => r.includes("后端开发")));
  assert.ok(job.responsibilities.some(r => r.includes("性能")));
});

test("难度判断", () => {
  const entryJob = parseJobDescription("前端实习生", "协助完成页面开发，熟悉HTML/CSS/JS即可", "某公司");
  assert.equal(entryJob.difficulty, "entry");
  
  const advancedJob = parseJobDescription("高级Java工程师", "负责系统架构设计，带领5人团队", "某公司");
  assert.equal(advancedJob.difficulty, "advanced");
});

test("缺失字段检测", () => {
  const empty = parseJobDescription("", "", "");
  assert.ok(empty.missingFields.length > 0);
  
  const complete = parseJobDescription("后端开发", "负责Java后端开发", "字节");
  assert.equal(complete.missingFields.length, 0);
});

test("核心能力提取", () => {
  const job = parseJobDescription(SAMPLE_JOB.title, SAMPLE_JOB.description, SAMPLE_JOB.company);
  assert.ok(job.coreCompetencies.length > 0);
  // 应该检测到沟通协作能力
  assert.ok(job.coreCompetencies.some(c => c.includes("沟通") || c.includes("协作")));
});
