"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { endpointSilenceMs, isLikelyPlaybackEcho } from "@/modules/group-1-interview/client/conversation-turn";
import { analyzeVoiceFrames, type VoiceCaptureStats, type VoiceFrame } from "@/modules/group-1-interview/client/wav-audio";

type RecognitionAlternative = {
  transcript: string;
  confidence: number;
};

type RecognitionResult = {
  isFinal: boolean;
  length: number;
  [index: number]: RecognitionAlternative;
};

type RecognitionEventLike = Event & {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: RecognitionResult;
  };
};

type RecognitionErrorEventLike = Event & {
  error: string;
  message?: string;
};

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
  speaking?: boolean;
  spokenText?: string;
  onSpeechStart?: () => void;
  maxDurationMs?: number;
  silenceMs?: number;
  onInterimChange?: (text: string) => void;
  onAudioLevel?: (level: number) => void;
  onStatusChange?: (status: LiveSpeechStatus) => void;
  onComplete: (text: string, durationMs: number, stats: VoiceCaptureStats) => void;
  onError: (message: string) => void;
}

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

export default function ContinuousSpeechRecognition({
  active,
  turnKey,
  disabled = false,
  maxDurationMs = 90_000,
  silenceMs = 1_500,
  speaking = false,
  spokenText = "",
  onSpeechStart,
  onInterimChange,
  onAudioLevel,
  onStatusChange,
  onComplete,
  onError,
}: ContinuousSpeechRecognitionProps) {
  const [status, setStatus] = useState<LiveSpeechStatus>("idle");
  const [interim, setInterim] = useState("");
  const playbackRef = useRef({ speaking, spokenText });
  useEffect(() => { playbackRef.current = { speaking, spokenText }; }, [speaking, spokenText]);
  const announcedSpeechRef = useRef(false);
  const previousFrameAtRef = useRef(0);
  const wasPlayingRef = useRef(false);
  const lastMeterNotifyRef = useRef(0);
  const sessionRef = useRef(0);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const desiredActiveRef = useRef(false);
  const completedRef = useRef(false);
  const restartRecognitionRef = useRef<() => void>(() => {});
  const finalTextRef = useRef("");
  const interimTextRef = useRef("");
  const startedAtRef = useRef(0);
  const speechStartedAtRef = useRef(0);
  const framesRef = useRef<VoiceFrame[]>([]);
  const callbacksRef = useRef({
    onInterimChange,
    onSpeechStart,
    onAudioLevel,
    onStatusChange,
    onComplete,
    onError,
  });

  useEffect(() => {
    callbacksRef.current = {
      onInterimChange,
      onSpeechStart,
      onAudioLevel,
      onStatusChange,
      onComplete,
      onError,
    };
  }, [onAudioLevel, onComplete, onError, onInterimChange, onSpeechStart, onStatusChange]);

  const updateStatus = useCallback((next: LiveSpeechStatus) => {
    setStatus(next);
    callbacksRef.current.onStatusChange?.(next);
  }, []);

  const clearTimers = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    if (connectionTimerRef.current) clearTimeout(connectionTimerRef.current);
    silenceTimerRef.current = null;
    maxTimerRef.current = null;
    restartTimerRef.current = null;
    connectionTimerRef.current = null;
  }, []);

  const releaseMeter = useCallback(async () => {
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
    analyserRef.current?.disconnect();
    sourceRef.current?.disconnect();
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
    recognition.onresult = null;
    recognition.onspeechstart = null;
    recognition.onspeechend = null;
    recognition.onstart = null;
    recognition.onaudiostart = null;
    recognition.onend = null;
    recognition.onerror = null;
    try {
      if (abort) recognition.abort();
      else recognition.stop();
    } catch {}
  }, []);

  const finishTurn = useCallback(async () => {
    if (completedRef.current) return;
    const text = `${finalTextRef.current} ${interimTextRef.current}`.replace(/\s+/g, " ").trim();
    if (!text) return;
    const session = sessionRef.current;
    completedRef.current = true;
    desiredActiveRef.current = false;
    clearTimers();
    updateStatus("finalizing");
    stopRecognition(false);
    const durationMs = Math.max(1, Date.now() - startedAtRef.current);
    const stats = analyzeVoiceFrames(framesRef.current, contextRef.current?.sampleRate ?? 16_000);
    await releaseMeter();
    if (session !== sessionRef.current) return;
    setInterim(text);
    callbacksRef.current.onInterimChange?.(text);
    callbacksRef.current.onComplete(text, durationMs, stats);
  }, [clearTimers, releaseMeter, stopRecognition, updateStatus]);

  const scheduleFinish = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(() => void finishTurn(), endpointSilenceMs(`${finalTextRef.current} ${interimTextRef.current}`, silenceMs));
  }, [finishTurn, silenceMs]);

  const startMeter = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext) return;
    const session = sessionRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      if (!desiredActiveRef.current || session !== sessionRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      const context = new AudioContext();
      await context.resume();
      if (!desiredActiveRef.current || session !== sessionRef.current) {
        stream.getTracks().forEach(track => track.stop());
        await context.close();
        return;
      }
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.72;
      source.connect(analyser);
      streamRef.current = stream;
      contextRef.current = context;
      sourceRef.current = source;
      analyserRef.current = analyser;

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
        if (wasPlayingRef.current !== playbackRef.current.speaking) {
          wasPlayingRef.current = playbackRef.current.speaking;
          // Do not count time spent hearing the interviewer's question as hesitation.
          startedAtRef.current = Date.now();
          framesRef.current = [];
          previousFrameAtRef.current = 0;
          lastMeterNotifyRef.current = 0;
        }
        const atMs = Date.now() - startedAtRef.current;
        const durationMs = Math.min(100, Math.max(0, atMs - previousFrameAtRef.current));
        previousFrameAtRef.current = atMs;
        if (!playbackRef.current.speaking) {
          framesRef.current.push({ atMs, durationMs, rms });
        }
        // React should not render the entire interview 120 times per second.
        if (atMs - lastMeterNotifyRef.current >= 65) {
          lastMeterNotifyRef.current = atMs;
          callbacksRef.current.onAudioLevel?.(Math.min(1, rms * 11));
        }
        animationRef.current = requestAnimationFrame(tick);
      };
      animationRef.current = requestAnimationFrame(tick);
    } catch {
      // SpeechRecognition will provide the user-facing microphone error.
    }
  }, []);

  const startRecognition = useCallback(() => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      desiredActiveRef.current = false;
      updateStatus("unsupported");
      callbacksRef.current.onError("当前浏览器不支持免费实时识别，请使用桌面版 Chrome，或切换文字输入。");
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "zh-CN";
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    const markListening = () => {
      if (connectionTimerRef.current) clearTimeout(connectionTimerRef.current);
      connectionTimerRef.current = null;
      updateStatus("listening");
    };
    recognition.onstart = markListening;
    recognition.onaudiostart = markListening;
    recognition.onspeechstart = () => {
      if (playbackRef.current.speaking) return;
      if (!speechStartedAtRef.current) speechStartedAtRef.current = Date.now();
      if (!announcedSpeechRef.current) {
        announcedSpeechRef.current = true;
        callbacksRef.current.onSpeechStart?.();
      }
      updateStatus("hearing");
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
    recognition.onresult = event => {
      let finalDelta = "";
      let interimDelta = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result[0]?.transcript?.trim() ?? "";
        if (!transcript) continue;
        if (result.isFinal) finalDelta += `${transcript} `;
        else interimDelta += `${transcript} `;
      }
      const heard = `${finalDelta} ${interimDelta}`.trim();
      if (!heard) return;
      if (playbackRef.current.speaking && isLikelyPlaybackEcho(heard, playbackRef.current.spokenText)) return;
      if (!announcedSpeechRef.current) {
        announcedSpeechRef.current = true;
        // Trigger before publishing text so stale TTS callbacks cannot reset this turn.
        callbacksRef.current.onSpeechStart?.();
      }
      updateStatus("hearing");
      if (finalDelta) finalTextRef.current = `${finalTextRef.current} ${finalDelta}`.trim();
      interimTextRef.current = interimDelta.trim();
      const combined = `${finalTextRef.current} ${interimTextRef.current}`.replace(/\s+/g, " ").trim();
      setInterim(combined);
      callbacksRef.current.onInterimChange?.(combined);
      scheduleFinish();
    };
    recognition.onspeechend = () => {
      if (finalTextRef.current || interimTextRef.current) scheduleFinish();
    };
    recognition.onerror = event => {
      if (event.error === "aborted" || event.error === "no-speech") return;
      desiredActiveRef.current = false;
      completedRef.current = true;
      clearTimers();
      updateStatus("error");
      void releaseMeter();
      callbacksRef.current.onError(recognitionErrorMessage(event.error));
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      if (!desiredActiveRef.current || completedRef.current) return;
      if (finalTextRef.current || interimTextRef.current) scheduleFinish();
      restartTimerRef.current = setTimeout(() => {
        if (desiredActiveRef.current && !completedRef.current) restartRecognitionRef.current();
      }, 260);
    };

    try {
      recognition.start();
    } catch {
      restartTimerRef.current = setTimeout(() => {
        if (desiredActiveRef.current && !completedRef.current) restartRecognitionRef.current();
      }, 320);
    }
  }, [clearTimers, releaseMeter, scheduleFinish, updateStatus]);

  useEffect(() => {
    restartRecognitionRef.current = startRecognition;
  }, [startRecognition]);

  useEffect(() => {
    sessionRef.current += 1;
    const shouldListen = active && !disabled;
    desiredActiveRef.current = shouldListen;
    if (!shouldListen) {
      clearTimers();
      stopRecognition(true);
      void releaseMeter();
      updateStatus("idle");
      return;
    }

    completedRef.current = false;
    finalTextRef.current = "";
    interimTextRef.current = "";
    framesRef.current = [];
    startedAtRef.current = Date.now();
    speechStartedAtRef.current = 0;
    announcedSpeechRef.current = false;
    previousFrameAtRef.current = 0;
    lastMeterNotifyRef.current = 0;
    setInterim("");
    callbacksRef.current.onInterimChange?.("");
    updateStatus("starting");
    void startMeter();
    startRecognition();
    connectionTimerRef.current = setTimeout(() => {
      if (!desiredActiveRef.current || completedRef.current || recognitionRef.current === null) return;
      desiredActiveRef.current = false;
      completedRef.current = true;
      stopRecognition(true);
      void releaseMeter();
      updateStatus("error");
      callbacksRef.current.onError("麦克风连接超过 8 秒未响应，已自动切换为文字回答。你也可以检查 Chrome 麦克风权限后重试。");
    }, 8_000);
    maxTimerRef.current = setTimeout(() => {
      if (finalTextRef.current || interimTextRef.current) void finishTurn();
      else {
        desiredActiveRef.current = false;
        completedRef.current = true;
        stopRecognition(true);
        void releaseMeter();
        updateStatus("error");
        callbacksRef.current.onError("本轮未检测到清晰回答，请重新开始或切换文字输入。");
      }
    }, maxDurationMs);

    return () => {
      sessionRef.current += 1;
      desiredActiveRef.current = false;
      clearTimers();
      stopRecognition(true);
      void releaseMeter();
    };
  }, [
    active,
    clearTimers,
    disabled,
    finishTurn,
    maxDurationMs,
    releaseMeter,
    startMeter,
    startRecognition,
    stopRecognition,
    turnKey,
    updateStatus,
  ]);

  const label = status === "starting"
    ? "正在连接麦克风…"
    : status === "listening"
      ? "随时开口，我在听"
      : status === "hearing"
        ? "正在听你说…"
        : status === "finalizing"
          ? "正在整理回答…"
          : status === "unsupported"
            ? "请使用桌面版 Chrome"
            : status === "error"
              ? "语音识别已暂停"
              : "等待面试官提问";

  return (
    <div className={`live-speech-status status-${status}`} aria-live="polite">
      <span className="live-speech-orb" aria-hidden="true" />
      <div className="live-speech-copy">
        <b>{label}</b>
        <p>{interim || "开口后显示转写"}</p>
      </div>
      {(status === "listening" || status === "hearing") && (
        <button
          type="button"
          className="live-answer-finished"
          disabled={interim.trim().length < 1}
          onClick={() => void finishTurn()}
        >
          我说完了
        </button>
      )}
    </div>
  );
}
