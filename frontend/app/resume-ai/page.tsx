"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  DownloadSimple,
  FileText,
  FireSimple,
  MagicWand,
  MapPin,
  Palette,
  Plus,
  UploadSimple,
  Sparkle,
  Target,
  Trash,
  UserCircle,
  X,
} from "@phosphor-icons/react";
import Link from "next/link";
import styles from "./page.module.css";
import StudioLogin from "../../modules/shared/StudioLogin";
import { request, type StudioUser } from "../../modules/shared/api/recruitment";
import { importResumeFile, type ImportedResume } from "../../modules/group-1-interview/client/resume-import";
import { applyResumeSuggestion, emptyResume, mergeImportedResume, resumeCompleteness, type Experience, type ResumeData, type ResumeSuggestion } from "../../modules/shared/resume-studio";
import { downloadResumeDocx } from "../../modules/shared/resume-export";

type PublishedJob = { id: string; enterpriseId: number; enterpriseName: string; title: string; department: string; location: string; employmentType: string; description: string; requirements: string; status: "open" | "closed" };
type MyApplication = { id: string; enterpriseId: number; enterpriseName: string; status: string; job: {id: string; title: string; location: string} | null; interview: {at: string; location: string; note: string} | null };

const templates = [
  { id: "blue", label: "薪火蓝", note: "清晰、稳重" },
  { id: "mono", label: "极简灰", note: "克制、专业" },
  { id: "mint", label: "薄荷绿", note: "轻快、亲和" },
] as const;

