import { CAREER_PROFILES } from "./decision-engine.ts";
import { ABILITY_DIMENSIONS, calculatePortrait, type AbilityDimension, type EvidenceRecord, type PortraitResult } from "./growth-engine.ts";

export const CAREER_MATCH_ENGINE_VERSION = "XH-JFM-1.0";

export type CareerJobInput = {
  title: string;
  company: string;
  city: string;
  employmentType: string;
  description: string;
};

export type CareerRequirement = {
  id: string;
  label: string;
  dimension: AbilityDimension;
  priority: "required" | "preferred";
  keywords: string[];
};

export type CareerMatchResult = {
  engineVersion: string;
  modelMode: "deterministic";
  overallScore: number;
  confidence: number;
  verdict: "强匹配" | "较匹配" | "可尝试" | "需谨慎" | "暂不建议";
  formula: string;
  requirements: CareerRequirement[];
  dimensions: Array<{ name: string; score: number; weight: number; evidenceBasis: string }>;
  strengths: string[];
  gaps: Array<{ id: string; label: string; dimension: AbilityDimension; priority: "required" | "preferred"; recommendation: string }>;
  manualChecks: string[];
  evidenceBasis: { verifiedEvidence: number; portraitConfidence: number; matchedRequirements: number; totalRequirements: number };
  calculatedAt: string;
};

type RequirementRule = Omit<CareerRequirement, "id" | "priority"> & { priority?: "required" | "preferred" };

const requirementRules: RequirementRule[] = [
  { label: "Java / Spring", dimension: "项目实践", keywords: ["java", "spring", "springboot", "spring boot"] },
  { label: "Go / 服务端", dimension: "项目实践", keywords: ["golang", "go语言", "服务端"] },
  { label: "Python", dimension: "专业学习", keywords: ["python"] },
  { label: "数据库与 SQL", dimension: "项目实践", keywords: ["mysql", "postgresql", "sql", "redis", "数据库"] },
  { label: "接口与工程质量", dimension: "项目实践", keywords: ["接口", "api", "测试", "部署", "日志", "性能优化", "并发"] },
  { label: "机器学习 / 深度学习", dimension: "创新探索", keywords: ["机器学习", "深度学习", "pytorch", "tensorflow", "模型训练", "算法"] },
  { label: "数据分析", dimension: "专业学习", keywords: ["数据分析", "数据处理", "数据挖掘", "excel", "可视化"] },
  { label: "需求与产品思维", dimension: "沟通协作", keywords: ["需求分析", "用户研究", "产品", "原型", "优先级"] },
  { label: "沟通与团队协作", dimension: "沟通协作", keywords: ["沟通", "协作", "团队", "跨部门", "表达"] },
  { label: "科研与实验能力", dimension: "创新探索", keywords: ["论文", "实验", "复现", "科研", "调研"] },
  { label: "职业材料与面试准备", dimension: "职业准备", keywords: ["简历", "面试", "实习", "校招", "求职"] },
];

