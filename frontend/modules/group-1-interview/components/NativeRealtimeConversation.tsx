"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { apiFetch } from "@/modules/shared/api/bmob-api";
import { analyzeVoiceFrames, type VoiceCaptureStats, type VoiceFrame } from "../client/wav-audio";
import { establishRealtimePeer, interruptionEvents, parseRealtimeEvent, RealtimeTranscript, type RealtimeEntry } from "../client/native-realtime";

export type NativeRealtimeHandle = { interrupt: () => void; finish: () => Promise<boolean> };
export type NativeRealtimeContext = { role: string; job: unknown; resume: unknown; opening: string; consent: boolean };
type Props = {
  context: NativeRealtimeContext;
  paused: boolean;
  onStateChange: (state: "idle" | "listening" | "thinking" | "speaking") => void;
  onInputLevel: (value: number) => void;
  onOutputLevel: (value: number) => void;
  onTranscript: (entries: RealtimeEntry[]) => void;
  onTurn: (turn: { id: string; order: number; question: string; answer: string; durationMs: number; stats: VoiceCaptureStats | null }) => void;
  onError: (message: string) => void;
  onLimit: () => void;
};

const NativeRealtimeConversation = forwardRef<NativeRealtimeHandle, Props>(function NativeRealtimeConversation(props, ref) {
  const [status, setStatus] = useState("正在连接实时语音…");
  const [playbackBlocked, setPlaybackBlocked] = useState(false);
  const callbacks = useRef(props);
  useEffect(() => { callbacks.current = props; }, [props]);
  const runtime = useRef<{ interrupt: () => void; finish: () => Promise<boolean>; pause: (paused: boolean) => void; play: () => void } | null>(null);
  useImperativeHandle(ref, () => ({ interrupt: () => runtime.current?.interrupt(), finish: () => runtime.current?.finish() ?? Promise.resolve(true) }), []);

  useEffect(() => {
    const initial = callbacks.current.context;
    let disposed = false;
    let finishing = false;
    let finishPromise: Promise<boolean> | null = null;
    const abort = new AbortController();
    const transcript = new RealtimeTranscript();
    let peer: RTCPeerConnection | null = null;
    let channel: RTCDataChannel | null = null;
    let mic: MediaStream | null = null;
    let audioContext: AudioContext | null = null;
    let inputMeter: AnalyserNode | null = null;
    let outputMeter: AnalyserNode | null = null;
    let frameId = 0;
    let limitTimer: ReturnType<typeof setTimeout> | null = null;
    let transcriptTimer: ReturnType<typeof setTimeout> | null = null;
    let connectionTimer: ReturnType<typeof setTimeout> | null = null;
    let callToken = "";
    let responseActive = false;
    let sessionReady = false;
    let openingSent = false;
    let turnDetection: object = { type: "semantic_vad", eagerness: "medium", create_response: true, interrupt_response: true };
    let inputActive = false;
    let paused = false;
    let latestPlaybackEnd = performance.now();
    let activeItem = "";
    let lastSample = performance.now();
    let lastNotify = 0;
    const frames: VoiceFrame[] = [];
    const turns = new Map<string, { start: number; stop: number; thinking: number; serverStart?: number; serverStop?: number; question: string }>();
    const player = new Audio();
    player.autoplay = true;
    player.setAttribute("playsinline", "true");
    const send = (event: object) => { if (channel?.readyState === "open") channel.send(JSON.stringify(event)); };
    const play = () => void player.play().then(() => setPlaybackBlocked(false)).catch(() => { if (!disposed) setPlaybackBlocked(true); });
    const interrupt = () => {
      for (const event of interruptionEvents(responseActive)) send(event);
      responseActive = false;
      if (!disposed) callbacks.current.onStateChange("listening");
    };
    const commitActiveInput = () => {
      if (!inputActive) return;
      const turn = turns.get(activeItem);
      if (turn) turn.stop = performance.now();
      send({ type: "input_audio_buffer.commit" });
      inputActive = false;
      activeItem = "";
    };
    const cleanup = () => {
      if (disposed) return;
      disposed = true;
      abort.abort();
      if (frameId) cancelAnimationFrame(frameId);
      if (limitTimer) clearTimeout(limitTimer);
      if (connectionTimer) clearTimeout(connectionTimer);
      if (transcriptTimer) clearTimeout(transcriptTimer);
      mic?.getTracks().forEach(track => track.stop());
      channel?.close();
      peer?.close();
      player.pause();
      player.srcObject = null;
      if (audioContext) void audioContext.close().catch(() => {});
      callbacks.current.onInputLevel(0);
      callbacks.current.onOutputLevel(0);
      if (callToken) void apiFetch("/api/interview/realtime/hangup", { method: "POST", keepalive: true,
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callToken }) }).catch(() => {});
    };
    const fail = (message: string) => { if (disposed) return; cleanup(); setStatus(message); callbacks.current.onError(message); };
    runtime.current = {
      interrupt, play,
      pause: value => {
        paused = value;
        mic?.getAudioTracks().forEach(track => { track.enabled = !value; });
        if (value) {
          interrupt();
          // Prevent silence/partially buffered input from creating a reply while paused.
          send({ type: "session.update", session: { type: "realtime", audio: { input: { turn_detection: null } } } });
          commitActiveInput();
          send({ type: "input_audio_buffer.clear" });
          player.muted = true;
        } else {
          player.muted = false;
          send({ type: "session.update", session: { type: "realtime", audio: { input: { turn_detection: turnDetection } } } });
          if (sessionReady && !openingSent) { openingSent = true; send({ type: "response.create" }); }
          latestPlaybackEnd = performance.now();
        }
      },
      finish: () => {
        if (finishPromise) return finishPromise;
        finishing = true;
        finishPromise = (async () => {
          mic?.getAudioTracks().forEach(track => { track.enabled = false; });
          interrupt();
          // Disable automatic replies before committing a final candidate utterance.
          send({ type: "session.update", session: { type: "realtime", audio: { input: { turn_detection: null } } } });
          commitActiveInput();
          const until = Date.now() + 1800;
          while (!disposed && transcript.hasPendingCandidate() && Date.now() < until) await new Promise(resolve => setTimeout(resolve, 60));
          const complete = !transcript.hasPendingCandidate();
          cleanup();
          setStatus("通话已结束");
          return complete;
        })();
        return finishPromise;
      },
    };

    const onEvent = (raw: unknown) => {
      if (disposed) return;
      const event = parseRealtimeEvent(raw);
      if (!event) return;
      const now = performance.now();
      const id = event.item_id;
      if (event.type === "session.created") {
        if (connectionTimer) clearTimeout(connectionTimer);
        sessionReady = true;
        setStatus("实时语音已连接");
        if (paused) runtime.current?.pause(true);
        else {
          callbacks.current.onStateChange("listening");
          if (!openingSent) { openingSent = true; send({ type: "response.create" }); }
        }
      }
      if (event.type === "response.created") { responseActive = true; if (!paused) callbacks.current.onStateChange("thinking"); }
      if (event.type === "response.done") responseActive = false;
      if (event.type === "output_audio_buffer.started") {
        if (!paused) callbacks.current.onStateChange("speaking");
      }
      if (event.type === "output_audio_buffer.stopped" || event.type === "output_audio_buffer.cleared") {
        latestPlaybackEnd = now;
        if (!paused) callbacks.current.onStateChange("listening");
      }
      if (event.type === "input_audio_buffer.speech_started" && id) {
        inputActive = true;
        activeItem = id;
        turns.set(id, { start: now, stop: now, thinking: Math.max(0, now - latestPlaybackEnd), serverStart: event.audio_start_ms,
          question: transcript.entries.findLast(entry => entry.speaker === "interviewer")?.text || initial.opening });
        // WebRTC server cancels and truncates unplayed audio automatically with VAD.
        callbacks.current.onStateChange("listening");
      }
      if (event.type === "input_audio_buffer.speech_stopped" && id) {
        const turn = turns.get(id);
        if (turn) { turn.stop = now; turn.serverStop = event.audio_end_ms; }
        activeItem = "";
        inputActive = false;
        if (!paused) callbacks.current.onStateChange("thinking");
      }
      const finished = transcript.apply(event);
      if (/transcript|output_text|truncated/.test(event.type)) {
        if (finished || event.type.endsWith(".done")) {
          if (transcriptTimer) clearTimeout(transcriptTimer);
          transcriptTimer = null;
          callbacks.current.onTranscript(transcript.snapshot());
        } else if (!transcriptTimer) transcriptTimer = setTimeout(() => {
          transcriptTimer = null;
          if (!disposed) callbacks.current.onTranscript(transcript.snapshot());
        }, 70);
      }
      if (finished?.text.trim()) {
        const turn = turns.get(finished.id);
        const start = turn?.start ?? now;
        const stop = turn?.stop || now;
        const slice = frames.filter(frame => frame.atMs >= start - 300 && frame.atMs <= stop)
          .map(frame => ({ ...frame, atMs: Math.max(0, frame.atMs - start) }));
        const stats = slice.length ? analyzeVoiceFrames(slice, audioContext?.sampleRate) : null;
        if (stats && turn) stats.thinkingBeforeAnswerMs = Math.round(turn.thinking);
        const durationMs = turn?.serverStart !== undefined && turn?.serverStop !== undefined
          ? Math.max(1, turn.serverStop - turn.serverStart) : Math.max(1, stop - start);
        callbacks.current.onTurn({ id: finished.id, order: transcript.entries.findIndex(entry => entry.id === finished.id), question: turn?.question || finished.question || initial.opening,
          answer: finished.text, durationMs, stats });
      }
      if (event.type === "error" && !["response_cancel_not_active", "input_audio_buffer_commit_empty"].includes(event.error?.code ?? "")) {
        fail("实时语音服务中断，已保留完成的回答");
      }
    };

    void (async () => {
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) throw new Error("请使用支持麦克风的浏览器并通过 HTTPS 访问");
        mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
        if (disposed) { mic.getTracks().forEach(track => track.stop()); return; }
        peer = new RTCPeerConnection();
        mic.getTracks().forEach(track => { track.enabled = !paused; peer?.addTrack(track, mic!); });
        try {
          audioContext = new AudioContext();
          await audioContext.resume();
          inputMeter = audioContext.createAnalyser(); inputMeter.fftSize = 512;
          audioContext.createMediaStreamSource(mic).connect(inputMeter);
        } catch { /* Audio can continue when only local metering is unavailable. */ }
        if (disposed) return;
        peer.ontrack = event => {
          player.srcObject = event.streams[0] ?? new MediaStream([event.track]);
          play();
          if (audioContext) {
            outputMeter = audioContext.createAnalyser(); outputMeter.fftSize = 512;
            audioContext.createMediaStreamSource(player.srcObject as MediaStream).connect(outputMeter);
          }
        };
        peer.onconnectionstatechange = () => {
          if (peer?.connectionState === "failed") fail("实时语音连接断开，已保留完成的回答");
        };
        channel = peer.createDataChannel("oai-events");
        channel.onmessage = event => onEvent(event.data);
        channel.onclose = () => { if (!disposed) fail("实时语音已断开，已保留完成的回答"); };
        connectionTimer = setTimeout(() => fail("实时语音连接超时，请重试或使用提纲练习"), 30000);
        const result = await establishRealtimePeer(peer, async sdp => {
          const response = await apiFetch("/api/interview/realtime/session", { method: "POST", signal: abort.signal,
            headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...initial, sdp }) });
          const body = await response.json();
          if (!response.ok) throw new Error(body.error || "实时语音连接失败");
          callToken = body.callToken;
          if (disposed && callToken) void apiFetch("/api/interview/realtime/hangup", { method: "POST", keepalive: true,
            headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callToken }) }).catch(() => {});
          if (body.turnDetection && typeof body.turnDetection === "object") turnDetection = body.turnDetection;
          return body;
        }, abort.signal);
        if (disposed) return;
        limitTimer = setTimeout(() => { if (!finishing && !disposed) void runtime.current?.finish().then(() => callbacks.current.onLimit()); }, result.maxSeconds * 1000);
        const buffer = new Uint8Array(512);
        const level = (meter: AnalyserNode | null) => {
          if (!meter) return 0;
          meter.getByteTimeDomainData(buffer);
          return Math.sqrt(buffer.reduce((sum, value) => sum + ((value - 128) / 128) ** 2, 0) / buffer.length);
        };
        const tick = () => {
          if (disposed) return;
          const now = performance.now();
          const input = paused ? 0 : level(inputMeter);
          if (activeItem && !paused) frames.push({ atMs: now, durationMs: Math.min(100, now - lastSample), rms: input });
          lastSample = now;
          // Bound memory to the call limit; there is never a raw recording buffer.
          if (frames.length > 60000) frames.splice(0, frames.length - 60000);
          if (now - lastNotify > 65) {
            callbacks.current.onInputLevel(Math.min(1, input * 11));
            callbacks.current.onOutputLevel(paused ? 0 : Math.min(1, level(outputMeter) * 11));
            lastNotify = now;
          }
          frameId = requestAnimationFrame(tick);
        };
        frameId = requestAnimationFrame(tick);
      } catch (error) {
        if (!disposed) fail(error instanceof Error ? error.message : "实时语音连接失败");
      }
    })();
    return cleanup;
  }, []);

  useEffect(() => { runtime.current?.pause(props.paused); }, [props.paused]);
  return <div className="live-speech-status" aria-live="polite">
    <span className="live-speech-orb" aria-hidden="true" />
    <div className="live-speech-copy"><b>{props.paused ? "通话已暂停" : status}</b><p>随时开口 · 支持打断</p></div>
    {playbackBlocked && <button className="live-answer-finished" onClick={() => runtime.current?.play()}>播放面试官语音</button>}
  </div>;
});
export default NativeRealtimeConversation;
