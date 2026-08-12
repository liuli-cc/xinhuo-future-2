import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const root = new URL("..", import.meta.url);
const text = relative => readFileSync(new URL(relative, root), "utf8");

test("growth-river frontend keeps its modular shell and explicit FastAPI boundary", () => {
  for (const relative of [
    "app/xinhuo-redesign.css",
    "app/error.tsx",
    "app/loading.tsx",
    "app/not-found.tsx",
    "modules/group-2-growth/components/FourYearJourney.tsx",
    "modules/shared/components/PortalFrame.tsx",
    "modules/shared/components/GrowthCommandPalette.tsx",
    "modules/shared/growth/semester.ts",
    "modules/shared/motion/RouteMotionProvider.tsx",
    "public/liuli-mentor-v2.jpg",
  ]) assert.ok(existsSync(new URL(relative, root)), `${relative} missing`);

  assert.match(text("app/layout.tsx"), /RouteMotionProvider/);
  assert.match(text("modules/group-2-growth/components/FourYearJourney.tsx"), /journey-river-progress/);
  assert.match(text("modules/shared/api/bmob-api.ts"), /`\/api\/v1\$\{pathname\.slice\(4\)\}`/);
  assert.doesNotMatch(text("modules/shared/api/bmob-api.ts"), /backend_module_not_migrated/);
  assert.doesNotMatch(text("modules/shared/api/bmob-api.ts"), /CloudBase HTTP function/);
});

test("v0.6 experience upgrade links core student workflows without changing backend contracts", () => {
  const packageJson = JSON.parse(text("package.json"));
  const interviewer = text("modules/group-1-interview/components/VirtualInterviewer.tsx");
  const frame = text("modules/shared/components/PortalFrame.tsx");
  const interview = text("app/interview/page.tsx");
  const career = text("modules/group-3-career/components/CareerWorkbench.tsx");
  const decision = text("app/ai/page.tsx");
  const resources = text("app/resources/ResourcesClient.tsx");

  assert.equal(packageJson.version, "0.6.0");
  assert.equal(packageJson.dependencies.three, undefined);
  assert.equal(packageJson.devDependencies["@types/three"], undefined);
  assert.match(interviewer, /liuli-mentor-v2\.jpg/);
  assert.match(interviewer, /AI 虚拟形象 · 非真人/);
  assert.doesNotMatch(interviewer, /from "three"/);
  assert.match(frame, /GrowthCommandPalette/);
  assert.match(frame, /apiFetch\("\/api\/health\/ready"/);
  assert.match(career, /\/interview\?applicationId=/);
  assert.match(interview, /get\("applicationId"\)/);
  assert.match(interview, /\/growth-map\?from=interview/);
  assert.match(decision, /linkedGrowthTaskId\("decision"/);
  assert.match(resources, /linkedGrowthTaskId\("resource"/);
});
