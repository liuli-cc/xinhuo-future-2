import { ABILITY_DIMENSIONS, type AbilityDimension, type PortraitResult } from "./growth-engine.ts";

export type CareerProfile = {
  id: string;
  label: string;
  description: string;
  thresholds: Record<AbilityDimension, number>;
  weights: Record<AbilityDimension, number>;
  keywords: string[];
};

export const CAREER_PROFILES: CareerProfile[] = [
  {
    id: "exploration",
    label: "探索方向",
    description: "先建立五维基础证据，再根据真实体验收敛方向。",
    thresholds: { "专业学习": 45, "项目实践": 40, "创新探索": 35, "沟通协作": 40, "职业准备": 30 },
    weights: { "专业学习": 24, "项目实践": 22, "创新探索": 20, "沟通协作": 18, "职业准备": 16 },
    keywords: ["探索", "专业认知", "兴趣"],
  },
  {
    id: "backend",
    label: "后端开发",
    description: "以计算机基础、工程实践和问题定位能力为核心。",
    thresholds: { "专业学习": 78, "项目实践": 82, "创新探索": 56, "沟通协作": 62, "职业准备": 68 },
    weights: { "专业学习": 28, "项目实践": 34, "创新探索": 12, "沟通协作": 10, "职业准备": 16 },
    keywords: ["后端", "Java", "Go", "数据库", "接口", "系统"],
  },
  {
    id: "algorithm",
    label: "算法工程师",
    description: "强调数学与专业基础、算法实验和可复现项目。",
    thresholds: { "专业学习": 86, "项目实践": 76, "创新探索": 82, "沟通协作": 58, "职业准备": 66 },
    weights: { "专业学习": 34, "项目实践": 24, "创新探索": 27, "沟通协作": 6, "职业准备": 9 },
    keywords: ["算法", "机器学习", "深度学习", "论文", "实验"],
  },
  {
    id: "data",
    label: "数据分析",
    description: "强调数据处理、业务理解、分析表达与作品展示。",
    thresholds: { "专业学习": 72, "项目实践": 76, "创新探索": 62, "沟通协作": 72, "职业准备": 70 },
    weights: { "专业学习": 24, "项目实践": 28, "创新探索": 16, "沟通协作": 17, "职业准备": 15 },
    keywords: ["数据", "SQL", "可视化", "分析", "业务"],
  },
  {
    id: "product",
    label: "产品经理",
    description: "强调问题发现、协作推进、结果验证与职业表达。",
    thresholds: { "专业学习": 58, "项目实践": 72, "创新探索": 74, "沟通协作": 86, "职业准备": 78 },
    weights: { "专业学习": 10, "项目实践": 23, "创新探索": 24, "沟通协作": 27, "职业准备": 16 },
    keywords: ["产品", "用户", "需求", "协作", "原型"],
  },
  {
    id: "postgraduate",
    label: "升学科研",
    description: "强调学业基础、科研探索、学术表达和持续研究证据。",
    thresholds: { "专业学习": 88, "项目实践": 68, "创新探索": 86, "沟通协作": 65, "职业准备": 60 },
    weights: { "专业学习": 36, "项目实践": 15, "创新探索": 32, "沟通协作": 10, "职业准备": 7 },
    keywords: ["考研", "科研", "论文", "实验室", "升学"],
  },
];

