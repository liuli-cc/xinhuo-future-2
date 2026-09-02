"use client";

/** 求职工作台：岗位投递 + 公告投递（两层进度）+ 我的收藏 + 自定义岗位导入。 */

import { apiFetch } from "@/modules/shared/api/bmob-api";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import CareerJobDiscovery, { type JobImportDraft } from "./CareerJobDiscovery";
import { formatDay, type ApplicationRecord, type Job, type Announcement, type Stage, type StageOption, type TimelineEvent } from "../client/types";

type Tracker = {
  applications: ApplicationRecord[];
  counts: Record<string, number>;
  stageOptions: StageOption[];
};

const outcomeChips = [
  { value: "rejected", label: "未通过" },
  { value: "withdrawn", label: "已终止" },
];

const blankJob = { title: "", company: "", city: "", employmentType: "实习", salary: "", sourceUrl: "", sourceName: "学生导入", description: "", majorsText: "" };

function statusColor(record: { outcome: string | null; stage: Stage }) {
  if (record.outcome === "rejected") return "var(--chart-blue-5, #ef4444)";
  if (record.outcome === "withdrawn") return "var(--chart-neutral, #94a3b8)";
  if (record.stage === "offer") return "var(--chart-blue-1, #16a34a)";
  return "var(--chart-blue-2, #2563eb)";
}

