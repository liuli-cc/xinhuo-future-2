export type TranscriptCleanup = {
  raw: string;
  cleaned: string;
  removedFillers: string[];
  changed: boolean;
};

export type RecognitionCandidate = {
  transcript: string;
  confidence?: number;
};

const HESITATION = /(^|[，,。！？!?、\s])(?:嗯+|呃+|额+|唔+|啊+|哦+)(?=$|[，,。！？!?、\s])/gi;
const OPENING_HESITATION = /^(?:嗯+|呃+|额+|唔+|啊+|哦+)[，,。！？!?、\s]*/i;
const REPEATED_FILLER = /(?:那个|这个|就是|然后|其实)(?:[，,、\s]*(?:那个|这个|就是|然后|其实)){1,}/g;
const DISCOURSE_FILLER = /(^|[。！？!?]\s*)(?:就是说|怎么说呢|怎么讲呢|然后呢)[，,、\s]*/g;
const DUPLICATE_PHRASE = /([\u4e00-\u9fff]{2,8})(?:[，,、\s]*\1){1,}/g;
const DUPLICATE_PRONOUN = /([我你他她它这那])\1+/g;

function normalizeTranscript(value: string) {
  return value
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .replace(/([\u4e00-\u9fff])\s+(?=[\u4e00-\u9fff])/g, "$1")
    .replace(/\s+([，。！？、；：])/g, "$1")
    .replace(/([，,、]){2,}/g, "，")
    .trim();
}

export function cleanInterviewTranscript(value: string): TranscriptCleanup {
  const raw = normalizeTranscript(value);
  const removedFillers: string[] = [];
  const capture = (match: string, prefix = "") => {
    const filler = match.slice(prefix.length).replace(/[，,。！？!?、\s]/g, "");
    if (filler) removedFillers.push(filler);
    return prefix;
  };

  let cleaned = raw
    .replace(OPENING_HESITATION, match => capture(match))
    .replace(HESITATION, (match, prefix: string) => capture(match, prefix))
    .replace(REPEATED_FILLER, match => {
      const token = match.match(/那个|这个|就是|然后|其实/)?.[0] ?? "";
      const repeats = match.match(/那个|这个|就是|然后|其实/g) ?? [];
      removedFillers.push(...repeats.slice(1));
      return token;
    })
    .replace(DISCOURSE_FILLER, (match, prefix: string) => capture(match, prefix))
    .replace(DUPLICATE_PRONOUN, (match, token: string) => {
      removedFillers.push(...Array.from({ length: match.length - 1 }, () => token));
      return token;
    })
    .replace(DUPLICATE_PHRASE, (match, phrase: string) => {
      const count = match.split(phrase).length - 1;
      removedFillers.push(...Array.from({ length: Math.max(0, count - 1) }, () => phrase));
      return phrase;
    });

  cleaned = normalizeTranscript(cleaned)
    .replace(/^[，,、；;：:\s]+|[，,、；;：:\s]+$/g, "")
    .trim();

  if (cleaned.length < 2) cleaned = raw;
  return { raw, cleaned, removedFillers, changed: cleaned !== raw };
}

export function selectContextualAlternative(
  alternatives: RecognitionCandidate[],
  contextualKeywords: string[],
) {
  const candidates = alternatives
    .map(item => ({ ...item, transcript: normalizeTranscript(item.transcript) }))
    .filter(item => item.transcript);
  if (!candidates.length) return "";
  const keywords = contextualKeywords.map(normalizeTranscript).filter(item => item.length >= 2);

  return candidates
    .map((item, index) => {
      const keywordScore = keywords.reduce((score, keyword) => (
        score + (item.transcript.includes(keyword) ? Math.min(8, 2 + keyword.length) : 0)
      ), 0);
      const confidence = Number.isFinite(item.confidence) ? Number(item.confidence) : 0;
      return { text: item.transcript, score: confidence * 10 + keywordScore - index * 0.02 };
    })
    .sort((left, right) => right.score - left.score)[0]?.text ?? candidates[0].transcript;
}

export function appendTranscriptSegment(previous: string, segment: string) {
  const base = normalizeTranscript(previous);
  const next = normalizeTranscript(segment);
  if (!next || base.endsWith(next)) return base;
  if (!base) return next;
  const overlapLimit = Math.min(base.length, next.length, 24);
  for (let size = overlapLimit; size >= 2; size -= 1) {
    if (base.slice(-size) === next.slice(0, size)) return `${base}${next.slice(size)}`;
  }
  return normalizeTranscript(`${base} ${next}`);
}

export function isLikelyAssistantEcho(candidate: string, assistantTranscript: string) {
  const heard = normalizeTranscript(candidate).replace(/[^\u4e00-\u9fffA-Za-z0-9]/g, "").toLowerCase();
  const spoken = normalizeTranscript(assistantTranscript).replace(/[^\u4e00-\u9fffA-Za-z0-9]/g, "").toLowerCase();
  if (heard.length < 4 || spoken.length < 4) return false;
  if (spoken.includes(heard)) return true;

  const gramSize = heard.length >= 12 ? 4 : 3;
  const grams = new Set<string>();
  for (let index = 0; index <= heard.length - gramSize; index += 1) {
    grams.add(heard.slice(index, index + gramSize));
  }
  if (!grams.size) return false;
  const overlap = [...grams].filter(gram => spoken.includes(gram)).length / grams.size;
  return overlap >= 0.72;
}
