"use client";

import { apiFetch } from "../../lib/bmob-api";

import { useEffect, useState } from "react";
import PortalFrame, { useStudentProfile } from "../components/PortalFrame";

type ProfileOption = { id: string; label: string; description: string };
type Gap = { dimension: string; score: number; threshold: number; gap: number; weightedGap: number };
type Recommendation = {
  id: string;
  dimension: string;
  title: string;
  deliverable: string;
  priority: number;
  estimatedWeeks: number;
  rationale: string;
  factors: { gapImpact: number; targetRelevance: number; urgency: number; executability: number; interestMatch: number; cost: number };
};
type DecisionPlan = {
  engineVersion: string;
  modelMode: "deterministic";
  target: { id: string; label: string; description: string };
  readiness: number;
  confidence: number;
  evidenceBasis: number;
  gaps: Gap[];
  recommendations: Recommendation[];
  formula: string;
  generatedAt: string;
};

export default function DecisionPage() {
  const profile = useStudentProfile();
  const [target, setTarget] = useState("exploration");
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [plan, setPlan] = useState<DecisionPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (profile.targetRole && profile.targetRole !== "探索方向") setTarget(profile.targetRole);
  }, [profile.targetRole]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiFetch(`/api/decision?target=${encodeURIComponent(target)}`)
      .then(async response => {
        const body = await response.json() as { plan?: DecisionPlan; profiles?: ProfileOption[]; error?: string };
        if (!response.ok || !body.plan) throw new Error(body.error || "决策方案读取失败");
        if (active) {
          setPlan(body.plan);
          setProfiles(body.profiles ?? []);
          if (target !== body.plan.target.id) setTarget(body.plan.target.id);
          setError("");
        }
      })
      .catch(reason => active && setError(reason instanceof Error ? reason.message : "决策方案读取失败"))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [target]);

  const feedback = async (item: Recommendation, value: "accepted" | "completed" | "dismissed") => {
    const response = await apiFetch("/api/decision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetRole: plan?.target.id, recommendationId: item.id, feedback: value }),
    });
    if (!response.ok) return setError("行动反馈保存失败");
    setToast(value === "completed" ? "已记录完成意向；正式进度仍需提交佐证并通过审核" : value === "accepted" ? "已加入你的行动反馈" : "已降低同类建议优先级");
    window.setTimeout(() => setToast(""), 2600);
  };

  return <PortalFrame
    active="ai"
    eyebrow="EXPLAINABLE DECISION ENGINE"
    title="成长决策引擎"
    subtitle="用真实证据计算能力差距与行动优先级；当前版本不调用外部大模型。"
  >
    <section className="decision-disclosure">
      <span>规则引擎 · {plan?.engineVersion ?? "XH-DPE-1.0"}</span>
      <p>系统负责计算与排序，不虚构经历，也不把推荐伪装成 AI 结论。每一项建议都可以查看影响因素。</p>
    </section>

    <section className="decision-target portal-card">
      <div><span>TARGET PROFILE</span><h2>选择你的发展目标</h2><p>目标只改变能力权重，不会修改你的真实能力分。</p></div>
      <select value={target} onChange={event => setTarget(event.target.value)}>{profiles.length ? profiles.map(item => <option value={item.id} key={item.id}>{item.label}</option>) : <option value="exploration">探索方向</option>}</select>
    </section>

    {error && <div className="account-feedback error">{error}</div>}
    {loading ? <div className="decision-loading portal-card">正在从已核验成长档案计算方案…</div> : plan && <>
      <section className="decision-summary">
        <article className="portal-card"><span>目标准备度</span><strong>{plan.readiness}</strong><p>按“{plan.target.label}”能力权重计算</p></article>
        <article className="portal-card"><span>计算可信度</span><strong>{plan.confidence}%</strong><p>来自 {plan.evidenceBasis} 条已核验佐证</p></article>
        <article className="portal-card"><span>主要能力差距</span><strong>{plan.gaps[0]?.gap ?? 0}</strong><p>{plan.gaps[0]?.dimension ?? "等待真实证据"}</p></article>
      </section>

      <section className="decision-grid">
        <article className="portal-card decision-gaps">
          <div className="admin-section-head"><div><span>ABILITY GAP</span><h2>目标能力差距</h2></div></div>
          <p>{plan.target.description}</p>
          <div>{plan.gaps.map(item => <section key={item.dimension}>
            <header><b>{item.dimension}</b><span>当前 {item.score} / 目标 {item.threshold}</span></header>
            <i><em style={{ width: `${Math.min(100, item.score / Math.max(1, item.threshold) * 100)}%` }} /></i>
            <small>差距 {item.gap} · 加权影响 {item.weightedGap}</small>
          </section>)}</div>
        </article>

        <article className="portal-card decision-method">
          <div className="admin-section-head"><div><span>METHOD</span><h2>评分依据</h2></div></div>
          <ol>
            <li><b>核验门槛</b><span>待审核与驳回佐证权重为 0。</span></li>
            <li><b>证据强度</b><span>来源、相关度、质量、贡献度、时间共同计算。</span></li>
            <li><b>重复衰减</b><span>同来源重复证据边际贡献逐次降低。</span></li>
            <li><b>多源奖励</b><span>课程、项目、教师评价等交叉验证提高可信度。</span></li>
          </ol>
          <code>{plan.formula}</code>
        </article>
      </section>

      <section className="portal-card decision-actions">
        <div className="admin-section-head"><div><span>NEXT BEST ACTION</span><h2>建议行动队列</h2></div><b>{plan.recommendations.length} 项</b></div>
        {plan.recommendations.length ? <div>{plan.recommendations.map((item, index) => <article key={item.id}>
          <span>{String(index + 1).padStart(2, "0")}</span>
          <div><small>{item.dimension} · 预计 {item.estimatedWeeks} 周</small><h3>{item.title}</h3><p>{item.rationale}</p><em>验收物：{item.deliverable}</em>
            <details><summary>查看优先级因素</summary><div className="decision-factors">{Object.entries(item.factors).map(([key, value]) => <span key={key}>{key} <b>{value}</b></span>)}</div></details>
          </div>
          <aside><strong>{item.priority}</strong><small>优先级</small><button onClick={() => feedback(item, "accepted")}>加入计划</button><button onClick={() => feedback(item, "dismissed")}>暂不考虑</button></aside>
        </article>)}</div> : <div className="admin-review-empty"><span>✓</span><div><b>当前没有新的高优先级行动</b><p>继续提交真实佐证，系统会重新计算。</p></div></div>}
      </section>
    </>}
    {toast && <div className="portal-toast">✓ {toast}</div>}
  </PortalFrame>;
}
