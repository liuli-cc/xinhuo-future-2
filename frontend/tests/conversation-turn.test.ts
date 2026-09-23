import assert from "node:assert/strict";
import test from "node:test";
import { ResponseGate, combineTurnText, endpointSilenceMs, isLikelyPlaybackEcho } from "../modules/group-1-interview/client/conversation-turn.ts";

test("barge-in aborts pending transport and rejects every stale response", () => {
  const gate = new ResponseGate();
  const old = gate.begin();
  assert.equal(gate.isCurrent(old.id), true);
  gate.cancel();
  assert.equal(old.signal.aborted, true);
  assert.equal(gate.isCurrent(old.id), false);
  const next = gate.begin();
  assert.equal(gate.isCurrent(old.id), false);
  assert.equal(gate.isCurrent(next.id), true);
});

test("unfinished thought gets more space while a completed answer hands over promptly", () => {
  assert.equal(endpointSilenceMs("我完成了接口开发。"), 1500);
  assert.equal(endpointSilenceMs("我觉得，嗯"), 3400);
  assert.equal(endpointSilenceMs("还有。"), 3400);
});

test("speaker echo does not interrupt but an independent short request can", () => {
  assert.equal(isLikelyPlaybackEcho("请介绍你的项目", "好的，请介绍你的项目。"), true);
  assert.equal(isLikelyPlaybackEcho("等一下", "好的，请介绍你的项目。"), false);
  assert.equal(isLikelyPlaybackEcho("嗯", "嗯，请继续。"), false);
});

test("interruption preserves and extends the same candidate answer", () => {
  assert.equal(combineTurnText("我负责接口。", "还有测试。"), "我负责接口。 还有测试。");
  assert.equal(combineTurnText("我负责接口", "我负责接口和测试"), "我负责接口和测试");
});
