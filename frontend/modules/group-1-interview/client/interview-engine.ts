import type { InterviewModelAnalysis, InterviewModelProvider } from "./interview-model";

export type InterviewAnswer = {
  question: string;
  answer: string;
  seconds: number;
  modelInsight?: InterviewModelAnalysis;
};

export type InterviewModelContext = {
  provider: InterviewModelProvider;
  modelName: string;
};

const roleKeywords: Record<string, string[]> = {
  "后端开发": ["接口", "数据库", "性能", "并发", "测试", "部署", "日志", "定位"],
  "产品经理": ["用户", "需求", "价值", "优先级", "数据", "验证", "协作", "迭代"],
  "算法工程师": ["数据", "模型", "指标", "实验", "误差", "复现", "特征", "优化"],
  "通用能力": ["目标", "行动", "结果", "反馈", "改进", "协作"],
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function includesAny(text: string, patterns: RegExp[]) {
  return patterns.some(pattern => pattern.test(text));
}

export function scoreInterviewAnswer(answer: InterviewAnswer, role: string) {
  const text = answer.answer.trim();
  const structureSignals = [
    includesAny(text, [/当时|背景|情境|在.+期间/]),
    includesAny(text, [/目标|任务|负责|需要/]),
    includesAny(text, [/我先|我负责|我采用|我通过|具体做法|随后/]),
    includesAny(text, [/最终|结果|提升|降低|完成|获得|达成/]),
  ];
  const structure = Math.round(structureSignals.filter(Boolean).length / 4 * 100);
  const quantified = /(?:\d+(?:\.\d+)?%?|\d+[个项次天周月人]|第一|前\d)/.test(text);
  const actionCount = (text.match(/我(?:负责|完成|设计|实现|组织|协调|分析|优化|推进|解决)/g) ?? []).length;
  const specificity = clamp(28 + Math.min(text.length, 180) / 180 * 42 + (quantified ? 20 : 0) + Math.min(10, actionCount * 5));
  const keywords = roleKeywords[role] ?? roleKeywords["通用能力"];
  const matchedKeywords = keywords.filter(keyword => text.includes(keyword));
  const roleMatch = clamp(25 + matchedKeywords.length / Math.max(4, keywords.length) * 75);
  const targetSeconds = answer.seconds || Math.round(text.length / 4);
  const efficiency = targetSeconds >= 35 && targetSeconds <= 150
    ? 90
    : targetSeconds < 20 || targetSeconds > 240 ? 45 : 70;
  const content = clamp(structure * 0.42 + specificity * 0.38 + (quantified ? 20 : 8));
  const score = Math.round(content * 0.35 + structure * 0.25 + roleMatch * 0.25 + efficiency * 0.15);
  const suggestions: string[] = [];
  if (structure < 75) suggestions.push("补齐情境、任务、行动、结果四个要素");
  if (!quantified) suggestions.push("加入人数、周期、比例或效率变化等量化结果");
  if (actionCount === 0) suggestions.push("明确使用“我负责/我完成”说明个人贡献");
  if (matchedKeywords.length < 2) suggestions.push(`增加与${role}工作任务直接相关的细节`);
  if (!suggestions.length) suggestions.push("将最有说服力的结果放到回答开头");
  return {
    score,
    metrics: {
      content: Math.round(content),
      structure,
      roleMatch: Math.round(roleMatch),
      efficiency,
    },
    signals: {
      starElements: structureSignals.filter(Boolean).length,
      quantified,
      actionCount,
      matchedKeywords,
    },
    suggestions,
  };
}

export function scoreInterview(answers: InterviewAnswer[], role: string, modelContext?: InterviewModelContext) {
  const items = answers.map(answer => ({ ...answer, evaluation: scoreInterviewAnswer(answer, role) }));
  const metric = (key: "content" | "structure" | "roleMatch" | "efficiency") =>
    items.length ? Math.round(items.reduce((sum, item) => sum + item.evaluation.metrics[key], 0) / items.length) : 0;
  const metrics = {
    content: metric("content"),
    structure: metric("structure"),
    roleMatch: metric("roleMatch"),
    efficiency: metric("efficiency"),
  };
  const overallScore = Math.round(metrics.content * 0.35 + metrics.structure * 0.25 + metrics.roleMatch * 0.25 + metrics.efficiency * 0.15);
  const quantifiedAnswers = items.filter(item => item.evaluation.signals.quantified).length;
  const starCompleteAnswers = items.filter(item => item.evaluation.signals.starElements === 4).length;
  const modelAssistedAnswers = items.filter(item => item.modelInsight).length;
  return {
    engineVersion: "XH-SIE-1.1",
    modelMode: modelContext && modelAssistedAnswers > 0 ? "hybrid" : "deterministic",
    model: modelContext && modelAssistedAnswers > 0 ? {
      provider: modelContext.provider,
      name: modelContext.modelName,
      assistedAnswers: modelAssistedAnswers,
    } : undefined,
    overallScore,
    metrics,
    evidence: {
      answerCount: items.length,
      quantifiedAnswers,
      starCompleteAnswers,
    },
    summary: overallScore >= 80 ? "表达基础扎实，重点提升岗位细节与结果前置。" : overallScore >= 60 ? "回答已有基本结构，下一步应强化个人行动和量化结果。" : "建议先用 STAR 框架重写回答，再进行下一轮练习。",
    items,
    calculatedAt: new Date().toISOString(),
  };
}
