"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle, Copy, DownloadSimple, FileText, Sparkle, WarningCircle } from "@phosphor-icons/react";
import { apiFetch } from "@/modules/shared/api/bmob-api";
import PortalFrame, { useStudentProfile } from "@/modules/shared/components/PortalFrame";

type ResumeForm = {
  name: string;
  phone: string;
  email: string;
  school: string;
  degree: string;
  major: string;
  studyPeriod: string;
  gpa: string;
  skills: string;
  tools: string;
  projectName: string;
  projectRole: string;
  projectPeriod: string;
  projectDetails: string;
  projectOutcome: string;
  internshipCompany: string;
  internshipRole: string;
  internshipPeriod: string;
  internshipDetails: string;
  internshipOutcome: string;
  awards: string;
};

type ResumeResult = {
  resumeMarkdown: string;
  matchingHighlights: string[];
  missingKeywords: string[];
  mode: "llm" | "deterministic";
};

const emptyForm: ResumeForm = {
  name: "", phone: "", email: "", school: "", degree: "本科", major: "", studyPeriod: "",
  gpa: "", skills: "", tools: "", projectName: "", projectRole: "", projectPeriod: "",
  projectDetails: "", projectOutcome: "", internshipCompany: "", internshipRole: "", internshipPeriod: "",
  internshipDetails: "", internshipOutcome: "", awards: "",
};

const keywordPool = ["Python", "Java", "JavaScript", "TypeScript", "React", "Vue", "Node.js", "SQL", "MySQL", "Docker", "Git", "Figma", "Excel", "数据分析", "机器学习", "人工智能", "产品设计", "用户研究", "项目管理", "沟通协作", "需求分析", "敏捷开发"];
const previewMode = process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_PREVIEW_MODE === "true";

function factsFrom(form: ResumeForm) {
  const section = (title: string, pairs: Array<[string, string]>) => {
    const lines = pairs.filter(([, value]) => value.trim()).map(([label, value]) => `${label}：${value.trim()}`);
    return lines.length ? `## ${title}\n${lines.join("\n")}` : "";
  };
  return [
    section("基本信息", [["姓名", form.name], ["电话", form.phone], ["邮箱", form.email]]),
    section("教育背景", [["学校", form.school], ["学历", form.degree], ["专业", form.major], ["就读时间", form.studyPeriod], ["GPA 或排名", form.gpa]]),
    section("技能", [["专业技能", form.skills], ["常用工具", form.tools]]),
    section("项目经历", [["项目名称", form.projectName], ["项目角色", form.projectRole], ["项目时间", form.projectPeriod], ["项目职责", form.projectDetails], ["项目成果", form.projectOutcome]]),
    section("实习实践", [["公司", form.internshipCompany], ["岗位", form.internshipRole], ["时间", form.internshipPeriod], ["职责", form.internshipDetails], ["成果", form.internshipOutcome]]),
    section("补充信息", [["奖项与荣誉", form.awards]]),
  ].filter(Boolean).join("\n\n");
}

function localResume(form: ResumeForm, company: string, targetRole: string, jobDescription: string): ResumeResult {
  const source = factsFrom(form).toLowerCase();
  const requirement = jobDescription.toLowerCase();
  const matched = keywordPool.filter(keyword => requirement.includes(keyword.toLowerCase()) && source.includes(keyword.toLowerCase())).slice(0, 8);
  const missing = keywordPool.filter(keyword => requirement.includes(keyword.toLowerCase()) && !source.includes(keyword.toLowerCase())).slice(0, 8);
  const section = (title: string, lines: string[]) => lines.filter(Boolean).length ? `\n## ${title}\n${lines.filter(Boolean).join("\n")}` : "";
  const resumeMarkdown = [
    `# ${form.name || "候选人"}｜${targetRole}`,
    [form.phone, form.email].filter(Boolean).join(" · "),
    section("求职意向", [`${company || "目标企业"} · ${targetRole}`]),
    section("教育背景", [[form.school, form.degree, form.major].filter(Boolean).join(" · "), form.studyPeriod, form.gpa && `GPA / 排名：${form.gpa}`]),
    section("专业技能", [form.skills, form.tools && `工具：${form.tools}`, matched.length ? `岗位匹配关键词：${matched.join("、")}` : ""]),
    section("项目经历", [form.projectName && `${form.projectName}${form.projectRole ? `｜${form.projectRole}` : ""}${form.projectPeriod ? `｜${form.projectPeriod}` : ""}`, form.projectDetails && `- ${form.projectDetails}`, form.projectOutcome && `- ${form.projectOutcome}`]),
    section("实习 / 实践经历", [form.internshipCompany && `${form.internshipCompany}${form.internshipRole ? `｜${form.internshipRole}` : ""}${form.internshipPeriod ? `｜${form.internshipPeriod}` : ""}`, form.internshipDetails && `- ${form.internshipDetails}`, form.internshipOutcome && `- ${form.internshipOutcome}`]),
    section("奖项与补充信息", [form.awards]),
    section("个人总结", [matched.length ? `基于已提供的真实资料，重点呈现与 ${targetRole} 相关的 ${matched.join("、")} 能力。` : `基于已提供的真实资料，围绕 ${targetRole} 重新组织了经历表达。`]),
  ].filter(Boolean).join("\n");
  return {
    resumeMarkdown,
    matchingHighlights: matched.length ? matched.map(item => `已突出：${item}`) : ["已按目标岗位重组真实经历"],
    missingKeywords: missing.length ? missing : ["岗位关键词已基本覆盖；请继续补充真实成果数据"],
    mode: "deterministic",
  };
}

