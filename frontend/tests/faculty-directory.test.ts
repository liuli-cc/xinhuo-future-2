import test from "node:test";
import assert from "node:assert/strict";
import { imnuAiFacultySnapshot } from "../data/imnu-ai-faculty.ts";

test("人工智能学院师资快照人数和导师层级完整", () => {
  const faculty = imnuAiFacultySnapshot.faculty;
  assert.equal(faculty.length, 30);
  assert.equal(new Set(faculty.map(item => item.id)).size, 30);
  assert.equal(new Set(faculty.map(item => item.name)).size, 30);
  assert.equal(faculty.filter(item => item.mentorLevel === "博士研究生导师").length, 5);
  assert.equal(faculty.filter(item => item.mentorLevel === "硕士研究生导师").length, 15);
  assert.equal(faculty.filter(item => item.mentorLevel === "教师").length, 10);
});

test("每位教师都有研究方向和官网详情页", () => {
  for (const teacher of imnuAiFacultySnapshot.faculty) {
    assert.ok(teacher.name.trim());
    assert.ok(teacher.researchAreas.length > 0, `${teacher.name} 缺少研究方向`);
    assert.match(teacher.profileUrl, /^https:\/\/sai\.imnu\.edu\.cn\/info\/1081\/\d+\.htm$/);
  }
});
