"use client";

import { apiFetch } from "../../lib/bmob-api";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PortalFrame from "./PortalFrame";
import CareerJobDiscovery, { type JobImportDraft } from "./CareerJobDiscovery";

type Requirement = { id: string; label: string; dimension: string; priority: "required" | "preferred"; keywords: string[] };
type MatchResult = {
  engineVersion: string;
  modelMode: "deterministic";
  overallScore: number;
  confidence: number;
  verdict: string;
  formula: string;
  requirements: Requirement[];
  dimensions: Array<{ name: string; score: number; weight: number; evidenceBasis: string }>;
  strengths: string[];
  gaps: Array<{ id: string; label: string; dimension: string; priority: "required" | "preferred"; recommendation: string }>;
  manualChecks: string[];
  evidenceBasis: { verifiedEvidence: number; portraitConfidence: number; matchedRequirements: number; totalRequirements: number };
  calculatedAt: string;
};
type ApplicationStatus = "saved" | "applied" | "written_test" | "interview" | "offer" | "rejected" | "withdrawn";
type Application = {
  id: string; jobId: string; status: ApplicationStatus; note: string; submittedAt: number | null; lastEventAt: number | null;
  createdAt: number; updatedAt: number; title: string; company: string; city: string; employmentType: string;
  sourceUrl: string; matchScore: number | null; matchVerdict: string | null; latestEventNote: string;
};
type Job = {
  id: string; title: string; company: string; city: string; employmentType: string; salary: string;
  sourceUrl: string; sourceName: string; description: string; requirements: Requirement[]; createdAt: number; updatedAt: number;
  match: { overallScore: number; confidence: number; verdict: string; result: MatchResult; updatedAt: number } | null;
  application: { id: string; status: ApplicationStatus; note: string; submittedAt: number | null; lastEventAt: number | null; updatedAt: number } | null;
};

const statusLabels: Record<ApplicationStatus, string> = {
  saved: "待投递", applied: "已投递", written_test: "笔试/测评", interview: "面试中", offer: "获得 Offer", rejected: "未通过", withdrawn: "已撤回",
};
const statusOrder: ApplicationStatus[] = ["saved", "applied", "written_test", "interview", "offer", "rejected", "withdrawn"];
const blankJob = { title: "", company: "", city: "", employmentType: "实习", salary: "", sourceUrl: "", sourceName: "学生导入", description: "" };

function formatDate(value: number | null) {
  return value ? new Date(value).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" }) : "尚未记录";
}

function matchResult(job: Job) {
  return job.match?.result ?? null;
}

