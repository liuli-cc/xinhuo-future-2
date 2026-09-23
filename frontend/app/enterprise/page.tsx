"use client";
import { useDeferredValue, useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Buildings, FileText, FireSimple, Star, UsersThree, CheckCircle, SignOut, MagnifyingGlass, DownloadSimple, Envelope, Phone, Briefcase, Plus, PencilSimple, CalendarBlank, X, MapPin } from "@phosphor-icons/react";
import Link from "next/link";
import StudioLogin from "../../modules/shared/StudioLogin";
import { request, type StudioUser } from "../../modules/shared/api/recruitment";
import styles from "./page.module.css";
import { downloadResumeDocx } from "../../modules/shared/resume-export";

type CandidateStatus = "待查看" | "已查看" | "已收藏" | "面试邀请" | "已录用" | "不合适";
type Job = {
  id: string; enterpriseId: number; enterpriseName: string; title: string; department: string;
  location: string; employmentType: string; description: string; requirements: string;
  status: "open" | "closed"; createdAt: string;
};
type JobDraft = Pick<Job, "title" | "department" | "location" | "employmentType" | "description" | "requirements" | "status">;
type Interview = { at: string; location: string; note: string };
type Application = {
  id: string; status: CandidateStatus; submitted: string;
  job?: Pick<Job, "id" | "title" | "location"> | null;
  interview?: Interview | null;
  resume: {
    name: string; role: string; school: string; major: string; grade: string;
    city: string; email: string; phone: string; summary: string; skills: string;
    experiences: { id: number; title: string; org: string; period: string; detail: string }[];
    tasks: { title: string; type: string; result: string; date: string }[];
  };
};
const tabs = ["全部", "待查看", "已查看", "已收藏", "面试邀请", "已录用", "不合适"] as const;
const initialJob: JobDraft = { title: "", department: "", location: "", employmentType: "实习", description: "", requirements: "", status: "open" };
const displayDate = (value: string) => new Date(value).toLocaleString("zh-CN", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
function localDateTime(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function FormDialog({ title, children, busy, onClose }: { title: string; children: ReactNode; busy: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => { dialog?.close(); }; }, []);
  return <dialog ref={ref} className={styles.formDialog} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <header><h2 id={titleId}>{title}</h2><button type="button" aria-label="关闭" disabled={busy} onClick={onClose}><X size={20} /></button></header>
    {children}
  </dialog>;
}

function JobEditor({ job, busy, error, onClose, onSave }: { job: Job | null; busy: boolean; error: string; onClose: () => void; onSave: (draft: JobDraft) => Promise<void> }) {
  const [draft, setDraft] = useState<JobDraft>(job ? { title: job.title, department: job.department, location: job.location, employmentType: job.employmentType, description: job.description, requirements: job.requirements, status: job.status } : initialJob);
  const change = (field: keyof JobDraft, value: string) => setDraft(current => ({ ...current, [field]: value }));
  return <FormDialog title={job ? "编辑岗位" : "发布岗位"} busy={busy} onClose={onClose}>
    <form onSubmit={event => { event.preventDefault(); void onSave(draft); }} className={styles.editorForm}>
      <div className={styles.formGrid}>
        <label>岗位名称<input required autoFocus minLength={2} maxLength={160} value={draft.title} onChange={event => change("title", event.target.value)} placeholder="例如：前端开发实习生" /></label>
        <label>所属部门<input maxLength={100} value={draft.department} onChange={event => change("department", event.target.value)} placeholder="例如：产品研发部" /></label>
        <label>工作地点<input required minLength={2} maxLength={160} value={draft.location} onChange={event => change("location", event.target.value)} placeholder="城市或远程" /></label>
        <label>岗位类型<select value={draft.employmentType} onChange={event => change("employmentType", event.target.value)}>{["实习", "全职", "兼职"].map(type => <option key={type}>{type}</option>)}</select></label>
      </div>
      <label>岗位职责<textarea required minLength={10} maxLength={10000} rows={5} value={draft.description} onChange={event => change("description", event.target.value)} placeholder="主要工作内容、协作方向与日常任务" /></label>
      <label>任职要求<textarea required minLength={2} maxLength={10000} rows={4} value={draft.requirements} onChange={event => change("requirements", event.target.value)} placeholder="专业、技能与到岗要求" /></label>
      {error && <p className={styles.formError} role="alert">{error}</p>}
      <footer><button type="button" className={styles.ghostButton} disabled={busy} onClick={onClose}>取消</button><button type="submit" className={styles.primaryButton} disabled={busy}>{busy ? "保存中…" : job ? "保存修改" : "发布岗位"}</button></footer>
    </form>
  </FormDialog>;
}

function InviteEditor({ candidate, busy, error, onClose, onSave }: { candidate: Application; busy: boolean; error: string; onClose: () => void; onSave: (interview: Interview) => Promise<void> }) {
  const [at, setAt] = useState(candidate.interview?.at ? localDateTime(candidate.interview.at) : "");
  const [location, setLocation] = useState(candidate.interview?.location ?? "");
  const [note, setNote] = useState(candidate.interview?.note ?? "");
  const [validation, setValidation] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const date = new Date(at);
    if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) { setValidation("请选择未来的面试时间"); return; }
    if (!location.trim()) { setValidation("请填写面试地点或会议链接"); return; }
    setValidation("");
    void onSave({ at: date.toISOString(), location: location.trim(), note: note.trim() });
  };
  return <FormDialog title={`邀请 ${candidate.resume.name} 面试`} busy={busy} onClose={onClose}>
    <form className={styles.editorForm} onSubmit={submit}>
      <label>面试时间<input required autoFocus type="datetime-local" value={at} onChange={event => setAt(event.target.value)} min={localDateTime(new Date().toISOString())} /><small>使用你所在时区的时间</small></label>
      <label>面试地点或会议链接<input required maxLength={300} value={location} onChange={event => setLocation(event.target.value)} placeholder="例如：线上会议链接 / 办公室地址" /></label>
      <label>补充说明<textarea rows={3} maxLength={2000} value={note} onChange={event => setNote(event.target.value)} placeholder="联系人、面试准备或其他安排（选填）" /></label>
      {(error || validation) && <p className={styles.formError} role="alert">{error || validation}</p>}
      <footer><button type="button" disabled={busy} className={styles.ghostButton} onClick={onClose}>取消</button><button type="submit" disabled={busy} className={styles.primaryButton}>{busy ? "保存中…" : candidate.status === "面试邀请" ? "更新面试安排" : "确认邀请"}</button></footer>
    </form>
  </FormDialog>;
}

