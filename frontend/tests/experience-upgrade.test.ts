import assert from "node:assert/strict";
import { test } from "node:test";
import { currentSemesterForGrade, linkedGrowthTaskId } from "../modules/shared/growth/semester.ts";

test("current semester is shared and bounded to the four-year journey", () => {
  assert.equal(currentSemesterForGrade("2025级", new Date("2025-10-01T00:00:00+08:00")), 0);
  assert.equal(currentSemesterForGrade("2025级", new Date("2026-03-01T00:00:00+08:00")), 1);
  assert.equal(currentSemesterForGrade("2021级", new Date("2026-10-01T00:00:00+08:00")), 7);
  assert.equal(currentSemesterForGrade("", new Date("2026-03-01T00:00:00+08:00")), 0);
});

test("linked task ids are stable, scoped and accepted by the custom-task contract", () => {
  const first = linkedGrowthTaskId("decision", "exploration-职业准备", 3);
  const repeated = linkedGrowthTaskId("decision", "exploration-职业准备", 3);
  const other = linkedGrowthTaskId("resource", "exploration-职业准备", 3);

  assert.equal(first, repeated);
  assert.notEqual(first, other);
  assert.match(first, /^custom-3-decision-[a-z0-9]+$/);
  assert.ok(first.length <= 80);
});
