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
    "modules/shared/motion/RouteMotionProvider.tsx",
  ]) assert.ok(existsSync(new URL(relative, root)), `${relative} missing`);

  assert.match(text("app/layout.tsx"), /RouteMotionProvider/);
  assert.match(text("modules/group-2-growth/components/FourYearJourney.tsx"), /journey-river-progress/);
  assert.match(text("modules/shared/api/bmob-api.ts"), /`\/api\/v1\$\{pathname\.slice\(4\)\}`/);
  assert.doesNotMatch(text("modules/shared/api/bmob-api.ts"), /backend_module_not_migrated/);
  assert.doesNotMatch(text("modules/shared/api/bmob-api.ts"), /CloudBase HTTP function/);
});