export default function EnterprisePage() {
  const [user, setUser] = useState<StudioUser | null>(null);
  const [candidates, setCandidates] = useState<Application[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [view, setView] = useState<"candidates" | "jobs">("candidates");
  const [selectedId, setSelectedId] = useState("");
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("全部");
  const [jobFilter, setJobFilter] = useState("");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const searchQuery = useDeferredValue(query);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [preview, setPreview] = useState(false);
  const [jobEditor, setJobEditor] = useState<Job | "new" | null>(null);
  const [inviteCandidate, setInviteCandidate] = useState<Application | null>(null);
  const [formError, setFormError] = useState("");

  async function refresh() {
    setBusy(true);
    try {
      const [applications, positions] = await Promise.all([request<{ applications: Application[] }>("/recruitment/applications"), request<{ jobs: Job[] }>("/recruitment/jobs")]);
      setCandidates(applications.applications); setJobs(positions.jobs); setLoaded(true); setNotice("");
    } catch (error) { setNotice(error instanceof Error ? error.message : "加载失败"); }
    finally { setBusy(false); }
  }
  useEffect(() => { request<{ user: StudioUser }>("/auth/me").then(result => { if (result.user.role === "enterprise") setUser(result.user); }).catch(() => {}); }, []);
  useEffect(() => { if (user) void refresh(); }, [user]);
  const filtered = useMemo(() => candidates.filter(candidate =>
    (activeTab === "全部" || candidate.status === activeTab) && (!jobFilter || candidate.job?.id === jobFilter) &&
    searchQuery.trim().toLowerCase().split(/\s+/).every(term => [candidate.resume.name, candidate.resume.school, candidate.resume.major, candidate.resume.role, candidate.resume.skills, candidate.job?.title, ...candidate.resume.experiences.map(item => item.title)].join(" ").toLowerCase().includes(term)),
  ), [candidates, activeTab, jobFilter, searchQuery]);
  const selected = candidates.find(candidate => candidate.id === selectedId) ?? filtered[0];
  const selectTab = (tab: (typeof tabs)[number]) => { setView("candidates"); setActiveTab(tab); setSelectedId(""); setPreview(false); };
  const openEditor = (job: Job | "new") => { setFormError(""); setJobEditor(job); };
  const openInvite = (candidate: Application) => { setFormError(""); setInviteCandidate(candidate); };
  const hasHiringStatus = selected && ["面试邀请", "已录用", "不合适"].includes(selected.status);

  async function setStatus(status: CandidateStatus, candidate = selected, interview?: Interview) {
    if (!candidate) return;
    setSelectedId(candidate.id); setBusy(true); setFormError("");
    try {
      const payload = { status, ...(interview ? { interview_at: interview.at, interview_location: interview.location, interview_note: interview.note } : {}) };
      const saved = await request<{ id: string; status: CandidateStatus; interview?: Interview | null }>("/recruitment/applications/" + candidate.id, "PATCH", payload);
      setCandidates(current => current.map(item => item.id === candidate.id ? { ...item, status: saved.status ?? status, interview: saved.interview === undefined ? (interview ?? item.interview) : saved.interview } : item));
      setInviteCandidate(null); setNotice(interview ? "面试安排已保存，学生可在投递记录中查看" : "处理状态已保存");
    } catch (error) {
      const message = error instanceof Error ? error.message : "保存失败";
      if (interview) setFormError(message); else setNotice(message);
    } finally { setBusy(false); }
  }
  async function saveJob(draft: JobDraft) {
    setBusy(true); setFormError("");
    try {
      const editing = jobEditor && jobEditor !== "new";
      const result = await request<{ job: Job }>(editing ? `/recruitment/jobs/${jobEditor.id}` : "/recruitment/jobs", editing ? "PATCH" : "POST", Object.fromEntries(Object.entries(draft).map(([key, value]) => [key, value.trim()])));
      setJobs(current => editing ? current.map(job => job.id === result.job.id ? result.job : job) : [result.job, ...current]);
      setJobEditor(null); setNotice(editing ? "岗位已更新" : "岗位已发布");
    } catch (error) { setFormError(error instanceof Error ? error.message : "保存失败"); }
    finally { setBusy(false); }
  }
  async function toggleJob(job: Job) {
    setBusy(true);
    try {
      const result = await request<{ job: Job }>(`/recruitment/jobs/${job.id}`, "PATCH", { status: job.status === "open" ? "closed" : "open" });
      setJobs(current => current.map(item => item.id === job.id ? result.job : item));
      setNotice(result.job.status === "open" ? "岗位已开放投递" : "岗位已停止接收新投递");
    } catch (error) { setNotice(error instanceof Error ? error.message : "更新失败"); }
    finally { setBusy(false); }
  }
  async function logout() {
    try { await request("/auth/logout", "POST"); setUser(null); setCandidates([]); setJobs([]); setLoaded(false); }
    catch (error) { setNotice(error instanceof Error ? error.message : "退出失败"); }
  }

  if (!user) return <StudioLogin role="enterprise" onLogin={setUser} />;
  return <main className={styles.workspace}>
    <aside className={styles.sidebar}>
      <div className={styles.brand}><span><FireSimple size={22} weight="fill" /></span><b>薪火</b><small>企业人才工作台</small></div>
      <div className={styles.companyBadge}><span><Buildings size={18} /></span><div><b>{user.name}</b><small>企业账号</small></div></div>
      <nav className={styles.sideNav}><span>工作台</span>
        <button onClick={() => selectTab("全部")} className={view === "candidates" && activeTab === "全部" ? styles.activeNav : ""}><UsersThree size={19} />学生投递<em>{candidates.length}</em></button>
        <button onClick={() => setView("jobs")} className={view === "jobs" ? styles.activeNav : ""}><Briefcase size={19} />招聘岗位<em>{jobs.filter(job => job.status === "open").length}</em></button>
        <button className={view === "candidates" && activeTab === "待查看" ? styles.activeNav : ""} onClick={() => selectTab("待查看")}><FileText size={19} />待处理投递</button>
        <button className={view === "candidates" && activeTab === "面试邀请" ? styles.activeNav : ""} onClick={() => selectTab("面试邀请")}><CalendarBlank size={19} />面试安排</button>
        <button className={view === "candidates" && activeTab === "已收藏" ? styles.activeNav : ""} onClick={() => selectTab("已收藏")}><Star size={19} />收藏候选人</button>
      </nav>
      <div className={styles.sidebarFoot}><Link href="/">返回首页</Link><button disabled={busy} onClick={logout}><SignOut size={17} />退出登录</button></div>
    </aside>
    <section className={styles.mainArea}>
      <header className={styles.topbar}><div><span className={styles.topKicker}>TALENT WORKSPACE</span><h1>{view === "jobs" ? "招聘岗位" : "候选人中心"}</h1></div><div className={styles.headerActions}><button className={styles.ghostButton} disabled={busy} onClick={refresh}>{busy ? "同步中…" : "刷新"}</button><button className={styles.ghostButton} disabled={busy} onClick={logout} aria-label="退出企业登录"><SignOut size={18} /></button></div></header>
      <div className={styles.content}>
        {notice && <p className={styles.notice} role="status">{notice}</p>}
        <section className={styles.welcomeRow}><div><h2>你好，{user.name}</h2><p>{view === "jobs" ? "管理招聘岗位与投递入口。" : "查看投递，安排面试，跟进录用。"}</p></div><div className={styles.workspaceSwitch} aria-label="工作台视图"><button aria-pressed={view === "candidates"} onClick={() => setView("candidates")}>学生投递</button><button aria-pressed={view === "jobs"} onClick={() => setView("jobs")}>招聘岗位</button></div></section>
        <section className={styles.metrics}>{(["全部", "待查看", "面试邀请", "已录用"] as const).map(tab => <article key={tab}><span>{tab === "全部" ? "收到简历" : tab}</span><strong>{tab === "全部" ? candidates.length : candidates.filter(candidate => candidate.status === tab).length}</strong></article>)}</section>
        {view === "jobs" ? <section className={styles.jobsPanel}>
          <div className={styles.jobsHead}><div><h2>我的岗位</h2><span>{jobs.filter(job => job.status === "open").length} 个招聘中</span></div><button className={styles.primaryButton} disabled={busy} onClick={() => openEditor("new")}><Plus size={17} />发布岗位</button></div>
          {!jobs.length && <div className={styles.empty}><Briefcase size={30} /><b>{loaded ? "还没有发布岗位" : "正在加载岗位"}</b><span>发布第一个岗位，接收学生投递</span></div>}
          <div className={styles.jobsList}>{jobs.map(job => <article key={job.id} className={styles.jobItem}>
            <div className={styles.jobTitle}><h3>{job.title}</h3><span data-open={job.status === "open"}>{job.status === "open" ? "招聘中" : "已关闭"}</span></div>
            <p className={styles.jobMeta}><span><MapPin size={14} />{job.location}</span><span>{job.employmentType}</span>{job.department && <span>{job.department}</span>}</p>
            <details className={styles.jobDescription}><summary>岗位详情</summary><h4>岗位职责</h4><p>{job.description}</p><h4>任职要求</h4><p>{job.requirements}</p></details>
            <footer><button className={styles.ghostButton} onClick={() => { selectTab("全部"); setJobFilter(job.id); setQuery(""); }}>查看投递 · {candidates.filter(candidate => candidate.job?.id === job.id).length}</button><div><button disabled={busy} className={styles.ghostButton} onClick={() => openEditor(job)}><PencilSimple size={15} />编辑</button><button disabled={busy} className={styles.ghostButton} onClick={() => void toggleJob(job)}>{job.status === "open" ? "关闭岗位" : "重新开放"}</button></div></footer>
          </article>)}</div>
        </section> : <section className={styles.candidateSection}>
          <div className={styles.listPanel}><div className={styles.sectionHead}><h2>学生投递</h2><span>{filtered.length} 份</span></div><div className={styles.filters}>
            <div className={styles.search}><MagnifyingGlass size={17} /><input aria-label="搜索候选人" value={query} onChange={event => { setQuery(event.target.value); setSelectedId(""); setPreview(false); }} placeholder="姓名、学校、岗位或技能" /></div>
            <select className={styles.jobFilter} aria-label="筛选投递岗位" value={jobFilter} onChange={event => { setJobFilter(event.target.value); setSelectedId(""); setPreview(false); }}><option value="">全部岗位</option>{jobs.map(job => <option key={job.id} value={job.id}>{job.title}{job.status === "closed" ? "（已关闭）" : ""}</option>)}</select>
            <div className={styles.tabs}>{tabs.map(tab => <button key={tab} className={activeTab === tab ? styles.tabActive : ""} onClick={() => selectTab(tab)} aria-pressed={activeTab === tab}>{tab}</button>)}</div>
          </div>
          <div className={styles.candidateList}>{filtered.map(candidate => <button key={candidate.id} className={styles.candidateItem + " " + (selected?.id === candidate.id ? styles.selectedItem : "")} onClick={() => { setSelectedId(candidate.id); setPreview(false); }}><span className={styles.candidateAvatar}>{candidate.resume.name.slice(0, 1)}</span><span className={styles.candidateMain}><strong>{candidate.resume.name}</strong><small>{candidate.resume.major} · {candidate.resume.grade}</small><span>{candidate.job?.title ?? candidate.resume.role}</span></span><span className={styles.candidateMeta}><small>{new Date(candidate.submitted).toLocaleDateString()}</small><em>{candidate.status}</em></span></button>)}</div>
          {filtered.length === 0 && <div className={styles.empty}><b>{loaded ? "暂无符合条件的投递" : "正在加载投递"}</b><span>{query || jobFilter ? "试试其他筛选条件" : "新的投递将在这里显示"}</span></div>}</div>
          {selected && <div className={styles.detailPanel}>
            <div className={styles.detailTop}><span>{selected.job?.title ?? "投递档案"} · {selected.status}</span><button disabled={busy || Boolean(hasHiringStatus)} onClick={() => void setStatus(selected.status === "已收藏" ? "已查看" : "已收藏")} aria-label={selected.status === "已收藏" ? "取消收藏" : "收藏候选人"} aria-pressed={selected.status === "已收藏"}><Star size={20} weight={selected.status === "已收藏" ? "fill" : "regular"} /></button></div>
            <div className={styles.profileHero}><span className={styles.detailAvatar}>{selected.resume.name.slice(0, 1)}</span><div><h2>{selected.resume.name}</h2><p>{selected.resume.role}</p><span>{[selected.resume.school, selected.resume.major, selected.resume.grade].filter(Boolean).join(" · ")}</span></div></div>
            {selected.resume.summary && <p className={styles.bio}>{selected.resume.summary}</p>}<div className={styles.contactRow}>{selected.resume.city && <span>{selected.resume.city}</span>}{selected.resume.email && <a href={`mailto:${selected.resume.email}`}><Envelope size={15} />{selected.resume.email}</a>}{selected.resume.phone && <a href={`tel:${selected.resume.phone.replace(/[^+\d]/g, "")}`}><Phone size={15} />{selected.resume.phone}</a>}</div>
            {selected.interview && <section className={styles.interviewCard}><CalendarBlank size={20} /><div><h3>面试安排</h3><strong>{displayDate(selected.interview.at)}</strong><p>{selected.interview.location}</p>{selected.interview.note && <p>{selected.interview.note}</p>}</div></section>}
            <div className={styles.hiringActions}><button disabled={busy} className={styles.primaryButton} onClick={() => openInvite(selected)}><CalendarBlank size={17} />{selected.status === "面试邀请" ? "修改面试安排" : "邀请面试"}</button><button disabled={busy || selected.status === "已录用"} className={styles.ghostButton} onClick={() => void setStatus("已录用")}><CheckCircle size={17} />{selected.status === "已录用" ? "已录用" : "录用"}</button><button disabled={busy || selected.status === "不合适"} className={styles.ghostButton} onClick={() => void setStatus("不合适")}>不合适</button>{["已录用", "不合适"].includes(selected.status) && <button disabled={busy} className={styles.ghostButton} onClick={() => void setStatus("已查看")}>重新评估</button>}</div>
            <div className={styles.tags}>{selected.resume.skills.split(/[,，、\n]/).filter(Boolean).map((skill, index) => <span key={index}>{skill.trim()}</span>)}</div>
            <div className={styles.detailSection}><h3>大学与项目经历</h3>{selected.resume.experiences.length === 0 && <p>学生尚未填写经历</p>}{selected.resume.experiences.map(experience => <article key={experience.id} className={styles.experience}><i /><div><strong>{experience.title}</strong><span>{experience.org} · {experience.period}</span><p>{experience.detail}</p></div></article>)}</div>
            <div className={styles.detailSection}><h3>已核验成长成果</h3>{selected.resume.tasks.length === 0 && <p>暂无分享的已核验成果</p>}{selected.resume.tasks.map((task, index) => <article key={index} className={styles.task}><CheckCircle size={18} /><div><strong>{task.title}</strong><small>{task.type} · {task.date}</small><p>{task.result}</p></div></article>)}</div>
            <div className={styles.detailActions}><button className={styles.ghostButton} onClick={() => setPreview(!preview)}><FileText size={17} />{preview ? "收起简历" : "查看完整简历"}</button>{selected.status === "待查看" && <button disabled={busy} className={styles.ghostButton} onClick={() => void setStatus("已查看")}>标记已查看</button>}<button disabled={busy} className={styles.ghostButton} onClick={async () => { setBusy(true); try { await downloadResumeDocx(selected.resume); } catch { setNotice("导出失败，请重试"); } finally { setBusy(false); } }}><DownloadSimple size={17} />导出 Word</button></div>
            {preview && <article className={styles.detailSection}><h2>{selected.resume.name} · {selected.resume.role}</h2><p>{selected.resume.school} · {selected.resume.major} · {selected.resume.grade}</p><p>{selected.resume.email} · {selected.resume.phone}</p><p>{selected.resume.summary}</p><p>{selected.resume.skills}</p>{selected.resume.experiences.map(experience => <section key={experience.id}><h3>{experience.title}</h3><p>{experience.org} · {experience.period}</p><p style={{ whiteSpace: "pre-wrap" }}>{experience.detail}</p></section>)}</article>}
          </div>}
        </section>}
      </div>
    </section>
    {jobEditor && <JobEditor job={jobEditor === "new" ? null : jobEditor} busy={busy} error={formError} onClose={() => setJobEditor(null)} onSave={saveJob} />}
    {inviteCandidate && <InviteEditor candidate={inviteCandidate} busy={busy} error={formError} onClose={() => setInviteCandidate(null)} onSave={interview => setStatus("面试邀请", inviteCandidate, interview)} />}
  </main>;
}
