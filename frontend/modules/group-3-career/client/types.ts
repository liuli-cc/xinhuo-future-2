/** 实习就业 v2 共享类型（与后端 camelCase 输出一一对应）。 */

export type Stage =
  | "saved" | "applied" | "written_test_pending" | "written_test"
  | "interview_pending" | "interview" | "offer";
export type Outcome = "rejected" | "withdrawn";
export type JobCategory = "intern" | "campus" | "social";

export type MatchResult = {
  engineVersion: string;
  overallScore: number;
  confidence: number;
  verdict: string;
  formula: string;
  hardFilter: { passed: boolean; reasons: string[]; unverifiable: string[] };
  skills: Array<{ name: string; required: boolean; matched: boolean; evidence: string | null }>;
  dimensions: Array<{ name: string; score: number; weight: number; evidenceBasis: string }>;
  strengths: string[];
  gaps: Array<{ id: string; label: string; priority: string; recommendation: string }>;
  manualChecks: string[];
  evidenceBasis: { verifiedEvidence: number; matchedSkills: number; totalSkills: number };
  calculatedAt: string;
};

export type JobMatchSummary = { overallScore: number; confidence: number; verdict: string; result: MatchResult; updatedAt: number };

export type JobRequirement = { id: string; label: string; dimension: string; priority: "required" | "preferred"; keywords: string[] };

export type Job = {
  id: string; title: string; company: string; city: string; employmentType: string;
  category: JobCategory; salary: string; majorsText: string;
  industries: string[]; companyNature: string; tags: string[];
  source: "import" | "school_coop" | "custom"; visibility: "public" | "private";
  status: string; sourceUrl: string; sourceName: string; description: string;
  requirements: JobRequirement[]; skills: Array<{ name: string; required: boolean }>;
  publishedAt: number; deadline: number | null; expired: boolean;
  createdAt: number; updatedAt: number;
  match: JobMatchSummary | null;
  application: { id: string; stage: Stage; outcome: Outcome | null; stageLabel: string; note: string; updatedAt: number } | null;
  favorited: boolean | null;
  employer?: { id: number; name: string; industry: string; organizationType: string; city: string; address: string };
};

export type Announcement = {
  id: string; title: string; company: string; cityText: string; cohort: string;
  positionsText: string; industries: string[]; companyNature: string;
  detailUrl: string; applyUrl: string; description: string;
  source: string; status: string; publishedAt: number; deadline: number | null;
  expired: boolean; createdAt: number; updatedAt: number;
  favorited: boolean | null;
  application: { id: string; stage: Stage; outcome: Outcome | null; stageLabel: string; note: string } | null;
};

export type ApplicationRecord = {
  id: string; stage: Stage; outcome: Outcome | null; stageLabel: string; outcomeLabel: string;
  note: string; submittedAt: number | null; lastEventAt: number | null; closedAt: number | null;
  eventCount: number; createdAt: number; updatedAt: number;
  title: string; company: string; city: string; cohort: string;
  employmentType: string; category: string; sourceUrl: string;
  matchScore: number | null; matchVerdict: string | null;
};

export type StageOption = { value: string; label: string };
export type TimelineEvent = { id: string; stage: string; note: string; createdAt: number };

export function formatDay(value: number | null | undefined) {
  if (!value) return "未注明";
  return new Date(value).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}

export const categoryLabels: Record<JobCategory, string> = { intern: "实习", campus: "校招", social: "社招" };
