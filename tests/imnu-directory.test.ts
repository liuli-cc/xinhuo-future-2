import assert from "node:assert/strict";
import test from "node:test";
import snapshot from "../data/imnu-faculty-snapshot.json" with { type: "json" };
import { imnuAiFacultySnapshot } from "../data/imnu-ai-faculty.ts";
import { canonicalImnuCollege, imnuCollegeNames, isOfficialImnuCollege } from "../data/imnu-colleges.ts";

test("IMNU official college list is complete and registration-safe", () => {
  assert.equal(imnuCollegeNames.length, 29);
  assert.equal(new Set(imnuCollegeNames).size, 29);
  assert.equal(isOfficialImnuCollege("人工智能学院"), true);
  assert.equal(isOfficialImnuCollege("不存在的学院"), false);
  assert.equal(canonicalImnuCollege("计算机科学与技术学院"), "计算机科学技术学院");
});

test("each official college has an auditable faculty-directory state", () => {
  assert.equal(snapshot.colleges.length, imnuCollegeNames.length);
  assert.deepEqual(snapshot.colleges.map(item => item.name), imnuCollegeNames);
  assert.ok(snapshot.colleges.every(item => item.sourceStatus && item.sourceNote));
  assert.equal(snapshot.colleges.reduce((total, item) => total + item.faculty.length, 0), 176);
  assert.ok(imnuAiFacultySnapshot.faculty.length >= 29);
  assert.ok(imnuAiFacultySnapshot.faculty.some(item => item.name === "焦李成" && item.mentorLevel === "博士研究生导师"));
});
