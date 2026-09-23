import assert from "node:assert/strict";
import test from "node:test";
import { applyResumeSuggestion, emptyResume, mergeImportedResume, resumeCompleteness } from "../modules/shared/resume-studio.ts";

test("resume import keeps unrecognized draft fields and transfers recognized contact and experience", () => {
  const current = { ...emptyResume, city: "呼和浩特", grade: "2024级", role: "软件开发" };
  const result = mergeImportedResume(current, { name: "王晓明", education: "内蒙古师范大学\n本科", major: "计算机", skills: ["Python", "SQL"], projects: [{ name: "校园系统", description: "完成搜索模块" }], internships: [], competitions: [], selfEval: "" }, "电话 13812345678 邮箱 student@example.com");
  assert.equal(result.school, "内蒙古师范大学");
  assert.equal(result.phone, "13812345678");
  assert.equal(result.email, "student@example.com");
  assert.equal(result.city, "呼和浩特");
  assert.equal(result.role, "软件开发");
  assert.equal(result.experiences[0].detail, "完成搜索模块");
  assert.deepEqual(current.experiences, []);
});

test("AI adoption only changes matching existing experience details", () => {
  const current = { ...emptyResume, name: "学生", experiences: [{ id: 8, title: "项目", org: "学校", period: "2026", detail: "原始描述" }] };
  const result = applyResumeSuggestion(current, { summary: "优化简介", experiences: [{ id: 8, detail: "优化描述" }, { id: 999, detail: "额外经历" }], suggestions: [] });
  assert.equal(result.experiences.length, 1);
  assert.equal(result.experiences[0].title, "项目");
  assert.equal(result.experiences[0].detail, "优化描述");
  assert.equal(current.experiences[0].detail, "原始描述");
});

test("completeness does not count blank spaces or empty experience cards", () => {
  assert.equal(resumeCompleteness({ ...emptyResume, name: " " }), 0);
  assert.equal(resumeCompleteness({ ...emptyResume, experiences: [{ id: 1, title: "", org: "", period: "", detail: "" }] }), 0);
  assert.equal(resumeCompleteness({ ...emptyResume, name: "学生", role: "开发", school: "大学", major: "计算机", email: "student@example.com", summary: "简介", skills: "Python", experiences: [{ id: 1, title: "校园系统", org: "", period: "", detail: "完成模块" }] }), 100);
});

test("DOCX export contains the actual resume and preserves multiple-line experiences", async () => {
  const { buildResumeDocx } = await import("../modules/shared/resume-export.ts");
  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  const AdmZip = require("../../functions/xinhuo-api/node_modules/adm-zip");
  const blob = await buildResumeDocx({ ...emptyResume, name: "王晓明", role: "后端开发", school: "内蒙古师范大学", experiences: [{ id: 1, title: "校园系统", org: "学校", period: "2026", detail: "实现检索模块\n完成测试" }] });
  const archive = new AdmZip(Buffer.from(await blob.arrayBuffer()));
  const xml = archive.readAsText("word/document.xml");
  assert.match(xml, /王晓明/);
  assert.match(xml, /内蒙古师范大学/);
  assert.match(xml, /实现检索模块/);
  assert.match(xml, /完成测试/);
  assert.doesNotMatch(xml, /薪火 AI 简历工坊/);
});

test("OCR-spaced target role and grade replace older draft values", () => {
  const result = mergeImportedResume({ ...emptyResume, role: "旧岗位", grade: "2025级" }, { name: "王晓明", education: "内蒙古师范大学 本科", major: "计算机", skills: [], projects: [], internships: [], competitions: [], selfEval: "" }, "求职 意向 : 后 端 开 发 实习 生\n本科 2024 级");
  assert.equal(result.role, "后端开发实习生");
  assert.equal(result.grade, "2024级");
});
