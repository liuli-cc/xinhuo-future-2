"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  DownloadSimple,
  FileText,
  FireSimple,
  Lightning,
  MagicWand,
  MapPin,
  Palette,
  PencilSimple,
  Plus,
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

type Experience = { id: number; title: string; org: string; period: string; detail: string };
type ResumeData = {
  school: string;
  major: string;
  grade: string;
  name: string;
  role: string;
  city: string;
  email: string;
  phone: string;
  summary: string;
  skills: string;
  experiences: Experience[];
};

const initialData: ResumeData = { name: "", role: "", city: "", email: "", phone: "", school: "", major: "", grade: "", summary: "", skills: "", experiences: [] };

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
  const [suggestion, setSuggestion] = useState("");
  const [companies, setCompanies] = useState<{id: number; name: string}[]>([]);
  const [company, setCompany] = useState("");
  const [consent, setConsent] = useState(false);
  const [applications, setApplications] = useState<{id: string; enterpriseId: number; status: string}[]>([]);
  const [data, setData] = useState(initialData);
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
      request<{data: ResumeData; template: "blue" | "mono" | "mint"}>("/recruitment/resume"),
      request<{enterprises: {id: number; name: string}[]}>("/recruitment/enterprises"),
      request<{applications: {id: string; enterpriseId: number; status: string}[]}>("/recruitment/applications"),
    ]).then(([draft, list, sent]) => { if (!cancelled) { setData(draft.data); setTemplate(draft.template); setCompanies(list.enterprises); setApplications(sent.applications); setReady(true); setSaved("已从账号加载"); } }).catch(e => setNotice(e.message));
    return () => { cancelled = true; };
  }, [user]);
  const skills = useMemo(() => data.skills.split(/[,，、\n]/).map(item => item.trim()).filter(Boolean), [data.skills]);
  const completeness = useMemo(() => {
    const fields = [data.name, data.role, data.city, data.email, data.phone, data.summary, data.skills, ...data.experiences.flatMap(item => [item.title, item.org, item.period, item.detail])];
    return Math.round(fields.filter(Boolean).length / fields.length * 100);
  }, [data]);

  const update = <K extends keyof ResumeData>(key: K, value: ResumeData[K]) => setData(current => ({ ...current, [key]: value }));
  const updateExperience = (id: number, key: keyof Experience, value: string) => setData(current => ({ ...current, experiences: current.experiences.map(item => item.id === id ? { ...item, [key]: value } : item) }));
  const addExperience = () => setData(current => ({ ...current, experiences: [...current.experiences, { id: Date.now(), title: "新的项目经历", org: "组织 / 公司", period: "2026.01 — 2026.06", detail: "写清楚你做了什么、怎么做的，以及产生了什么结果。" }] }));
  const removeExperience = (id: number) => setData(current => ({ ...current, experiences: current.experiences.filter(item => item.id !== id) }));
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
    try { const result = await request<{summary: string}>("/recruitment/resume/optimize", "POST", { data, template }); setSuggestion(result.summary); }
    catch (e) { setNotice(e instanceof Error ? e.message : "AI 请求失败"); }
    finally { setBusy(false); }
  };
  const submitResume = async () => {
    if (!company || !consent) { setNotice("请选择企业并确认分享范围"); return; }
    if (!await save()) return;
    setBusy(true);
    try {
      const result = await request<{alreadySubmitted: boolean}>("/recruitment/applications", "POST", {enterprise_id: Number(company), consent});
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
  const exportResume = () => { flash("已打开打印 / 导出面板"); window.setTimeout(() => window.print(), 180); };

  if (!user) return <StudioLogin role="student" onLogin={setUser} />;
  if (!ready) return <main><p role="status">{notice || "正在加载简历…"}</p><button onClick={() => window.location.reload()}>重试</button></main>;
  return <main onChange={() => { revision.current += 1; setSaved("有未保存修改"); }} className={`${styles.shell} ${styles[`theme_${template}`]}`}>
    <aside className={styles.sidebar}>
      <Link className={styles.brand} href="/dashboard"><span><FireSimple size={21} weight="fill" /></span><b>薪火</b><small>成长操作系统</small></Link>
      <Link className={styles.backLink} href="/dashboard"><ArrowLeft size={16} />返回学生空间</Link>
      <div className={styles.sideTitle}><span>AI CAREER STUDIO</span><h1>简历工坊</h1><p>把经历整理成能被看见的能力证据。</p></div>
      <nav className={styles.steps} aria-label="简历制作步骤"><button className={activeSection === "basics" ? styles.stepActive : ""} onClick={() => setActiveSection("basics")}><i>01</i><span><b>基本信息</b><small>姓名、岗位与联系方式</small></span>{activeSection !== "basics" && <CheckCircle size={16} />}</button><button className={activeSection === "story" ? styles.stepActive : ""} onClick={() => setActiveSection("story")}><i>02</i><span><b>个人优势</b><small>让 AI 帮你提炼关键词</small></span>{optimized && <CheckCircle size={16} />}</button><button className={activeSection === "experience" ? styles.stepActive : ""} onClick={() => setActiveSection("experience")}><i>03</i><span><b>项目经历</b><small>用结果讲清楚你做过什么</small></span>{data.experiences.length > 0 && <CheckCircle size={16} />}</button></nav>
      <div className={styles.sideTip}><Sparkle size={17} /><div><b>AI 小提示</b><p>好经历 = 动词 + 具体行动 + 可验证结果。</p></div></div>
      <small className={styles.localNote}>ACCOUNT DRAFT · 保存至学生账号</small>
    </aside>

    <section className={styles.main}>
      <header className={styles.topbar}><div><span>PERSONAL CAREER STUDIO</span><h2>AI 简历制作</h2></div><div className={styles.topActions}><span className={styles.saved}><span />{saved}</span><button disabled={busy} onClick={save}>保存简历</button><button onClick={exportResume}><DownloadSimple size={17} />导出简历</button><Link href="/dashboard" aria-label="退出简历工坊"><X size={19} /></Link></div></header>
      <div className={styles.body}>
        <section className={styles.editor}>
          <div className={styles.heading}><div><span className={styles.kicker}>BUILD YOUR STORY</span><h2>先把经历写下来，剩下的交给 AI。</h2><p>根据真实经历编辑并保存，确认投递后所选企业才能查看。</p></div><div className={styles.completeness}><strong>{completeness}%</strong><span>完成度</span></div></div>
          <div className={styles.sectionTabs}><button className={activeSection === "basics" ? styles.currentTab : ""} onClick={() => setActiveSection("basics")}><UserCircle size={17} />基本信息</button><button className={activeSection === "story" ? styles.currentTab : ""} onClick={() => setActiveSection("story")}><MagicWand size={17} />AI 优化</button><button className={activeSection === "experience" ? styles.currentTab : ""} onClick={() => setActiveSection("experience")}><Target size={17} />经历证据</button></div>

          {activeSection === "basics" && <section className={styles.formSection}><div className={styles.formGrid}><label>学校<input value={data.school} onChange={event => update("school", event.target.value)} /></label><label>专业<input value={data.major} onChange={event => update("major", event.target.value)} /></label><label>年级<input value={data.grade} onChange={event => update("grade", event.target.value)} /></label><label>姓名<input value={data.name} onChange={event => update("name", event.target.value)} /></label><label>目标岗位<input value={data.role} onChange={event => update("role", event.target.value)} /></label><label><span><MapPin size={14} />所在城市</span><input value={data.city} onChange={event => update("city", event.target.value)} /></label><label>邮箱<input type="email" value={data.email} onChange={event => update("email", event.target.value)} /></label><label>电话<input value={data.phone} onChange={event => update("phone", event.target.value)} /></label></div><div className={styles.callout}><Lightning size={20} weight="fill" /><div><b>先选一个明确的岗位目标</b><p>AI 会根据岗位名称调整简历中的关键词和表达顺序。</p></div></div><button className={styles.nextButton} onClick={() => setActiveSection("story")}>继续完善个人优势 <ArrowRight size={17} /></button></section>}

          {activeSection === "story" && <section className={styles.formSection}><label className={styles.fullLabel}>个人简介<textarea value={data.summary} onChange={event => update("summary", event.target.value)} rows={6} placeholder="用 2-3 句话介绍你的方向、能力和目标" /><small>建议 60-100 字，优先写“我能为岗位解决什么问题”。</small></label><label className={styles.fullLabel}>核心技能<textarea value={data.skills} onChange={event => update("skills", event.target.value)} rows={3} placeholder="用逗号分隔，例如 Python, React, 数据分析" /><small>已识别 {skills.length} 项技能，请仅填写能够证明的技能。</small></label>{suggestion && <div className={styles.callout}><div><b>AI 建议 · 请核对事实后采用</b><p>{suggestion}</p><button onClick={() => { update("summary", suggestion); setSuggestion(""); setOptimized(true); setSaved("有未保存修改"); }}>采用建议</button><button onClick={() => setSuggestion("")}>保留原文</button></div></div>}<div className={styles.aiAction}><div><MagicWand size={23} /><div><b>{optimized ? "已完成一轮岗位化优化" : "让 AI 帮你把话说得更有力量"}</b><p>{optimized ? "你可以继续编辑，也可以切换到右侧预览查看效果。" : "根据目标岗位，把“做过什么”改写成“带来了什么结果”。"}</p></div></div><button disabled={busy} onClick={optimizeWithAI}><Sparkle size={16} />{optimized ? "再次优化" : "AI 优化表述"}</button></div><button className={styles.nextButton} onClick={() => setActiveSection("experience")}>继续添加项目经历 <ArrowRight size={17} /></button></section>}

          {activeSection === "experience" && <section className={styles.formSection}><div className={styles.experienceHeader}><div><h3>项目与实践经历</h3><p>优先填写与你目标岗位最相关的 1-3 段经历。</p></div><button className={styles.addButton} onClick={addExperience}><Plus size={16} />添加经历</button></div><div className={styles.experienceList}>{data.experiences.map((item, index) => <article className={styles.experienceCard} key={item.id}><div className={styles.experienceCardTop}><span>0{index + 1}</span><button onClick={() => removeExperience(item.id)} aria-label="删除经历"><Trash size={16} /></button></div><div className={styles.formGrid}><label className={styles.wide}>项目 / 职位<input value={item.title} onChange={event => updateExperience(item.id, "title", event.target.value)} /></label><label>组织 / 公司<input value={item.org} onChange={event => updateExperience(item.id, "org", event.target.value)} /></label><label>时间<input value={item.period} onChange={event => updateExperience(item.id, "period", event.target.value)} /></label></div><label className={styles.fullLabel}>你完成了什么<textarea value={item.detail} onChange={event => updateExperience(item.id, "detail", event.target.value)} rows={4} /></label></article>)}</div><button className={styles.primaryAction} onClick={exportResume}><FileText size={17} />预览并导出简历</button></section>}
          <section className={styles.formSection}>
            <h3>投递给企业</h3><label className={styles.fullLabel}>接收企业<select value={company} onChange={e => setCompany(e.target.value)}><option value="">请选择企业</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
            {!companies.length && <p>暂无可接收投递的企业，请联系管理员开通企业账号。</p>}
            <label><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />我同意将当前简历及已核验成长记录分享给所选企业。</label>
            <button className={styles.primaryAction} disabled={busy || !company || !consent} onClick={submitResume}>保存并投递</button>
            <h3>我的投递</h3>{applications.length === 0 && <p>尚未投递</p>}{applications.map(item => <p key={item.id}>{companies.find(c => c.id === item.enterpriseId)?.name || "企业"} · {item.status} <button disabled={busy} onClick={() => withdraw(item.id)}>撤回投递</button></p>)}
          </section>
        </section>

        <aside className={styles.previewColumn}><div className={styles.previewToolbar}><div><span>LIVE PREVIEW</span><b>实时预览</b></div><div className={styles.templatePicker}><Palette size={16} /><select value={template} onChange={event => setTemplate(event.target.value as typeof template)} aria-label="选择简历模板">{templates.map(item => <option key={item.id} value={item.id}>{item.label} · {item.note}</option>)}</select></div></div><div className={`${styles.resumePaper} ${styles[`paper_${template}`]}`}><header className={styles.resumeHeader}><div><h1>{data.name || "你的姓名"}</h1><p>{data.role || "目标岗位"}</p></div><div className={styles.resumeContact}><span>{data.city || "城市"}</span><span>{data.email || "邮箱"}</span><span>{data.phone || "电话"}</span></div></header><div className={styles.resumeRule} /><section className={styles.resumeBlock}><h2>教育背景</h2><p>{[data.school, data.major, data.grade].filter(Boolean).join(" · ") || "请填写教育背景"}</p></section><section className={styles.resumeBlock}><h2>个人简介</h2><p>{data.summary || "在这里展示你的方向、能力和职业目标。"}</p></section><section className={styles.resumeBlock}><h2>核心技能</h2><div className={styles.resumeSkills}>{skills.map(skill => <span key={skill}>{skill}</span>)}</div></section><section className={styles.resumeBlock}><h2>项目与实践经历</h2>{data.experiences.map(item => <article className={styles.resumeExperience} key={item.id}><div className={styles.resumeExperienceHead}><div><b>{item.title || "项目名称"}</b><span>{item.org || "组织 / 公司"}</span></div><em>{item.period}</em></div><p>{item.detail || "补充你负责的工作和取得的结果。"}</p></article>)}</section><footer className={styles.resumeFooter}><span>薪火 AI 简历工坊</span><span>依据真实经历生成 · {new Date().getFullYear()}</span></footer></div><div className={styles.previewInsight}><div><span><CheckCircle size={16} weight="fill" />请核对个人信息</span><span><CheckCircle size={16} weight="fill" />请核实经历与成果</span></div><button onClick={() => setActiveSection("story")}><PencilSimple size={15} />继续优化</button></div></aside>
      </div>
    </section>
    {notice && <div className={styles.toast}><CheckCircle size={18} weight="fill" />{notice}</div>}
  </main>;
}
