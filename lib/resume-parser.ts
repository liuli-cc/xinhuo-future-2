/**
 * 简历解析与隐私脱敏模块 (XH-RESUME-1.0)
 *
 * 前端和后端共享的纯函数，不依赖Node.js文件系统。
 * 实际文件读取在上传时由后端处理。
 */

export type ResumeField =
  | "name" | "education" | "major" | "skills"
  | "projects" | "internships" | "competitions" | "selfEval";

export type ResumeStructured = {
  name: string;
  education: string;
  major: string;
  skills: string[];
  projects: Array<{ name: string; description: string }>;
  internships: Array<{ company: string; role: string; description: string }>;
  competitions: Array<{ name: string; award: string }>;
  selfEval: string;
};

// CloudBase HTTP functions cap the request body. Base64 adds roughly 33%, so a
// 3 MB source document stays comfortably below the gateway limit together with
// the JSON envelope.
export const RESUME_MAX_BYTES = 3 * 1024 * 1024;
export const RESUME_MAX_MB = RESUME_MAX_BYTES / 1024 / 1024;
export const ALLOWED_RESUME_MIME = [
  "application/pdf",
  "application/x-pdf",
  "application/acrobat",
  "application/vnd.pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
  "text/markdown",
  "text/x-markdown",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/bmp",
];
export const ALLOWED_RESUME_EXT = [
  ".pdf", ".doc", ".docx", ".txt", ".md", ".markdown",
  ".jpg", ".jpeg", ".png", ".webp", ".bmp",
];

const PII_PATTERNS: Array<{ name: string; regex: RegExp; replacement: string }> = [
  { name: "手机号", regex: /1[3-9]\d{9}/g, replacement: "[手机号已隐藏]" },
  { name: "身份证号", regex: /\d{17}[\dXx]/g, replacement: "[身份证号已隐藏]" },
  { name: "邮箱", regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: "[邮箱已隐藏]" },
  { name: "家庭地址", regex: /(?:住址|地址|家庭住址)[:：]\s*(.+?)(?:[\n\r]|$)/g, replacement: "地址：[已隐藏]" },
  { name: "QQ号", regex: /[Qq]{2}[：:]?\s*\d{5,12}/g, replacement: "[QQ已隐藏]" },
  { name: "微信号", regex: /(?:微信|WeChat|wx)[:：]?\s*[a-zA-Z0-9_-]{5,20}/g, replacement: "[微信已隐藏]" },
];

export function validateResumeFile(name: string, size: number, mimeType: string): string | null {
  if (size <= 0) return "文件大小为0，请选择有效简历文件";
  if (size > RESUME_MAX_BYTES) return `文件大小 ${(size / 1024 / 1024).toFixed(1)}MB 超过 ${RESUME_MAX_MB}MB 限制，请压缩后重新上传`;
  const ext = name.toLowerCase().slice(name.lastIndexOf("."));
  if (!ALLOWED_RESUME_EXT.includes(ext)) return `不支持 ${ext} 格式，请上传 PDF、Word、TXT、Markdown 或常见图片格式简历`;
  // Safari and some office suites report an empty or generic MIME type. The
  // backend verifies the file signature, so do not reject those valid files in
  // the browser.
  if (mimeType && mimeType !== "application/octet-stream" && !ALLOWED_RESUME_MIME.includes(mimeType)) {
    return `文件类型 ${mimeType} 与扩展名不匹配，请重新导出标准文档或图片文件`;
  }
  return null;
}

export function desensitizeResume(text: string): string {
  let result = text;
  for (const pattern of PII_PATTERNS) {
    result = result.replace(pattern.regex, pattern.replacement);
  }
  return result;
}

function extractAfterLabel(text: string, labels: string[]): string {
  for (const label of labels) {
    const idx = text.indexOf(label);
    if (idx >= 0) {
      const after = text.slice(idx + label.length);
      const end = after.search(/[\n\r]{2,}|[一二三四五六七八九十]、|第[一二三四五六七八九十]|(?:\d+[.、])/);
      return end > 0 ? after.slice(0, end).trim() : after.slice(0, 200).trim();
    }
  }
  return "";
}

function extractBulletList(text: string, sectionLabels: string[]): string[] {
  for (const label of sectionLabels) {
    const idx = text.indexOf(label);
    if (idx >= 0) {
      const section = text.slice(idx + label.length);
      const end = section.search(/[\n\r]{3,}|[一二三四五六七八九十]、\s*(?:教育|实习|项目|技能|自我|获奖|证书)/);
      const block = end > 0 ? section.slice(0, end).trim() : section.slice(0, 3000).trim();
      return block
        .split(/[\n\r]+/)
        .map(line => line.replace(/^[\s•·●○►\-–—*\d]+[.、]?\s*/, "").trim())
        .filter(line => line.length > 2 && line.length < 200);
    }
  }
  return [];
}

