import assert from "node:assert/strict";
import test from "node:test";
import { establishRealtimePeer, interruptionEvents, parseRealtimeEvent, RealtimeTranscript } from "../modules/group-1-interview/client/native-realtime.ts";
import { mergeInterviewApplications } from "../modules/group-1-interview/client/interview-applications.ts";

test("ASR completion can arrive after the next question without changing its original question or order", () => {
  const log = new RealtimeTranscript();
  log.apply({ type: "response.output_audio_transcript.done", item_id: "a1", transcript: "你负责什么？" });
  log.apply({ type: "input_audio_buffer.speech_started", item_id: "u1" });
  log.apply({ type: "response.output_audio_transcript.done", item_id: "a2", transcript: "怎样验证？" });
  log.apply({ type: "input_audio_buffer.speech_started", item_id: "u2" });
  log.apply({ type: "conversation.item.input_audio_transcription.completed", item_id: "u2", transcript: "用测试验证。" });
  const first = log.apply({ type: "conversation.item.input_audio_transcription.completed", item_id: "u1", transcript: "我负责接口。" });
  assert.equal(first?.question, "你负责什么？");
  assert.deepEqual(log.snapshot().map(item => item.id), ["a1", "u1", "a2", "u2"]);
  assert.equal(log.apply({ type: "conversation.item.input_audio_transcription.completed", item_id: "u1", transcript: "重复包" }), null);
  assert.equal(log.hasPendingCandidate(), false);
});

test("partial assistant text remains marked interrupted and never becomes a candidate answer", () => {
  const log = new RealtimeTranscript();
  log.apply({ type: "response.output_audio_transcript.delta", item_id: "a1", delta: "请解释" });
  log.apply({ type: "conversation.item.truncated", item_id: "a1" });
  assert.equal(log.snapshot()[0].interrupted, true);
  assert.equal(log.snapshot()[0].speaker, "interviewer");
  assert.deepEqual(interruptionEvents(true).map(event => event.type), ["response.cancel", "output_audio_buffer.clear"]);
  assert.deepEqual(interruptionEvents(false).map(event => event.type), ["output_audio_buffer.clear"]);
  assert.equal(parseRealtimeEvent("not-json"), null);
});

test("negotiation sends SDP through app server, applies answer and has no provider key", async () => {
  const calls: string[] = [];
  const peer = {
    iceGatheringState: "complete", localDescription: { sdp: "v=0\no=local" },
    async createOffer() { calls.push("offer"); return { type: "offer", sdp: "v=0\no=local" }; },
    async setLocalDescription() { calls.push("local"); },
    async setRemoteDescription(value: { sdp: string }) { assert.equal(value.sdp, "v=0\no=remote"); calls.push("remote"); },
  } as unknown as RTCPeerConnection;
  const response = await establishRealtimePeer(peer, async sdp => {
    assert.equal(sdp, "v=0\no=local"); calls.push("server");
    return { sdp: "v=0\no=remote", callToken: "signed-owner-token", model: "test", maxSeconds: 900 };
  }, new AbortController().signal);
  assert.deepEqual(calls, ["offer", "local", "server", "remote"]);
  assert.equal("apiKey" in response, false);
});

test("cancelled negotiation cannot install a late remote description", async () => {
  const abort = new AbortController();
  let remote = false;
  const peer = { iceGatheringState: "complete", localDescription: { sdp: "v=0" },
    async createOffer() { return {}; }, async setLocalDescription() {}, async setRemoteDescription() { remote = true; },
  } as unknown as RTCPeerConnection;
  await assert.rejects(establishRealtimePeer(peer, async () => {
    abort.abort(); return { sdp: "v=0", callToken: "signed", model: "test", maxSeconds: 900 };
  }, abort.signal), { name: "AbortError" });
  assert.equal(remote, false);
});

test("new recruitment submissions retain their source and fill missing job snapshot from actual live data", () => {
  const rows = mergeInterviewApplications([{ id: "same", title: "旧岗位", company: "A", status: "投递" }],
    [{ id: "same", enterpriseName: "B", status: "新投递", job: { id: "j1", title: "React 实习" } }],
    [{ id: "j1", description: "真实岗位职责", requirements: "真实技能要求" }]);
  assert.notEqual(rows[0].id, rows[1].id);
  assert.equal(rows[0].source, "recruitment");
  assert.equal(rows[0].description, "真实岗位职责\n真实技能要求");
  assert.equal(rows[1].source, "career");
});