function Field({ label, value, placeholder, onChange, multiline = false }: { label: string; value: string; placeholder: string; onChange: (value: string) => void; multiline?: boolean }) {
  return <label className={multiline ? "resume-field resume-field-wide" : "resume-field"}>
    <span>{label}</span>
    {multiline
      ? <textarea rows={4} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} />
      : <input value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} />}
  </label>;
}

export default function ResumePage() {
  const profile = useStudentProfile();
  const [form, setForm] = useState<ResumeForm>(emptyForm);
  const [company, setCompany] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [result, setResult] = useState<ResumeResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const candidateFacts = useMemo(() => factsFrom(form), [form]);

  useEffect(() => {
    if (profile.role !== "student" || !profile.studentId) return;
    setForm(current => ({
      ...current,
      name: current.name || profile.name,
      email: current.email || profile.email,
      school: current.school || "内蒙古师范大学",
      major: current.major || profile.major,
    }));
    setTargetRole(current => current || profile.targetRole);
  }, [profile.email, profile.major, profile.name, profile.role, profile.studentId, profile.targetRole]);

  const update = (field: keyof ResumeForm, value: string) => setForm(current => ({ ...current, [field]: value }));
  const canGenerate = candidateFacts.length >= 40 && targetRole.trim().length >= 2 && jobDescription.trim().length >= 30;

  const generate = async () => {
    if (!canGenerate) return;
    setBusy(true);
    setError("");
    try {
      const response = await apiFetch("/api/resume/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateFacts, jobDescription, targetRole, company }),
      });
      const body = await response.json() as Partial<ResumeResult> & { error?: string };
      if (response.ok && body.resumeMarkdown) {
        setResult({
          resumeMarkdown: body.resumeMarkdown,
          matchingHighlights: body.matchingHighlights ?? [],
          missingKeywords: body.missingKeywords ?? [],
          mode: body.mode === "llm" ? "llm" : "deterministic",
        });
      } else if (previewMode) {
        setResult(localResume(form, company, targetRole, jobDescription));
      } else {
        throw new Error(body.error || "生成简历失败");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "生成简历失败");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (result) await navigator.clipboard.writeText(result.resumeMarkdown);
  };
  const download = () => {
    if (!result) return;
    const blob = new Blob([result.resumeMarkdown], { type: "text/markdown;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${form.name || "候选人"}-${targetRole || "简历"}.md`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return <PortalFrame active="resume" eyebrow="CAREER TOOLS" title="AI 简历中心" subtitle="根据你的真实经历与企业岗位需求，生成一份可继续编辑的定制简历。">
    <div className="resume-builder">
      <section className="resume-hero portal-card">
        <div><span><Sparkle size={17} weight="fill" /> AI RESUME BUILDER</span><h2>让经历更贴近目标岗位</h2><p>填写真实教育、项目与实践信息，再粘贴企业岗位职责和任职要求。系统只会重组和突出已有事实，不会编造经历。</p></div>
        <button className="primary-action" type="button" onClick={() => void generate()} disabled={!canGenerate || busy}><FileText size={18} weight="duotone" />{busy ? "正在生成…" : "生成定制简历"}</button>
      </section>

      <section className="resume-editor-section">
        <header><div className="resume-section-number">01</div><div><h2>个人与教育信息</h2><p>用于建立简历基础信息，可继续编辑。</p></div></header>
        <div className="resume-editor-grid">
          <Field label="姓名" value={form.name} onChange={value => update("name", value)} placeholder="请输入真实姓名" />
          <Field label="求职岗位" value={targetRole} onChange={setTargetRole} placeholder="例如：产品经理实习生" />
          <Field label="联系电话（选填）" value={form.phone} onChange={value => update("phone", value)} placeholder="仅用于简历展示" />
          <Field label="电子邮箱（选填）" value={form.email} onChange={value => update("email", value)} placeholder="name@example.com" />
          <Field label="学校" value={form.school} onChange={value => update("school", value)} placeholder="例如：内蒙古师范大学" />
          <Field label="学历" value={form.degree} onChange={value => update("degree", value)} placeholder="例如：本科" />
          <Field label="专业" value={form.major} onChange={value => update("major", value)} placeholder="例如：计算机科学与技术" />
          <Field label="就读时间 / 毕业时间" value={form.studyPeriod} onChange={value => update("studyPeriod", value)} placeholder="例如：2025.09 - 2029.06" />
          <Field label="GPA 或专业排名（选填）" value={form.gpa} onChange={value => update("gpa", value)} placeholder="例如：3.7/4.0，专业前 15%" />
        </div>
      </section>

      <section className="resume-editor-section">
        <header><div className="resume-section-number">02</div><div><h2>技能与真实经历</h2><p>尽量写清你的行动、职责、成果或可核验数据。</p></div></header>
        <div className="resume-editor-grid">
          <Field label="专业技能" value={form.skills} onChange={value => update("skills", value)} placeholder="例如：Python、SQL、React、数据分析" />
          <Field label="常用工具（选填）" value={form.tools} onChange={value => update("tools", value)} placeholder="例如：Git、Figma、Excel" />
          <Field label="项目名称" value={form.projectName} onChange={value => update("projectName", value)} placeholder="例如：大学生成长规划平台" />
          <Field label="项目角色 / 时间" value={[form.projectRole, form.projectPeriod].filter(Boolean).join(" ｜ ")} onChange={value => { const [role = "", period = ""] = value.split("｜"); update("projectRole", role.trim()); update("projectPeriod", period.trim()); }} placeholder="例如：前端开发 ｜ 2026.03 - 2026.06" />
          <Field label="项目职责" value={form.projectDetails} onChange={value => update("projectDetails", value)} multiline placeholder="说明你负责的模块、关键行动和解决的问题" />
          <Field label="项目成果" value={form.projectOutcome} onChange={value => update("projectOutcome", value)} multiline placeholder="填写真实成果、数据、获奖或作品链接" />
          <Field label="实习 / 实践单位（选填）" value={form.internshipCompany} onChange={value => update("internshipCompany", value)} placeholder="例如：XX 科技有限公司" />
          <Field label="实习岗位 / 时间（选填）" value={[form.internshipRole, form.internshipPeriod].filter(Boolean).join(" ｜ ")} onChange={value => { const [role = "", period = ""] = value.split("｜"); update("internshipRole", role.trim()); update("internshipPeriod", period.trim()); }} placeholder="例如：产品实习生 ｜ 2026.06 - 2026.09" />
          <Field label="实习职责（选填）" value={form.internshipDetails} onChange={value => update("internshipDetails", value)} multiline placeholder="描述你承担的具体工作与协作对象" />
          <Field label="实习成果（选填）" value={form.internshipOutcome} onChange={value => update("internshipOutcome", value)} multiline placeholder="填写真实产出、数据或获得的反馈" />
          <Field label="奖项、证书或补充信息（选填）" value={form.awards} onChange={value => update("awards", value)} multiline placeholder="例如：省级竞赛一等奖、英语六级、作品集链接" />
        </div>
      </section>

      <section className="resume-editor-section resume-job-section">
        <header><div className="resume-section-number">03</div><div><h2>企业岗位需求</h2><p>粘贴企业招聘信息，AI 会根据岗位关键词重新组织你的已有经历。</p></div></header>
        <div className="resume-editor-grid">
          <Field label="应聘企业" value={company} onChange={setCompany} placeholder="例如：字节跳动" />
          <Field label="目标岗位" value={targetRole} onChange={setTargetRole} placeholder="例如：产品经理实习生" />
          <Field label="岗位职责、任职要求与关键词" value={jobDescription} onChange={setJobDescription} multiline placeholder="请粘贴完整岗位说明，例如岗位职责、技能要求、加分项及学历要求（至少 30 个字）" />
        </div>
      </section>

      {error && <div className="resume-builder-error"><WarningCircle size={18} />{error}</div>}
      <footer className="resume-builder-footer"><button className="primary-action" type="button" onClick={() => void generate()} disabled={!canGenerate || busy}><Sparkle size={18} weight="fill" />{busy ? "正在生成定制简历…" : "生成定制简历"}</button><small>仅使用你填写的事实；请在投递前复核所有内容。</small></footer>

      {result && <section className="resume-result-panel">
        <header><div><span>{result.mode === "llm" ? "AI GENERATED" : "LOCAL PREVIEW"}</span><h2>定制简历草稿</h2></div><div className="resume-result-actions"><button type="button" onClick={() => void copy()}><Copy size={16} />复制</button><button type="button" onClick={download}><DownloadSimple size={16} />下载 Markdown</button></div></header>
        <pre>{result.resumeMarkdown}</pre>
        <div className="resume-result-notes"><section><h3><CheckCircle size={16} weight="fill" />已突出匹配点</h3>{result.matchingHighlights.map(item => <p key={item}>• {item}</p>)}</section><section><h3><WarningCircle size={16} weight="fill" />建议补充</h3>{result.missingKeywords.map(item => <p key={item}>• {item}</p>)}</section></div>
      </section>}
    </div>
  </PortalFrame>;
}