function extractName(text: string): string {
  const firstLine = text.split(/[\n\r]/)[0]?.trim() || "";
  const cnName = firstLine.match(/[\u4e00-\u9fff]{2,4}/);
  if (cnName && cnName[0].length >= 2 && cnName[0].length <= 4) return cnName[0];
  return "";
}

function extractSectionPairs(text: string, sectionLabels: string[]): Array<{ name: string; description: string }> {
  for (const label of sectionLabels) {
    const idx = text.indexOf(label);
    if (idx >= 0) {
      const section = text.slice(idx + label.length);
      const end = section.search(/[\n\r]{3,}|[一二三四五六七八九十]、\s*(?:教育|实习|项目|技能|自我|获奖|证书|语言)/);
      const block = end > 0 ? section.slice(0, end).trim() : section.slice(0, 3000).trim();
      const lines = block.split(/[\n\r]+/).map(l => l.trim()).filter(Boolean);
      const pairs: Array<{ name: string; description: string }> = [];
      let current: { name: string; description: string } | null = null;
      for (const line of lines) {
        const cleaned = line.replace(/^[\s•·●○►\-–—*\d]+[.、]?\s*/, "").trim();
        if (!current) {
          current = { name: cleaned.slice(0, 80), description: "" };
        } else if (cleaned.length < 60 && !/。|；|，/.test(cleaned)) {
          pairs.push(current);
          current = { name: cleaned.slice(0, 80), description: "" };
        } else {
          current.description += (current.description ? "；" : "") + cleaned;
        }
      }
      if (current && current.name) pairs.push(current);
      return pairs.slice(0, 6);
    }
  }
  return [];
}

export function parseResumeText(text: string): ResumeStructured {
  const t = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return {
    name: extractName(t),
    education: extractAfterLabel(t, ["教育背景", "学历", "教育经历", "学校", "毕业院校"]),
    major: extractAfterLabel(t, ["专业", "所学专业", "主修专业"]),
    skills: extractBulletList(t, ["技能", "专业技能", "技术栈", "掌握技能", "语言能力"]),
    projects: extractSectionPairs(t, ["项目经历", "项目经验", "科研项目", "项目"]),
    internships: extractSectionPairs(t, ["实习经历", "工作经历", "实习经验", "工作经验", "社会实践"]).map(p => {
      const roleMatch = p.name.match(/(?:实习生|工程师|专员|助理|经理|主管|负责人)/);
      return { company: roleMatch ? p.name.slice(0, p.name.indexOf(roleMatch[0])).trim() || p.name : p.name, role: roleMatch?.[0] || "", description: p.description };
    }),
    competitions: extractSectionPairs(t, ["竞赛", "获奖", "证书", "比赛", "荣誉"]).map(p => ({ name: p.name, award: p.description || p.name })),
    selfEval: extractAfterLabel(t, ["自我评价", "个人评价", "自我介绍", "个人简介", "关于我"]),
  };
}

export function resumeStructuredSummary(resume: ResumeStructured): string {
  const parts: string[] = [];
  if (resume.name) parts.push(`姓名：${resume.name}`);
  if (resume.education) parts.push(`学历：${resume.education}`);
  if (resume.major) parts.push(`专业：${resume.major}`);
  if (resume.skills.length) parts.push(`技能：${resume.skills.slice(0, 10).join("、")}`);
  if (resume.projects.length) parts.push(`项目：${resume.projects.slice(0, 3).map(p => p.name).join("、")}`);
  if (resume.internships.length) parts.push(`实习：${resume.internships.slice(0, 3).map(i => `${i.company}${i.role}`).join("、")}`);
  if (resume.competitions.length) parts.push(`竞赛：${resume.competitions.slice(0, 3).map(c => c.name).join("、")}`);
  if (resume.selfEval) parts.push(`自评：${resume.selfEval.slice(0, 200)}`);
  return parts.join("\n");
}

export function isResumeFieldEmpty(resume: ResumeStructured, field: ResumeField): boolean {
  switch (field) {
    case "name": return !resume.name;
    case "education": return !resume.education;
    case "major": return !resume.major;
    case "skills": return resume.skills.length === 0;
    case "projects": return resume.projects.length === 0;
    case "internships": return resume.internships.length === 0;
    case "competitions": return resume.competitions.length === 0;
    case "selfEval": return !resume.selfEval;
  }
}
