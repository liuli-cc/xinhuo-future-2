/**
 * 增强评分引擎 (XH-SCORE-V2)
 *
 * 五维评分 + 确定性规则 + 音频指标
 * 总分100：内容30 + 匹配20 + 专业20 + 逻辑15 + 表达15
 */

import type { SpeechMetrics } from "./speech-analysis";

export type ScoreDimensions = {
  content: number;
  roleMatch: number;
  professionalDepth: number;
  logicStructure: number;
  languageExpression: number;
};

export type AnswerEvidence = {
  highlight: string;
  gap: string;
  originalQuote: string;
  resumeConsistent: boolean;
  jobRelevant: boolean;
};

export type ScoredAnswer = {
  question: string;
  answer: string;
  seconds: number;
  score: number;
  dimensions: ScoreDimensions;
  evidence: AnswerEvidence;
  speechMetrics: SpeechMetrics | null;
  riskPoints: string[];
};

export type InterviewReportV2 = {
  engineVersion: string;
  overallScore: number;
  dimensions: ScoreDimensions;
  scoredAnswers: ScoredAnswer[];
  strengths: string[];
  improvements: string[];
  actionPlan: string[];
  expressionSummary: {
    answersWithVoice: number;
    averageWordsPerMinute: number;
    averagePauseRatio: number;
    averageThinkingSeconds: number;
    totalFillers: number;
    fillerWordsPerMinute: number;
    observation: string;
  };
  trendNote: string;
  calculatedAt: string;
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function countActionVerbs(text: string): number {
  return (text.match(/我(?:负责|完成|设计|实现|组织|协调|分析|优化|推进|解决|推动|主导|带领|开发|搭建|重构|落地|交付)/g) ?? []).length;
}

function hasQuantified(text: string): boolean {
  return /(?:\d+(?:\.\d+)?%?|\d+[个项次天周月人万千百]|第一|前\d|排名|提升|降低|增长|减少)/.test(text);
}

function starScore(text: string): number {
  const elements = [
    /当时|背景|情境|在(.+?)期间|之前|原本/,
    /目标|任务|负责|需要|要求|期望/,
    /我先|我负责|我采用|我通过|具体做法|随后|接着|然后我|于是我|所以我/,
    /最终|结果|提升|降低|完成|获得|达成|产出|交付/,
  ];
  const count = elements.filter(p => p.test(text)).length;
  return count;
}

export function scoreAnswerV2(
  question: string,
  answer: string,
  seconds: number,
  jobSkills: string[],
  speechMetrics: SpeechMetrics | null,
): ScoredAnswer {
  const text = answer.trim();
  const starElements = starScore(text);
  const quantified = hasQuantified(text);
  const actionCount = countActionVerbs(text);

  // 内容质量 (30)
  const content = clamp(
    12 + Math.min(10, text.length / 30)
    + (quantified ? 5 : 0)
    + Math.min(3, actionCount),
  );

  // 岗位匹配 (20)
  const matchedSkills = jobSkills.filter(s =>
    text.toLowerCase().includes(s.toLowerCase()),
  );
  const roleMatch = clamp(6 + matchedSkills.length / Math.max(1, Math.min(4, jobSkills.length)) * 14);

  // 专业深度 (20)
  const depthIndicators = [
    /因为|所以|原因|分析|对比|权衡|选择|考虑/,
    /具体来说|举例|比如|例如/,
    /优化|改进|提升|降低|减少|增加/,
    /数据|指标|测量|评估|验证/,
  ];
  const depthCount = depthIndicators.filter(p => p.test(text)).length;
  const professionalDepth = clamp(5 + depthCount * 3.75);

  // 逻辑结构 (15)
  const logicStructure = clamp(starElements / 4 * 15);

  // 语言表达 (15)
  let languageExpression = 5;
  if (speechMetrics) {
    if (speechMetrics.wordsPerMinute >= 110 && speechMetrics.wordsPerMinute <= 220) languageExpression += 3;
    else if (speechMetrics.wordsPerMinute >= 80 && speechMetrics.wordsPerMinute <= 250) languageExpression += 1;
    if (speechMetrics.pauseRatio >= 8 && speechMetrics.pauseRatio <= 35) languageExpression += 2;
    else if (speechMetrics.pauseRatio < 50) languageExpression += 1;
    if (speechMetrics.fillerWordsPerMinute <= 2.5) languageExpression += 3;
    else if (speechMetrics.fillerWordsPerMinute <= 5) languageExpression += 2;
    else if (speechMetrics.fillerWordsPerMinute <= 8) languageExpression += 1;
    if (speechMetrics.thinkingBeforeAnswerMs <= 8_000) languageExpression += 2;
    else if (speechMetrics.thinkingBeforeAnswerMs <= 15_000) languageExpression += 1;
  } else {
    languageExpression = 9;
  }
  languageExpression = clamp(languageExpression);

  const totalScore = clamp(
    content + roleMatch + professionalDepth + logicStructure + languageExpression,
  );

  const highlight = (() => {
    if (quantified && starElements >= 4) return "量化结果明确，STAR结构完整";
    if (quantified) return "包含量化数据，有说服力";
    if (starElements >= 3) return "结构较完整";
    return "回答可进一步结构化";
  })();

  const gap = (() => {
    const missing: string[] = [];
    if (!quantified) missing.push("缺少量化结果");
    if (starElements < 3) missing.push("STAR结构不完整");
    if (actionCount === 0) missing.push("未明确个人贡献");
    return missing.length ? missing.join("；") : "无明显缺口";
  })();

  const originalQuote = (() => {
    const match = text.match(/.{15,80}(?:提升|降低|完成|获得|达成|负责|设计|实现)/);
    return match ? match[0] : text.slice(0, 80);
  })();

  const riskPoints: string[] = [];
  if (starElements < 2) riskPoints.push("面试官可能追问具体行动细节");
  if (!quantified) riskPoints.push("面试官可能追问量化成果");
  if (matchedSkills.length === 0 && jobSkills.length > 0) riskPoints.push("未涉及岗位要求的关键技能");
  if (speechMetrics?.fillerWordsPerMinute && speechMetrics.fillerWordsPerMinute > 6) {
    riskPoints.push(`口头语密度偏高（${speechMetrics.fillerWordsPerMinute}次/分）`);
  }
  if (speechMetrics?.thinkingBeforeAnswerMs && speechMetrics.thinkingBeforeAnswerMs > 15_000) {
    riskPoints.push("开口前思考时间超过15秒，可先用一句结论建立回答框架");
  }

  return {
    question,
    answer: text,
    seconds,
    score: totalScore,
    dimensions: { content, roleMatch, professionalDepth, logicStructure, languageExpression },
    evidence: {
      highlight,
      gap,
      originalQuote,
      resumeConsistent: true,
      jobRelevant: matchedSkills.length > 0,
    },
    speechMetrics,
    riskPoints,
  };
}

export function generateReportV2(scoredAnswers: ScoredAnswer[]): InterviewReportV2 {
  if (scoredAnswers.length === 0) {
    return {
      engineVersion: "XH-SCORE-V3.0",
      overallScore: 0,
      dimensions: { content: 0, roleMatch: 0, professionalDepth: 0, logicStructure: 0, languageExpression: 0 },
      scoredAnswers: [],
      strengths: [],
      improvements: [],
      actionPlan: [],
      expressionSummary: {
        answersWithVoice: 0,
        averageWordsPerMinute: 0,
        averagePauseRatio: 0,
        averageThinkingSeconds: 0,
        totalFillers: 0,
        fillerWordsPerMinute: 0,
        observation: "本次没有可用的语音指标",
      },
      trendNote: "",
      calculatedAt: new Date().toISOString(),
    };
  }

  const avg = (key: keyof ScoreDimensions) =>
    clamp(scoredAnswers.reduce((s, a) => s + a.dimensions[key], 0) / scoredAnswers.length);

  const dimensions: ScoreDimensions = {
    content: avg("content"),
    roleMatch: avg("roleMatch"),
    professionalDepth: avg("professionalDepth"),
    logicStructure: avg("logicStructure"),
    languageExpression: avg("languageExpression"),
  };

  const overallScore = clamp(
    dimensions.content
    + dimensions.roleMatch
    + dimensions.professionalDepth
    + dimensions.logicStructure
    + dimensions.languageExpression,
  );

  const strengths: string[] = [];
  const improvements: string[] = [];
  if (dimensions.content >= 25) strengths.push("经历描述具体，包含有效信息");
  else improvements.push("丰富经历细节，增加量化成果");
  if (dimensions.roleMatch >= 16) strengths.push("与岗位要求匹配度较高");
  else improvements.push("更主动地与岗位要求建立关联");
  if (dimensions.logicStructure >= 12) strengths.push("回答结构清晰，逻辑完整");
  else improvements.push("采用STAR框架优化回答结构");
  if (dimensions.languageExpression >= 12) strengths.push("语言表达流畅，口头语少");
  else improvements.push("减少口头语和重复，提升表达流畅度");

  const dimensionPlans = [
    {
      score: dimensions.content / 30,
      text: "选择一个真实项目，用“背景-任务-行动-结果”补写细节，并至少加入一项量化结果。",
    },
    {
      score: dimensions.roleMatch / 20,
      text: "对照岗位要求整理三项核心能力，每项准备一段与简历经历对应的回答。",
    },
    {
      score: dimensions.professionalDepth / 20,
      text: "为项目经历补充方案选择、权衡依据、验证指标和复盘结论，准备追问答案。",
    },
    {
      score: dimensions.logicStructure / 15,
      text: "使用 STAR 框架重写本次最低分回答，并控制在 90 秒内完整表达。",
    },
    {
      score: dimensions.languageExpression / 15,
      text: "进行两轮 90 秒录音复述，减少口头语和长停顿，保持稳定语速。",
    },
  ];
  const actionPlan = dimensionPlans
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map(item => item.text);

  const trendNote = scoredAnswers.length >= 2
    ? (scoredAnswers[scoredAnswers.length - 1].score >= scoredAnswers[0].score
      ? "整体表现呈上升趋势"
      : "后半段表现有波动，建议加强稳定性")
    : "";
  const voiceAnswers = scoredAnswers.flatMap(answer => answer.speechMetrics ? [answer.speechMetrics] : []);
  const metricAverage = (pick: (metric: SpeechMetrics) => number) => voiceAnswers.length
    ? Math.round(voiceAnswers.reduce((sum, metric) => sum + pick(metric), 0) / voiceAnswers.length * 10) / 10
    : 0;
  const totalFillers = voiceAnswers.reduce(
    (sum, metric) => sum + Object.values(metric.fillerWordCounts).reduce((inner, value) => inner + value, 0),
    0,
  );
  const totalVoiceMinutes = voiceAnswers.reduce((sum, metric) => sum + metric.totalAnswerSeconds, 0) / 60;
  const fillerWordsPerMinute = totalVoiceMinutes > 0
    ? Math.round(totalFillers / totalVoiceMinutes * 10) / 10
    : 0;
  const averageThinkingSeconds = metricAverage(metric => metric.thinkingBeforeAnswerMs / 1000);
  const expressionSummary = {
    answersWithVoice: voiceAnswers.length,
    averageWordsPerMinute: metricAverage(metric => metric.wordsPerMinute),
    averagePauseRatio: metricAverage(metric => metric.pauseRatio),
    averageThinkingSeconds,
    totalFillers,
    fillerWordsPerMinute,
    observation: voiceAnswers.length === 0
      ? "本次没有可用的语音指标"
      : fillerWordsPerMinute > 6
        ? "口头语密度偏高，建议先停顿组织结构，再用完整句表达"
        : averageThinkingSeconds > 15
          ? "开口前思考时间较长，可先给结论，再补充依据"
          : "思考停顿与口头语处于可接受范围，表达节奏总体自然",
  };

  return {
    engineVersion: "XH-SCORE-V3.0",
    overallScore,
    dimensions,
    scoredAnswers,
    strengths,
    improvements,
    actionPlan,
    expressionSummary,
    trendNote,
    calculatedAt: new Date().toISOString(),
  };
}
