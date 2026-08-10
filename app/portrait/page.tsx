"use client";

import { apiFetch } from "../../lib/bmob-api";

import { FormEvent, useEffect, useState } from "react";
import PortalFrame, { useStudentProfile } from "../components/PortalFrame";
import {
  ABILITY_DIMENSIONS,
  SOURCE_META,
  calculatePortrait,
  type AbilityDimension,
  type EvidenceSource,
  type PortraitResult,
} from "../../lib/growth-engine";

const emptyPortrait = calculatePortrait([], 0);
const categoryOptions = ["课程学习", "项目实践", "竞赛经历", "科研创新", "志愿服务", "实习实践", "教师评价", "个人复盘"];
const dimensionColors: Record<AbilityDimension, string> = {
  "专业学习": "#65a8ff",
  "项目实践": "#8099d8",
  "创新探索": "#4baed4",
  "沟通协作": "#9aa8c8",
  "职业准备": "#7986cb",
};

function freshForm() {
  return {
    title: "",
    category: "课程学习",
    dimension: "专业学习" as AbilityDimension,
    detail: "",
    evidenceRef: "",
    evidenceDate: new Date().toISOString().slice(0, 10),
    sourceType: "course_record" as EvidenceSource,
    relevance: 80,
    quality: 75,
    contribution: 70,
  };
}

