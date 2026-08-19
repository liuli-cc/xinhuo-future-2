"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { analyzeVoiceFrames, type VoiceCaptureStats, type VoiceFrame } from "@/modules/group-1-interview/client/wav-audio";
import {
  appendTranscriptSegment,
  isLikelyAssistantEcho,
  selectContextualAlternative,
} from "@/modules/group-1-interview/client/transcript-cleaner";
import {
  buildFunAsrHandshake,
  chooseRealtimeAsrProvider,
  endpointDelayMs,
  float32ToPcm16,
  FUNASR_WS_URL,
  parseFunAsrMessage,
  parseSherpaOnnxMessage,
  parseSoulXTurnMessage,
  resampleTo16Khz,
  SOULX_DUPLEX_WS_URL,
  SHERPA_ONNX_WS_URL,
  soulXAudioPayload,
  type RealtimeAsrProvider,
} from "@/modules/group-1-interview/client/streaming-speech";

type RecognitionAlternative = { transcript: string; confidence: number };
type RecognitionResult = { isFinal: boolean; length: number; [index: number]: RecognitionAlternative };
type RecognitionEventLike = Event & {
  resultIndex: number;
  results: { length: number; [index: number]: RecognitionResult };
};
type RecognitionErrorEventLike = Event & { error: string; message?: string };
type SpeechRecognitionLike = EventTarget & {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: ((event: Event) => void) | null;
  onaudiostart: ((event: Event) => void) | null;
  onspeechstart: ((event: Event) => void) | null;
  onresult: ((event: RecognitionEventLike) => void) | null;
  onspeechend: ((event: Event) => void) | null;
  onaudioend: ((event: Event) => void) | null;
  onerror: ((event: RecognitionErrorEventLike) => void) | null;
  onend: ((event: Event) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export type LiveSpeechStatus = "idle" | "starting" | "listening" | "hearing" | "finalizing" | "unsupported" | "error";

interface ContinuousSpeechRecognitionProps {
  active: boolean;
  turnKey: number;
  disabled?: boolean;
  assistantSpeaking?: boolean;
  assistantTranscript?: string;
  contextualKeywords?: string[];
  maxDurationMs?: number;
  silenceMs?: number;
  onInterimChange?: (text: string) => void;
  onAudioLevel?: (level: number) => void;
  onStatusChange?: (status: LiveSpeechStatus) => void;
  onProviderChange?: (provider: RealtimeAsrProvider) => void;
  onBargeIn?: () => void;
  onComplete: (text: string, durationMs: number, stats: VoiceCaptureStats) => void;
  onError: (message: string) => void;
}

const SOULX_CHUNK_SAMPLES = 2_560;

const recognitionErrorMessage = (error: string) => {
  if (error === "not-allowed" || error === "service-not-allowed") {
    return "麦克风或语音识别权限被拒绝。请在 Chrome 地址栏左侧允许麦克风后刷新页面。";
  }
  if (error === "audio-capture") return "没有检测到可用麦克风，请检查系统声音输入设备。";
  if (error === "network") return "浏览器语音服务暂时无法联网，请检查网络后重试。";
  if (error === "language-not-supported") return "当前浏览器不支持中文语音识别，请使用桌面版 Chrome。";
  return "实时语音识别暂时中断，已保留文字输入方式。";
};

export function supportsBrowserSpeechRecognition() {
  if (typeof window === "undefined") return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function supportsRealtimeSpeechRecognition() {
  return chooseRealtimeAsrProvider(supportsBrowserSpeechRecognition()) !== "unavailable";
}

export default function ContinuousSpeechRecognition({
  active,
  turnKey,
  disabled = false,
  assistantSpeaking = false,
  assistantTranscript = "",
  contextualKeywords = [],
  maxDurationMs = 90_000,
  silenceMs = 2_400,
  onInterimChange,
  onAudioLevel,
  onStatusChange,
  onProviderChange,
  onBargeIn,
  onComplete,
  onError,
}: ContinuousSpeechRecognitionProps) {
  const [status, setStatus] = useState<LiveSpeechStatus>("idle");
  const [interim, setInterim] = useState("");
  const [provider, setProvider] = useState<RealtimeAsrProvider>("unavailable");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const websocketRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const muteGainRef = useRef<GainNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const providerFinalizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const desiredActiveRef = useRef(false);
  const completedRef = useRef(false);
  const finalizingRef = useRef(false);
  const restartRecognitionRef = useRef<() => void>(() => {});
  const finalTextRef = useRef("");
  const interimTextRef = useRef("");
  const onlineTextRef = useRef("");
  const startedAtRef = useRef(0);
  const framesRef = useRef<VoiceFrame[]>([]);
  const providerRef = useRef<RealtimeAsrProvider>("unavailable");
  const audioSinkRef = useRef<(audio: Float32Array) => void>(() => {});
  const soulXBufferRef = useRef<Float32Array>(new Float32Array(0));
  const soulXSessionRef = useRef("");
  const noiseFloorRef = useRef(0.004);
  const voiceFramesRef = useRef(0);
  const heardSpeechRef = useRef(false);
  const lastVoiceAtRef = useRef(0);
  const bargeInSentRef = useRef(false);
  const assistantSpeakingRef = useRef(assistantSpeaking);
  const assistantTranscriptRef = useRef(assistantTranscript);
  const statusRef = useRef<LiveSpeechStatus>("idle");
  const callbacksRef = useRef({
    onInterimChange,
    onAudioLevel,
    onStatusChange,
    onProviderChange,
    onBargeIn,
    onComplete,
    onError,
  });

  useEffect(() => {
    callbacksRef.current = {
      onInterimChange,
      onAudioLevel,
      onStatusChange,
      onProviderChange,
      onBargeIn,
      onComplete,
      onError,
    };
  }, [onAudioLevel, onBargeIn, onComplete, onError, onInterimChange, onProviderChange, onStatusChange]);

  useEffect(() => {
    assistantSpeakingRef.current = assistantSpeaking;
    assistantTranscriptRef.current = assistantTranscript;
    if (!assistantSpeaking) bargeInSentRef.current = false;
  }, [assistantSpeaking, assistantTranscript]);

  const updateStatus = useCallback((next: LiveSpeechStatus) => {
    if (statusRef.current === next) return;
    statusRef.current = next;
    setStatus(next);
    callbacksRef.current.onStatusChange?.(next);
  }, []);

  const updateProvider = useCallback((next: RealtimeAsrProvider) => {
    providerRef.current = next;
    setProvider(next);
    callbacksRef.current.onProviderChange?.(next);
  }, []);

  const emitTranscript = useCallback(() => {
    const combined = `${finalTextRef.current}${onlineTextRef.current || interimTextRef.current}`.replace(/\s+/g, " ").trim();
    setInterim(combined);
    callbacksRef.current.onInterimChange?.(combined);
    return combined;
  }, []);

  const signalBargeIn = useCallback(() => {
    if (!assistantSpeakingRef.current || bargeInSentRef.current) return;
    bargeInSentRef.current = true;
    callbacksRef.current.onBargeIn?.();
  }, []);

  const clearTimers = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    if (connectionTimerRef.current) clearTimeout(connectionTimerRef.current);
    if (providerFinalizeTimerRef.current) clearTimeout(providerFinalizeTimerRef.current);
    silenceTimerRef.current = null;
    maxTimerRef.current = null;
    restartTimerRef.current = null;
    connectionTimerRef.current = null;
    providerFinalizeTimerRef.current = null;
  }, []);

  const closeWebsocket = useCallback(() => {
    audioSinkRef.current = () => {};
    const socket = websocketRef.current;
    websocketRef.current = null;
    if (!socket) return;
    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) socket.close();
  }, []);

  const releaseMeter = useCallback(async () => {
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
    processorRef.current?.disconnect();
    muteGainRef.current?.disconnect();
    analyserRef.current?.disconnect();
    sourceRef.current?.disconnect();
    processorRef.current = null;
    muteGainRef.current = null;
    analyserRef.current = null;
    sourceRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    const context = contextRef.current;
    contextRef.current = null;
    if (context && context.state !== "closed") await context.close().catch(() => {});
    callbacksRef.current.onAudioLevel?.(0);
  }, []);

  const stopRecognition = useCallback((abort = false) => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (!recognition) return;
    recognition.onend = null;
    recognition.onerror = null;
    try {
      if (abort) recognition.abort();
      else recognition.stop();
    } catch {}
  }, []);

  const completeTurn = useCallback(async (overrideText = "") => {
    if (completedRef.current) return;
    const text = (overrideText || `${finalTextRef.current}${onlineTextRef.current || interimTextRef.current}`).replace(/\s+/g, " ").trim();
    if (text.length < 2) {
      finalizingRef.current = false;
      updateStatus("listening");
      return;
    }
    completedRef.current = true;
    desiredActiveRef.current = false;
    clearTimers();
    updateStatus("finalizing");
    stopRecognition(false);
    closeWebsocket();
    const durationMs = Math.max(1, Date.now() - startedAtRef.current);
    const stats = analyzeVoiceFrames(framesRef.current, contextRef.current?.sampleRate ?? 16_000);
    await releaseMeter();
    setInterim(text);
    callbacksRef.current.onInterimChange?.(text);
    callbacksRef.current.onComplete(text, durationMs, stats);
  }, [clearTimers, closeWebsocket, releaseMeter, stopRecognition, updateStatus]);

  const finishTurn = useCallback((overrideText = "") => {
    if (completedRef.current || finalizingRef.current) return;
    if (overrideText) {
      finalTextRef.current = overrideText;
      onlineTextRef.current = "";
      interimTextRef.current = "";
      emitTranscript();
    }
    const text = `${finalTextRef.current}${onlineTextRef.current || interimTextRef.current}`.trim();
    if (text.length < 2) return;
    finalizingRef.current = true;
    updateStatus("finalizing");
    if (providerRef.current === "funasr" && websocketRef.current?.readyState === WebSocket.OPEN) {
      websocketRef.current.send(JSON.stringify({ is_speaking: false, is_end: true }));
      providerFinalizeTimerRef.current = setTimeout(() => void completeTurn(), 700);
      return;
    }
    void completeTurn(overrideText);
  }, [completeTurn, emitTranscript, updateStatus]);

  const scheduleFinish = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    const text = `${finalTextRef.current}${onlineTextRef.current || interimTextRef.current}`.trim();
    silenceTimerRef.current = setTimeout(() => finishTurn(), endpointDelayMs(text, silenceMs));
  }, [finishTurn, silenceMs]);

  const startMeter = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext) return false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48_000,
          sampleSize: 16,
        },
      });
      if (!desiredActiveRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return false;
      }
      const context = new AudioContext({ latencyHint: "interactive" });
      await context.resume();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.62;
      source.connect(analyser);
      const processor = context.createScriptProcessor(4096, 1, 1);
      const muteGain = context.createGain();
      muteGain.gain.value = 0;
      source.connect(processor);
      processor.connect(muteGain);
      muteGain.connect(context.destination);
      processor.onaudioprocess = event => {
        if (!desiredActiveRef.current) return;
        const chunk = resampleTo16Khz(event.inputBuffer.getChannelData(0), context.sampleRate);
        audioSinkRef.current(chunk);
      };
      streamRef.current = stream;
      contextRef.current = context;
      sourceRef.current = source;
      analyserRef.current = analyser;
      processorRef.current = processor;
      muteGainRef.current = muteGain;

      const samples = new Uint8Array(analyser.fftSize);
      const tick = () => {
        if (!desiredActiveRef.current || !analyserRef.current) return;
        analyser.getByteTimeDomainData(samples);
        let sumSquares = 0;
        for (const sample of samples) {
          const normalized = (sample - 128) / 128;
          sumSquares += normalized * normalized;
        }
        const rms = Math.sqrt(sumSquares / samples.length);
        const atMs = Date.now() - startedAtRef.current;
        framesRef.current.push({ atMs, durationMs: 1000 / 30, rms });
        if (!assistantSpeakingRef.current && rms < noiseFloorRef.current * 1.45) {
          noiseFloorRef.current = noiseFloorRef.current * 0.985 + rms * 0.015;
        }
        const threshold = Math.max(0.0045, Math.min(0.04, noiseFloorRef.current * (assistantSpeakingRef.current ? 3.2 : 2.15)));
        const voiceActive = rms >= threshold;
        callbacksRef.current.onAudioLevel?.(Math.min(1, rms / Math.max(0.008, threshold * 2.4)));
        if (voiceActive) {
          voiceFramesRef.current += 1;
          lastVoiceAtRef.current = Date.now();
          if (voiceFramesRef.current >= (assistantSpeakingRef.current ? 8 : 3)) {
            heardSpeechRef.current = true;
            updateStatus("hearing");
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            if (assistantSpeakingRef.current) signalBargeIn();
          }
        } else {
          voiceFramesRef.current = Math.max(0, voiceFramesRef.current - 1);
          if (heardSpeechRef.current && Date.now() - lastVoiceAtRef.current > endpointDelayMs(
            `${finalTextRef.current}${onlineTextRef.current || interimTextRef.current}`,
            silenceMs,
          )) finishTurn();
        }
        animationRef.current = requestAnimationFrame(tick);
      };
      animationRef.current = requestAnimationFrame(tick);
      return true;
    } catch {
      return false;
    }
  }, [finishTurn, signalBargeIn, silenceMs, updateStatus]);

  const startBrowserRecognition = useCallback(() => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return false;
    updateProvider("browser");
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "zh-CN";
    recognition.maxAlternatives = 5;
    recognitionRef.current = recognition;

    const markListening = () => {
      if (connectionTimerRef.current) clearTimeout(connectionTimerRef.current);
      connectionTimerRef.current = null;
      updateStatus(heardSpeechRef.current ? "hearing" : "listening");
    };
    recognition.onstart = markListening;
    recognition.onaudiostart = markListening;
    recognition.onspeechstart = () => {
      heardSpeechRef.current = true;
      lastVoiceAtRef.current = Date.now();
      updateStatus("hearing");
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
    recognition.onresult = event => {
      let finalDelta = "";
      let interimDelta = "";
      let hasUserSpeech = false;
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const alternatives = Array.from({ length: result.length }, (_, candidateIndex) => result[candidateIndex]);
        const transcript = selectContextualAlternative(alternatives, contextualKeywords);
        if (!transcript) continue;
        if (assistantSpeakingRef.current && isLikelyAssistantEcho(transcript, assistantTranscriptRef.current)) continue;
        hasUserSpeech = true;
        if (result.isFinal) finalDelta = appendTranscriptSegment(finalDelta, transcript);
        else interimDelta = appendTranscriptSegment(interimDelta, transcript);
      }
      if (finalDelta) finalTextRef.current = appendTranscriptSegment(finalTextRef.current, finalDelta);
      interimTextRef.current = interimDelta;
      emitTranscript();
      if (hasUserSpeech) signalBargeIn();
      if (finalDelta) scheduleFinish();
    };
    recognition.onspeechend = () => {
      if (finalTextRef.current || interimTextRef.current) scheduleFinish();
    };
    recognition.onerror = event => {
      if (event.error === "aborted") return;
      if (event.error === "no-speech") {
        restartTimerRef.current = setTimeout(() => restartRecognitionRef.current(), 180);
        return;
      }
      desiredActiveRef.current = false;
      completedRef.current = true;
      clearTimers();
      updateStatus("error");
      void releaseMeter();
      callbacksRef.current.onError(recognitionErrorMessage(event.error));
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      if (!desiredActiveRef.current || completedRef.current || finalizingRef.current) return;
      restartTimerRef.current = setTimeout(() => restartRecognitionRef.current(), 180);
    };
    try {
      recognition.start();
    } catch {
      restartTimerRef.current = setTimeout(() => restartRecognitionRef.current(), 260);
    }
    return true;
  }, [clearTimers, contextualKeywords, emitTranscript, releaseMeter, scheduleFinish, signalBargeIn, updateProvider, updateStatus]);

  useEffect(() => {
    restartRecognitionRef.current = () => { startBrowserRecognition(); };
  }, [startBrowserRecognition]);

  const startFunAsr = useCallback((fallbackToBrowser: () => void) => {
    if (!FUNASR_WS_URL) return false;
    updateProvider("funasr");
    const socket = new WebSocket(FUNASR_WS_URL);
    websocketRef.current = socket;
    socket.binaryType = "arraybuffer";
    socket.onopen = () => {
      if (connectionTimerRef.current) clearTimeout(connectionTimerRef.current);
      connectionTimerRef.current = null;
      socket.send(JSON.stringify(buildFunAsrHandshake(contextualKeywords)));
      audioSinkRef.current = audio => {
        if (socket.readyState === WebSocket.OPEN && !finalizingRef.current) socket.send(float32ToPcm16(audio).buffer);
      };
      updateStatus("listening");
    };
    socket.onmessage = event => {
      const message = parseFunAsrMessage(String(event.data));
      if (!message) return;
      if (message.error) {
        callbacksRef.current.onError(`FunASR：${message.error}`);
        return;
      }
      const text = message.text?.trim() ?? "";
      if (text) {
        if (assistantSpeakingRef.current && isLikelyAssistantEcho(text, assistantTranscriptRef.current)) return;
        heardSpeechRef.current = true;
        lastVoiceAtRef.current = Date.now();
        if (message.mode === "2pass-online" || message.mode === "online") {
          onlineTextRef.current = appendTranscriptSegment(onlineTextRef.current, text);
        } else {
          finalTextRef.current = appendTranscriptSegment(finalTextRef.current, text);
          onlineTextRef.current = "";
        }
        emitTranscript();
        updateStatus(finalizingRef.current ? "finalizing" : "hearing");
        signalBargeIn();
      }
      if (finalizingRef.current && (message.is_final || message.is_end || message.mode === "2pass-offline")) {
        if (providerFinalizeTimerRef.current) clearTimeout(providerFinalizeTimerRef.current);
        providerFinalizeTimerRef.current = setTimeout(() => void completeTurn(), 80);
      }
    };
    const fallback = () => {
      if (!desiredActiveRef.current || completedRef.current) return;
      closeWebsocket();
      fallbackToBrowser();
    };
    socket.onerror = fallback;
    socket.onclose = fallback;
    return true;
  }, [closeWebsocket, completeTurn, contextualKeywords, emitTranscript, signalBargeIn, updateProvider, updateStatus]);

  const startSherpaOnnx = useCallback((fallbackToBrowser: () => void) => {
    if (!SHERPA_ONNX_WS_URL) return false;
    updateProvider("sherpa-onnx");
    const socket = new WebSocket(SHERPA_ONNX_WS_URL);
    websocketRef.current = socket;
    socket.onopen = () => {
      if (connectionTimerRef.current) clearTimeout(connectionTimerRef.current);
      connectionTimerRef.current = null;
      audioSinkRef.current = audio => {
        if (socket.readyState === WebSocket.OPEN && !finalizingRef.current) socket.send(audio.buffer);
      };
      updateStatus("listening");
    };
    const fallback = () => {
      if (!desiredActiveRef.current || completedRef.current) return;
      closeWebsocket();
      fallbackToBrowser();
    };
    socket.onmessage = event => {
      const message = parseSherpaOnnxMessage(String(event.data));
      if (!message) return;
      if (message.error) {
        fallback();
        return;
      }
      const text = message.text?.trim() ?? "";
      if (!text) return;
      if (assistantSpeakingRef.current && isLikelyAssistantEcho(text, assistantTranscriptRef.current)) return;
      heardSpeechRef.current = true;
      lastVoiceAtRef.current = Date.now();
      if (message.is_final) {
        finalTextRef.current = appendTranscriptSegment(finalTextRef.current, text);
        interimTextRef.current = "";
      } else {
        interimTextRef.current = text;
      }
      emitTranscript();
      updateStatus("hearing");
      signalBargeIn();
      if (message.is_final) scheduleFinish();
    };
    socket.onerror = fallback;
    socket.onclose = fallback;
    return true;
  }, [closeWebsocket, emitTranscript, scheduleFinish, signalBargeIn, updateProvider, updateStatus]);

  const startSoulX = useCallback((fallbackToFunAsr: () => void) => {
    if (!SOULX_DUPLEX_WS_URL) return false;
    updateProvider("soulx-duplug");
    soulXSessionRef.current = crypto.randomUUID().replaceAll("-", "");
    soulXBufferRef.current = new Float32Array(0);
    const socket = new WebSocket(SOULX_DUPLEX_WS_URL);
    websocketRef.current = socket;
    socket.onopen = () => {
      if (connectionTimerRef.current) clearTimeout(connectionTimerRef.current);
      connectionTimerRef.current = null;
      audioSinkRef.current = audio => {
        const merged = new Float32Array(soulXBufferRef.current.length + audio.length);
        merged.set(soulXBufferRef.current);
        merged.set(audio, soulXBufferRef.current.length);
        let offset = 0;
        while (merged.length - offset >= SOULX_CHUNK_SAMPLES && socket.readyState === WebSocket.OPEN) {
          socket.send(soulXAudioPayload(soulXSessionRef.current, merged.slice(offset, offset + SOULX_CHUNK_SAMPLES)));
          offset += SOULX_CHUNK_SAMPLES;
        }
        soulXBufferRef.current = merged.slice(offset);
      };
      updateStatus("listening");
    };
    socket.onmessage = event => {
      const message = parseSoulXTurnMessage(String(event.data));
      const turn = message?.state;
      if (!turn?.state || turn.state === "blank" || turn.state === "idle") return;
      const partial = turn.asr_segment || turn.asr_buffer || "";
      const semanticText = turn.text?.trim() ?? "";
      if (assistantSpeakingRef.current && isLikelyAssistantEcho(partial || semanticText, assistantTranscriptRef.current)) return;
      heardSpeechRef.current = true;
      lastVoiceAtRef.current = Date.now();
      if (partial) {
        interimTextRef.current = appendTranscriptSegment(interimTextRef.current, partial);
        emitTranscript();
      }
      updateStatus("hearing");
      signalBargeIn();
      if (turn.state === "speak" && semanticText) finishTurn(semanticText);
    };
    const fallback = () => {
      if (!desiredActiveRef.current || completedRef.current) return;
      closeWebsocket();
      fallbackToFunAsr();
    };
    socket.onerror = fallback;
    socket.onclose = fallback;
    return true;
  }, [closeWebsocket, emitTranscript, finishTurn, signalBargeIn, updateProvider, updateStatus]);

  useEffect(() => {
    const shouldListen = active && !disabled;
    desiredActiveRef.current = shouldListen;
    if (!shouldListen) {
      clearTimers();
      stopRecognition(true);
      closeWebsocket();
      void releaseMeter();
      updateStatus("idle");
      return;
    }

    completedRef.current = false;
    finalizingRef.current = false;
    finalTextRef.current = "";
    interimTextRef.current = "";
    onlineTextRef.current = "";
    framesRef.current = [];
    startedAtRef.current = Date.now();
    noiseFloorRef.current = 0.004;
    voiceFramesRef.current = 0;
    heardSpeechRef.current = false;
    lastVoiceAtRef.current = 0;
    bargeInSentRef.current = false;
    setInterim("");
    callbacksRef.current.onInterimChange?.("");
    updateStatus("starting");

    const startBrowser = () => {
      if (!startBrowserRecognition()) {
        desiredActiveRef.current = false;
        updateProvider("unavailable");
        updateStatus("unsupported");
        callbacksRef.current.onError("当前环境没有可用的流式中文识别服务，请配置开源 ASR WebSocket，或使用桌面版 Chrome。");
      }
    };
    const startSherpa = () => {
      if (!startSherpaOnnx(startBrowser)) startBrowser();
    };
    const startFun = () => {
      if (!startFunAsr(startSherpa)) startSherpa();
    };
    const startSelectedProvider = () => {
      if (!startSoulX(startFun)) startFun();
    };

    void startMeter().then(meterReady => {
      if (!desiredActiveRef.current || completedRef.current) return;
      if (!meterReady && (SOULX_DUPLEX_WS_URL || FUNASR_WS_URL || SHERPA_ONNX_WS_URL)) {
        desiredActiveRef.current = false;
        updateStatus("error");
        callbacksRef.current.onError("无法读取麦克风，请允许权限并检查系统输入设备。麦克风只用于实时转写，原始录音不会保存。");
        return;
      }
      startSelectedProvider();
    });

    connectionTimerRef.current = setTimeout(() => {
      if (!desiredActiveRef.current || completedRef.current || statusRef.current !== "starting") return;
      desiredActiveRef.current = false;
      completedRef.current = true;
      stopRecognition(true);
      closeWebsocket();
      void releaseMeter();
      updateStatus("error");
      callbacksRef.current.onError("实时识别连接超过 8 秒未响应，已切换为文字回答。请检查麦克风权限或开源 ASR 服务地址。");
    }, 8_000);
    maxTimerRef.current = setTimeout(() => {
      if (finalTextRef.current || interimTextRef.current || onlineTextRef.current) finishTurn();
      else {
        desiredActiveRef.current = false;
        completedRef.current = true;
        stopRecognition(true);
        closeWebsocket();
        void releaseMeter();
        updateStatus("error");
        callbacksRef.current.onError("本轮没有检测到清晰回答，请靠近麦克风后继续，或切换文字输入。");
      }
    }, maxDurationMs);

    return () => {
      desiredActiveRef.current = false;
      clearTimers();
      stopRecognition(true);
      closeWebsocket();
      void releaseMeter();
    };
  }, [
    active,
    clearTimers,
    closeWebsocket,
    disabled,
    finishTurn,
    maxDurationMs,
    releaseMeter,
    startBrowserRecognition,
    startFunAsr,
    startMeter,
    startSoulX,
    startSherpaOnnx,
    stopRecognition,
    turnKey,
    updateProvider,
    updateStatus,
  ]);

  const providerLabel = provider === "soulx-duplug"
    ? "SoulX 语义双工"
    : provider === "funasr"
      ? "FunASR 流式中文"
      : provider === "sherpa-onnx"
        ? "sherpa-onnx 本地中文"
      : provider === "browser"
        ? "Chrome 实时识别"
        : "实时识别";
  const label = status === "starting"
    ? `正在连接${providerLabel}…`
    : status === "listening"
      ? assistantSpeaking ? "麦克风持续开启，直接开口即可打断" : "请自然回答，无需按键"
      : status === "hearing"
        ? "正在实时识别，小声回答也会持续增益"
        : status === "finalizing"
          ? "正在校正同音词并整理回答…"
          : status === "unsupported"
            ? "未配置可用的实时中文识别"
            : status === "error"
              ? "语音识别已暂停"
              : "等待面试官提问";

  return (
    <div className={`live-speech-status status-${status}`} aria-live="polite">
      <span className="live-speech-orb" aria-hidden="true" />
      <div className="live-speech-copy">
        <b>{label}</b>
        <p>{interim || "双方都可以随时插话；系统自动判断语义结束、清理口头语，不保存原始录音。"}</p>
        <small className="live-asr-provider">{providerLabel} · 中文 · 自动断句</small>
      </div>
    </div>
  );
}
