/** Pure turn-taking policy, kept separate from microphone lifecycle for testing. */
export function endpointSilenceMs(text: string, baseMs = 1500) {
  // Leave space for unfinished phrases and filled pauses; an explicit finish wins.
  return /(?:嗯+|呃+|啊+|那个|就是说|然后|因为|所以|我觉得|首先|比如|还有)[，,。\s]*$/.test(text.trim())
    ? Math.max(3400, baseMs)
    : baseMs;
}

export function isLikelyPlaybackEcho(transcript: string, spokenText: string) {
  const normalize = (value: string) => value.replace(/[\p{P}\p{Z}\s]/gu, "").toLowerCase();
  const heard = normalize(transcript);
  const spoken = normalize(spokenText);
  // Avoid matching one-character filler sounds; candidates may say them to interrupt.
  return heard.length >= 4 && spoken.includes(heard);
}

export function combineTurnText(previous: string, next: string) {
  if (!previous.trim()) return next.trim();
  if (next.trim().startsWith(previous.trim())) return next.trim();
  return `${previous.trim()} ${next.trim()}`;
}

export class ResponseGate {
  private generation = 0;
  private controller: AbortController | null = null;

  begin() {
    this.cancel();
    this.controller = new AbortController();
    return { id: this.generation, signal: this.controller.signal };
  }

  isCurrent(id: number) { return id === this.generation && !this.controller?.signal.aborted; }

  cancel() {
    this.generation += 1;
    this.controller?.abort();
    this.controller = null;
  }
}