export default function CareerWorkbench({ onToast }: { onToast: (message: string) => void }) {
  const [jobTracker, setJobTracker] = useState<Tracker>({ applications: [], counts: {}, stageOptions: [] });
  const [annTracker, setAnnTracker] = useState<Tracker>({ applications: [], counts: {}, stageOptions: [] });
  const [filter, setFilter] = useState<Record<string, string>>({ job: "", announcement: "" });
  const [favorites, setFavorites] = useState<{ jobs: Job[]; announcements: Announcement[] }>({ jobs: [], announcements: [] });
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [stageDrafts, setStageDrafts] = useState<Record<string, string>>({});
  const [timeline, setTimeline] = useState<Record<string, TimelineEvent[]>>({});
  const [openTimeline, setOpenTimeline] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [jobForm, setJobForm] = useState(blankJob);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [jobsRes, annRes, favJobsRes, favAnnRes] = await Promise.all([
      apiFetch("/api/career/applications"),
      apiFetch("/api/career/announcement-applications"),
      apiFetch("/api/career/favorites"),
      apiFetch("/api/career/announcement-favorites"),
    ]);
    const [jobsBody, annBody, favJobsBody, favAnnBody] = await Promise.all([
      jobsRes.json(), annRes.json(), favJobsRes.json(), favAnnRes.json(),
    ]);
    if (!jobsRes.ok) throw new Error(jobsBody.error || "投递档案读取失败");
    if (!annRes.ok) throw new Error(annBody.error || "公告投递读取失败");
    setJobTracker({ applications: jobsBody.applications ?? [], counts: jobsBody.counts ?? {}, stageOptions: jobsBody.stageOptions ?? [] });
    setAnnTracker({ applications: annBody.applications ?? [], counts: annBody.counts ?? {}, stageOptions: annBody.stageOptions ?? [] });
    setFavorites({ jobs: favJobsBody.favorites ?? [], announcements: favAnnBody.favorites ?? [] });
  }, []);

  useEffect(() => {
    load().catch(reason => setError(reason instanceof Error ? reason.message : "数据读取失败")).finally(() => setLoading(false));
  }, [load]);

  const stageChips = useMemo(() => {
    const options = jobTracker.stageOptions;
    const chips: Array<{ value: string; label: string; count: number }> = [{ value: "", label: "全部", count: Object.values(jobTracker.counts).reduce((sum, value) => sum + value, 0) }];
    for (const option of options) chips.push({ ...option, count: jobTracker.counts[option.value] ?? 0 });
    for (const outcome of outcomeChips) chips.push({ ...outcome, count: jobTracker.counts[outcome.value] ?? 0 });
    return chips;
  }, [jobTracker]);

  const annChips = useMemo(() => {
    const chips: Array<{ value: string; label: string; count: number }> = [{ value: "", label: "全部", count: Object.values(annTracker.counts).reduce((sum, value) => sum + value, 0) }];
    for (const option of annTracker.stageOptions) chips.push({ ...option, count: annTracker.counts[option.value] ?? 0 });
    for (const outcome of outcomeChips) chips.push({ ...outcome, count: annTracker.counts[outcome.value] ?? 0 });
    return chips;
  }, [annTracker]);

  const useParsedDraft = (draft: JobImportDraft) => {
    setJobForm(current => ({
      ...current,
      title: draft.title || current.title, company: draft.company || current.company,
      city: draft.city || current.city, employmentType: draft.employmentType || current.employmentType,
      salary: draft.salary || current.salary, sourceUrl: draft.sourceUrl || current.sourceUrl,
      description: draft.description || current.description,
    }));
    setShowImport(true);
    onToast("岗位基本信息已填入，请人工核对后再保存");
  };

  const importJob = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true); setError("");
    try {
      const response = await apiFetch("/api/career/jobs", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(jobForm),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "岗位导入失败");
      setJobForm(blankJob); setShowImport(false); await load();
      onToast("已保存为你的自定义岗位（仅自己可见），可投递并跟踪");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "岗位导入失败"); }
    finally { setSaving(false); }
  };

  const saveStage = async (kind: "job" | "announcement", record: ApplicationRecord) => {
    const draft = stageDrafts[record.id] ?? "";
    const isOutcome = draft === "rejected" || draft === "withdrawn";
    const note = (notes[record.id] ?? record.note ?? "").trim();
    if (note.length < 2) return setError("请先写下至少 2 个字的阶段反馈或复盘");
    setBusyId(record.id); setError("");
    try {
      const path = kind === "job"
        ? `/api/career/applications/${record.id}/events`
        : `/api/career/announcement-applications/${record.id}/events`;
      const payload = isOutcome ? { outcome: draft, note } : { stage: draft || record.stage, note };
      const response = await apiFetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "投递阶段保存失败");
      onToast("投递进度与复盘已保存");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "投递阶段保存失败"); }
    finally { setBusyId(""); }
  };

  const loadTimeline = async (kind: "job" | "announcement", record: ApplicationRecord) => {
    const key = `${kind}-${record.id}`;
    if (openTimeline === key) return setOpenTimeline(null);
    setOpenTimeline(key);
    if (timeline[key]) return;
    setBusyId(key);
    try {
      const path = kind === "job"
        ? `/api/career/applications/${record.id}/events`
        : `/api/career/announcement-applications/${record.id}/events`;
      const response = await apiFetch(path);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "时间线读取失败");
      setTimeline(current => ({ ...current, [key]: body.events ?? [] }));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "时间线读取失败"); }
    finally { setBusyId(""); }
  };

  const removeFavorite = async (kind: "job" | "announcement", targetId: string) => {
    setBusyId(`fav-${targetId}`);
    try {
      const path = kind === "job" ? `/api/career/favorites/${targetId}` : `/api/career/announcement-favorites/${targetId}`;
      const response = await apiFetch(path, { method: "DELETE" });
      if (!response.ok) throw new Error((await response.json()).error || "取消收藏失败");
      onToast("已取消收藏");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "取消收藏失败"); }
    finally { setBusyId(""); }
  };

  const renderTracker = (kind: "job" | "announcement", tracker: Tracker, chips: Array<{ value: string; label: string; count: number }>) => {
    const active = filter[kind] ?? "";
    const records = !active ? tracker.applications
      : tracker.applications.filter(item => (item.outcome || item.stage) === active);
    return <>
      <div className="career-pipeline-head">
        {chips.map(chip => (
          <span key={`${kind}-${chip.value}`} style={{ cursor: "pointer", opacity: active === chip.value ? 1 : 0.75 }}
                onClick={() => setFilter(current => ({ ...current, [kind]: chip.value }))}>
            <b>{chip.count}</b>{chip.label}
          </span>))}
      </div>
      {!records.length ? <div className="career-empty"><span>○</span><h2>这里还没有记录</h2><p>去「岗位」或「校招公告」标签挑选目标，点「投递」后开始跟踪。</p></div> : <div className="career-application-list">
        {records.map(record => {
          const key = `${kind}-${record.id}`;
          const draft = stageDrafts[record.id] ?? record.stage;
          const closed = Boolean(record.outcome);
          return <article key={record.id}>
            <header>
              <div>
                <span className="application-status" style={{ background: statusColor(record), color: "#fff" }}>
                  {record.outcomeLabel || record.stageLabel}
                </span>
                <h2>{record.title}</h2>
                <p>{record.company}{record.city ? ` · ${record.city}` : ""}{record.cohort ? ` · ${record.cohort}` : ""}
                  {record.matchScore != null ? ` · 匹配 ${record.matchScore} 分` : ""}</p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="ghost-action" disabled={busyId === key} onClick={() => loadTimeline(kind, record)}>
                  {openTimeline === key ? "收起时间线" : `时间线（${record.eventCount}）`}</button>
                {kind === "job" && <Link className="ghost-action" href={`/interview?applicationId=${encodeURIComponent(record.id)}`}>模拟面试</Link>}
              </div>
            </header>
            {openTimeline === key && <div className="career-manual-checks" style={{ margin: "8px 0" }}>
              <span>投递时间线</span>
              {(timeline[key] ?? []).map(event => (
                <p key={event.id}>· {formatDay(event.createdAt)} → {event.stage}{event.note ? `：${event.note}` : ""}</p>))}
              {busyId === key && !timeline[key] && <p>正在读取…</p>}
            </div>}
            <div className="application-event">
              <label><span>{closed ? "该投递已结束" : "更新到哪个阶段"}</span>
                <select disabled={closed} value={closed ? record.outcomeLabel || record.stageLabel : draft}
                        onChange={event => setStageDrafts(current => ({ ...current, [record.id]: event.target.value }))}>
                  <option value={record.stage}>{record.stageLabel}</option>
                  {tracker.stageOptions.filter(option => option.value !== record.stage).map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>))}
                  {!closed && outcomeChips.map(outcome => <option key={outcome.value} value={outcome.value}>{outcome.label}</option>)}
                </select></label>
              <label><span>本阶段反馈 / 复盘</span>
                <textarea value={notes[record.id] ?? record.note} maxLength={500} disabled={closed}
                          onChange={event => setNotes(current => ({ ...current, [record.id]: event.target.value }))}
                          placeholder="如：已完成线上笔试；技术题需补强数据库索引" /></label>
              <button className="primary-action" disabled={closed || busyId === record.id} onClick={() => saveStage(kind, record)}>
                {busyId === record.id ? "保存中…" : "保存阶段与复盘"}</button>
            </div>
            <footer><span>最近记录：{record.note || "暂无补充"}</span><span>更新时间：{formatDay(record.lastEventAt ?? record.updatedAt)}</span></footer>
          </article>;
        })}
      </div>}
    </>;
  };

  return <>
    {error && <div className="account-feedback error" role="alert">{error}</div>}
    <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 10px" }}>
      岗位投递与公告投递分开跟踪，复盘沉淀为你的就业档案。
    </p>

    <section className="career-workspace-tabs" aria-label="工作台分区">
      <button className="active">岗位投递 <b>{jobTracker.applications.length}</b></button>
    </section>

    {loading ? <div className="career-loading">正在读取你的投递档案…</div> : <>
      {renderTracker("job", jobTracker, stageChips)}

      <section className="career-workspace-tabs" aria-label="公告投递分区" style={{ marginTop: 20 }}>
        <button className="active">公告投递 <b>{annTracker.applications.length}</b></button>
      </section>
      {renderTracker("announcement", annTracker, annChips)}

      <section className="career-workspace-tabs" aria-label="我的收藏分区" style={{ marginTop: 20 }}>
        <button className="active">我的收藏 <b>{favorites.jobs.length + favorites.announcements.length}</b></button>
      </section>
      {!favorites.jobs.length && !favorites.announcements.length ? <div className="career-empty"><span>☆</span><h2>还没有收藏</h2><p>在岗位或公告卡片上点「☆ 收藏」，先加入心愿单。</p></div> : <div className="career-application-list">
        {favorites.jobs.map(job => <article key={`job-${job.id}`}>
          <header><div><span className="application-status">岗位</span><h2>{job.title}</h2>
            <p>{job.company}{job.city ? ` · ${job.city}` : ""}</p></div>
            <div style={{ display: "flex", gap: 8 }}>
              {job.match && <span className="application-status">{job.match.verdict} {job.match.overallScore}分</span>}
              <button className="ghost-action" disabled={busyId === `fav-${job.id}`} onClick={() => removeFavorite("job", job.id)}>取消收藏</button>
            </div></header>
        </article>)}
        {favorites.announcements.map(item => <article key={`ann-${item.id}`}>
          <header><div><span className="application-status">公告</span><h2>{item.title}</h2>
            <p>{item.company}{item.cohort ? ` · ${item.cohort}` : ""}</p></div>
            <button className="ghost-action" disabled={busyId === `fav-${item.id}`} onClick={() => removeFavorite("announcement", item.id)}>取消收藏</button>
          </header>
        </article>)}
      </div>}

      <section className="career-workspace-tabs" aria-label="自定义岗位分区" style={{ marginTop: 20 }}>
        <button className="active">自定义岗位 <b>{favorites.jobs.filter(item => item.visibility === "private").length}</b></button>
        <button className="primary-action" onClick={() => setShowImport(value => !value)}>＋ 导入真实岗位</button>
      </section>
      <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 10px" }}>
        自己发现的好岗位可以存进这里（仅自己可见），同样参与匹配与投递跟踪。
      </p>

      <CareerJobDiscovery onUseDraft={useParsedDraft} />
      {showImport && <form className="career-import" onSubmit={importJob}>
        <div className="career-import-head"><div><h2>导入一个真实岗位</h2>
          <p>粘贴企业官方页面、学校就业信息或你确认过的岗位原文；平台不会自动访问外部招聘网站。</p></div>
          <button type="button" className="ghost-action" onClick={() => setShowImport(false)}>收起</button></div>
        <div className="career-form-grid">
          <label><span>岗位名称 *</span><input value={jobForm.title} onChange={event => setJobForm({ ...jobForm, title: event.target.value })} maxLength={100} /></label>
          <label><span>公司 / 单位 *</span><input value={jobForm.company} onChange={event => setJobForm({ ...jobForm, company: event.target.value })} maxLength={80} /></label>
          <label><span>城市</span><input value={jobForm.city} onChange={event => setJobForm({ ...jobForm, city: event.target.value })} maxLength={40} /></label>
          <label><span>岗位类型</span><select value={jobForm.employmentType} onChange={event => setJobForm({ ...jobForm, employmentType: event.target.value })}><option>实习</option><option>校招</option><option>兼职</option><option>科研助理</option></select></label>
          <label><span>薪资（选填）</span><input value={jobForm.salary} onChange={event => setJobForm({ ...jobForm, salary: event.target.value })} maxLength={40} /></label>
          <label><span>岗位链接（选填）</span><input value={jobForm.sourceUrl} onChange={event => setJobForm({ ...jobForm, sourceUrl: event.target.value })} inputMode="url" maxLength={500} /></label>
          <label className="wide"><span>专业限制（选填）</span><input value={jobForm.majorsText} onChange={event => setJobForm({ ...jobForm, majorsText: event.target.value })} placeholder="如：计算机科学与技术、软件工程；不限可留空" maxLength={500} /></label>
          <label className="wide"><span>岗位原文 *</span><textarea value={jobForm.description} onChange={event => setJobForm({ ...jobForm, description: event.target.value })} placeholder="粘贴岗位职责、任职要求和其他关键信息（至少 30 个字）" maxLength={12000} /></label>
        </div>
        <footer><small>岗位文字仅作为匹配材料保存，不会被当作系统指令执行。</small>
          <button className="primary-action" disabled={saving}>{saving ? "正在保存…" : "保存岗位并建立快照"}</button></footer>
      </form>}
    </>}
  </>;
}
