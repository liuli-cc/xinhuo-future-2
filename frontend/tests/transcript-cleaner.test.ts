import assert from "node:assert/strict";
import { test } from "node:test";
import {
  appendTranscriptSegment,
  cleanInterviewTranscript,
  isLikelyAssistantEcho,
  selectContextualAlternative,
} from "../modules/group-1-interview/client/transcript-cleaner.ts";
import {
  endpointDelayMs,
  float32ToPcm16,
  parseFunAsrMessage,
  parseSherpaOnnxMessage,
  parseSoulXTurnMessage,
  resampleTo16Khz,
} from "../modules/group-1-interview/client/streaming-speech.ts";

test("conservatively removes hesitation and duplicate filler words", () => {
  const result = cleanInterviewTranscript("嗯，那个那个，我我负责了这个项目，然后然后最终完成交付。");
  assert.equal(result.cleaned, "那个，我负责了这个项目，然后最终完成交付。");
  assert.ok(result.removedFillers.length >= 3);
  assert.equal(result.raw.includes("嗯"), true);
});

test("keeps meaningful short answers when cleanup would erase content", () => {
  const result = cleanInterviewTranscript("其实");
  assert.equal(result.cleaned, "其实");
});

test("selects a lower-ranked homophone alternative when it contains interview hotwords", () => {
  const selected = selectContextualAlternative([
    { transcript: "我负责数据治里", confidence: 0.89 },
    { transcript: "我负责数据治理", confidence: 0.82 },
  ], ["数据治理"]);
  assert.equal(selected, "我负责数据治理");
});

test("incremental transcript merge removes overlapping streaming text", () => {
  assert.equal(appendTranscriptSegment("我负责数据", "数据治理项目"), "我负责数据治理项目");
});

test("filters assistant loudspeaker echo without discarding a real interruption", () => {
  const question = "请你结合申请的岗位方向，介绍一段最有代表性的项目经历。";
  assert.equal(isLikelyAssistantEcho("介绍一段最有代表性的项目经历", question), true);
  assert.equal(isLikelyAssistantEcho("我想先补充一下，这个项目是我独立负责的", question), false);
});

test("streaming helpers parse provider messages and convert audio", () => {
  assert.equal(parseFunAsrMessage('{"mode":"2pass-online","text":"你好"}')?.text, "你好");
  assert.equal(parseSoulXTurnMessage('{"type":"turn_state","state":{"state":"speak","text":"完成"}}')?.state?.state, "speak");
  assert.equal(parseSoulXTurnMessage('{"type":"other"}'), null);
  assert.equal(parseSherpaOnnxMessage('{"text":"本地识别","is_final":true}')?.is_final, true);
  const resampled = resampleTo16Khz(new Float32Array(480), 48_000);
  assert.equal(resampled.length, 160);
  assert.deepEqual([...float32ToPcm16(new Float32Array([-1, 0, 1]))], [-32768, 0, 32767]);
});

test("semantic endpoint timing is faster after a complete Chinese sentence", () => {
  assert.equal(endpointDelayMs("我通过拆分任务按时完成了项目。", 3_000), 900);
  assert.equal(endpointDelayMs("我还在想", 3_000), 3_000);
});
