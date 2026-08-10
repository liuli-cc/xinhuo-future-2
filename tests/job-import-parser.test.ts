import assert from "node:assert/strict";
import test from "node:test";
import { parsePastedJob } from "../lib/job-import-parser.ts";

test("只解析学生粘贴的 BOSS 岗位内容，不访问外部链接", () => {
  const draft = parsePastedJob({
    sourceUrl: "https://www.zhipin.com/job_detail/example.html",
    text: "Java后端开发实习生\n招聘企业：薪火科技有限公司\n工作地点：呼和浩特\n薪资：200-300元/天\n岗位职责：协助完成 Java 服务端接口开发、单元测试与文档整理。\n任职要求：熟悉 Java、MySQL 与 Git，每周至少到岗四天。",
  });

  assert.equal(draft.title, "Java后端开发实习生");
  assert.equal(draft.company, "薪火科技有限公司");
  assert.equal(draft.city, "呼和浩特");
  assert.equal(draft.salary, "200-300元/天");
  assert.equal(draft.employmentType, "实习");
  assert.equal(draft.sourceName, "BOSS直聘（学生主动导入）");
  assert.equal(draft.confidence, 100);
  assert.deepEqual(draft.missing, []);
});

test("缺失信息会明确返回，保留给学生人工核对", () => {
  const draft = parsePastedJob({
    text: "数据分析实习生\n岗位职责：协助数据清洗、可视化与周报整理，熟悉 Excel 和 SQL。",
  });

  assert.equal(draft.title, "数据分析实习生");
  assert.ok(draft.missing.includes("公司/单位"));
  assert.ok(draft.missing.includes("城市"));
  assert.ok(draft.missing.includes("薪资"));
  assert.equal(draft.sourceName, "学生主动导入");
});
