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
    "public/liuli-ai-mentor-sprite-v1.png",
    "scripts/serve-sherpa-asr.mjs",
    "scripts/setup-sherpa-asr.mjs",
  ]) assert.ok(existsSync(new URL(relative, root)), `${relative} missing`);

  assert.match(text("app/layout.tsx"), /RouteMotionProvider/);
  assert.match(text("modules/group-2-growth/components/FourYearJourney.tsx"), /journey-river-progress/);
  assert.match(text("modules/shared/api/bmob-api.ts"), /`\/api\/v1\$\{pathname\.slice\(4\)\}`/);
  assert.doesNotMatch(text("modules/shared/api/bmob-api.ts"), /backend_module_not_migrated/);
  assert.doesNotMatch(text("modules/shared/api/bmob-api.ts"), /CloudBase HTTP function/);
});

test("v0.7 release keeps core student workflows and public-source boundaries", () => {
  const packageJson = JSON.parse(text("package.json"));
  const interviewer = text("modules/group-1-interview/components/VirtualInterviewer.tsx");
  const styles = text("app/globals.css");
  const frame = text("modules/shared/components/PortalFrame.tsx");
  const interview = text("app/interview/page.tsx");
  const career = text("modules/group-3-career/components/CareerWorkbench.tsx");
  const decision = text("app/ai/page.tsx");
  const resources = text("app/resources/ResourcesClient.tsx");

  assert.equal(packageJson.version, "0.7.0");
  assert.equal(packageJson.dependencies.three, undefined);
  assert.equal(packageJson.devDependencies["@types/three"], undefined);
  assert.match(packageJson.dependencies["sherpa-onnx-node"], /^\^1\./);
  assert.match(styles, /liuli-ai-mentor-sprite-v1\.png/);
  assert.match(interviewer, /原创 AI 卡通形象 · 非真人/);
  assert.match(styles, /\.mentor-mascot-sprite\.pose-wave/);
  assert.match(styles, /\.mentor-mascot-sprite\.pose-walk/);
  assert.match(styles, /\.mentor-mascot-sprite\.pose-think/);
  assert.match(styles, /\.mentor-mascot-sprite\.pose-happy/);
  assert.doesNotMatch(interviewer, /from "three"/);
  assert.match(frame, /GrowthCommandPalette/);
  assert.match(frame, /apiFetch\("\/api\/health\/ready"/);
  assert.match(career, /\/interview\?applicationId=/);
  assert.match(interview, /get\("applicationId"\)/);
  assert.match(interview, /assistantTranscript=\{currentQuestion\}/);
  assert.match(interview, /无需按键；语义完整或自然停顿后自动继续/);
  assert.match(interview, /sherpa-onnx 本地中文/);
  assert.match(interview, /\/growth-map\?from=interview/);
  assert.match(decision, /linkedGrowthTaskId\("decision"/);
  assert.match(resources, /linkedGrowthTaskId\("resource"/);
  assert.match(resources, /内师公开信息/);
  assert.match(resources, /查看官网原文/);
});

test("IMNU public index contains attributable, on-domain source links only", () => {
  const index = JSON.parse(text("data/imnu-public-index.json"));
  assert.equal(index.schemaVersion, 1);
  assert.equal(index.source.homeUrl, "https://www.imnu.edu.cn/");
  assert.ok(index.items.length > 0);
  assert.ok(index.items.every(item => item.sourceUrl.startsWith("https://www.imnu.edu.cn/")));
  assert.ok(index.items.every(item => item.title && item.section && item.sourceHost === "www.imnu.edu.cn"));
});