export default function CareerWorkbench() {
  const [tab, setTab] = useState<"jobs" | "applications" | "method">("jobs");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [jobForm, setJobForm] = useState(blankJob);
  const [showImport, setShowImport] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [statusDrafts, setStatusDrafts] = useState<Record<string, ApplicationStatus>>({});
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    const [jobsResponse, applicationsResponse] = await Promise.all([apiFetch("/api/career/jobs"), apiFetch("/api/career/applications")]);
    const jobsBody = await jobsResponse.json() as { jobs?: Job[]; error?: string };
    const applicationsBody = await applicationsResponse.json() as { applications?: Application[]; error?: string };
    if (!jobsResponse.ok) throw new Error(jobsBody.error || "岗位工作台读取失败");
    if (!applicationsResponse.ok) throw new Error(applicationsBody.error || "投递工作台读取失败");
    setJobs(jobsBody.jobs ?? []);
    setApplications(applicationsBody.applications ?? []);
  }, []);

  useEffect(() => {
    load().catch(reason => setError(reason instanceof Error ? reason.message : "职业数据读取失败")).finally(() => setLoading(false));
  }, [load]);

  const counts = useMemo(() => Object.fromEntries(statusOrder.map(status => [status, applications.filter(item => item.status === status).length])) as Record<ApplicationStatus, number>, [applications]);
  const verifiedEvidence = useMemo(() => jobs.reduce((sum, job) => sum + (matchResult(job)?.evidenceBasis.verifiedEvidence ?? 0), 0), [jobs]);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  };

  const useParsedDraft = (draft: JobImportDraft) => {
    setJobForm(current => ({
      ...current,
      title: draft.title || current.title,
      company: draft.company || current.company,
      city: draft.city || current.city,
      employmentType: draft.employmentType || current.employmentType,
      salary: draft.salary || current.salary,
      sourceUrl: draft.sourceUrl || current.sourceUrl,
      sourceName: draft.sourceName || current.sourceName,
      description: draft.description || current.description,
    }));
    setShowImport(true);
    notify("岗位基本信息已填入，请人工核对后再保存");
  };

  const importJob = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true); setError("");
    try {
      const response = await apiFetch("/api/career/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(jobForm) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "岗位导入失败");
      setJobForm(blankJob); setShowImport(false); await load();
      notify("岗位原文已保存；下一步可开始证据型匹配");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "岗位导入失败"); }
    finally { setSaving(false); }
  };

  const analyse = async (job: Job) => {
    setBusyId(`match-${job.id}`); setError("");
    try {
      const response = await apiFetch(`/api/career/jobs/${job.id}/match`, { method: "POST" });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "岗位匹配失败");
      await load(); setActiveJobId(job.id); notify("匹配已按已核验成长佐证重新计算");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "岗位匹配失败"); }
    finally { setBusyId(null); }
  };

  const createApplication = async (job: Job) => {
    setBusyId(`apply-${job.id}`); setError("");
    try {
      const response = await apiFetch("/api/career/applications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId: job.id }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "投递记录创建失败");
      await load(); setTab("applications"); notify("已加入个人投递工作台");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "投递记录创建失败"); }
    finally { setBusyId(null); }
  };

  const addGapTasks = async (job: Job) => {
    setBusyId(`gap-${job.id}`); setError("");
    try {
      const response = await apiFetch(`/api/career/jobs/${job.id}/gap-tasks`, { method: "POST" });
      const body = await response.json() as { tasks?: unknown[]; error?: string };
      if (!response.ok) throw new Error(body.error || "补强任务创建失败");
      notify(`已把 ${body.tasks?.length ?? 0} 项岗位缺口加入成长地图，仍需提交佐证并审核`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "补强任务创建失败"); }
    finally { setBusyId(null); }
  };

  const updateApplication = async (application: Application, status: ApplicationStatus) => {
    const note = (notes[application.id] ?? application.note ?? "").trim();
    if (note.length < 2) return setError("请先写下至少 2 个字的阶段反馈或复盘");
    setBusyId(`event-${application.id}`); setError("");
    try {
      const response = await apiFetch(`/api/career/applications/${application.id}/events`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, note }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "投递阶段保存失败");
      await load(); notify("投递阶段与复盘已保存");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "投递阶段保存失败"); }
    finally { setBusyId(null); }
  };

  return <PortalFrame active="career" eyebrow="CAREER LOOP · XH-JFM-1.0" title="实习就业工作台" subtitle="保存真实岗位，依据已核验成长佐证匹配，再把投递结果反哺成长地图。" actions={<button className="primary-action" onClick={() => setShowImport(value => !value)}>＋ 导入真实岗位</button>}>
    {error && <div className="account-feedback error" role="alert">{error}</div>}
    <section className="career-loop-intro">
      <div><b>不抓取、不代投、不编造经历。</b><p>岗位原文由你保存；匹配分数只读取通过审核的成长佐证，AI不能改写最终分数。</p></div>
      <Link href="/growth-map">查看成长地图 →</Link>
    </section>

    <CareerJobDiscovery onUseDraft={useParsedDraft} />

    {showImport && <form className="career-import" onSubmit={importJob}>
      <div className="career-import-head"><div><h2>导入一个真实岗位</h2><p>粘贴企业官方页面、学校就业信息或你确认过的岗位原文；平台不会自动访问外部招聘网站。</p></div><button type="button" className="ghost-action" onClick={() => setShowImport(false)}>收起</button></div>
      <div className="career-form-grid">
        <label><span>岗位名称 *</span><input value={jobForm.title} onChange={event => setJobForm({ ...jobForm, title: event.target.value })} placeholder="如：后端开发实习生" maxLength={100} /></label>
        <label><span>公司 / 单位 *</span><input value={jobForm.company} onChange={event => setJobForm({ ...jobForm, company: event.target.value })} placeholder="如：某科技公司" maxLength={80} /></label>
        <label><span>城市</span><input value={jobForm.city} onChange={event => setJobForm({ ...jobForm, city: event.target.value })} placeholder="如：呼和浩特" maxLength={40} /></label>
        <label><span>岗位类型</span><select value={jobForm.employmentType} onChange={event => setJobForm({ ...jobForm, employmentType: event.target.value })}><option>实习</option><option>校招</option><option>兼职</option><option>科研助理</option></select></label>
        <label><span>薪资（选填）</span><input value={jobForm.salary} onChange={event => setJobForm({ ...jobForm, salary: event.target.value })} placeholder="如：200-300/天" maxLength={40} /></label>
        <label><span>岗位链接（选填）</span><input value={jobForm.sourceUrl} onChange={event => setJobForm({ ...jobForm, sourceUrl: event.target.value })} placeholder="https://..." inputMode="url" maxLength={500} /></label>
        <label className="wide"><span>来源说明</span><input value={jobForm.sourceName} onChange={event => setJobForm({ ...jobForm, sourceName: event.target.value })} placeholder="如：学校就业中心、企业官网、老师推荐" maxLength={60} /></label>
        <label className="wide"><span>岗位原文 *</span><textarea value={jobForm.description} onChange={event => setJobForm({ ...jobForm, description: event.target.value })} placeholder="粘贴岗位职责、任职要求和其他关键信息（至少 30 个字）" maxLength={12000} /></label>
      </div>
      <footer><small>岗位文字仅作为匹配材料保存，不会被当作系统指令执行。</small><button className="primary-action" disabled={saving}>{saving ? "正在保存…" : "保存岗位并建立快照"}</button></footer>
    </form>}

    <section className="career-loop-stats">
      <article><span>已保存岗位</span><strong>{jobs.length}</strong><small>每个岗位保留原文快照</small></article>
      <article><span>已完成匹配</span><strong>{jobs.filter(job => job.match).length}</strong><small>算法版本 XH-JFM-1.0</small></article>
      <article><span>进行中投递</span><strong>{applications.filter(item => ["applied", "written_test", "interview"].includes(item.status)).length}</strong><small>结果会持续记录</small></article>
      <article><span>证据基数</span><strong>{verifiedEvidence || "—"}</strong><small>仅统计参与匹配的已核验证据</small></article>
    </section>

    <section className="career-workspace-tabs" aria-label="实习就业工作台分区">
      <button className={tab === "jobs" ? "active" : ""} onClick={() => setTab("jobs")}>岗位库 <b>{jobs.length}</b></button>
      <button className={tab === "applications" ? "active" : ""} onClick={() => setTab("applications")}>投递进度 <b>{applications.length}</b></button>
      <button className={tab === "method" ? "active" : ""} onClick={() => setTab("method")}>评分方法</button>
    </section>

    {loading ? <div className="career-loading">正在读取你的云端岗位与投递档案…</div> : tab === "jobs" ? <section className="career-job-list">
      {!jobs.length ? <div className="career-empty"><span>↗</span><h2>从一条真实岗位开始</h2><p>导入岗位原文后，平台会保存快照，并用你的已核验成长佐证计算匹配依据。</p><button className="primary-action" onClick={() => setShowImport(true)}>导入第一个岗位</button></div> : jobs.map(job => {
        const detail = matchResult(job);
        const open = activeJobId === job.id;
        return <article className={`career-job-record ${open ? "open" : ""}`} key={job.id}>
          <div className="career-job-summary">
            <div className="career-company-mark">{job.company.slice(0, 1)}</div>
            <div className="career-job-copy"><div><span>{job.employmentType}</span>{job.city && <small>{job.city}</small>}{job.salary && <small>{job.salary}</small>}</div><h2>{job.title}</h2><p>{job.company} · 来源：{job.sourceName}</p></div>
            <div className="career-match-badge">{job.match ? <><strong>{job.match.overallScore}</strong><span>{job.match.verdict}</span><small>可信度 {job.match.confidence}%</small></> : <><strong>—</strong><span>待匹配</span><small>尚未计算</small></>}</div>
            <div className="career-job-actions"><button className="ghost-action" onClick={() => setActiveJobId(open ? null : job.id)}>{open ? "收起" : "查看"}</button><button className="primary-action" disabled={busyId === `match-${job.id}`} onClick={() => analyse(job)}>{busyId === `match-${job.id}` ? "计算中…" : job.match ? "重新匹配" : "开始匹配"}</button></div>
          </div>
          {open && <div className="career-job-detail">
            <div className="career-job-source"><div><span>岗位原文快照</span><p>{job.description}</p></div>{job.sourceUrl && <a href={job.sourceUrl} target="_blank" rel="noreferrer">打开原始链接 ↗</a>}</div>
            <div className="career-requirements"><span>识别到的岗位能力</span><div>{job.requirements.map(item => <b key={item.id} className={item.priority}>{item.label}<small>{item.priority === "required" ? "重点" : "加分"}</small></b>)}</div></div>
            {detail ? <div className="career-match-detail">
              <header><div><span>证据型匹配报告</span><h3>{detail.verdict} · {detail.overallScore} 分</h3><p>{detail.formula}</p></div><small>{detail.engineVersion} · 计算可信度 {detail.confidence}%</small></header>
              <div className="career-score-grid">{detail.dimensions.map(item => <article key={item.name}><div><b>{item.name}</b><strong>{item.score}</strong></div><i><em style={{ width: `${item.score}%` }} /></i><p>{item.weight}% 权重 · {item.evidenceBasis}</p></article>)}</div>
              <div className="career-match-notes"><section><h4>已有优势</h4>{detail.strengths.map(item => <p key={item}>✓ {item}</p>)}</section><section><h4>待补强缺口</h4>{detail.gaps.length ? detail.gaps.map(item => <p key={item.id}><b>{item.label}</b>：{item.recommendation}</p>) : <p>当前未识别到主要岗位缺口，仍请核对企业官方资格要求。</p>}</section></div>
              <div className="career-manual-checks"><span>投递前仍需人工确认</span>{detail.manualChecks.map(item => <p key={item}>• {item}</p>)}</div>
              <footer><button className="ghost-action" disabled={busyId === `gap-${job.id}`} onClick={() => addGapTasks(job)}>{busyId === `gap-${job.id}` ? "正在加入…" : "将缺口加入成长地图"}</button>{job.application ? <button className="primary-action" onClick={() => setTab("applications")}>查看投递进度</button> : <button className="primary-action" disabled={busyId === `apply-${job.id}`} onClick={() => createApplication(job)}>{busyId === `apply-${job.id}` ? "正在加入…" : "加入投递工作台"}</button>}</footer>
            </div> : <div className="career-match-empty"><b>尚未计算匹配</b><p>点击“开始匹配”后，系统将从已审核的成长佐证中读取依据；没有证据时会明确显示低可信度，而不是生成默认高分。</p></div>}
          </div>}
        </article>;
      })}
    </section> : tab === "applications" ? <section className="career-applications">
      <div className="career-pipeline-head">{statusOrder.slice(0, 5).map(status => <span key={status}><b>{counts[status]}</b>{statusLabels[status]}</span>)}</div>
      {!applications.length ? <div className="career-empty"><span>○</span><h2>还没有投递记录</h2><p>在岗位详情中完成匹配后，选择“加入投递工作台”开始记录。</p><button className="primary-action" onClick={() => setTab("jobs")}>前往岗位库</button></div> : <div className="career-application-list">{applications.map(application => <article key={application.id}>
        <header><div><span className={`application-status ${application.status}`}>{statusLabels[application.status]}</span><h2>{application.title}</h2><p>{application.company}{application.city ? ` · ${application.city}` : ""}{application.matchScore != null ? ` · 匹配 ${application.matchScore} 分` : ""}</p></div><Link className="ghost-action" href={`/interview?applicationId=${encodeURIComponent(application.id)}`}>岗位模拟面试</Link></header>
        <div className="application-event"><label><span>更新到哪个阶段</span><select value={statusDrafts[application.id] ?? application.status} onChange={event => setStatusDrafts(current => ({ ...current, [application.id]: event.target.value as ApplicationStatus }))}>{statusOrder.map(status => <option value={status} key={status}>{statusLabels[status]}</option>)}</select></label><label><span>本阶段反馈 / 复盘</span><textarea value={notes[application.id] ?? application.note} onChange={event => setNotes(current => ({ ...current, [application.id]: event.target.value }))} placeholder="如：已完成线上笔试；技术题需补强数据库索引" maxLength={500} /></label><button className="primary-action" disabled={busyId === `event-${application.id}`} onClick={() => {
          updateApplication(application, statusDrafts[application.id] ?? application.status);
        }}>{busyId === `event-${application.id}` ? "保存中…" : "保存阶段与复盘"}</button></div>
        <footer><span>最近记录：{application.latestEventNote || "暂无补充"}</span><span>更新时间：{formatDate(application.lastEventAt ?? application.updatedAt)}</span></footer>
      </article>)}</div>}
    </section> : <section className="career-method">
      <article><span>01</span><div><h2>岗位原文保存</h2><p>系统不自动抓取外部招聘网站。学生自行导入确认过的岗位文字，平台保存岗位快照、来源和链接。</p></div></article>
      <article><span>02</span><div><h2>确定性证据匹配</h2><p>技能 30%、项目经历 25%、沟通协作 15%、职业方向 30%。待审核、驳回或没有佐证的材料不参与评分。</p></div></article>
      <article><span>03</span><div><h2>投递结果反哺成长</h2><p>岗位缺口会生成待佐证的成长任务；笔试、面试、Offer 与复盘形成个人就业档案，后续模拟面试可关联到具体岗位。</p></div></article>
      <aside><b>为什么显示“可信度”</b><p>分数不等于事实。可信度由已核验证据数量、能力画像可信度和岗位原文完整度共同计算；证据不足时，系统明确提示而不装作了解你。</p></aside>
    </section>}
    {toast && <div className="portal-toast">✓ {toast}</div>}
  </PortalFrame>;
}
