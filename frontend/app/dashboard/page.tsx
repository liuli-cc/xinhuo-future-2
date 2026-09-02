"use client";

import { apiFetch } from "@/modules/shared/api/bmob-api";
import { AnimatedBarChart, AnimatedDonutChart, VizSkeleton, type VizDatum } from "@/modules/shared/components/DataViz";
import PortalFrame, { useStudentProfile } from "@/modules/shared/components/PortalFrame";
import FourYearJourney from "@/modules/group-2-growth/components/FourYearJourney";
import {
  ArrowUpRight,
  BookOpenText,
  Briefcase,
  ChartDonut,
  CheckCircle,
  ClockCountdown,
  FileText,
  ListChecks,
  MapTrifold,
  Robot,
  Sparkle,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useState } from "react";

const features = [
  { id: "map", title: "成长地图", desc: "展开大学四年的阶段路径与真实任务。", icon: MapTrifold, href: "/growth-map", className: "wide" },
  { id: "interview", title: "模拟面试", desc: "围绕真实简历和岗位完成语音练习。", icon: Robot, href: "/interview", className: "" },
  { id: "portrait", title: "能力画像", desc: "让每条已核验佐证进入能力计算。", icon: ChartDonut, href: "/portrait", className: "" },
  { id: "ai", title: "成长决策", desc: "看清目标差距与下一项优先行动。", icon: Sparkle, href: "/ai", className: "tall" },
  { id: "task-match", title: "任务匹配", desc: "根据测评和未来方向生成个性化任务。", icon: ListChecks, href: "/task-match", className: "" },
  { id: "resources", title: "成长资源", desc: "匹配课程、竞赛、导师与公开资源。", icon: BookOpenText, href: "/resources", className: "" },
  { id: "career", title: "实习就业", desc: "保存真实岗位，记录投递与复盘。", icon: Briefcase, href: "/career", className: "wide" },
  { id: "resume", title: "AI 简历", desc: "结合真实经历与企业岗位需求，生成定制简历。", icon: FileText, href: "/resume", className: "" },
];

const months = ["1 月", "2 月", "3 月", "4 月", "5 月", "6 月", "7 月", "8 月", "9 月", "10 月", "11 月", "12 月"];
const days = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
const journeyLabels = ["大一上", "大一下", "大二上", "大二下", "大三上", "大三下", "大四上", "大四下"];
const journeyThemes = [
  "适应大学，认识自己和专业",
  "拓宽边界，找到值得投入的方向",
  "能力筑基，把知识变成作品",
  "项目实践，让能力变成经历",
  "理解职业，准备第一次实习",
  "进入真实场景，验证职业方向",
  "聚焦去向，把准备转化为结果",
  "完成毕业，平稳走向下一站",
];

function getCurrentSemester(grade: string) {
  const entryYear = Number(grade.match(/\d{4}/)?.[0]);
  if (!entryYear) return 0;
  const now = new Date();
  const academicYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  const term = now.getMonth() >= 8 ? 0 : 1;
  return Math.max(0, Math.min(7, (academicYear - entryYear) * 2 + term));
}

type DashboardStats = {
  verifiedTasks: number;
  pendingTasks: number;
  abilityScore: number;
  verifiedEvidence: number;
  dimensions: VizDatum[];
  journeyProgress: number[];
};

const initialStats: DashboardStats = { verifiedTasks: 0, pendingTasks: 0, abilityScore: 0, verifiedEvidence: 0, dimensions: [], journeyProgress: Array(8).fill(0) };

