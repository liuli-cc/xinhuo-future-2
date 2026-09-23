/** Realtime GA events: keep identity/order independent from asynchronous ASR completion. */
export type RealtimeEntry = { id: string; speaker: "interviewer" | "candidate"; text: string; final: boolean; interrupted?: boolean; question?: string };
export type RealtimeEvent = { type: string; item_id?: string; delta?: string; transcript?: string; text?: string; previous_item_id?: string; audio_start_ms?: number; audio_end_ms?: number; error?: { code?: string; message?: string }; item?: { id?: string; role?: string }; response?: { status?: string } };

export class RealtimeTranscript {
  entries: RealtimeEntry[] = [];
  private completed = new Set<string>();
  private ensure(id: string, speaker: RealtimeEntry["speaker"]) {
    let entry = this.entries.find(item => item.id === id);
    if (!entry) {
      entry = { id, speaker, text: "", final: false,
        ...(speaker === "candidate" ? { question: this.entries.findLast(item => item.speaker === "interviewer")?.text ?? "开场交流" } : {}) };
      this.entries.push(entry);
    }
    return entry;
  }
  apply(event: RealtimeEvent): RealtimeEntry | null {
    const id = event.item_id || event.item?.id;
    if (!id) return null;
    if (event.type === "input_audio_buffer.speech_started" || event.type === "input_audio_buffer.committed") this.ensure(id, "candidate");
    if (event.type === "conversation.item.truncated") {
      const entry = this.entries.find(item => item.id === id);
      if (entry) entry.interrupted = true;
    }
    if (event.type.startsWith("conversation.item.input_audio_transcription.")) {
      const entry = this.ensure(id, "candidate");
      if (event.type.endsWith(".delta") && !entry.final) entry.text += event.delta ?? "";
      if (event.type.endsWith(".completed") && !this.completed.has(id)) {
        entry.text = event.transcript ?? entry.text;
        entry.final = true;
        this.completed.add(id);
        return entry;
      }
    }
    if (event.type.startsWith("response.output_audio_transcript.") || event.type.startsWith("response.output_text.")) {
      const entry = this.ensure(id, "interviewer");
      if (event.type.endsWith(".delta") && !entry.final) entry.text += event.delta ?? "";
      if (event.type.endsWith(".done")) { entry.text = event.transcript ?? event.text ?? entry.text; entry.final = true; }
    }
    return null;
  }
  snapshot() { return this.entries.map(entry => ({ ...entry })); }
  hasPendingCandidate() { return this.entries.some(entry => entry.speaker === "candidate" && !entry.final); }
}

export function interruptionEvents(responseActive: boolean) {
  return [...(responseActive ? [{ type: "response.cancel" }] : []), { type: "output_audio_buffer.clear" }];
}

export function parseRealtimeEvent(raw: unknown): RealtimeEvent | null {
  if (typeof raw !== "string" || raw.length > 100_000) return null;
  try {
    const event = JSON.parse(raw);
    return event && typeof event.type === "string" ? event as RealtimeEvent : null;
  } catch { return null; }
}

export type RealtimeNegotiation = { sdp: string; callToken: string; model: string; maxSeconds: number };
export async function establishRealtimePeer(
  peer: RTCPeerConnection,
  negotiate: (sdp: string) => Promise<RealtimeNegotiation>,
  signal: AbortSignal,
): Promise<RealtimeNegotiation> {
  const alive = () => { if (signal.aborted) throw new DOMException("Cancelled", "AbortError"); };
  alive();
  const offer = await peer.createOffer();
  alive();
  await peer.setLocalDescription(offer);
  if (peer.iceGatheringState !== "complete") {
    await new Promise<void>((resolve, reject) => {
      const finish = () => { clearTimeout(timer); peer.removeEventListener("icegatheringstatechange", change); signal.removeEventListener("abort", abort); resolve(); };
      const change = () => { if (peer.iceGatheringState === "complete") finish(); };
      const abort = () => { finish(); reject(new DOMException("Cancelled", "AbortError")); };
      const timer = setTimeout(finish, 3000);
      peer.addEventListener("icegatheringstatechange", change);
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) abort();
    });
  }
  alive();
  const sdp = peer.localDescription?.sdp;
  if (!sdp) throw new Error("无法创建语音连接");
  const result = await negotiate(sdp);
  alive();
  if (!result.sdp.startsWith("v=0") || !result.callToken) throw new Error("语音服务返回无效");
  await peer.setRemoteDescription({ type: "answer", sdp: result.sdp });
  alive();
  return result;
}
