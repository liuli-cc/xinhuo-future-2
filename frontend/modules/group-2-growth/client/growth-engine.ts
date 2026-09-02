export const ABILITY_DIMENSIONS = ["专业学习", "项目实践", "创新探索", "沟通协作", "职业准备"] as const;
export type AbilityDimension = typeof ABILITY_DIMENSIONS[number];

export const SOURCE_META = {
  course_record: { label: "课程成绩或教务记录", reliability: 90 },
  project_artifact: { label: "项目作品或交付物", reliability: 82 },
  competition_certificate: { label: "竞赛成绩或正式证书", reliability: 92 },
  teacher_review: { label: "教师或导师评价", reliability: 95 },
  peer_review: { label: "团队成员或同伴评价", reliability: 70 },
  self_report: { label: "个人复盘或自述", reliability: 45 },
} as const;
export type EvidenceSource = keyof typeof SOURCE_META;

export type VerificationStatus = "pending" | "verified" | "rejected";

export type EvidenceRecord = {
  id: number;
  studentId: string;
  taskId: string;
  title: string;
  category: string;
  dimension: AbilityDimension;
  detail: string;
  evidenceRef: string;
  evidenceDate: string;
  sourceType: EvidenceSource;
  sourceReliability: number;
  relevance: number;
  quality: number;
  contribution: number;
  verificationStatus: VerificationStatus;
  reviewerNote: string;
  reviewedAt: number | null;
  createdAt: number;
  attachmentId?: string | null;
  attachmentName?: string | null;
  attachmentMime?: string | null;
  attachmentBytes?: number | null;
  attachmentSha256?: string | null;
  attachmentVersion?: number | null;
  attachmentUrl?: string | null;
};

export type ScoredEvidence = EvidenceRecord & {
  recencyWeight: number;
  effectiveWeight: number;
  impact: number;
};

export type DimensionScore = {
  name: AbilityDimension;
  score: number;
  confidence: number;
  evidenceCount: number;
  verifiedCount: number;
  weightSum: number;
  sourceDiversity: number;
};

export type PortraitResult = {
  algorithmVersion: string;
  overallScore: number;
  completeness: number;
  confidence: number;
  totalEvidence: number;
  verifiedEvidence: number;
  pendingEvidence: number;
  dimensions: DimensionScore[];
  evidence: ScoredEvidence[];
  nextAction: { dimension: AbilityDimension; title: string; detail: string };
  calculatedAt: string;
};

export const GROWTH_ALGORITHM_VERSION = "XH-EGM-2.0";

const nextActionCopy: Record<AbilityDimension, string> = {
  "专业学习": "添加近期课程成绩、课程作品或教师评价。",
  "项目实践": "补充真实项目中的个人职责、交付物和可量化结果。",
  "创新探索": "提交一次竞赛、调研、创意方案或创新实践的成果证据。",
  "沟通协作": "邀请团队成员或教师对协作、表达与责任履行给出评价。",
  "职业准备": "补充职业调研、简历评审、模拟面试或实习申请记录。",
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

export function getRecencyWeight(date: string, now = Date.now()) {
  const timestamp = new Date(`${date}T00:00:00`).getTime();
  if (!Number.isFinite(timestamp)) return 0.65;
  const days = Math.max(0, (now - timestamp) / 86_400_000);
  if (days <= 180) return 1;
  if (days <= 365) return 0.9;
  if (days <= 730) return 0.78;
  return 0.65;
}

export function scoreEvidence(record: EvidenceRecord, now = Date.now()): ScoredEvidence {
  const recencyWeight = getRecencyWeight(record.evidenceDate, now);
  const verificationWeight = record.verificationStatus === "verified" ? 1 : 0;
  const effectiveWeight =
    clamp(record.sourceReliability) / 100 *
    clamp(record.relevance) / 100 *
    clamp(record.quality) / 100 *
    clamp(record.contribution) / 100 *
    recencyWeight *
    verificationWeight;
  return {
    ...record,
    recencyWeight: Math.round(recencyWeight * 100) / 100,
    effectiveWeight: Math.round(effectiveWeight * 1000) / 1000,
    impact: Math.round(effectiveWeight * 180) / 10,
  };
}

export function calculatePortrait(records: EvidenceRecord[], now = Date.now()): PortraitResult {
  const evidence = records.map(record => scoreEvidence(record, now));
  const verifiedEvidence = evidence.filter(item => item.verificationStatus === "verified");
  const dimensions = ABILITY_DIMENSIONS.map(name => {
    const items = verifiedEvidence.filter(item => item.dimension === name);
    const sourceCounts = new Map<EvidenceSource, number>();
    const weightSum = [...items]
      .sort((a, b) => b.effectiveWeight - a.effectiveWeight)
      .reduce((sum, item) => {
        const repeated = sourceCounts.get(item.sourceType) ?? 0;
        sourceCounts.set(item.sourceType, repeated + 1);
        const diminishingFactor = [1, 0.72, 0.52, 0.38][Math.min(repeated, 3)];
        return sum + item.effectiveWeight * diminishingFactor;
      }, 0);
    const sourceDiversity = sourceCounts.size;
    const diversityBonus = 1 + Math.min(0.16, Math.max(0, sourceDiversity - 1) * 0.04);
    const adjustedWeight = weightSum * diversityBonus;
    const averageReliability = items.length ? items.reduce((sum, item) => sum + item.sourceReliability, 0) / items.length : 0;
    const evidenceConfidence = 1 - Math.exp(-adjustedWeight / 1.8);
    const confidence = items.length
      ? Math.round(clamp(evidenceConfidence * 62 + Math.min(1, sourceDiversity / 3) * 18 + averageReliability * 0.2))
      : 0;
    const rawScore = 100 * (1 - Math.exp(-adjustedWeight / 2.15));
    const score = Math.round(clamp(rawScore * (0.72 + confidence / 100 * 0.28)));
    return {
      name,
      score,
      confidence,
      evidenceCount: items.length,
      verifiedCount: items.filter(item => item.verificationStatus === "verified").length,
      weightSum: Math.round(adjustedWeight * 100) / 100,
      sourceDiversity,
    };
  });

  const supported = dimensions.filter(item => item.evidenceCount > 0);
  const overallScore = Math.round(dimensions.reduce((sum, item) => sum + item.score, 0) / ABILITY_DIMENSIONS.length);
  const confidence = Math.round(dimensions.reduce((sum, item) => sum + item.confidence, 0) / ABILITY_DIMENSIONS.length);
  const coveredDimensions = supported.length / ABILITY_DIMENSIONS.length;
  const evidenceDepth = Math.min(1, verifiedEvidence.length / 12);
  const completeness = Math.round((coveredDimensions * 0.65 + evidenceDepth * 0.35) * 100);
  const priority = [...dimensions].sort((a, b) => {
    if (a.evidenceCount === 0 && b.evidenceCount > 0) return -1;
    if (b.evidenceCount === 0 && a.evidenceCount > 0) return 1;
    return a.score - b.score;
  })[0];

  return {
    algorithmVersion: GROWTH_ALGORITHM_VERSION,
    overallScore,
    completeness,
    confidence,
    totalEvidence: evidence.length,
    verifiedEvidence: verifiedEvidence.length,
    pendingEvidence: evidence.filter(item => item.verificationStatus === "pending").length,
    dimensions,
    evidence,
    nextAction: {
      dimension: priority.name,
      title: priority.evidenceCount ? `继续验证“${priority.name}”` : `首先建立“${priority.name}”证据`,
      detail: nextActionCopy[priority.name],
    },
    calculatedAt: new Date(now).toISOString(),
  };
}