export default function Dashboard() {
  const profile = useStudentProfile();
  const currentSemester = getCurrentSemester(profile.grade);
  const [selectedJourneySemester, setSelectedJourneySemester] = useState(currentSemester);
  const [greeting, setGreeting] = useState("");
  const [dateStr, setDateStr] = useState("");
  const [growthStats, setGrowthStats] = useState(initialStats);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSelectedJourneySemester(currentSemester);
  }, [currentSemester]);

  useEffect(() => {
    const now = new Date();
    const hour = now.getHours();
    setGreeting(hour < 12 ? "上午好" : hour < 18 ? "下午好" : "晚上好");
    setDateStr(`${months[now.getMonth()]} ${now.getDate()} 日，${days[now.getDay()]}`);
    Promise.all([apiFetch("/api/growth-path"), apiFetch("/api/portrait")])
      .then(async ([tasksResponse, portraitResponse]) => {
        const tasksBody = await tasksResponse.json() as { tasks?: Array<{ evidenceStatus: string; semesterIndex?: number; isCustom?: boolean }> };
        const portraitBody = await portraitResponse.json() as { portrait?: { overallScore: number; verifiedEvidence: number; dimensions?: Array<{ name: string; score: number; evidenceCount: number }> } };
        if (!tasksResponse.ok || !portraitResponse.ok) return;
        const tasks = tasksBody.tasks ?? [];
        const journeyProgress = journeyLabels.map((_, semesterIndex) => {
          const semesterTasks = tasks.filter(item => item.semesterIndex === semesterIndex);
          const customTaskCount = semesterTasks.filter(item => item.isCustom).length;
          const totalTasks = 4 + customTaskCount;
          const verifiedTasks = semesterTasks.filter(item => item.evidenceStatus === "verified").length;
          return Math.round(Math.min(totalTasks, verifiedTasks) / totalTasks * 100);
        });
        setGrowthStats({
          verifiedTasks: tasks.filter(item => item.evidenceStatus === "verified").length,
          pendingTasks: tasks.filter(item => item.evidenceStatus === "pending").length,
          abilityScore: portraitBody.portrait?.overallScore ?? 0,
          verifiedEvidence: portraitBody.portrait?.verifiedEvidence ?? 0,
          dimensions: (portraitBody.portrait?.dimensions ?? []).map(item => ({ label: item.name, value: item.score, detail: `${item.evidenceCount} 条证据参与计算` })),
          journeyProgress,
        });
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  const evidenceData: VizDatum[] = [
    { label: "已核验", value: growthStats.verifiedEvidence, detail: "已进入能力画像与进度计算", color: "var(--chart-blue-2)" },
    { label: "待审核", value: growthStats.pendingTasks, detail: "审核通过前不会增加成长进度", color: "var(--chart-blue-5)" },
  ];

  return <PortalFrame
    active="dashboard"
    eyebrow="你的成长总览"
    title={`${greeting}，${profile.name}`}
    subtitle={`${dateStr}。用真实行动和可核验成果，推进下一段成长。`}
    actions={<Link className="primary-action" href="/growth-map"><MapTrifold size={18} weight="duotone" />查看成长路径</Link>}
  >
    <section className="dashboard-redesign-hero">
      <div className="dashboard-redesign-copy">
        <span>当前成长状态</span>
        <h2>{growthStats.verifiedTasks ? `已有 ${growthStats.verifiedTasks} 项任务通过核验` : "从第一条真实成长佐证开始"}</h2>
        <p>{growthStats.pendingTasks ? `${growthStats.pendingTasks} 项佐证正在等待审核。审核通过后，图表和成长地图会自动重绘。` : "平台不会生成默认高分。完成任务、提交成果并通过审核后，数据才会变化。"}</p>
        <div className="dashboard-hero-actions"><Link href="/portrait">查看能力画像 <ArrowUpRight size={17} /></Link><Link href="/ai">生成行动优先级 <Sparkle size={17} /></Link></div>
      </div>
      <div className="dashboard-score-orbit" aria-label={`当前证据能力指数 ${growthStats.abilityScore}`}>
        <i style={{ "--score": `${growthStats.abilityScore * 3.6}deg` } as React.CSSProperties} />
        <div><strong>{loading ? "-" : growthStats.abilityScore}</strong><span>证据能力指数</span><small>{growthStats.verifiedEvidence} 条已核验佐证</small></div>
      </div>
    </section>

    <FourYearJourney
      semesters={journeyLabels.map((label, index) => ({ label, theme: journeyThemes[index], progress: growthStats.journeyProgress[index] ?? 0 }))}
      currentIndex={currentSemester}
      selectedIndex={selectedJourneySemester}
      onSelect={setSelectedJourneySemester}
    />

    <section className="dashboard-viz-grid">
      {loading ? <><VizSkeleton /><VizSkeleton /></> : <>
        <AnimatedBarChart data={growthStats.dimensions.length ? growthStats.dimensions : [
          { label: "专业学习", value: 0, detail: "尚无已核验证据" },
          { label: "项目实践", value: 0, detail: "尚无已核验证据" },
          { label: "创新探索", value: 0, detail: "尚无已核验证据" },
          { label: "沟通协作", value: 0, detail: "尚无已核验证据" },
          { label: "职业准备", value: 0, detail: "尚无已核验证据" },
        ]} title="五维能力分布" description="采用同一百分制，立体纵深仅用于区分层级。" max={100} depth unit="" />
        <AnimatedDonutChart data={evidenceData} title="成长证据状态" description="图表只统计当前读取到的真实佐证。" centerLabel="证据总数" unit="" />
      </>}
    </section>

    <section className="dashboard-feature-section">
      <header><div><span>功能入口</span><h2>围绕一个目标，串起完整成长闭环</h2></div><p>规划、实践、核验、复盘和就业数据保持连通。</p></header>
      <div className="dashboard-feature-mosaic">
        {features.map(feature => {
          const Icon = feature.icon;
          return <Link className={`dashboard-feature ${feature.className}`} href={feature.href} key={feature.id}>
            <div><span><Icon size={23} weight="duotone" /></span><ArrowUpRight size={18} /></div><h3>{feature.title}</h3><p>{feature.desc}</p>
          </Link>;
        })}
      </div>
    </section>

    <section className="dashboard-next-grid">
      <article className="dashboard-next-action">
        <span><ClockCountdown size={22} weight="duotone" /></span>
        <div><small>下一项建议</small><h2>{growthStats.pendingTasks ? "等待审核时，整理下一项任务成果" : growthStats.verifiedTasks ? "继续完成当前学期的一项任务" : "选择当前学期的第一项任务"}</h2><p>每次只推进一个可以验收的结果，进度更清楚。</p></div>
        <Link href="/growth-map">前往成长地图 <ArrowUpRight size={17} /></Link>
      </article>
      <article className="dashboard-identity-summary">
        <div className="dashboard-avatar">{profile.name.slice(0, 1)}</div>
        <div><small>个人成长档案</small><h2>{profile.name}</h2><p>{profile.college} · {profile.major} · {profile.grade}</p></div>
        <span><CheckCircle size={19} weight="fill" />云端已连接</span>
      </article>
    </section>
  </PortalFrame>;
}
