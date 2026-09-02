"use client";

/** 校招公告：届数/行业/城市筛选 + 公告卡（截图样式）+ 收藏/投递。不做匹配打分。 */

import { apiFetch } from "@/modules/shared/api/bmob-api";

import { useCallback, useEffect, useState } from "react";
import { formatDay, type Announcement } from "../client/types";

export default function CareerAnnouncementBoard({ onToast, onGoWorkbench }: { onToast: (message: string) => void; onGoWorkbench: () => void }) {
  const [items, setItems] = useState<Announcement[]>([]);
  const [cohortOptions, setCohortOptions] = useState<Array<{ value: string; label: string; count: number }>>([]);
  const [cohort, setCohort] = useState("");
  const [industry, setIndustry] = useState("");
  const [city, setCity] = useState("");
  const [keyword, setKeyword] = useState("");
  const [includeExpired, setIncludeExpired] = useState(false);
  const [total, setTotal] = useState(0);
  const [totalBeforeExpiry, setTotalBeforeExpiry] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async (options?: { initial?: boolean }) => {
    if (options?.initial) setLoading(true); else setRefreshing(true);
    setError("");
    try {
      const params = new URLSearchParams({ pageSize: "20" });
      if (cohort) params.set("cohort", cohort);
      if (industry.trim()) params.set("industry", industry.trim());
      if (city.trim()) params.set("city", city.trim());
      if (keyword.trim()) params.set("q", keyword.trim());
      if (includeExpired) params.set("includeExpired", "1");
      const response = await apiFetch(`/api/career/announcements?${params.toString()}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "公告读取失败");
      setItems(body.items ?? []);
      setCohortOptions(body.cohortOptions ?? []);
      setTotal(body.total ?? 0);
      setTotalBeforeExpiry(body.totalBeforeExpiry ?? body.total ?? 0);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "公告读取失败");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [cohort, industry, city, keyword, includeExpired]);

  useEffect(() => { load({ initial: true }); }, [load]);

  const toggleFavorite = async (item: Announcement) => {
    setBusyId(`fav-${item.id}`);
    try {
      const method = item.favorited ? "DELETE" : "POST";
      const response = await apiFetch(`/api/career/announcement-favorites${item.favorited ? `/${item.id}` : ""}`, {
        method, headers: { "Content-Type": "application/json" },
        body: method === "POST" ? JSON.stringify({ announcementId: item.id }) : undefined,
      });
      if (!response.ok) throw new Error((await response.json()).error || "收藏操作失败");
      onToast(item.favorited ? "已取消收藏" : "已收藏");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "收藏操作失败");
    } finally { setBusyId(""); }
  };

  const apply = async (item: Announcement) => {
    if (item.application) return onGoWorkbench();
    setBusyId(`apply-${item.id}`);
    try {
      const response = await apiFetch("/api/career/announcement-applications", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ announcementId: item.id }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "投递记录创建失败");
      onToast("公告投递已记录，请在工作台跟进网申进度");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "投递记录创建失败");
    } finally { setBusyId(""); }
  };

  return <section aria-label="校招公告">
    <div className="career-pipeline-head" style={{ justifyContent: "space-between" }}>
      <span><b>{total}</b>条校招公告{totalBeforeExpiry > total ? `（已隐藏 ${totalBeforeExpiry - total} 条过期公告）` : ""}</span>
      <span className="career-toggle-row" onClick={() => setIncludeExpired(value => !value)}>
        <button type="button" aria-pressed={includeExpired} className={includeExpired ? "career-toggle on" : "career-toggle"} />
        含已过期
      </span>
    </div>

    <div className="career-workspace-tabs" aria-label="届数筛选">
      <button className={cohort === "" ? "active" : ""} onClick={() => setCohort("")}>全部届数</button>
      {cohortOptions.map(option => (
        <button key={option.value} className={cohort === option.value ? "active" : ""}
                onClick={() => setCohort(option.value)}>{option.label} <b>{option.count}</b></button>
      ))}
    </div>
    <div className="career-form-grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", marginBottom: 12 }}>
      <label><span>行业标签</span><input value={industry} onChange={event => setIndustry(event.target.value)} placeholder="如：科技 / 银行" /></label>
      <label><span>城市</span><input value={city} onChange={event => setCity(event.target.value)} placeholder="如：呼和浩特" /></label>
      <label><span>关键词</span>
        <span style={{ display: "flex", gap: 10 }}>
          <input value={keyword} onChange={event => setKeyword(event.target.value)} placeholder="公司或公告标题" />
          <button className="ghost-action" onClick={() => load()}>搜索</button>
        </span>
      </label>
    </div>

    {error && <div className="account-feedback error" role="alert">{error}</div>}
    {loading ? <div className="career-loading">正在读取校招公告…</div> : items.length || refreshing ? <div className="career-job-list" style={refreshing ? { opacity: 0.55, pointerEvents: "none" } : undefined}>
      {items.map(item => {
        const open = openId === item.id;
        return <article className={`career-job-record ${open ? "open" : ""}`} key={item.id}>
          <div className="career-job-summary">
            <div className="career-company-mark">{item.company.slice(0, 1)}</div>
            <div className="career-job-copy">
              <div>
                <span>{item.industries[0] || "校招公告"}</span>
                {item.companyNature && <small>{item.companyNature}</small>}
                {item.source === "school_coop" && <small style={{ color: "#2563eb" }}>校企合作</small>}
                {item.cohort && <small>{item.cohort}</small>}
                <small>{formatDay(item.publishedAt)} 发布{item.deadline ? ` · 截止 ${formatDay(item.deadline)}` : " · 招满即止"}</small>
                {item.expired && <small style={{ color: "#dc2626" }}>已过期</small>}
              </div>
              <h2>{item.title}</h2>
              <p>{item.company} · {item.cityText ? item.cityText.split(",").slice(0, 4).join(" / ") : "地点详见公告"}</p>
            </div>
            {item.application && (
              <div className="career-match-badge"><strong>—</strong><span>{item.application.stageLabel}</span><small>已加入工作台</small></div>
            )}
            <div className="career-job-actions">
              <button className="ghost-action" title="收藏" disabled={busyId === `fav-${item.id}`}
                      onClick={() => toggleFavorite(item)}>{item.favorited ? "★ 已收藏" : "☆ 收藏"}</button>
              <button className="ghost-action" onClick={() => setOpenId(open ? null : item.id)}>{open ? "收起" : "详 情"}</button>
              <button className="primary-action" disabled={busyId === `apply-${item.id}`} onClick={() => apply(item)}>
                {item.application ? "查看投递" : busyId === `apply-${item.id}` ? "加入中…" : "投 递"}
              </button>
            </div>
          </div>
          {open && <div className="career-job-detail">
            <div className="career-job-source"><div><span>招聘岗位清单</span>
              <p>{item.positionsText || "详见公告原文"}</p></div>
              {item.detailUrl && <a href={item.detailUrl} target="_blank" rel="noreferrer">查看公告原文 ↗</a>}
            </div>
            {item.applyUrl && <div className="career-job-source"><div><span>网申入口</span><p>{item.applyUrl}</p></div>
              <a href={item.applyUrl} target="_blank" rel="noreferrer">去网申 ↗</a></div>}
            {item.description && <div className="career-job-source"><div><span>公司简介</span><p>{item.description}</p></div></div>}
            <div className="career-manual-checks"><span>温馨提示</span>
              <p>• 校招公告通常包含多个岗位，网申前请确认目标岗位与截止时间。</p>
              <p>• 公告暂不参与匹配打分；可在「岗位」标签中查看与你匹配的具体职位。</p>
            </div>
          </div>}
        </article>;
      })}
    </div> : refreshing ? <div className="career-loading">正在筛选公告…</div> : <div className="career-empty"><span>○</span><h2>暂无匹配的公告</h2><p>调整筛选条件，或等老师导入新一届的网申公告。</p></div>}
  </section>;
}