export default function ResumeAIPage() {
  const [user, setUser] = useState<StudioUser | null>(null);
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState("尚未保存");
  const [busy, setBusy] = useState(false);
  const revision = useRef(0);
  const [draftRevision, setDraftRevision] = useState(0);
  const [suggestion, setSuggestion] = useState<(ResumeSuggestion & { revision: number }) | null>(null);
  const [imported, setImported] = useState<(ImportedResume & { filename: string }) | null>(null);
  const [importStatus, setImportStatus] = useState("");
  const [aiConfigured, setAiConfigured] = useState(true);
  const uploadInput = useRef<HTMLInputElement>(null);
  const [companies, setCompanies] = useState<{id: number; name: string}[]>([]);
  const [company, setCompany] = useState("");
  const [jobs, setJobs] = useState<PublishedJob[]>([]);
  const [jobId, setJobId] = useState("");
  const [consent, setConsent] = useState(false);
  const [shareEvidence, setShareEvidence] = useState(true);
  const [applications, setApplications] = useState<MyApplication[]>([]);
  const [data, setData] = useState(emptyResume);
  const [template, setTemplate] = useState<(typeof templates)[number]["id"]>("blue");
  const [activeSection, setActiveSection] = useState<"basics" | "story" | "experience">("basics");
  const [notice, setNotice] = useState("");
  const [optimized, setOptimized] = useState(false);

  useEffect(() => {
    request<{user: StudioUser}>("/auth/me").then(r => { if (r.user.role === "student") setUser(r.user); }).catch(() => {});
  }, []);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    Promise.all([
      request<{data: ResumeData; template: "blue" | "mono" | "mint"; aiConfigured: boolean}>("/recruitment/resume"),
      request<{enterprises: {id: number; name: string}[]}>("/recruitment/enterprises"),
      request<{applications: MyApplication[]}>("/recruitment/applications"),
      request<{jobs: PublishedJob[]}>("/recruitment/jobs"),
    ]).then(([draft, list, sent, vacancies]) => { if (!cancelled) { setData({ ...emptyResume, ...draft.data }); setTemplate(draft.template); setAiConfigured(draft.aiConfigured); setCompanies(list.enterprises); setApplications(sent.applications); setJobs(vacancies.jobs); setReady(true); setSaved("已从账号加载"); } }).catch(e => setNotice(e.message));
    return () => { cancelled = true; };
  }, [user]);
  const companyJobs = useMemo(() => jobs.filter(job => job.enterpriseId === Number(company) && job.status === "open"), [jobs, company]);
  const chosenJob = companyJobs.find(job => job.id === jobId);
  const skills = useMemo(() => Array.from(new Set(data.skills.split(/[,，、\n]/).map(item => item.trim()).filter(Boolean))), [data.skills]);
  const completeness = useMemo(() => resumeCompleteness(data), [data]);
  const changed = () => { revision.current += 1; setDraftRevision(revision.current); setSaved("有未保存修改"); };
  const update = <K extends keyof ResumeData>(key: K, value: ResumeData[K]) => { changed(); setData(current => ({ ...current, [key]: value })); };
  const updateExperience = (id: number, key: keyof Experience, value: string) => { changed(); setData(current => ({ ...current, experiences: current.experiences.map(item => item.id === id ? { ...item, [key]: value } : item) })); };
  const addExperience = () => { if (data.experiences.length >= 20) return; changed(); setData(current => ({ ...current, experiences: [...current.experiences, { id: Date.now(), title: "", org: "", period: "", detail: "" }] })); };
  const removeExperience = (id: number) => { changed(); setData(current => ({ ...current, experiences: current.experiences.filter(item => item.id !== id) })); };
  useEffect(() => {
    if (saved !== "有未保存修改") return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [saved]);
  const importFile = async (file: File) => {
    setBusy(true); setImported(null);
    try {
      const result = await importResumeFile(file, progress => setImportStatus(`${progress.message} ${progress.progress}%`));
      setImported({ ...result, filename: file.name });
      setNotice("");
    } catch (error) { setNotice(error instanceof Error ? error.message : "识别失败"); }
    finally { setBusy(false); setImportStatus(""); if (uploadInput.current) uploadInput.current.value = ""; }
  };
  const flash = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2600); };
  const save = async () => {
    setBusy(true); setSaved("保存中…");
    const savedRevision = revision.current;
    try { await request("/recruitment/resume", "PUT", { data, template }); setSaved(savedRevision === revision.current ? "已保存至账号" : "有未保存修改"); return true; }
    catch (e) { setSaved("保存失败"); setNotice(e instanceof Error ? e.message : "保存失败"); return false; }
    finally { setBusy(false); }
  };
  const optimizeWithAI = async () => {
    setBusy(true);
    const sourceRevision = revision.current;
    try { const result = await request<ResumeSuggestion>("/recruitment/resume/optimize", "POST", { data, template }); setSuggestion({ ...result, revision: sourceRevision }); }
    catch (e) { setNotice(e instanceof Error ? e.message : "AI 请求失败"); }
    finally { setBusy(false); }
  };
  const submitResume = async () => {
    if (!company || !consent || (companyJobs.length > 0 && !jobId)) { setNotice("请选择企业、岗位并确认分享范围"); return; }
    if (!await save()) return;
    setBusy(true);
    try {
      const result = await request<{alreadySubmitted: boolean}>("/recruitment/applications", "POST", {enterprise_id: Number(company), job_id: jobId || null, consent, include_verified_evidence: shareEvidence});
      const sent = await request<{applications: typeof applications}>("/recruitment/applications");
      setApplications(sent.applications);
      setNotice(result.alreadySubmitted ? "已投递过此企业；如需更新请撤回后重新投递" : "投递成功，企业现在可以查看这份简历");
    } catch (e) { setNotice(e instanceof Error ? e.message : "投递失败"); }
    finally { setBusy(false); }
  };
  const withdraw = async (id: string) => {
    setBusy(true);
    try { await request("/recruitment/applications/" + id, "DELETE"); setApplications(current => current.filter(item => item.id !== id)); setNotice("已撤回，企业不再能访问本次投递"); }
    catch (e) { setNotice(e instanceof Error ? e.message : "撤回失败"); }
    finally { setBusy(false); }
  };
  const canExport = () => { if (!data.name.trim() || !data.role.trim()) { setNotice("请先填写姓名和目标岗位"); return false; } return true; };
  const exportResume = () => { if (canExport()) window.print(); };
  const exportWord = async () => { if (!canExport()) return; setBusy(true); try { await downloadResumeDocx(data, template); flash("Word 简历已导出"); } catch { setNotice("导出失败，请重试"); } finally { setBusy(false); } };

  if (!user) return <StudioLogin role="student" onLogin={setUser} />;
  if (!ready) return <main><p role="status">{notice || "正在加载简历…"}</p><button onClick={() => window.location.reload()}>重试</button></main>;
  return <main className={`${styles.shell} ${styles[`theme_${template}`]}`}>
    <aside className={styles.sidebar}>
      <Link className={styles.brand} href="/dashboard"><span><FireSimple size={21} weight="fill" /></span><b>薪火</b><small>成长操作系统</small></Link>
      <Link className={styles.backLink} href="/dashboard"><ArrowLeft size={16} />返回学生空间</Link>
      <div className={styles.sideTitle}><span>AI CAREER STUDIO</span><h1>简历工坊</h1></div>
      <nav className={styles.steps} aria-label="简历制作步骤"><button className={activeSection === "basics" ? styles.stepActive : ""} onClick={() => setActiveSection("basics")}><i>01</i><span><b>基本信息</b><small>姓名、岗位与联系方式</small></span>{activeSection !== "basics" && <CheckCircle size={16} />}</button><button className={activeSection === "story" ? styles.stepActive : ""} onClick={() => setActiveSection("story")}><i>02</i><span><b>个人优势</b><small>简介与核心技能</small></span>{optimized && <CheckCircle size={16} />}</button><button className={activeSection === "experience" ? styles.stepActive : ""} onClick={() => setActiveSection("experience")}><i>03</i><span><b>项目经历</b><small>项目、实习与实践</small></span>{data.experiences.length > 0 && <CheckCircle size={16} />}</button></nav>
      <small className={styles.localNote}>ACCOUNT DRAFT · 保存至学生账号</small>
    </aside>

    <section className={styles.main}>
      <header className={styles.topbar}><div><span>PERSONAL CAREER STUDIO</span><h2>AI 简历制作</h2></div><div className={styles.topActions}><span className={styles.saved}><span />{saved}</span><button disabled={busy} onClick={save}>保存简历</button><button disabled={busy} onClick={() => uploadInput.current?.click()}><UploadSimple size={17} />导入简历</button><button onClick={exportResume}><DownloadSimple size={17} />PDF</button><button disabled={busy} onClick={exportWord}>Word</button><input ref={uploadInput} hidden type="file" accept=".pdf,.docx,.txt,.md,.markdown,.jpg,.jpeg,.png,.webp,.bmp" onChange={event => { const file = event.target.files?.[0]; if (file) void importFile(file); }} /><Link href="/dashboard" aria-label="退出简历工坊"><X size={19} /></Link></div></header>
      <div className={styles.body}>
        <section className={styles.editor}>
          <div className={styles.heading}><div><span className={styles.kicker}>BUILD YOUR STORY</span><h2>编辑你的简历</h2><p>导入已有简历，或从基本信息开始。</p></div><div className={styles.completeness}><strong>{completeness}%</strong><span>完成度</span></div></div>
          {importStatus && <p role="status" className={styles.callout}>{importStatus}</p>}
          {imported && <div className={styles.callout}><div><b>{imported.filename}</b><p>{[imported.resume.name, imported.resume.education.split("\n")[0]].filter(Boolean).join(" · ")}</p><p>{imported.resume.skills.length} 项技能 · {imported.resume.projects.length + imported.resume.internships.length} 段经历</p><button onClick={() => { changed(); setData(current => mergeImportedResume(current, imported.resume, imported.text)); setImported(null); setActiveSection("basics"); }}>导入到草稿</button><button onClick={() => setImported(null)}>取消</button></div></div>}
          <div className={styles.sectionTabs}><button className={activeSection === "basics" ? styles.currentTab : ""} onClick={() => setActiveSection("basics")}><UserCircle size={17} />基本信息</button><button className={activeSection === "story" ? styles.currentTab : ""} onClick={() => setActiveSection("story")}><MagicWand size={17} />AI 优化</button><button className={activeSection === "experience" ? styles.currentTab : ""} onClick={() => setActiveSection("experience")}><Target size={17} />经历证据</button></div>

          {activeSection === "basics" && <section className={styles.formSection}><div className={styles.formGrid}><label>学校<input value={data.school} onChange={event => update("school", event.target.value)} /></label><label>专业<input value={data.major} onChange={event => update("major", event.target.value)} /></label><label>年级<input value={data.grade} onChange={event => update("grade", event.target.value)} /></label><label>姓名<input value={data.name} onChange={event => update("name", event.target.value)} /></label><label>目标岗位<input value={data.role} onChange={event => update("role", event.target.value)} /></label><label><span><MapPin size={14} />所在城市</span><input value={data.city} onChange={event => update("city", event.target.value)} /></label><label>邮箱<input type="email" value={data.email} onChange={event => update("email", event.target.value)} /></label><label>电话<input value={data.phone} onChange={event => update("phone", event.target.value)} /></label></div><button className={styles.nextButton} onClick={() => setActiveSection("story")}>继续完善个人优势 <ArrowRight size={17} /></button></section>}

          {activeSection === "story" && <section className={styles.formSection}><label className={styles.fullLabel}>个人简介<textarea value={data.summary} onChange={event => update("summary", event.target.value)} rows={6} placeholder="用 2-3 句话介绍你的方向、能力和目标" /></label><label className={styles.fullLabel}>核心技能<textarea value={data.skills} onChange={event => update("skills", event.target.value)} rows={3} placeholder="用逗号分隔，例如 Python, React, 数据分析" /><small>{skills.length} 项技能</small></label>{suggestion && <div className={styles.callout}><div><b>优化建议</b><p style={{ whiteSpace: "pre-wrap" }}>{suggestion.summary}</p>{suggestion.experiences.map(item => <section key={item.id}><b>{data.experiences.find(value => value.id === item.id)?.title || "项目经历"}</b><p style={{ whiteSpace: "pre-wrap" }}>{item.detail}</p></section>)}{suggestion.suggestions.length > 0 && <ul>{suggestion.suggestions.map(item => <li key={item}>{item}</li>)}</ul>}{suggestion.revision !== draftRevision && <p>草稿已修改，请重新优化。</p>}<button disabled={suggestion.revision !== draftRevision} onClick={() => { changed(); setData(current => applyResumeSuggestion(current, suggestion)); setSuggestion(null); setOptimized(true); }}>采用建议</button><button onClick={() => setSuggestion(null)}>保留原文</button></div></div>}<div className={styles.aiAction}><div><MagicWand size={23} /><div><b>岗位匹配优化</b><p>{aiConfigured ? "个人简介与项目经历" : "AI 服务暂未开通"}</p></div></div><button disabled={busy || !aiConfigured} onClick={optimizeWithAI}><Sparkle size={16} />{busy ? "处理中…" : optimized ? "再次优化" : "优化简历"}</button></div><button className={styles.nextButton} onClick={() => setActiveSection("experience")}>继续添加项目经历 <ArrowRight size={17} /></button></section>}

          {activeSection === "experience" && <section className={styles.formSection}><div className={styles.experienceHeader}><div><h3>项目与实践经历</h3><p>优先填写与你目标岗位最相关的 1-3 段经历。</p></div><button className={styles.addButton} disabled={data.experiences.length >= 20} onClick={addExperience}><Plus size={16} />添加经历</button></div><div className={styles.experienceList}>{data.experiences.map((item, index) => <article className={styles.experienceCard} key={item.id}><div className={styles.experienceCardTop}><span>0{index + 1}</span><button onClick={() => removeExperience(item.id)} aria-label="删除经历"><Trash size={16} /></button></div><div className={styles.formGrid}><label className={styles.wide}>项目 / 职位<input value={item.title} onChange={event => updateExperience(item.id, "title", event.target.value)} /></label><label>组织 / 公司<input value={item.org} onChange={event => updateExperience(item.id, "org", event.target.value)} /></label><label>时间<input value={item.period} onChange={event => updateExperience(item.id, "period", event.target.value)} /></label></div><label className={styles.fullLabel}>你完成了什么<textarea value={item.detail} onChange={event => updateExperience(item.id, "detail", event.target.value)} rows={4} /></label></article>)}</div><button className={styles.primaryAction} onClick={exportResume}><FileText size={17} />预览并导出简历</button></section>}
          <section className={`${styles.formSection} ${styles.deliverySection}`}>
            <h3>投递给企业</h3><label className={styles.fullLabel}>接收企业<select value={company} onChange={e => { setCompany(e.target.value); setJobId(""); setConsent(false); }}><option value="">请选择企业</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
            {companyJobs.length > 0 && <label className={styles.fullLabel}>应聘岗位<select value={jobId} onChange={event => { setJobId(event.target.value); setConsent(false); }}><option value="">请选择岗位</option>{companyJobs.map(job => <option key={job.id} value={job.id}>{job.title}{job.location ? ` · ${job.location}` : ""}</option>)}</select></label>}
            {chosenJob && <details className={styles.jobDetails}><summary>{chosenJob.title} · {[chosenJob.location, chosenJob.employmentType].filter(Boolean).join(" · ")}</summary><p>{chosenJob.description}</p>{chosenJob.requirements && <p>{chosenJob.requirements}</p>}</details>}
            {!companies.length && <p>暂无可接收投递的企业，请联系管理员开通企业账号。</p>}
            <label className={styles.consentRow}><input type="checkbox" checked={shareEvidence} onChange={e => { setShareEvidence(e.target.checked); setConsent(false); }} />附带已核验成长记录</label><label className={styles.consentRow}><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />我同意将当前简历{shareEvidence ? "及已核验成长记录" : ""}分享给所选企业。</label>
            <button className={styles.primaryAction} disabled={busy || !company || !consent || (companyJobs.length > 0 && !jobId)} onClick={submitResume}>保存并投递</button>
            <h3>我的投递</h3>{applications.length === 0 && <p>尚未投递</p>}{applications.map(item => <article className={styles.applicationItem} key={item.id}><div><b>{item.enterpriseName || companies.find(c => c.id === item.enterpriseId)?.name || "企业"}</b><span>{item.job?.title || "通用投递"} · {item.status}</span></div>{item.interview && <div className={styles.interviewInvite}><b>{item.status === "面试邀请" ? "面试邀请" : "面试安排"}</b><p>{new Date(item.interview.at).toLocaleString("zh-CN", { dateStyle: "medium", timeStyle: "short" })}</p><p>{item.interview.location}</p>{item.interview.note && <p>{item.interview.note}</p>}</div>}<button disabled={busy} onClick={() => withdraw(item.id)}>撤回投递</button></article>)}
          </section>
        </section>

        <aside className={styles.previewColumn}><div className={styles.previewToolbar}><div><span>LIVE PREVIEW</span><b>实时预览</b></div><div className={styles.templatePicker}><Palette size={16} /><select value={template} onChange={event => { changed(); setTemplate(event.target.value as typeof template); }} aria-label="选择简历模板">{templates.map(item => <option key={item.id} value={item.id}>{item.label} · {item.note}</option>)}</select></div></div><div className={`${styles.resumePaper} ${styles[`paper_${template}`]}`}><header className={styles.resumeHeader}><div><h1>{data.name || "你的姓名"}</h1><p>{data.role || "目标岗位"}</p></div><div className={styles.resumeContact}>{[data.city, data.email, data.phone].filter(Boolean).map(value => <span key={value}>{value}</span>)}</div></header><div className={styles.resumeRule} /><section className={styles.resumeBlock}><h2>教育背景</h2><p>{[data.school, data.major, data.grade].filter(Boolean).join(" · ") || "请填写教育背景"}</p></section><section className={styles.resumeBlock}><h2>个人简介</h2><p>{data.summary || "在这里展示你的方向、能力和职业目标。"}</p></section><section className={styles.resumeBlock}><h2>核心技能</h2><div className={styles.resumeSkills}>{skills.map(skill => <span key={skill}>{skill}</span>)}</div></section><section className={styles.resumeBlock}><h2>项目与实践经历</h2>{data.experiences.map(item => <article className={styles.resumeExperience} key={item.id}><div className={styles.resumeExperienceHead}><div><b>{item.title || "项目名称"}</b>{item.org && <span>{item.org}</span>}</div><em>{item.period}</em></div><p>{item.detail}</p></article>)}</section></div></aside>
      </div>
    </section>
    {notice && <div role="status" className={styles.toast}><CheckCircle size={18} weight="fill" />{notice}</div>}
  </main>;
}
