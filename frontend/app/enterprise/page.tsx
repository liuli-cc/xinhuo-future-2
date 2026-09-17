"use client";
import { useEffect, useMemo, useState } from "react";
import { Buildings, FileText, FireSimple, Star, UsersThree, CheckCircle, SignOut, MagnifyingGlass } from "@phosphor-icons/react";
import Link from "next/link";
import StudioLogin from "../../modules/shared/StudioLogin";
import { request, type StudioUser } from "../../modules/shared/api/recruitment";
import styles from "./page.module.css";

type CandidateStatus = "待查看" | "已查看" | "已收藏";
type Application = {
  id: string; status: CandidateStatus; submitted: string;
  resume: {
    name: string; role: string; school: string; major: string; grade: string;
    city: string; email: string; phone: string; summary: string; skills: string;
    experiences: {id: number; title: string; org: string; period: string; detail: string}[];
    tasks: {title: string; type: string; result: string; date: string}[];
  };
};
const tabs = ["全部", "待查看", "已查看", "已收藏"] as const;

export default function EnterprisePage() {
  const [user, setUser] = useState<StudioUser | null>(null);
  const [candidates, setCandidates] = useState<Application[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("全部");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [preview, setPreview] = useState(false);
  async function refresh() {
    setBusy(true);
    try { const result = await request<{applications: Application[]}>("/recruitment/applications"); setCandidates(result.applications); setLoaded(true); setNotice(""); }
    catch(e) { setNotice(e instanceof Error ? e.message : "加载失败"); }
    finally { setBusy(false); }
  }
  useEffect(() => { request<{user: StudioUser}>("/auth/me").then(r => { if (r.user.role === "enterprise") setUser(r.user); }).catch(() => {}); }, []);
  useEffect(() => { if (user) { void refresh(); } }, [user]);
  const filtered = useMemo(() => candidates.filter(c => (activeTab === "全部" || c.status === activeTab) && [c.resume.name, c.resume.major, c.resume.role, c.resume.skills].join(" ").toLowerCase().includes(query.trim().toLowerCase())), [candidates, activeTab, query]);
  const selected = filtered.find(c => c.id === selectedId) ?? filtered[0];
  async function setStatus(status: CandidateStatus) {
    if (!selected) return;
    setBusy(true);
    try { await request("/recruitment/applications/" + selected.id, "PATCH", {status}); setCandidates(current => current.map(c => c.id === selected.id ? {...c, status} : c)); setNotice("处理状态已保存"); }
    catch(e) { setNotice(e instanceof Error ? e.message : "保存失败"); }
    finally { setBusy(false); }
  }
  async function logout() {
    try { await request("/auth/logout", "POST"); setUser(null); setCandidates([]); setLoaded(false); }
    catch(e) { setNotice(e instanceof Error ? e.message : "退出失败"); }
  }
  if (!user) return <StudioLogin role="enterprise" onLogin={setUser} />;
  return <main className={styles.workspace}>
    <aside className={styles.sidebar}>
      <div className={styles.brand}><span><FireSimple size={22} weight="fill" /></span><b>薪火</b><small>企业人才工作台</small></div>
      <div className={styles.companyBadge}><span><Buildings size={18} /></span><div><b>{user.name}</b><small>企业账号</small></div></div>
      <nav className={styles.sideNav}><span>工作台</span><button onClick={() => setActiveTab("全部")} className={activeTab === "全部" ? styles.activeNav : ""}><UsersThree size={19} />学生投递<em>{candidates.length}</em></button><button onClick={() => setActiveTab("待查看")}><FileText size={19} />待处理投递</button><button onClick={() => setActiveTab("已收藏")}><Star size={19} />收藏候选人</button></nav>
      <div className={styles.sidebarFoot}><Link href="/">返回首页</Link><button onClick={logout}><SignOut size={17} />退出登录</button></div>
    </aside>
    <section className={styles.mainArea}>
      <header className={styles.topbar}><div><span className={styles.topKicker}>TALENT WORKSPACE</span><h1>候选人中心</h1></div><button disabled={busy} onClick={refresh}>{busy ? "同步中…" : "刷新投递"}</button></header>
      <div className={styles.content}>
        {notice && <p role="status">{notice}</p>}
        <section className={styles.welcomeRow}><div><h2>你好，{user.name}</h2><p>查看学生主动分享的简历、大学经历与已核验成长成果。</p></div></section>
        <section className={styles.metrics}>{tabs.map(tab => <article key={tab}><span>{tab === "全部" ? "收到简历" : tab}</span><strong>{tab === "全部" ? candidates.length : candidates.filter(c => c.status === tab).length}</strong><small>当前实际投递</small></article>)}</section>
        <section className={styles.candidateSection}>
          <div className={styles.listPanel}><div className={styles.sectionHead}><h2>学生投递</h2></div><div className={styles.filters}><div className={styles.search}><MagnifyingGlass size={17} /><input aria-label="搜索候选人" value={query} onChange={e => setQuery(e.target.value)} placeholder="搜索姓名、专业或技能" /></div><div className={styles.tabs}>{tabs.map(tab => <button key={tab} className={activeTab === tab ? styles.tabActive : ""} onClick={() => {setActiveTab(tab); setPreview(false);}}>{tab}</button>)}</div></div>
          <div className={styles.candidateList}>{filtered.map(c => <button key={c.id} className={styles.candidateItem + " " + (selected?.id === c.id ? styles.selectedItem : "")} onClick={() => {setSelectedId(c.id); setPreview(false);}}><span className={styles.candidateAvatar}>{c.resume.name.slice(0,1)}</span><span className={styles.candidateMain}><strong>{c.resume.name}</strong><small>{c.resume.major} · {c.resume.grade}</small><span>{c.resume.role}</span></span><span className={styles.candidateMeta}><small>{new Date(c.submitted).toLocaleDateString()}</small><em>{c.status}</em></span></button>)}</div>
          {filtered.length === 0 && <div className={styles.empty}><b>{loaded ? "暂无符合条件的投递" : "正在加载投递"}</b><span>学生在简历工坊选择本企业并确认投递后，资料会显示在这里。</span></div>}</div>
          {selected && <div className={styles.detailPanel}><div className={styles.detailTop}><span>投递档案</span><button disabled={busy} onClick={() => setStatus(selected.status === "已收藏" ? "已查看" : "已收藏")} aria-label="收藏"><Star size={20} weight={selected.status === "已收藏" ? "fill" : "regular"} /></button></div>
            <div className={styles.profileHero}><span className={styles.detailAvatar}>{selected.resume.name.slice(0,1)}</span><div><h2>{selected.resume.name}</h2><p>{selected.resume.role}</p><span>{[selected.resume.school, selected.resume.major, selected.resume.grade].filter(Boolean).join(" · ")}</span></div></div>
            <p className={styles.bio}>{selected.resume.summary}</p><p className={styles.bio}>{[selected.resume.city, selected.resume.email, selected.resume.phone].filter(Boolean).join(" · ")}</p>
            <div className={styles.tags}>{selected.resume.skills.split(/[,，、\n]/).filter(Boolean).map((skill,i) => <span key={i}>{skill.trim()}</span>)}</div>
            <div className={styles.detailSection}><h3>大学与项目经历</h3>{selected.resume.experiences.length === 0 && <p>学生尚未填写经历</p>}{selected.resume.experiences.map(e => <article key={e.id} className={styles.experience}><i/><div><strong>{e.title}</strong><span>{e.org} · {e.period}</span><p>{e.detail}</p></div></article>)}</div>
            <div className={styles.detailSection}><h3>已核验成长成果</h3>{selected.resume.tasks.length === 0 && <p>投递时暂无已核验成果，未核验内容不会显示为已完成任务。</p>}{selected.resume.tasks.map((task,i) => <article key={i} className={styles.task}><CheckCircle size={18}/><div><strong>{task.title}</strong><small>{task.type} · {task.date}</small><p>{task.result}</p></div></article>)}</div>
            <div className={styles.detailActions}><button className={styles.ghostButton} onClick={() => setPreview(!preview)}><FileText size={17}/>{preview ? "收起简历" : "查看完整简历"}</button><button disabled={busy} className={styles.primaryButton} onClick={() => setStatus("已查看")}>标记已查看</button></div>
            {preview && <article className={styles.detailSection}><h2>{selected.resume.name} · {selected.resume.role}</h2><p>{selected.resume.school} · {selected.resume.major} · {selected.resume.grade}</p><p>{selected.resume.email} · {selected.resume.phone}</p><p>{selected.resume.summary}</p><p>{selected.resume.skills}</p>{selected.resume.experiences.map(e => <section key={e.id}><h3>{e.title}</h3><p>{e.org} · {e.period}</p><p style={{whiteSpace:"pre-wrap"}}>{e.detail}</p></section>)}</article>}
          </div>}
        </section>
      </div>
    </section>
  </main>;
}
