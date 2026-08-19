export type RealtimeAsrProvider = "soulx-duplug" | "funasr" | "sherpa-onnx" | "browser" | "unavailable";

export type FunAsrMessage = {
  text?: string;
  mode?: "online" | "offline" | "2pass-online" | "2pass-offline" | string;
  is_final?: boolean;
  is_end?: boolean;
  error?: string;
};

export type SoulXTurnMessage = {
  type?: string;
  state?: {
    state?: "idle" | "nonidle" | "speak" | "blank";
    text?: string;
    asr_segment?: string;
    asr_buffer?: string;
  };
};

export type SherpaOnnxMessage = {
  text?: string;
  is_final?: boolean;
  error?: string;
};

export const FUNASR_WS_URL = process.env.NEXT_PUBLIC_FUNASR_WS_URL?.trim() ?? "";
export const SOULX_DUPLEX_WS_URL = process.env.NEXT_PUBLIC_SOULX_DUPLEX_WS_URL?.trim() ?? "";
export const SHERPA_ONNX_WS_URL = process.env.NEXT_PUBLIC_SHERPA_ONNX_WS_URL?.trim() ?? "";

export function chooseRealtimeAsrProvider(browserSupported: boolean): RealtimeAsrProvider {
  if (SOULX_DUPLEX_WS_URL) return "soulx-duplug";
  if (FUNASR_WS_URL) return "funasr";
  if (SHERPA_ONNX_WS_URL) return "sherpa-onnx";
  return browserSupported ? "browser" : "unavailable";
}

export function buildFunAsrHandshake(contextualKeywords: string[]) {
  const hotwords = Object.fromEntries(
    contextualKeywords
      .map(item => item.trim())
      .filter(item => item.length >= 2)
      .slice(0, 40)
      .map(item => [item, 20]),
  );
  return {
    mode: "2pass",
    chunk_size: [5, 10, 5],
    chunk_interval: 10,
    encoder_chunk_look_back: 4,
    decoder_chunk_look_back: 0,
    audio_fs: 16_000,
    wav_format: "pcm",
    wav_name: `xinhuo-${crypto.randomUUID()}`,
    is_speaking: true,
    hotwords: JSON.stringify(hotwords),
    itn: true,
  };
}

export function parseFunAsrMessage(value: string): FunAsrMessage | null {
  try {
    const message = JSON.parse(value) as FunAsrMessage;
    return message && typeof message === "object" ? message : null;
  } catch {
    return null;
  }
}

export function parseSoulXTurnMessage(value: string): SoulXTurnMessage | null {
  try {
    const message = JSON.parse(value) as SoulXTurnMessage;
    return message?.type === "turn_state" && message.state ? message : null;
  } catch {
    return null;
  }
}

export function parseSherpaOnnxMessage(value: string): SherpaOnnxMessage | null {
  try {
    const message = JSON.parse(value) as SherpaOnnxMessage;
    return message && typeof message === "object" ? message : null;
  } catch {
    return null;
  }
}

export function resampleTo16Khz(input: Float32Array, inputSampleRate: number) {
  if (inputSampleRate === 16_000) return new Float32Array(input);
  const ratio = inputSampleRate / 16_000;
  const outputLength = Math.max(1, Math.round(input.length / ratio));
  const output = new Float32Array(outputLength);
  for (let index = 0; index < outputLength; index += 1) {
    const sourceIndex = index * ratio;
    const left = Math.floor(sourceIndex);
    const right = Math.min(input.length - 1, left + 1);
    const mix = sourceIndex - left;
    output[index] = input[left] * (1 - mix) + input[right] * mix;
  }
  return output;
}

export function float32ToPcm16(input: Float32Array) {
  const pcm = new Int16Array(input.length);
  for (let index = 0; index < input.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, input[index]));
    pcm[index] = sample < 0 ? Math.round(sample * 0x8000) : Math.round(sample * 0x7fff);
  }
  return pcm;
}

export function float32ToBase64(input: Float32Array) {
  const bytes = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  let binary = "";
  const stride = 0x8000;
  for (let index = 0; index < bytes.length; index += stride) {
    binary += String.fromCharCode(...bytes.subarray(index, index + stride));
  }
  return btoa(binary);
}

export function soulXAudioPayload(sessionId: string, audio: Float32Array) {
  return JSON.stringify({
    type: "audio",
    session_id: sessionId,
    audio: float32ToBase64(audio),
  });
}

export function endpointDelayMs(text: string, fallbackMs: number) {
  const compact = text.replace(/\s/g, "");
  if (compact.length >= 12 && /[。！？!?]$/.test(compact)) return 900;
  if (compact.length >= 28) return 1_500;
  return Math.max(1_800, fallbackMs);
}