const gapActions: Record<AbilityDimension, (label: string, title: string) => string> = {
  "专业学习": label => `整理“${label}”知识清单，并完成一份可核验的课程或练习成果。`,
  "项目实践": (label, title) => `围绕“${title}”完成含个人职责、代码或作品链接、结果复盘的“${label}”项目佐证。`,
  "创新探索": label => `用调研、实验或竞赛成果补充“${label}”能力证据。`,
  "沟通协作": label => `完成一次与“${label}”相关的协作实践，并获取教师或团队成员评价。`,
  "职业准备": label => `完成“${label}”专项准备，提交简历、岗位对照或模拟面试报告作为佐证。`,
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function normalize(value: string) {
  return value.toLocaleLowerCase("zh-CN").replace(/\s+/g, " ");
}

function includesKeyword(text: string, keyword: string) {
  return text.includes(normalize(keyword));
}

function weightForRequirement(text: string, keywords: string[]) {
  const position = Math.min(...keywords.map(keyword => {
    const index = text.indexOf(normalize(keyword));
    return index < 0 ? Number.MAX_SAFE_INTEGER : index;
  }));
  if (!Number.isFinite(position) || position === Number.MAX_SAFE_INTEGER) return "preferred" as const;
  const nearby = text.slice(Math.max(0, position - 38), position + 80);
  return /必须|必需|要求|熟悉|掌握|具备|优先/.test(nearby) ? "required" as const : "preferred" as const;
}

export function deriveCareerRequirements(job: CareerJobInput): CareerRequirement[] {
  const source = normalize(`${job.title}\n${job.description}`);
  const found = requirementRules
    .filter(rule => rule.keywords.some(keyword => includesKeyword(source, keyword)))
    .map((rule, index) => ({
      id: `req-${index + 1}`,
      label: rule.label,
      dimension: rule.dimension,
      priority: rule.priority ?? weightForRequirement(source, rule.keywords),
      keywords: rule.keywords,
    }));

  if (found.length) return found;
  return [{
    id: "req-core",
    label: "岗位核心能力",
    dimension: "职业准备",
    priority: "required",
    keywords: [],
  }];
}

function scoreByDimension(portrait: PortraitResult, dimension: AbilityDimension) {
  return portrait.dimensions.find(item => item.name === dimension)?.score ?? 0;
}

function scoreRequirementCoverage(requirements: CareerRequirement[], evidence: EvidenceRecord[], dimensions: AbilityDimension[]) {
  const scoped = requirements.filter(item => dimensions.includes(item.dimension) && item.keywords.length);
  if (!scoped.length) return 0;
  const evidenceText = normalize(evidence
    .filter(item => item.verificationStatus === "verified")
    .map(item => `${item.title} ${item.detail} ${item.evidenceRef}`)
    .join("\n"));
  const total = scoped.reduce((sum, item) => sum + (item.priority === "required" ? 2 : 1), 0);
  const matched = scoped.reduce((sum, item) => {
    const hit = item.keywords.some(keyword => includesKeyword(evidenceText, keyword));
    return sum + (hit ? (item.priority === "required" ? 2 : 1) : 0);
  }, 0);
  return total ? Math.round(matched / total * 100) : 0;
}

function profileIntent(targetRole: string, interests: string[], job: CareerJobInput) {
  const profile = CAREER_PROFILES.find(item => item.id === targetRole || item.label === targetRole);
  if (!profile || profile.id === "exploration") return interests.length ? 58 : 50;
  const text = normalize(`${job.title}\n${job.description}\n${interests.join(" ")}`);
  const matched = profile.keywords.filter(keyword => includesKeyword(text, keyword)).length;
  return clamp(44 + matched / Math.max(1, profile.keywords.length) * 56);
}

function verdict(score: number): CareerMatchResult["verdict"] {
  if (score >= 75) return "强匹配";
  if (score >= 60) return "较匹配";
  if (score >= 45) return "可尝试";
  if (score >= 30) return "需谨慎";
  return "暂不建议";
}

export function buildCareerMatch(input: {
  job: CareerJobInput;
  evidence: EvidenceRecord[];
  targetRole: string;
  interests: string[];
  portrait?: PortraitResult;
  now?: number;
}): CareerMatchResult {
  const portrait = input.portrait ?? calculatePortrait(input.evidence, input.now);
  const requirements = deriveCareerRequirements(input.job);
  const learning = scoreByDimension(portrait, "专业学习");
  const projects = scoreByDimension(portrait, "项目实践");
  const innovation = scoreByDimension(portrait, "创新探索");
  const collaboration = scoreByDimension(portrait, "沟通协作");
  const readiness = scoreByDimension(portrait, "职业准备");
  const technicalCoverage = scoreRequirementCoverage(requirements, input.evidence, ["专业学习", "项目实践", "创新探索"]);
  const technical = Math.round(learning * 0.35 + projects * 0.4 + technicalCoverage * 0.25);
  const experience = Math.round(projects * 0.7 + innovation * 0.3);
  const behavior = collaboration;
  const alignment = Math.round(readiness * 0.6 + profileIntent(input.targetRole, input.interests, input.job) * 0.4);
  const overallScore = Math.round(technical * 0.3 + experience * 0.25 + behavior * 0.15 + alignment * 0.3);
  const requirementClarity = clamp(35 + Math.min(45, input.job.description.trim().length / 70) + Math.min(20, requirements.length * 3));
  const confidence = Math.round(clamp(portrait.confidence * 0.62 + requirementClarity * 0.22 + Math.min(16, portrait.verifiedEvidence * 2.7)));
  const verifiedText = normalize(input.evidence.filter(item => item.verificationStatus === "verified")
    .map(item => `${item.title} ${item.detail} ${item.evidenceRef}`).join("\n"));
  const matchedRequirements = requirements.filter(item => item.keywords.length && item.keywords.some(keyword => includesKeyword(verifiedText, keyword)));
  const strengths = matchedRequirements.slice(0, 3).map(item => `已核验成长材料中存在与“${item.label}”相关的证据。`);
  if (!strengths.length && portrait.verifiedEvidence) strengths.push("已有已核验成长佐证，但其中尚未检索到岗位关键词的直接对应材料。");
  if (!portrait.verifiedEvidence) strengths.push("当前没有已核验佐证，系统不会用默认经历抬高匹配分数。");
  const gaps = requirements
    .filter(item => !matchedRequirements.some(match => match.id === item.id))
    .slice(0, 5)
    .map(item => ({
      id: item.id,
      label: item.label,
      dimension: item.dimension,
      priority: item.priority,
      recommendation: gapActions[item.dimension](item.label, input.job.title),
    }));
  const manualChecks = [
    "请在投递前人工确认岗位发布日期、截止日期、城市与实习周期。",
    /应届|毕业|届|在读|实习/.test(input.job.description) ? "岗位原文含年级、毕业或实习要求，请结合个人学籍与时间安排确认资格。" : "岗位资格信息未完整识别，请以企业官方页面为准。",
  ];
  return {
    engineVersion: CAREER_MATCH_ENGINE_VERSION,
    modelMode: "deterministic",
    overallScore,
    confidence,
    verdict: verdict(overallScore),
    formula: "岗位匹配=技能30%+项目经历25%+沟通协作15%+职业方向30%；只有已核验佐证参与计算。",
    requirements,
    dimensions: [
      { name: "技能匹配", score: technical, weight: 30, evidenceBasis: `专业学习 ${learning}、项目实践 ${projects}、关键词佐证覆盖 ${technicalCoverage}%` },
      { name: "项目经历", score: experience, weight: 25, evidenceBasis: `项目实践 ${projects}、创新探索 ${innovation}` },
      { name: "沟通协作", score: behavior, weight: 15, evidenceBasis: `沟通协作 ${collaboration}` },
      { name: "职业方向", score: alignment, weight: 30, evidenceBasis: `职业准备 ${readiness}、目标方向与岗位文本对照` },
    ],
    strengths,
    gaps,
    manualChecks,
    evidenceBasis: {
      verifiedEvidence: portrait.verifiedEvidence,
      portraitConfidence: portrait.confidence,
      matchedRequirements: matchedRequirements.length,
      totalRequirements: requirements.length,
    },
    calculatedAt: new Date(input.now ?? Date.now()).toISOString(),
  };
}

export function buildCareerGapTasks(jobId: string, title: string, result: CareerMatchResult, semesterIndex: number) {
  return result.gaps.slice(0, 3).map((gap, index) => ({
    taskId: `career-${jobId.slice(0, 12)}-${index + 1}`,
    semesterIndex: clamp(Math.round(semesterIndex), 0, 7),
    title: `补强：${gap.label}`.slice(0, 100),
    note: gap.recommendation.slice(0, 240),
    type: "岗位补强",
    xp: gap.priority === "required" ? 35 : 25,
    isCustom: true,
    jobTitle: title,
  }));
}

export function isKnownAbilityDimension(value: string): value is AbilityDimension {
  return ABILITY_DIMENSIONS.includes(value as AbilityDimension);
}
