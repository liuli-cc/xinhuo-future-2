import assert from "node:assert/strict";
import test from "node:test";
import { parseResumeText, desensitizeResume, validateResumeFile, resumeStructuredSummary } from "../lib/resume-parser.ts";

const SAMPLE_RESUME = `张三

教育背景
内蒙古师范大学 计算机科学与技术 本科 2021级

专业
计算机科学与技术

技能
Java, Python, React, Docker, Git

项目经历
在线考试系统
负责后端接口设计和数据库优化，使用Spring Boot + MySQL，最终将查询耗时降低40%。

校园二手交易平台
前端开发，使用React + TypeScript，完成商品发布和聊天模块。

实习经历
字节跳动 后端开发实习生
参与广告投放系统开发，负责数据统计模块，日均处理500万条日志。

竞赛
蓝桥杯省级二等奖
数学建模竞赛省级三等奖

自我评价
具有较强的学习能力和团队协作精神，能够快速适应新技术。
联系方式：13812345678
邮箱：zhangsan@example.com`;

test("简历字段提取：姓名、学历、专业、技能、项目、实习、竞赛、自评", () => {
  const resume = parseResumeText(SAMPLE_RESUME);
  assert.equal(resume.name, "张三");
  assert.ok(resume.education.includes("内蒙古师范大学"));
  assert.ok(resume.major.includes("计算机"));
  assert.ok(resume.skills.length >= 1);
  // Skills are comma-separated on one line
assert.ok(resume.skills.length >= 1);
  assert.ok(resume.projects.length >= 1, );
  assert.ok(resume.projects.some(p => p.name.includes("在线考试")), "should find online exam project");
  assert.ok(resume.projects.some(p => p.description.includes("40%")), "should find 40% in project desc");
  assert.ok(resume.internships.length >= 1);
  assert.ok(resume.internships.some(i => i.company.includes("字节跳动")));
  assert.ok(resume.competitions.length >= 1);
  assert.ok(resume.selfEval.includes("学习能力"));
});

test("简历隐私脱敏：手机号、邮箱被隐藏", () => {
  const desensitized = desensitizeResume(SAMPLE_RESUME);
  assert.ok(!desensitized.includes("13812345678"));
  assert.ok(!desensitized.includes("zhangsan@example.com"));
  assert.ok(desensitized.includes("[手机号已隐藏]"));
  assert.ok(desensitized.includes("[邮箱已隐藏]"));
});

test("文件大小和类型限制", () => {
  assert.equal(validateResumeFile("resume.pdf", 1024, "application/pdf"), null);
  assert.ok(validateResumeFile("resume.exe", 1024, "application/pdf")?.includes("不支持"));
  assert.ok(validateResumeFile("resume.pdf", 6 * 1024 * 1024, "application/pdf")?.includes("超过"));
  assert.ok(validateResumeFile("resume.pdf", 0, "application/pdf")?.includes("0"));
  assert.equal(validateResumeFile("resume.jpg", 1024, "image/jpeg"), null);
  assert.equal(validateResumeFile("resume.png", 1024, "image/png"), null);
  assert.equal(validateResumeFile("resume.doc", 1024, "application/msword"), null);
  assert.equal(validateResumeFile("resume.md", 1024, "text/markdown"), null);
});

test("结构化摘要生成", () => {
  const resume = parseResumeText(SAMPLE_RESUME);
  const summary = resumeStructuredSummary(resume);
  assert.ok(summary.includes("张三"));
  assert.ok(summary.includes("计算机"));
  assert.ok(summary.includes("Java"));
});

test("空简历处理", () => {
  const resume = parseResumeText("");
  assert.equal(resume.name, "");
  assert.equal(resume.skills.length, 0);
  assert.equal(resume.projects.length, 0);
});
