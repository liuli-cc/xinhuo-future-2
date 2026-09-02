/**
 * 岗位描述解析模块 (XH-JOB-1.0)
 */

export type JobStructured = {
  title: string;
  company: string;
  skills: string[];
  responsibilities: string[];
  experienceReq: string;
  coreCompetencies: string[];
  possibleQuestions: string[];
  difficulty: "entry" | "standard" | "advanced";
  missingFields: string[];
};

const SKILL_KEYWORDS = [
  "Java", "Python", "JavaScript", "TypeScript", "Go", "C++", "Rust", "SQL",
  "React", "Vue", "Angular", "Node.js", "Spring", "Django", "Flask",
  "Docker", "Kubernetes", "Linux", "AWS", "Azure", "Git",
  "机器学习", "深度学习", "NLP", "CV", "数据分析", "数据挖掘",
  "产品设计", "用户研究", "Figma", "Axure", "需求分析", "PRD",
  "沟通", "协作", "项目管理", "敏捷", "Scrum",
];

const RESPONSIBILITY_KEYWORDS = [
  "负责", "参与", "设计", "开发", "优化", "维护", "分析", "调研",
  "制定", "协调", "推动", "管理", "跟进", "输出", "交付", "上线",
];

const COMPETENCY_PATTERNS: Array<{ regex: RegExp; label: string }> = [
  { regex: /问题解决|故障排查|定位|debug/i, label: "问题解决能力" },
  { regex: /沟通|协作|团队|跨部门/i, label: "沟通协作能力" },
  { regex: /学习|快速|适应|新技术/i, label: "学习能力" },
  { regex: /独立|自主|owner/i, label: "独立负责能力" },
  { regex: /架构|系统设计|方案/i, label: "架构设计能力" },
  { regex: /数据驱动|指标|AB|实验/i, label: "数据驱动思维" },
  { regex: /创新|突破|优化|改进/i, label: "创新能力" },
  { regex: /领导|带领|指导|mentor/i, label: "领导力" },
];

function clean(value: unknown, max = 200): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

export function parseJobDescription(title: string, description: string, company = ""): JobStructured {
  const t = clean(title, 100);
  const desc = clean(description, 6000);
  const comp = clean(company, 80);
  const fullText = `${t}\n${desc}`;

  const skills = SKILL_KEYWORDS.filter(kw =>
    fullText.toLowerCase().includes(kw.toLowerCase())
  ).slice(0, 10);

  const responsibilities = desc
    .split(/[；;。\n]+/)
    .filter(line => RESPONSIBILITY_KEYWORDS.some(kw => line.includes(kw)))
    .map(line => clean(line, 200))
    .filter(Boolean)
    .slice(0, 8);

  const experienceReq = (() => {
    const yearMatch = fullText.match(/(\d+)[-~至到]\d+\s*年|(\d+)\s*年以上?/);
    if (yearMatch) return yearMatch[0];
    if (/应届|实习|校招|毕业生/.test(fullText)) return "应届或实习";
    if (/初级|助理/.test(fullText)) return "1-2年";
    if (/高级|资深|专家/.test(fullText)) return "5年以上";
    return "未明确";
  })();

  const coreCompetencies = COMPETENCY_PATTERNS
    .filter(p => p.regex.test(fullText))
    .map(p => p.label);

  const possibleQuestions: string[] = [];
  if (skills.length) possibleQuestions.push(`请介绍你在${skills[0]}方面的实际项目经验`);
  if (responsibilities.length) possibleQuestions.push(`${responsibilities[0].slice(0, 40)}——你在这方面有哪些具体成果？`);
  if (coreCompetencies.length) possibleQuestions.push(`请举例说明你如何运用${coreCompetencies[0]}`);

  const difficulty = (() => {
    if (/高级|资深|专家|负责人|经理|主管/.test(fullText)) return "advanced";
    if (/应届|实习|校招|初级|助理/.test(fullText)) return "entry";
    return "standard";
  })();

  const missingFields: string[] = [];
  if (!t) missingFields.push("岗位名称");
  if (!desc || desc.length < 10) missingFields.push("岗位描述（至少10字）");
  if (!comp) missingFields.push("企业名称（选填）");

  return { title: t, company: comp, skills, responsibilities, experienceReq, coreCompetencies, possibleQuestions, difficulty, missingFields };
}
