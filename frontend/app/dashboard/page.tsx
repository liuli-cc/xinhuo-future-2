"use client";

import { apiFetch } from "../../lib/bmob-api";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useStudentProfile } from "../components/PortalFrame";

const features = [
  { id: "map", title: "成长地图", en: "GROWTH MAP", desc: "从自我认知到高质量就业，拆解大学四年的每个关键阶段。", icon: "⌘", ready: true, className: "feature-map" },
  { id: "interview", title: "模拟面试", en: "MOCK INTERVIEW", desc: "AI 虚拟面试官陪你练习，提升表达与应变能力。", icon: "◉", ready: true, className: "feature-interview" },
  { id: "portrait", title: "能力画像", en: "ABILITY PROFILE", desc: "聚合学业、竞赛、项目和实践数据，看见能力变化。", icon: "◇", ready: true, className: "feature-profile" },
  { id: "ai", title: "成长决策引擎", en: "DECISION ENGINE", desc: "基于能力差距、目标权重和可执行成本，生成可解释行动优先级。", icon: "策", ready: true, className: "feature-ai" },
  { id: "resources", title: "成长资源", en: "RESOURCE HUB", desc: "精准匹配课程、竞赛、证书、导师和校内成长机会。", icon: "▦", ready: true, className: "feature-resource" },
  { id: "career", title: "实习就业", en: "CAREER CENTER", desc: "用学生画像匹配实习岗位，管理简历、投递与面试进度。", icon: "▱", ready: true, className: "feature-career" },
];

const MONTHS = ["JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE","JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER"];
const DAYS = ["SUNDAY","MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY"];