const actionLibrary: Record<AbilityDimension, Array<{ title: string; deliverable: string; cost: number }>> = {
  "专业学习": [
    { title: "完成一项核心课程诊断", deliverable: "课程知识清单、一次测验结果与改进记录", cost: 2 },
    { title: "沉淀一份课程作品", deliverable: "可查看作品、过程说明与教师反馈", cost: 3 },
  ],
  "项目实践": [
    { title: "交付一个最小可用项目", deliverable: "代码或作品链接、职责说明和验收结果", cost: 4 },
    { title: "补齐项目复盘", deliverable: "问题、行动、结果、个人贡献四段式复盘", cost: 2 },
  ],
  "创新探索": [
    { title: "完成一次问题调研或实验", deliverable: "调研记录、实验结果与结论", cost: 3 },
    { title: "参加一次创新实践", deliverable: "方案、过程材料与正式结果", cost: 4 },
  ],
  "沟通协作": [
    { title: "获取一次外部评价", deliverable: "教师或团队成员的具体反馈", cost: 1 },
    { title: "完成一次成果展示", deliverable: "展示材料、反馈清单与改进版本", cost: 2 },
  ],
  "职业准备": [
    { title: "完成一次岗位差距调研", deliverable: "3个岗位要求对照表与补强清单", cost: 2 },
    { title: "完成一次结构化面试", deliverable: "平台面试报告与一轮修改记录", cost: 1 },
  ],
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function profileFor(value: string) {
  return CAREER_PROFILES.find(item => item.id === value || item.label === value) ?? CAREER_PROFILES[0];
}

export function buildDecisionPlan(input: {
  portrait: PortraitResult;
  targetRole: string;
  interests?: string[];
  semesterIndex?: number;
  completedRecommendationIds?: string[];
  feedbackById?: Record<string, "accepted" | "completed" | "dismissed">;
}) {
  const target = profileFor(input.targetRole);
  const interestText = (input.interests ?? []).join(" ");
  const completed = new Set(input.completedRecommendationIds ?? []);
  const gaps = ABILITY_DIMENSIONS.map(dimension => {
    const score = input.portrait.dimensions.find(item => item.name === dimension)?.score ?? 0;
    const threshold = target.thresholds[dimension];
    const gap = Math.max(0, threshold - score);
    return {
      dimension,
      score,
      threshold,
      gap,
      weightedGap: Math.round(gap * target.weights[dimension]) / 100,
    };
  }).sort((a, b) => b.weightedGap - a.weightedGap);

  const semesterIndex = Math.max(0, Math.min(7, input.semesterIndex ?? 0));
  const urgency = clamp(35 + semesterIndex * 8);
  const recommendations = gaps.flatMap((gap, gapIndex) =>
    actionLibrary[gap.dimension].map((action, actionIndex) => {
      const id = `${target.id}-${gap.dimension}-${actionIndex}`.replaceAll(" ", "-");
      const feedback = input.feedbackById?.[id];
      const interestMatch = target.keywords.some(keyword => interestText.includes(keyword)) ? 88 : interestText ? 62 : 50;
      const executability = clamp(96 - action.cost * 12);
      const targetRelevance = clamp(60 + target.weights[gap.dimension]);
      const gapImpact = gap.threshold ? clamp(gap.gap / gap.threshold * 100) : 0;
      const priority = clamp(
        (gapImpact * 0.35 + targetRelevance * 0.25 + urgency * 0.15 + executability * 0.15 + interestMatch * 0.1) /
        (0.84 + action.cost * 0.08) + (feedback === "accepted" ? 4 : feedback === "dismissed" ? -24 : 0),
      );
      return {
        id,
        dimension: gap.dimension,
        title: action.title,
        deliverable: action.deliverable,
        priority: Math.round(priority),
        estimatedWeeks: Math.max(1, Math.ceil(action.cost / 2)),
        status: completed.has(id) || feedback === "completed" ? "completed" as const : "recommended" as const,
        rationale: `“${gap.dimension}”当前 ${gap.score} 分，目标基准 ${gap.threshold} 分；该行动与“${target.label}”权重为 ${target.weights[gap.dimension]}%。`,
        factors: {
          gapImpact: Math.round(gapImpact),
          targetRelevance: Math.round(targetRelevance),
          urgency: Math.round(urgency),
          executability: Math.round(executability),
          interestMatch: Math.round(interestMatch),
          cost: action.cost,
          feedbackAdjustment: feedback === "accepted" ? 4 : feedback === "dismissed" ? -24 : 0,
        },
        rankHint: gapIndex * 10 + actionIndex,
      };
    }),
  )
    .filter(item => item.status === "recommended")
    .sort((a, b) => b.priority - a.priority || a.rankHint - b.rankHint)
    .slice(0, 5)
    .map(({ rankHint, ...item }) => {
      void rankHint;
      return item;
    });

  const weightedReadiness = Math.round(ABILITY_DIMENSIONS.reduce((sum, dimension) => {
    const score = input.portrait.dimensions.find(item => item.name === dimension)?.score ?? 0;
    return sum + score * target.weights[dimension] / 100;
  }, 0));

  return {
    engineVersion: "XH-DPE-1.0",
    modelMode: "deterministic",
    target: { id: target.id, label: target.label, description: target.description },
    readiness: weightedReadiness,
    confidence: input.portrait.confidence,
    evidenceBasis: input.portrait.verifiedEvidence,
    gaps,
    recommendations,
    formula: "优先级=(差距影响×35%+目标相关×25%+紧迫度×15%+可执行性×15%+兴趣匹配×10%)/(0.84+成本×0.08)",
    generatedAt: new Date().toISOString(),
  };
}
