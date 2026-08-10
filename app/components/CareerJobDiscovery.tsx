"use client";

import { apiFetch } from "../../lib/bmob-api";

import { useMemo, useState } from "react";

export type JobImportDraft = {
  title: string;
  company: string;
  city: string;
  employmentType: "实习" | "校招" | "兼职" | "科研助理";
  salary: string;
  sourceUrl: string;
  sourceName: string;
  description: string;
  confidence: number;
  missing: string[];
};

export default function CareerJobDiscovery({ onUseDraft }: { onUseDraft: (draft: JobImportDraft) => void }) {
  const [keywords, setKeywords] = useState("");
  const [city, setCity] = useState("呼和浩特");
  const [employmentType, setEmploymentType] = useState("实习");
  const [sourceUrl, setSourceUrl] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [draft, setDraft] = useState<JobImportDraft | null>(null);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState("");

  const bossSearchUrl = useMemo(() => {
    const query = [keywords.trim(), city.trim(), employmentType].filter(Boolean).join(" ");
    return query ? `https://www.zhipin.com/web/geek/job?query=${encodeURIComponent(query)}` : "";
  }, [city, employmentType, keywords]);

  const parse = async () => {
    if (pastedText.trim().length < 10) return setError("请先粘贴至少 10 个字的岗位信息");
    setParsing(true); setError(""); setDraft(null);
    try {
      const response = await apiFetch("/api/career/jobs/parse", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: pastedText, sourceUrl }),
      });
      const body = await response.json() as { draft?: JobImportDraft; error?: string };
      if (!response.ok || !body.draft) throw new Error(body.error || "岗位信息识别失败");
      setDraft(body.draft);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "岗位信息识别失败");
    } finally {
      setParsing(false);
    }
  };

  return <section className="career-import" aria-label="实习岗位搜索与导入">
    <div className="career-import-head"><div><h2>关键词找岗位，再导入真实信息</h2><p>平台不自动抓取 BOSS 直聘。你可先前往官方搜索页，再把确认过的岗位链接和原文粘贴回来，由平台识别基本信息并保存为个人快照。</p></div></div>
    <div className="career-form-grid">
      <label><span>岗位关键词</span><input value={keywords} onChange={event => setKeywords(event.target.value)} placeholder="如：Java 后端、产品经理、数据分析" maxLength={60} /></label>
      <label><span>意向城市</span><input value={city} onChange={event => setCity(event.target.value)} placeholder="如：呼和浩特、北京" maxLength={30} /></label>
      <label><span>机会类型</span><select value={employmentType} onChange={event => setEmploymentType(event.target.value)}><option>实习</option><option>校招</option><option>兼职</option><option>科研助理</option></select></label>
      <label><span>岗位链接（可选）</span><input value={sourceUrl} onChange={event => setSourceUrl(event.target.value)} placeholder="从官网复制的 https:// 链接" inputMode="url" maxLength={500} /></label>
      <label className="wide"><span>粘贴岗位原文</span><textarea value={pastedText} onChange={event => setPastedText(event.target.value)} placeholder="粘贴岗位名称、公司、城市、薪资、职责与任职要求。平台只解析你主动粘贴的内容，不会访问链接或抓取招聘网站。" maxLength={12000} /></label>
    </div>
    {error && <div className="account-feedback error" role="alert">{error}</div>}
    {draft && <div className="career-loop-intro"><div><b>已识别 {draft.confidence}% 的岗位基本信息</b><p>{[draft.title || "未识别岗位名称", draft.company || "未识别公司", draft.city || "未识别城市", draft.salary || "未识别薪资"].join(" · ")}{draft.missing.length ? `。仍建议人工补全：${draft.missing.join("、")}` : "。请核对后再保存。"}</p></div><button className="primary-action" type="button" onClick={() => onUseDraft(draft)}>填入岗位导入表</button></div>}
    <footer><small>外部招聘网站的岗位状态、发布时间和资格要求会变化，投递前请回到原始页面人工确认。</small><div><button className="ghost-action" type="button" disabled={parsing} onClick={parse}>{parsing ? "正在识别…" : "识别粘贴信息"}</button>{bossSearchUrl ? <a className="primary-action" href={bossSearchUrl} target="_blank" rel="noreferrer">去 BOSS 官方搜索 ↗</a> : <button className="primary-action" type="button" disabled>先填写关键词</button>}</div></footer>
  </section>;
}