export default function PortraitPage() {
  const profile = useStudentProfile();
  const [portrait, setPortrait] = useState<PortraitResult>(emptyPortrait);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(freshForm);
  const [filter, setFilter] = useState<"全部" | AbilityDimension>("全部");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const studentIdReady = Boolean(profile.studentId && !profile.studentId.includes("未填写"));

  useEffect(() => {
    if (!studentIdReady) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    apiFetch(`/api/portrait?studentId=${encodeURIComponent(profile.studentId)}`)
      .then(async response => {
        const data = await response.json() as { portrait?: PortraitResult; error?: string };
        if (!response.ok || !data.portrait) throw new Error(data.error || "成长证据读取失败");
        if (active) { setPortrait(data.portrait); setError(""); }
      })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "成长证据读取失败"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [profile.studentId, studentIdReady]);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2300);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!studentIdReady || saving) return;
    setSaving(true);
    setError("");
    try {
      let attachmentId = "";
      if (file) {
        const upload = new FormData();
        upload.set("file", file);
        const uploadResponse = await apiFetch("/api/evidence-files", { method: "POST", body: upload });
        const uploadBody = await uploadResponse.json() as { file?: { id: string }; error?: string };
        if (!uploadResponse.ok || !uploadBody.file) throw new Error(uploadBody.error || "佐证文件上传失败");
        attachmentId = uploadBody.file.id;
      }
      const response = await apiFetch("/api/portrait", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ studentId: profile.studentId, ...form, attachmentId }),
      });
      const data = await response.json() as { portrait?: PortraitResult; error?: string };
      if (!response.ok || !data.portrait) throw new Error(data.error || "证据保存失败");
      setPortrait(data.portrait);
      setForm(freshForm());
      setFile(null);
      setOpen(false);
      notify("佐证已提交审核，核验通过前能力分数保持不变");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "证据保存失败");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    if (!studentIdReady) return;
    setError("");
    try {
      const response = await apiFetch(`/api/portrait?studentId=${encodeURIComponent(profile.studentId)}&id=${id}`, { method: "DELETE" });
      const data = await response.json() as { portrait?: PortraitResult; error?: string };
      if (!response.ok || !data.portrait) throw new Error(data.error || "证据删除失败");
      setPortrait(data.portrait);
      notify("证据已删除，能力分数已重新计算");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "证据删除失败");
    }
  };

  const visibleEvidence = filter === "全部" ? portrait.evidence : portrait.evidence.filter(item => item.dimension === filter);

  return <PortalFrame
    active="portrait"
    eyebrow="证据型成长画像"
    title="能力画像"
    subtitle="所有分数都由真实成长证据计算，不使用默认能力分。"
    actions={<button className="primary-action" onClick={() => setOpen(true)} disabled={!studentIdReady}>添加成长证据</button>}
  >
    {!studentIdReady && <div className="ep-alert"><b>需要完善学号</b><span>证据库使用学号区分学生，请先返回学生信息页补充。</span></div>}
    {error && <div className="ep-alert error"><b>暂时无法完成操作</b><span>{error}</span></div>}

    <section className="ep-hero portal-card">
      <div className="ep-score" style={{ "--ep-score": `${portrait.overallScore}%` } as React.CSSProperties}>
        <div><strong>{loading ? "-" : portrait.overallScore}</strong><small>证据能力指数</small></div>
      </div>
      <div className="ep-summary">
        <span>{profile.grade}　·　{profile.major}</span>
        <h2>{profile.name}的真实成长画像</h2>
        <p>{portrait.totalEvidence ? `已提交 ${portrait.totalEvidence} 条佐证，其中 ${portrait.verifiedEvidence} 条通过核验；只有已核验佐证才参与能力计算。` : "当前没有真实成长佐证，因此所有能力数据均为 0。提交佐证并通过管理员核验后才会建立画像。"}</p>
        <div className="ep-metrics">
          <div><strong>{portrait.verifiedEvidence}</strong><span>已核验佐证</span></div>
          <div><strong>{portrait.pendingEvidence}</strong><span>待审核佐证</span></div>
          <div><strong>{portrait.completeness}%</strong><span>画像完整度</span></div>
          <div><strong>{portrait.confidence}%</strong><span>计算可信度</span></div>
        </div>
      </div>
    </section>

    <section className="ep-section">
      <div className="ep-heading"><div><span>能力计算结果</span><h2>五维能力与证据覆盖</h2></div><small>分数是证据强度的结果，不代表与其他学生的排名</small></div>
      <div className="ep-dimensions">
        {portrait.dimensions.map(item => <article className={`ep-dimension ${filter === item.name ? "selected" : ""}`} key={item.name} onClick={() => setFilter(item.name)}>
          <div><span className="ep-dimension-dot" style={{ background: dimensionColors[item.name] }} /><b>{item.name}</b><strong>{item.score}</strong></div>
          <div className="ep-bar"><i style={{ width: `${item.score}%`, background: dimensionColors[item.name] }} /></div>
          <p><span>{item.evidenceCount} 条证据</span><span>可信度 {item.confidence}%</span></p>
          <small>{item.evidenceCount ? `有效证据权重 ${item.weightSum.toFixed(2)}` : "尚无证据，不生成默认分"}</small>
        </article>)}
      </div>
    </section>

    <section className="ep-insight-grid">
      <article className="ep-next portal-card">
        <span>当前最值得补充</span>
        <h2>{portrait.nextAction.title}</h2>
        <p>{portrait.nextAction.detail}</p>
        <button onClick={() => { setForm(current => ({ ...current, dimension: portrait.nextAction.dimension })); setOpen(true); }}>添加{portrait.nextAction.dimension}证据</button>
      </article>
      <article className="ep-method portal-card">
        <span>分数怎样产生</span>
        <h2>可解释证据计算</h2>
        <div><b>来源可信度</b><i /> <b>能力相关度</b><i /> <b>成果质量</b><i /> <b>个人贡献度</b><i /> <b>时间新鲜度</b></div>
        <p>待审核或被驳回的佐证权重为 0；只有管理员核验通过后才计入。两年以上的佐证会降低时间权重。</p>
      </article>
    </section>

    <section className="ep-section portal-card">
      <div className="ep-evidence-head">
        <div><span>成长证据库</span><h2>证据明细</h2><p>每条证据都可追溯到得分因素。</p></div>
        <div className="ep-filter"><button className={filter === "全部" ? "active" : ""} onClick={() => setFilter("全部")}>全部</button>{ABILITY_DIMENSIONS.map(item => <button className={filter === item ? "active" : ""} key={item} onClick={() => setFilter(item)}>{item}</button>)}</div>
      </div>
      {loading ? <div className="ep-empty"><b>正在读取证据库…</b></div> : visibleEvidence.length ? <div className="ep-evidence-list">
        {visibleEvidence.map(item => <article key={item.id}>
          <div className="ep-evidence-title"><span style={{ background: dimensionColors[item.dimension] }}>{item.dimension.slice(0, 1)}</span><div><small>{item.category}　·　{item.evidenceDate}</small><h3>{item.title}</h3><p>{item.detail}</p>{item.evidenceRef && <small>核验来源：{item.evidenceRef}</small>}{item.attachmentUrl && <a className="evidence-file-link" href={item.attachmentUrl} target="_blank" rel="noreferrer">查看佐证文件：{item.attachmentName} · {Math.ceil((item.attachmentBytes ?? 0) / 1024)} KB</a>}</div><strong>{item.verificationStatus === "verified" ? `+${item.impact.toFixed(1)} 证据强度` : "暂不计分"}</strong></div>
          <div className="ep-factors"><span>来源 {item.sourceReliability}</span><span>相关 {item.relevance}</span><span>质量 {item.quality}</span><span>贡献 {item.contribution}</span><span>时间 {Math.round(item.recencyWeight * 100)}</span><em>{item.verificationStatus === "verified" ? "已核验" : item.verificationStatus === "rejected" ? `已驳回${item.reviewerNote ? `：${item.reviewerNote}` : ""}` : "待管理员核验"}</em>{item.verificationStatus !== "verified" && <button onClick={() => remove(item.id)}>删除</button>}</div>
        </article>)}
      </div> : <div className="ep-empty"><span>证</span><b>{filter === "全部" ? "还没有真实成长证据" : `还没有“${filter}”证据`}</b><p>从一条可验证的课程、项目、竞赛或评价记录开始。</p><button onClick={() => setOpen(true)}>添加第一条证据</button></div>}
    </section>

    {open && <div className="modal-backdrop" onMouseDown={() => !saving && setOpen(false)}><form className="portal-modal ep-modal" onSubmit={submit} onMouseDown={event => event.stopPropagation()}>
      <button type="button" className="modal-close" aria-label="关闭" onClick={() => setOpen(false)} disabled={saving}>关闭</button>
      <span className="modal-kicker">新增成长佐证</span><h2>记录一项真实成果</h2><p>信息会保存到云端并进入管理员审核；审核通过前不增加能力分数。</p>
      <div className="ep-form-grid">
        <label className="wide"><span>成果名称</span><input autoFocus value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} placeholder="例如：大学物理期末成绩" /></label>
        <label><span>证据类型</span><select value={form.category} onChange={event => setForm({ ...form, category: event.target.value })}>{categoryOptions.map(item => <option key={item}>{item}</option>)}</select></label>
        <label><span>对应能力</span><select value={form.dimension} onChange={event => setForm({ ...form, dimension: event.target.value as AbilityDimension })}>{ABILITY_DIMENSIONS.map(item => <option key={item}>{item}</option>)}</select></label>
        <label><span>发生日期</span><input type="date" max={new Date().toISOString().slice(0, 10)} value={form.evidenceDate} onChange={event => setForm({ ...form, evidenceDate: event.target.value })} /></label>
        <label><span>证据来源</span><select value={form.sourceType} onChange={event => setForm({ ...form, sourceType: event.target.value as EvidenceSource })}>{Object.entries(SOURCE_META).map(([value, meta]) => <option value={value} key={value}>{meta.label}（可信度 {meta.reliability}）</option>)}</select></label>
        <label className="wide"><span>成果说明</span><textarea value={form.detail} onChange={event => setForm({ ...form, detail: event.target.value })} placeholder="至少 12 个字，说明你做了什么、实际贡献和可验证结果" /></label>
        <label className="wide"><span>上传佐证文件（推荐）</span><input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.txt" onChange={event => setFile(event.target.files?.[0] ?? null)} /><small>支持 PDF、图片、TXT，单个文件不超过 3 MB；保存后生成 SHA-256 完整性摘要。</small></label>
        <label className="wide"><span>其他可核验来源（文件和来源至少一项）</span><input value={form.evidenceRef} onChange={event => setForm({ ...form, evidenceRef: event.target.value })} placeholder="成果链接、证书编号、教务记录编号或教师评价来源" /></label>
        <label><span>与该能力的相关度</span><select value={form.relevance} onChange={event => setForm({ ...form, relevance: Number(event.target.value) })}><option value="60">部分相关·60</option><option value="80">高度相关·80</option><option value="100">直接证明·100</option></select></label>
        <label><span>成果质量</span><select value={form.quality} onChange={event => setForm({ ...form, quality: Number(event.target.value) })}><option value="60">完成基本要求·60</option><option value="75">达到良好水平·75</option><option value="90">有明确优质结果·90</option><option value="100">获得权威认可·100</option></select></label>
        <label className="wide"><span>个人贡献度</span><select value={form.contribution} onChange={event => setForm({ ...form, contribution: Number(event.target.value) })}><option value="50">参与者·50</option><option value="70">核心成员·70</option><option value="90">主要负责人·90</option><option value="100">独立完成·100</option></select></label>
      </div>
      <div className="ep-source-preview"><span>本条佐证的来源可信度</span><strong>{SOURCE_META[form.sourceType].reliability}</strong><small>新提交佐证默认为“待管理员核验”，核验通过前不计入分数。</small></div>
      <button className="modal-submit" disabled={saving || form.title.trim().length < 2 || form.detail.trim().length < 12 || (!file && form.evidenceRef.trim().length < 6)}>{saving ? "正在上传并提交…" : "提交佐证等待审核"}</button>
    </form></div>}
    {toast && <div className="portal-toast"><span>已更新</span>{toast}</div>}
  </PortalFrame>;
}
