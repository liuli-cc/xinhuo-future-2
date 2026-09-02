/**
 * 语音表达分析模块 (XH-SPEECH-1.0)
 *
 * 基于音频元数据和转写结果计算客观指标。
 * 不进行心理诊断，只描述可观察的表达状态。
 */

export type SpeechMetrics = {
  wordsPerMinute: number;
  effectiveSpeechSeconds: number;
  totalAnswerSeconds: number;
  pauseCount: number;
  pauseRatio: number;
  thinkingBeforeAnswerMs: number;
  fillerWordCounts: Record<string, number>;
  fillerWordsPerMinute: number;
  repeatedPhrases: string[];
  averageVolume: number;
  volumeVariance: number;
  isOvertime: boolean;
  starCompleteness: number;
};

export type ExpressionObservation = {
  pace: string;
  pauses: string;
  volume: string;
  fillers: string;
  structure: string;
  overall: string;
};

const FILLER_WORDS = ["嗯", "啊", "呃", "哦", "那个", "就是说", "然后", "这个", "怎么说呢", "其实", "就是"];
const REPEATED_PATTERN = /(.{2,10})\1{2,}/g;

// STAR 结构检测
const STAR_PATTERNS = {
  situation: [/当时|背景|情境|在(.+?)期间|之前|原本/],
  task: [/目标|任务|负责|需要|要求|期望/],
  action: [/我先|我负责|我采用|我通过|具体做法|随后|接着|然后我|于是我|所以我/],
  result: [/最终|结果|提升|降低|完成|获得|达成|产出|交付/],
};

export function analyzeSpeechMetrics(
  transcript: string,
  totalAnswerMs: number,
  effectiveSpeechMs: number,
  pauseIntervalsMs: number[],
  thinkingBeforeMs: number,
  volumeSamples: number[],
  maxAnswerMs = 180000,
): SpeechMetrics {
  const words = transcript.replace(/[\s,，。！？、；：""''！?《》\[\]【】()（）…—\-]/g, "").length;
  const effectiveSeconds = Math.max(1, effectiveSpeechMs / 1000);
  const totalSeconds = Math.max(1, totalAnswerMs / 1000);
  const wordsPerMinute = Math.round(words / effectiveSeconds * 60);

  const totalPauseMs = pauseIntervalsMs.reduce((s, v) => s + v, 0);
  const pauseRatio = Math.round(totalPauseMs / Math.max(1, totalAnswerMs) * 100);

  const fillerWordCounts: Record<string, number> = {};
  for (const fw of FILLER_WORDS) {
    const count = (transcript.match(new RegExp(fw, "g")) || []).length;
    if (count > 0) fillerWordCounts[fw] = count;
  }
  const totalFillers = Object.values(fillerWordCounts).reduce((sum, value) => sum + value, 0);
  const fillerWordsPerMinute = Math.round(totalFillers / totalSeconds * 60 * 10) / 10;

  const repeatedPhrases: string[] = [];
  let match;
  while ((match = REPEATED_PATTERN.exec(transcript)) !== null) {
    if (repeatedPhrases.length < 5) repeatedPhrases.push(match[1]);
  }

  const avgVolume = volumeSamples.length
    ? Math.round(volumeSamples.reduce((s, v) => s + v, 0) / volumeSamples.length)
    : 0;
  const volumeVariance = volumeSamples.length > 1
    ? Math.round(volumeSamples.reduce((s, v) => s + (v - avgVolume) ** 2, 0) / volumeSamples.length)
    : 0;

  const starCompleteness = [
    STAR_PATTERNS.situation,
    STAR_PATTERNS.task,
    STAR_PATTERNS.action,
    STAR_PATTERNS.result,
  ].filter(patterns => patterns.some(p => p.test(transcript))).length;

  return {
    wordsPerMinute,
    effectiveSpeechSeconds: Math.round(effectiveSeconds),
    totalAnswerSeconds: Math.round(totalSeconds),
    pauseCount: pauseIntervalsMs.length,
    pauseRatio,
    thinkingBeforeAnswerMs: Math.round(thinkingBeforeMs),
    fillerWordCounts,
    fillerWordsPerMinute,
    repeatedPhrases,
    averageVolume: avgVolume,
    volumeVariance,
    isOvertime: totalAnswerMs > maxAnswerMs,
    starCompleteness,
  };
}

export function describeExpression(metrics: SpeechMetrics): ExpressionObservation {
  const pace = metrics.wordsPerMinute > 250
    ? "语速偏快，建议适当放慢确保面试官理解"
    : metrics.wordsPerMinute < 90
      ? "语速偏慢，可适当加快节奏"
      : "语速适中";

  const pauses = metrics.pauseRatio > 35
    ? "停顿较多，回答流畅度可提升"
    : metrics.pauseRatio < 10
      ? "停顿较少，表达较连贯"
      : "停顿比例正常";

  const volume = metrics.volumeVariance > 800
    ? "音量波动明显"
    : metrics.volumeVariance < 200
      ? "音量较稳定"
      : "音量变化在正常范围";

  const totalFillers = Object.values(metrics.fillerWordCounts).reduce((s, v) => s + v, 0);
  const fillers = metrics.fillerWordsPerMinute > 6
    ? `口头语较密集（${metrics.fillerWordsPerMinute}次/分），建议减少"${Object.entries(metrics.fillerWordCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ""}"等词`
    : metrics.fillerWordsPerMinute > 3
      ? `有少量口头语（${totalFillers}次，${metrics.fillerWordsPerMinute}次/分）`
      : "口头语较少，表达干净";

  const structure = metrics.starCompleteness >= 4
    ? "STAR结构完整"
    : `STAR结构覆盖${metrics.starCompleteness}/4要素，建议检查情境、任务、行动和结果中尚未说明的部分`;

  const overall = [
    metrics.wordsPerMinute > 200 ? "后半段节奏改善" : "",
    totalFillers <= 3 ? "表达较平稳" : "",
  ].filter(Boolean).join("；") || "表达状态正常";

  return { pace, pauses, volume, fillers, structure, overall };
}

export function defaultSpeechMetrics(): SpeechMetrics {
  return {
    wordsPerMinute: 0,
    effectiveSpeechSeconds: 0,
    totalAnswerSeconds: 0,
    pauseCount: 0,
    pauseRatio: 0,
    thinkingBeforeAnswerMs: 0,
    fillerWordCounts: {},
    fillerWordsPerMinute: 0,
    repeatedPhrases: [],
    averageVolume: 0,
    volumeVariance: 0,
    isOvertime: false,
    starCompleteness: 0,
  };
}
