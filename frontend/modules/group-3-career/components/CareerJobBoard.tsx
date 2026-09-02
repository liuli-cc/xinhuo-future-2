"use client";

/** 岗位大厅：筛选 + 岗位卡（匹配分/收藏/详情展开/投递）+ 分页。 */

import { apiFetch } from "@/modules/shared/api/bmob-api";

import { useCallback, useEffect, useMemo, useState } from "react";
import { categoryLabels, formatDay, type Job, type JobCategory } from "../client/types";

const categoryChips: Array<{ value: ""; label: string } | { value: JobCategory; label: string }> = [
  { value: "", label: "全部" },
  { value: "intern", label: "实习" },
  { value: "campus", label: "校招" },
  { value: "social", label: "社招" },
];

export default function CareerJobBoard({ onToast, onGoWorkbench }: { onToast: (message: string) => void; onGoWorkbench: () => void }) {
  const [items, setItems] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [totalBeforeExpiry, setTotalBeforeExpiry] = useState(0);
  const [category, setCategory] = useState<"" | JobCategory>("");
  const [industry, setIndustry] = useState("");
  const [city, setCity] = useState("");
  const [keyword, setKeyword] = useState("");
  const [fitForMe, setFitForMe] = useState(false);
  const [includeExpired, setIncludeExpired] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [interpretation, setInterpretation] = useState<Record<string, string>>({});

  const pageSize = 15;
  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (category) params.set("category", category);
    if (industry.trim()) params.set("industry", industry.trim());
    if (city.trim()) params.set("city", city.trim());
    if (keyword.trim()) params.set("q", keyword.trim());
    if (fitForMe) params.set("fitForMe", "1");
    if (includeExpired) params.set("includeExpired", "1");
    return params.toString();
  }, [page, category, industry, city, keyword, fitForMe, includeExpired]);

  const load = useCallback(async (options?: { initial?: boolean }) => {
    if (options?.initial) setLoading(true); else setRefreshing(true);
    setError("");
    try {
      const response = await apiFetch(`/api/career/jobs?${query}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "岗位大厅读取失败");
      setItems(body.items ?? []);
      setTotal(body.total ?? 0);
      setTotalBeforeExpiry(body.totalBeforeExpiry ?? body.total ?? 0);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "岗位大厅读取失败");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [query]);

  useEffect(() => { load({ initial: true }); }, [load]);

  const toggleFavorite = async (job: Job) => {
    setBusyId(`fav-${job.id}`);
    try {
      const method = job.favorited ? "DELETE" : "POST";
      const response = await apiFetch(`/api/career/favorites${job.favorited ? `/${job.id}` : ""}`, {
        method, headers: { "Content-Type": "application/json" },
        body: method === "POST" ? JSON.stringify({ jobId: job.id }) : undefined,
      });
      if (!response.ok) throw new Error((await response.json()).error || "收藏操作失败");
      onToast(job.favorited ? "已取消收藏" : "已收藏，可在工作台查看");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "收藏操作失败");
    } finally { setBusyId(""); }
  };

  const apply = async (job: Job) => {
    if (job.application) return onGoWorkbench();
    setBusyId(`apply-${job.id}`);
    try {
      const response = await apiFetch("/api/career/applications", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId: job.id }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "投递记录创建失败");
      onToast("已加入求职工作台（待投递），记得跟进进度");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "投递记录创建失败");
    } finally { setBusyId(""); }
  };

  const recompute = async (job: Job) => {
    setBusyId(`match-${job.id}`);
    try {
      const response = await apiFetch(`/api/career/jobs/${job.id}/match`, { method: "POST" });
      if (!response.ok) throw new Error((await response.json()).error || "匹配计算失败");
      onToast("已按你的已核验佐证重新计算匹配");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "匹配计算失败");
    } finally { setBusyId(""); }
  };

  const interpret = async (job: Job) => {
    setBusyId(`ai-${job.id}`);
    try {
      const response = await apiFetch(`/api/career/jobs/${job.id}/interpret`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "AI 解读生成失败");
      setInterpretation(current => ({ ...current, [job.id]: body.interpretation }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "AI 解读生成失败");
    } finally { setBusyId(""); }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return <section aria-label="岗位大厅">
    <div className="career-pipeline-head" style={{ justifyContent: "space-between" }}>
      <span><b>{total}</b>个岗位在招{totalBeforeExpiry > total ? `（已隐藏 ${totalBeforeExpiry - total} 个过期岗位）` : ""}</span>
      <span className="career-toggle-row" onClick={() => { setFitForMe(value => !value); setPage(1); }}>
        <button type="button" aria-pressed={fitForMe} className={fitForMe ? "career-toggle on" : "career-toggle"} />
        智能岗位推荐{fitForMe ? "（按匹配分排序）" : ""}
      </span>
    </div>

    <div className="career-workspace-tabs" aria-label="岗位筛选">
      {categoryChips.map(chip => (
        <button key={chip.label} className={category === chip.value ? "active" : ""}
                onClick={() => { setCategory(chip.value); setPage(1); }}>{chip.label}</button>
      ))}
    </div>
    <div className="career-form-grid" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))", marginBottom: 12 }}>
      <label><span>行业标签</span><input value={industry} onChange={event => setIndustry(event.target.value)} placeholder="如：银行 / 科技" /></label>
      <label><span>城市</span><input value={city} onChange={event => setCity(event.target.value)} placeholder="如：呼和浩特" /></label>
      <label><span>关键词</span><input value={keyword} onChange={event => setKeyword(event.target.value)} placeholder="公司或岗位名" /></label>
      <label><span>&nbsp;</span>
        <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button className="ghost-action" onClick={() => { load(); }}>搜索</button>
          <span className="career-toggle-row" onClick={() => { setIncludeExpired(value => !value); setPage(1); }}>
            <button type="button" aria-pressed={includeExpired} className={includeExpired ? "career-toggle on" : "career-toggle"} />
            含已过期
          </span>
        </span>
      </label>
    </div>

    {error && <div className="account-feedback error" role="alert">{error}</div>}
    {loading ? <div className="career-loading">正在读取岗位大厅…</div> : items.length || refreshing ? <div className="career-job-list" style={refreshing ? { opacity: 0.55, pointerEvents: "none" } : undefined}>
      {items.map(job => {
        const open = openId === job.id;
        const detail = job.match?.result ?? null;
        return <article className={`career-job-record ${open ? "open" : ""}`} key={job.id}>
          <div className="career-job-summary">
            <div className="career-company-mark">{job.company.slice(0, 1)}</div>
            <div className="career-job-copy">
              <div>
                <span>{categoryLabels[job.category] || job.employmentType || "岗位"}</span>
                {job.companyNature && <small>{job.companyNature}</small>}
                {job.source === "school_coop" && <small style={{ color: "#2563eb" }}>校企合作</small>}
                {job.city && <small>{job.city}</small>}
                {job.deadline ? <small>截止 {formatDay(job.deadline)}</small> : null}
                {job.expired && <small style={{ color: "#dc2626" }}>已过期</small>}
              </div>
              <h2>{job.title}</h2>
              <p>{job.company} · {job.majorsText ? `限 ${job.majorsText.slice(0, 30)}` : "专业不限"} · 来源：{job.sourceName || "平台导入"}</p>
            </div>
            {fitForMe && job.match ? (
              <div className="career-match-badge"><strong>{job.match.overallScore}</strong><span>{job.match.verdict}</span><small>可信度 {job.match.confidence}%</small></div>
            ) : job.application ? (
              <div className="career-match-badge"><strong>—</strong><span>{job.application.stageLabel}</span><small>已加入工作台</small></div>
            ) : null}
            <div className="career-job-actions">
              <button className="ghost-action" title="收藏"
                      disabled={busyId === `fav-${job.id}`}
                      onClick={() => toggleFavorite(job)}>{job.favorited ? "★ 已收藏" : "☆ 收藏"}</button>
              <button className="ghost-action" onClick={() => setOpenId(open ? null : job.id)}>{open ? "收起" : "详情"}</button>
              <button className="primary-action" disabled={busyId === `apply-${job.id}`} onClick={() => apply(job)}>
                {job.application ? "查看投递" : busyId === `apply-${job.id}` ? "加入中…" : "投 递"}
              </button>
            </div>
          </div>
          {open && <div className="career-job-detail">
            <div className="career-job-source"><div><span>岗位要求原文</span><p>{job.description}</p></div>
              {job.sourceUrl && <a href={job.sourceUrl} target="_blank" rel="noreferrer">打开投递链接 ↗</a>}</div>
            <div className="career-requirements"><span>岗位能力关键词</span>
              <div>{(job.skills.length ? job.skills : job.requirements).map((item, index) => (
                <b key={index} className={"priority" in item && item.priority === "required" ? "required" : "preferred"}>
                  {"name" in item ? item.name : item.label}
                  {"required" in item && item.required ? <small>重点</small> : null}
                </b>))}</div>
            </div>
            {detail && <>
              <div className="career-match-detail">
                <header><div><span>证据型匹配报告</span><h3>{detail.verdict} · {detail.overallScore} 分</h3><p>{detail.formula}</p></div>
                  <small>{detail.engineVersion} · 可信度 {detail.confidence}%</small></header>
                {!detail.hardFilter.passed && <div className="career-manual-checks"><span>硬性条件不符</span>
                  {detail.hardFilter.reasons.map(reason => <p key={reason}>✗ {reason}</p>)}</div>}
                <div className="career-score-grid">{detail.dimensions.map(item => (
                  <article key={item.name}><div><b>{item.name}</b><strong>{item.score}</strong></div>
                    <i><em style={{ width: `${item.score}%` }} /></i><p>{item.weight}% 权重 · {item.evidenceBasis}</p></article>))}</div>
                <div className="career-match-notes">
                  <section><h4>已有优势</h4>{detail.strengths.map(item => <p key={item}>✓ {item}</p>)}</section>
                  <section><h4>待补强缺口</h4>{detail.gaps.length
                    ? detail.gaps.map(item => <p key={item.id}><b>{item.label}</b>：{item.recommendation}</p>)
                    : <p>未识别到主要缺口，仍请核对企业官方资格要求。</p>}</section>
                </div>
                <div className="career-manual-checks"><span>投递前仍需人工确认</span>
                  {detail.manualChecks.concat(detail.hardFilter.unverifiable).map(item => <p key={item}>• {item}</p>)}</div>
                <footer>
                  {interpretation[job.id] && <p style={{ margin: "0 0 8px" }}>🤖 AI 解读：{interpretation[job.id]}</p>}
                  <button className="ghost-action" disabled={busyId === `ai-${job.id}`} onClick={() => interpret(job)}>
                    {busyId === `ai-${job.id}` ? "AI 思考中…" : "AI 解读契合度"}
                  </button>
                </footer>
              </div>
              <div className="career-job-actions" style={{ justifyContent: "flex-start", padding: "0 0 12px" }}>
                <button className="ghost-action" disabled={busyId === `match-${job.id}`} onClick={() => recompute(job)}>
                  {busyId === `match-${job.id}` ? "计算中…" : "重新匹配"}</button>
              </div>
            </>}
          </div>}
        </article>;
      })}
    </div> : refreshing ? <div className="career-loading">正在筛选岗位…</div> : <div className="career-empty"><span>○</span><h2>暂无匹配的岗位</h2><p>调整筛选条件，或等就业处老师导入新的招聘信息。</p></div>}

    {totalPages > 1 && <div className="career-workspace-tabs" style={{ justifyContent: "center" }}>
      <button className="ghost-action" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>上一页</button>
      <span style={{ alignSelf: "center" }}>{page} / {totalPages}</span>
      <button className="ghost-action" disabled={page >= totalPages} onClick={() => setPage(value => value + 1)}>下一页</button>
    </div>}
  </section>;
}
