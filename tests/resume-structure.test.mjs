import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";

const require = createRequire(import.meta.url);
const { parseResumeStructure } = require("../functions/xinhuo-api/resume-structure.js");

test("结构化解析不会把后续栏目串入当前字段", () => {
  const text = fs.readFileSync(new URL("./fixtures/e2e-resume.txt", import.meta.url), "utf8");
  const resume = parseResumeStructure(text);

  assert.equal(resume.name, "测试同学");
  assert.equal(resume.education, "本科");
  assert.equal(resume.major, "计算机科学与技术");
  assert.deepEqual(resume.skills, ["Python", "TypeScript", "数据分析"]);
  assert.equal(resume.projects.length, 1);
  assert.equal(resume.internships.length, 1);
  assert.equal(typeof resume.internships[0].company, "string");
  assert.equal(typeof resume.internships[0].role, "string");
  assert.equal(resume.competitions.length, 1);
  assert.equal(typeof resume.competitions[0].award, "string");
  assert.match(resume.selfEval, /学习主动/);
});

test("能从常见的独立章节和单行教育经历中提取完整字段", () => {
  const resume = parseResumeStructure(`
李明

教育背景 EDUCATION
2021.09 - 2025.06 内蒙古师范大学 软件工程 本科

专业技能
JavaScript、React、Node.js

项目经验
2023.03 - 2023.12 校园招聘平台
项目描述：面向毕业生提供岗位检索与智能推荐
技术栈：React、Node.js、PostgreSQL

实习经验
2024.07 - 2024.10 北京星火科技有限公司 前端开发实习生
工作内容：负责招聘后台页面开发和接口联调

荣誉奖项
2024 全国大学生计算机设计大赛 省级二等奖
  `);

  assert.equal(resume.name, "李明");
  assert.equal(resume.education, "本科");
  assert.equal(resume.major, "软件工程");
  assert.deepEqual(resume.skills, ["JavaScript", "React", "Node.js"]);
  assert.equal(resume.projects.length, 1);
  assert.match(resume.projects[0].name, /校园招聘平台/);
  assert.match(resume.projects[0].description, /智能推荐/);
  assert.equal(resume.internships.length, 1);
  assert.match(resume.internships[0].company, /北京星火科技有限公司/);
  assert.equal(resume.internships[0].role, "前端开发实习生");
  assert.match(resume.internships[0].description, /接口联调/);
  assert.equal(resume.competitions.length, 1);
  assert.match(resume.competitions[0].name, /计算机设计大赛/);
  assert.equal(resume.competitions[0].award, "省级二等奖");
});

test("兼容控制字符、分隔符标签和中英文章节标题", () => {
  const resume = parseResumeStructure(`
基本信息
姓名：王芳\u0001 | 学历：硕士研究生 | 专业名称：人工智能

TECHNICAL SKILLS
Python, PyTorch, 机器学习

PROJECT EXPERIENCE
智能问答系统
负责检索增强生成模块，实现知识库问答

WORK EXPERIENCE
某科技有限公司 | 算法工程师
负责文本分类模型训练与部署

AWARDS AND HONORS
中国国际大学生创新大赛：国家级铜奖
  `);

  assert.equal(resume.name, "王芳");
  assert.equal(resume.education, "硕士研究生");
  assert.equal(resume.major, "人工智能");
  assert.deepEqual(resume.skills, ["Python", "PyTorch", "机器学习"]);
  assert.match(resume.projects[0].name, /智能问答系统/);
  assert.match(resume.projects[0].description, /知识库问答/);
  assert.match(resume.internships[0].company, /某科技有限公司/);
  assert.equal(resume.internships[0].role, "算法工程师");
  assert.match(resume.competitions[0].name, /中国国际大学生创新大赛/);
  assert.equal(resume.competitions[0].award, "国家级铜奖");
});

test("兼容 PDF 常见的专业学历同行与竞赛荣誉组合标题", () => {
  const resume = parseResumeStructure(`
教育背景
有价职大学 2021.9-2024.7
计算机科学与技术 硕士研究生 计算机学院

六、竞赛与荣誉经历
2024年 全国大学生数学建模竞赛 省级二等奖：负责数据处理与模型搭建
2023年 校内算法竞赛 校级优秀奖：负责代码实现
  `);

  assert.equal(resume.education, "硕士研究生");
  assert.equal(resume.major, "计算机科学与技术");
  assert.equal(resume.competitions.length, 2);
  assert.match(resume.competitions[0].name, /数学建模竞赛/);
});

test("兼容 OCR 在中文字符之间插入空格的结果", () => {
  const resume = parseResumeStructure(`
姓 名 ： 李 华
教 育 背 景
东 北 大 学
计 算 机 科 学 与 技 术 本 科

专 业 技 能
Python、React、数 据 分 析

项 目 经 历
校 园 招 聘 平 台
负 责 前 端 开 发 与 接 口 联 调

竞 赛 与 荣 誉 经 历
全 国 大 学 生 计 算 机 设 计 大 赛 省 级 二 等 奖
  `);

  assert.equal(resume.name, "李华");
  assert.equal(resume.education, "本科");
  assert.equal(resume.major, "计算机科学与技术");
  assert.deepEqual(resume.skills, ["Python", "React", "数据分析"]);
  assert.equal(resume.projects.length, 1);
  assert.equal(resume.competitions.length, 1);
});

test("从教育背景内嵌的所获奖项和自评软件清单补全 OCR 字段", () => {
  const resume = parseResumeStructure(`
张小明
求职岗位：财务专员

教育背景
内蒙古有价职大学 数学与应用数学 | 本科 2019.09-2023.06
主修课程：微观经济学、宏观经济学、统计学、会计学等。
所获奖项：校级优秀学生干部、校级社会实践奖学金、第八届互联网+创新创业大赛优秀奖、校级
优秀学生标兵、校心理剧大赛三等奖。

自我评价
拥有财务相关实习经历，熟悉掌握 Word、PowerPoint、Excel、Photoshop、Xmind 等软件；
  `);

  assert.equal(resume.major, "数学与应用数学");
  assert.deepEqual(resume.skills, ["Word", "PowerPoint", "Excel", "Photoshop", "Xmind"]);
  assert.ok(resume.competitions.some(entry => (
    /互联网\+创新创业大赛/.test(entry.name) && entry.award === "优秀奖"
  )));
  assert.ok(resume.competitions.some(entry => (
    /心理剧大赛/.test(entry.name) && entry.award === "三等奖"
  )));
});
