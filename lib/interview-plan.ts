/**
 * DeepSeek 面试计划生成模块 (XH-PLAN-1.0)
 */

import type { ResumeStructured } from "./resume-parser";
import type { JobStructured } from "./job-parser";

export type InterviewPlanQuestion = {
  id: string;
  category: "self_intro" | "resume_deep" | "professional" | "scenario" | "teamwork" | "pressure" | "career" | "reverse";
  label: string;
  guidance: string;
};

export type InterviewPlan = {
  questions: InterviewPlanQuestion[];
  estimatedMinutes: number;
  focusAreas: string[];
};

const CATEGORY_META: Record<string, { label: string; guidance: string }> = {
  self_intro: { label: "自我介绍", guidance: "用1分钟介绍个人信息、专业背景和核心优势" },
  resume_deep: { label: "简历深挖", guidance: "选取简历中最有代表性的项目经历深入追问" },
  professional: { label: "岗位专业能力", guidance: "考察与目标岗位直接相关的专业技能和知识" },
  scenario: { label: "情景处理", guidance: "给定工作场景，评估问题分析和解决思路" },
  teamwork: { label: "团队协作", guidance: "了解团队协作经验、冲突处理和沟通风格" },
  pressure: { label: "压力追问", guidance: "在限定条件下追问，评估抗压和临场反应" },
  career: { label: "职业规划", guidance: "了解职业目标、发展方向和成长动力" },
  reverse: { label: "反问环节", guidance: "候选人向面试官提问，了解公司和岗位" },
};

export function buildInterviewPlanPrompt(
  resume: ResumeStructured | null,
  job: JobStructured | null,
): string {
  const parts: string[] = [
    "你是一名专业面试官，请根据候选人简历和岗位信息生成面试计划。",
    "面试计划包含6-8道题，分属不同类别。",
    "",
  ];

  if (resume) {
    parts.push("=== 候选人简历（已脱敏） ===");
    if (resume.name) parts.push(`姓名：${resume.name}`);
    if (resume.education) parts.push(`学历：${resume.education}`);
    if (resume.major) parts.push(`专业：${resume.major}`);
    if (resume.skills.length) parts.push(`技能：${resume.skills.join("、")}`);
    if (resume.projects.length) parts.push(`项目经历：${resume.projects.map(p => p.name).join("；")}`);
    if (resume.internships.length) parts.push(`实习经历：${resume.internships.map(i => `${i.company} ${i.role}`).join("；")}`);
    parts.push("");
  }

  if (job) {
    parts.push("=== 目标岗位 ===");
    parts.push(`岗位：${job.title}`);
    if (job.company) parts.push(`企业：${job.company}`);
    if (job.skills.length) parts.push(`技能要求：${job.skills.join("、")}`);
    if (job.responsibilities.length) parts.push(`工作职责：${job.responsibilities.join("；")}`);
    parts.push("");
  }

  parts.push("=== 输出格式 ===");
  parts.push("返回 JSON：");
  parts.push('{"questions":[{"category":"self_intro","question":"问题正文","guidance":"考察要点"}]}');
  parts.push("category 必须是以下之一：self_intro, resume_deep, professional, scenario, teamwork, pressure, career, reverse");
  parts.push("");
  parts.push("规则：");
  parts.push("1. 必须包含 self_intro 类别的1道题");
  parts.push("2. 每个类别最多1道题");
  parts.push("3. 总共6-8道题");
  parts.push("4. 问题使用简洁中文，不超过120汉字");
  parts.push("5. 问题必须与简历和岗位信息相关");

  return parts.join("\n");
}

export function parseInterviewPlanResponse(raw: string): InterviewPlan | null {
  try {
    const text = String(raw ?? "").replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    const parsed = JSON.parse(text.slice(start, end + 1));
    const questions = (Array.isArray(parsed.questions) ? parsed.questions : [])
      .map((q: Record<string, unknown>) => ({
        id: crypto.randomUUID(),
        category: String(q.category || "professional"),
        label: String(q.question || "").slice(0, 240),
        guidance: String(q.guidance || "").slice(0, 200),
      }))
      .filter((q: InterviewPlanQuestion) =>
        Object.keys(CATEGORY_META).includes(q.category) && q.label.length >= 6,
      );

    if (questions.length < 3) return null;

    const focusAreas = (Array.from(new Set(questions.map((q: InterviewPlanQuestion) => q.category))) as string[])
      .map(c => CATEGORY_META[c]?.label ?? c);

    return {
      questions,
      estimatedMinutes: questions.length * 4,
      focusAreas,
    };
  } catch {
    return null;
  }
}

export function defaultInterviewPlan(resume: ResumeStructured | null, job: JobStructured | null): InterviewPlan {
  const questions: InterviewPlanQuestion[] = [
    { id: "q1", category: "self_intro", label: "请做一个1分钟的自我介绍，说明你的专业背景和核心优势。", guidance: "评估表达能力和自我认知" },
    { id: "q2", category: "resume_deep", label: resume?.projects?.[0]?.name
      ? `请详细介绍你在"${resume.projects[0].name}"项目中的角色和贡献。`
      : "请介绍你最有代表性的一个项目经历。", guidance: "考察项目深度和个人贡献" },
    { id: "q3", category: "professional", label: job?.skills?.[0]
      ? `请描述你在${job.skills[0]}方面的实践经验。`
      : "请描述你最有信心的专业技能及其应用场景。", guidance: "评估专业能力匹配度" },
    { id: "q4", category: "scenario", label: "如果在工作中遇到超出你能力范围的任务，你会如何处理？", guidance: "考察问题解决和主动性" },
    { id: "q5", category: "teamwork", label: "请分享一次团队协作经历，并说明你在其中的角色。", guidance: "了解团队协作和沟通能力" },
    { id: "q6", category: "pressure", label: "如果你的方案被上级或客户直接否定，你会怎么应对？", guidance: "评估抗压和适应性" },
    { id: "q7", category: "career", label: "你未来三年的职业目标是什么？这个岗位如何帮助你实现？", guidance: "了解职业规划和发展动力" },
  ];

  return {
    questions,
    estimatedMinutes: 28,
    focusAreas: ["自我介绍", "简历深挖", "专业能力", "情景处理", "团队协作", "压力追问", "职业规划"],
  };
}
