"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { analyzeVoiceFrames, type VoiceCaptureStats, type VoiceFrame } from "../../lib/wav-audio";

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
  silenceMs = 5_000,
  onInterimChange,
  onAudioLevel,
  onStatusChange,
  onComplete,
  onError,
}: ContinuousSpeechRecognitionProps) {
  const [status, setStatus] = useState<LiveSpeechStatus>("idle");
  const [interim, setInterim] = useState("");
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
    onAudioLevel,
    onStatusChange,
    onComplete,
    onError,
  });

  useEffect(() => {
    callbacksRef.current = {
      onInterimChange,
      onAudioLevel,
      onStatusChange,
      onComplete,
      onError,
    };
  }, [onAudioLevel, onComplete, onError, onInterimChange, onStatusChange]);

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
    if (text.length < 2) return;
    completedRef.current = true;
    desiredActiveRef.current = false;
    clearTimers();
    updateStatus("finalizing");
    stopRecognition(false);
    const durationMs = Math.max(1, Date.now() - startedAtRef.current);
    const stats = analyzeVoiceFrames(framesRef.current, contextRef.current?.sampleRate ?? 16_000);
    await releaseMeter();
    setInterim(text);
    callbacksRef.current.onInterimChange?.(text);
    callbacksRef.current.onComplete(text, durationMs, stats);
  }, [clearTimers, releaseMeter, stopRecognition, updateStatus]);

  const scheduleFinish = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(() => void finishTurn(), silenceMs);
  }, [finishTurn, silenceMs]);

  const startMeter = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      if (!desiredActiveRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      const context = new AudioContext();
      await context.resume();
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
        const atMs = Date.now() - startedAtRef.current;
        framesRef.current.push({ atMs, durationMs: 1000 / 30, rms });
        callbacksRef.current.onAudioLevel?.(Math.min(1, rms * 11));
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
      if (!speechStartedAtRef.current) speechStartedAtRef.current = Date.now();
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
      if (finalDelta) finalTextRef.current = `${finalTextRef.current} ${finalDelta}`.trim();
      interimTextRef.current = interimDelta.trim();
      const combined = `${finalTextRef.current} ${interimTextRef.current}`.replace(/\s+/g, " ").trim();
      setInterim(combined);
      callbacksRef.current.onInterimChange?.(combined);
      if (finalDelta) scheduleFinish();
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
      if (finalTextRef.current || interimTextRef.current) {
        scheduleFinish();
        return;
      }
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
      ? "请开始回答，停顿后会自动继续"
      : status === "hearing"
        ? "正在听你回答，思考停顿不会打断"
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
        <p>{interim || "识别内容会在这里实时出现；允许“嗯、啊”和自然思考，原始录音不会保存。"}</p>
      </div>
      {(status === "listening" || status === "hearing") && (
        <button
          type="button"
          className="live-answer-finished"
          disabled={interim.trim().length < 2}
          onClick={() => void finishTurn()}
        >
          我说完了
        </button>
      )}
    </div>
  );
}