export default function Dashboard() {
  const profile = useStudentProfile();
  const [toast, setToast] = useState("");
  const [greeting, setGreeting] = useState("");
  const [dateStr, setDateStr] = useState("");
  const [growthStats, setGrowthStats] = useState({ verifiedTasks: 0, pendingTasks: 0, abilityScore: 0, verifiedEvidence: 0 });

  useEffect(() => {
    const now = new Date();
    const h = now.getHours();
    setGreeting(h < 12 ? "上午好" : h < 18 ? "下午好" : "晚上好");
    setDateStr(`${MONTHS[now.getMonth()]} ${now.getDate()}, ${DAYS[now.getDay()]}`);
    Promise.all([apiFetch("/api/growth-path"), apiFetch("/api/portrait")])
      .then(async ([tasksResponse, portraitResponse]) => {
        const tasksBody = await tasksResponse.json() as { tasks?: Array<{ evidenceStatus: string }> };
        const portraitBody = await portraitResponse.json() as { portrait?: { overallScore: number; verifiedEvidence: number } };
        if (!tasksResponse.ok || !portraitResponse.ok) return;
        setGrowthStats({
          verifiedTasks: (tasksBody.tasks ?? []).filter(item => item.evidenceStatus === "verified").length,
          pendingTasks: (tasksBody.tasks ?? []).filter(item => item.evidenceStatus === "pending").length,
          abilityScore: portraitBody.portrait?.overallScore ?? 0,
          verifiedEvidence: portraitBody.portrait?.verifiedEvidence ?? 0,
        });
      })
      .catch(() => null);
  }, []);

  const featureStat = (id: string) => {
    if (id === "map") return `已核验·${growthStats.verifiedTasks} 项`;
    if (id === "portrait") return `证据指数·${growthStats.abilityScore}`;
    if (id === "interview") return "尚未形成报告";
    if (id === "ai") return "基于真实档案辅助";
    return "从 0 开始记录";
  };

  const notify = (title: string) => {
    setToast(title);
    window.setTimeout(() => setToast(""), 2300);
  };

  return (
    <main className="dashboard-shell">
      <aside className="dash-sidebar">
        <Link className="dash-brand" href="/dashboard"><span><i /></span><b>薪火</b></Link>
        <nav className="dash-nav">
          <button className="active" aria-current="page"><i aria-hidden="true">▤</i><span>成长首页</span><em className="nav-active-indicator" /></button>
          <Link href="/growth-map"><i>⌘</i><span>成长地图</span></Link>
          <Link href="/interview"><i>◉</i><span>模拟面试</span></Link>
          <Link href="/portrait"><i>◇</i><span>能力画像</span></Link>
          <Link href="/ai"><i>策</i><span>成长决策</span></Link>
          <Link href="/resources"><i>▦</i><span>成长资源</span></Link>
          <Link href="/career"><i>▱</i><span>实习就业</span></Link>
          {["teacher", "counselor", "college_admin", "school_admin", "admin"].includes(profile.role) && <Link href="/admin"><i>管</i><span>管理中心</span></Link>}
        </nav>
        <div className="dash-side-bottom"><div className="completion"><div><span>已核验成长任务</span><b>{growthStats.verifiedTasks} 项</b></div><i><em style={{ width: growthStats.verifiedTasks ? "100%" : "0%" }} /></i><small>{growthStats.pendingTasks ? `${growthStats.pendingTasks} 项佐证等待管理员审核` : "提交真实佐证并审核通过后开始累计"}</small></div><Link href="/account"><span className="mini-avatar">{profile.name.slice(0, 1)}</span><span><b>{profile.name}</b><small>{profile.studentId}</small></span><i>›</i></Link></div>
      </aside>

      <section className="dashboard-main">
        <header className="dash-topbar"><div><span className="status-dot" />个人云端成长档案正常</div><div><button aria-label="搜索" onClick={() => notify("可在成长资源和实习就业中搜索内容")}>⌕</button><button aria-label="通知" className="bell" onClick={() => notify(growthStats.pendingTasks ? `${growthStats.pendingTasks} 条任务佐证正在等待审核` : "当前没有新的成长提醒")}>⌑{growthStats.pendingTasks > 0 && <i />}</button><Link href="/account">账号设置</Link></div></header>
        <div className="dash-page">
          <section className="dash-hero">
            <div className="hero-text"><p>{dateStr}</p><h1>{greeting}，{profile.name}。</h1><span>{profile.college}·{profile.major}·{profile.className}</span></div>
            <div className="dash-ai-brief"><div className="brief-icon">✦</div><div><span>AI DAILY BRIEF</span><p>{growthStats.pendingTasks ? `你有 ${growthStats.pendingTasks} 条佐证正在等待审核，审核通过前进度不会增加。` : growthStats.verifiedTasks ? `已有 ${growthStats.verifiedTasks} 项任务通过核验，继续用真实成果推进成长路径。` : "当前成长进度为 0。完成任务并提交实际佐证，通过核验后才会开始累计。"}</p></div><Link href="/growth-map">去看计划 <i>→</i></Link></div>
          </section>

          <section className="dash-overview">
            <div className="dash-heading"><div><span>MY GROWTH CENTER</span><h2>你的成长中心</h2></div><p>所有与成长有关的事，都在这里。</p></div>
            <div className="feature-grid">
              {features.map((feature, index) => {
              const hrefMap: Record<string, string> = { map: "/growth-map", interview: "/interview", portrait: "/portrait", ai: "/ai", resources: "/resources", career: "/career" };
              return feature.ready ? (
                <Link className={`feature-card ${feature.className}`} href={hrefMap[feature.id] || `/${feature.id}`} key={feature.id}>
                  <span className="feature-index">0{index + 1}</span><span className="feature-icon">{feature.icon}</span><div><small>{feature.en}</small><h3>{feature.title}</h3><p>{feature.desc}</p><em>{featureStat(feature.id)}</em></div><b>↗</b>
                </Link>
              ) : (
                <button className={`feature-card ${feature.className}`} onClick={() => notify(feature.title)} key={feature.id}>
                  <span className="feature-index">0{index + 1}</span><span className="feature-icon">{feature.icon}</span><div><small>{feature.en}</small><h3>{feature.title}</h3><p>{feature.desc}</p><em>{featureStat(feature.id)}</em></div><b>›</b>
                </button>
              );
            })}
            </div>
          </section>

          <section className="dash-bottom-grid">
            <article className="today-card"><div className="dash-heading small"><div><span>TODAY</span><h2>今日成长节奏</h2></div><Link href="/growth-map">全部任务 →</Link></div><div className="today-list"><div className="dashboard-zero-state"><span>0</span><div><b>暂无已确认成长进度</b><small>选择一项任务，完成后提交真实成果链接、证书编号或评价来源。</small></div><Link href="/growth-map">提交第一项佐证 →</Link></div></div></article>
            <article className="student-card"><div className="student-card-top"><span className="large-avatar">{profile.name.slice(0, 1)}</span><div><small>STUDENT PROFILE</small><h3>{profile.name}</h3><p>{profile.grade}·{profile.major}</p></div><Link href="/account">编辑</Link></div><div className="student-fields"><div><span>院系</span><b>{profile.college}</b></div><div><span>班级</span><b>{profile.className}</b></div><div><span>学号</span><b>{profile.studentId}</b></div><div><span>成长状态</span><b>{growthStats.verifiedEvidence ? `已核验 ${growthStats.verifiedEvidence} 条佐证` : "等待首条核验"}</b></div></div></article>
          </section>
        </div>
      </section>
      {toast && <div className="dash-toast"><span>✦</span>{toast}</div>}
    </main>
  );
}
