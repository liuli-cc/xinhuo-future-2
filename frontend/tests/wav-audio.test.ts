import test from "node:test";
import assert from "node:assert/strict";
import { analyzeVoiceFrames, encodePcm16Wav, mergeFloat32Chunks, resampleMono } from "../lib/wav-audio.ts";

test("merges, resamples and emits a valid 16 kHz PCM WAV", () => {
  const merged = mergeFloat32Chunks([
    new Float32Array([0, 0.5]),
    new Float32Array([-0.5, 0]),
  ]);
  assert.deepEqual(Array.from(merged), [0, 0.5, -0.5, 0]);

  const source = new Float32Array(48_000).map((_, index) => Math.sin(index / 20) * 0.2);
  const samples = resampleMono(source, 48_000, 16_000);
  assert.equal(samples.length, 16_000);

  const wav = encodePcm16Wav(samples, 16_000);
  const view = new DataView(wav);
  assert.equal(Buffer.from(wav, 0, 4).toString("ascii"), "RIFF");
  assert.equal(Buffer.from(wav, 8, 4).toString("ascii"), "WAVE");
  assert.equal(view.getUint32(24, true), 16_000);
  assert.equal(view.getUint16(22, true), 1);
  assert.equal(view.getUint16(34, true), 16);
});

test("derives real thinking, speech, pause and volume statistics", () => {
  const frames = [
    { atMs: 0, durationMs: 100, rms: 0.002 },
    { atMs: 100, durationMs: 100, rms: 0.002 },
    { atMs: 200, durationMs: 100, rms: 0.04 },
    { atMs: 300, durationMs: 100, rms: 0.05 },
    { atMs: 400, durationMs: 100, rms: 0.002 },
    { atMs: 500, durationMs: 100, rms: 0.002 },
    { atMs: 600, durationMs: 100, rms: 0.002 },
    { atMs: 700, durationMs: 100, rms: 0.04 },
  ];
  const stats = analyzeVoiceFrames(frames);
  assert.equal(stats.thinkingBeforeAnswerMs, 200);
  assert.equal(stats.activeSpeechMs, 300);
  assert.deepEqual(stats.pauseDurationsMs, [300]);
  assert.ok(stats.averageVolume > 0);
  assert.ok(stats.volumeVariance >= 0);
});
