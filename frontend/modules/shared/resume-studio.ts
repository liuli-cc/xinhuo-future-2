import type { ResumeStructured } from "../group-1-interview/client/resume-parser.ts";

export type Experience = { id: number; title: string; org: string; period: string; detail: string };
export type ResumeData = {
  school: string; major: string; grade: string; name: string; role: string; city: string;
  email: string; phone: string; summary: string; skills: string; experiences: Experience[];
};
export type ResumeSuggestion = { summary: string; experiences: {id: number; detail: string}[]; suggestions: string[] };
export const emptyResume: ResumeData = { name: "", role: "", city: "", email: "", phone: "", school: "", major: "", grade: "", summary: "", skills: "", experiences: [] };

export function mergeImportedResume(current: ResumeData, resume: ResumeStructured, text = ""): ResumeData {
  const normalizedText = text.normalize("NFKC").replace(/([\u3400-\u9fff])[ \t]+(?=[\u3400-\u9fff])/g, "$1");
  const school = resume.education.match(/[\u4e00-\u9fffA-Za-z·]+(?:大学|学院|University|College)/)?.[0] || resume.education.split("\n")[0]?.slice(0, 120) || "";
  const phone = normalizedText.match(/(?<!\d)1[3-9]\d{9}(?!\d)/)?.[0] || "";
  const email = normalizedText.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)?.[0] || "";
  const role = normalizedText.match(/(?:求职意向|目标岗位|应聘岗位)\s*[:：]\s*([^\n|｜]+)/)?.[1]?.trim().slice(0, 160) || "";
  const gradeMatch = normalizedText.match(/((?:19|20)\d{2})\s*级/);
  const grade = gradeMatch ? `${gradeMatch[1]}级` : "";
  const city = normalizedText.match(/(?:所在城市|现居地|现居城市)\s*[:：]\s*([^\n|｜]+)/)?.[1]?.trim().slice(0, 100) || "";
  const experiences = [...resume.projects.map(item => ({ title: item.name, org: "", detail: item.description })), ...resume.internships.map(item => ({ title: item.role || "实习经历", org: item.company, detail: item.description }))].slice(0, 20).map((item, index) => ({ ...item, id: Date.now() + index, period: "" }));
  const values = { name: resume.name.slice(0,100), school, major: resume.major.slice(0,100), skills: resume.skills.join("、").slice(0,2000), summary: resume.selfEval.slice(0,5000), phone, email, role, grade, city };
  const result = { ...current };
  for (const [key, value] of Object.entries(values)) if (value.trim()) result[key as keyof typeof values] = value;
  if (experiences.length) result.experiences = experiences;
  return result;
}

export function applyResumeSuggestion(current: ResumeData, suggestion: ResumeSuggestion): ResumeData {
  return { ...current, summary: suggestion.summary, experiences: current.experiences.map(item => ({ ...item, detail: suggestion.experiences.find(value => value.id === item.id)?.detail || item.detail })) };
}

export function resumeCompleteness(data: ResumeData) {
  const required = [data.name, data.role, data.school, data.major, data.email || data.phone, data.summary, data.skills, data.experiences.some(item => item.title.trim() && item.detail.trim()) ? "experience" : ""];
  return Math.round(required.filter(item => item.trim()).length / required.length * 100);
}
