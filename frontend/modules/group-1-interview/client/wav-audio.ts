export type VoiceFrame = {
  atMs: number;
  durationMs: number;
  rms: number;
};

export type VoiceCaptureStats = {
  sampleRate: number;
  activeSpeechMs: number;
  pauseDurationsMs: number[];
  thinkingBeforeAnswerMs: number;
  volumeSamples: number[];
  averageVolume: number;
  volumeVariance: number;
};

export function mergeFloat32Chunks(chunks: Float32Array[]): Float32Array {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Float32Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

export function resampleMono(input: Float32Array, sourceRate: number, targetRate = 16_000): Float32Array {
  if (!input.length || sourceRate <= 0 || targetRate <= 0) return new Float32Array();
  if (sourceRate === targetRate) return input.slice();
  const outputLength = Math.max(1, Math.round(input.length * targetRate / sourceRate));
  const output = new Float32Array(outputLength);
  const ratio = sourceRate / targetRate;
  for (let i = 0; i < outputLength; i += 1) {
    const position = i * ratio;
    const left = Math.floor(position);
    const right = Math.min(input.length - 1, left + 1);
    const weight = position - left;
    output[i] = input[left] * (1 - weight) + input[right] * weight;
  }
  return output;
}

export function encodePcm16Wav(samples: Float32Array, sampleRate = 16_000): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };
  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (const sample of samples) {
    const value = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, value < 0 ? value * 0x8000 : value * 0x7fff, true);
    offset += 2;
  }
  return buffer;
}

export function analyzeVoiceFrames(frames: VoiceFrame[], sampleRate = 16_000): VoiceCaptureStats {
  const threshold = 0.018;
  const sorted = frames.filter(frame => Number.isFinite(frame.rms) && frame.durationMs > 0);
  const volumeSamples = sorted.map(frame => Math.min(100, Math.round(frame.rms * 400)));
  const speechFrames = sorted.filter(frame => frame.rms >= threshold);
  const firstSpeechAt = speechFrames[0]?.atMs ?? 0;
  const activeSpeechMs = Math.round(speechFrames.reduce((sum, frame) => sum + frame.durationMs, 0));

  const pauseDurationsMs: number[] = [];
  let pauseStart: number | null = null;
  let heardSpeech = false;
  for (const frame of sorted) {
    const speaking = frame.rms >= threshold;
    if (speaking) {
      if (heardSpeech && pauseStart !== null) {
        const pause = frame.atMs - pauseStart;
        if (pause >= 300) pauseDurationsMs.push(Math.round(pause));
      }
      heardSpeech = true;
      pauseStart = null;
    } else if (heardSpeech && pauseStart === null) {
      pauseStart = frame.atMs;
    }
  }

  const averageVolume = volumeSamples.length
    ? Math.round(volumeSamples.reduce((sum, value) => sum + value, 0) / volumeSamples.length)
    : 0;
  const volumeVariance = volumeSamples.length > 1
    ? Math.round(volumeSamples.reduce((sum, value) => sum + (value - averageVolume) ** 2, 0) / volumeSamples.length)
    : 0;

  return {
    sampleRate,
    activeSpeechMs,
    pauseDurationsMs,
    thinkingBeforeAnswerMs: Math.max(0, Math.round(firstSpeechAt)),
    volumeSamples,
    averageVolume,
    volumeVariance,
  };
}
