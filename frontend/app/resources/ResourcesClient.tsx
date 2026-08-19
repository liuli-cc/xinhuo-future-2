"use client";

import { apiFetch } from "@/modules/shared/api/bmob-api";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PortalFrame, { useStudentProfile } from "@/modules/shared/components/PortalFrame";
import { AnimatedBarChart, AnimatedDonutChart, VizSkeleton } from "@/modules/shared/components/DataViz";
import { loadCloudState, saveCloudState } from "@/modules/shared/state/cloud-state-client";
import { currentSemesterForGrade, linkedGrowthTaskId } from "@/modules/shared/growth/semester";
import imnuPublicIndex from "../../data/imnu-public-index.json";

type Resource = { id: number; title: string; category: string; provider: string; level: string; duration: string; desc: string; tags: string[]; color: string };
type Faculty = { id: string; name: string; title: string; position: string; mentorLevel: "博士研究生导师" | "硕士研究生导师" | "教师"; researchAreas: string[]; email: string; description: string; profileUrl: string; sourceUpdatedAt: string };
type DirectoryStatus = "synced" | "no_public_directory" | "no_official_url" | "site_unavailable";
type CollegeDirectory = { id: string; school: string; college: string; officialUrl: string; sourceUrl: string; mentorSourceUrl: string; sourceStatus: DirectoryStatus; sourceNote: string; updatedAt: string; total: number; doctoralCount: number; masterCount: number };
type Directory = CollegeDirectory & { faculty: Faculty[] };
type ImnuPublicItem = { id: string; title: string; section: string; publishedAt: string | null; summary: string; sourceUrl: string; sourceHost: string; syncedAt: string };
type ImnuPublicIndex = { generatedAt: string; sections: string[]; source: { name: string; homeUrl: string; scope: string; copyrightNotice: string }; items: ImnuPublicItem[] };

const resources: Resource[] = [
  { id: 1, title: "后端项目工程化实战", category: "课程", provider: "学堂在线", level: "进阶", duration: "12 课时", desc: "从接口设计、鉴权到部署，完成一个可演示的服务端项目。", tags: ["Node.js", "数据库"], color: "blue" },
  { id: 2, title: "中国国际大学生创新大赛", category: "竞赛", provider: "创新创业学院", level: "团队", duration: "7月20日截止", desc: "面向真实问题完善商业计划与产品原型，支持校内导师匹配。", tags: ["国创", "路演"], color: "violet" },
  { id: 3, title: "大学生职业生涯规划师工作坊", category: "活动", provider: "就业指导中心", level: "入门", duration: "周五 19:00", desc: "拆解目标岗位，现场完成职业定位与一页行动计划。", tags: ["生涯", "线下"], color: "green" },
  { id: 4, title: "算法与数据结构专项训练", category: "课程", provider: "人工智能学院", level: "进阶", duration: "8 周", desc: "覆盖高频笔试题型，每周训练、讲解与学习反馈。", tags: ["算法", "笔试"], color: "cyan" },
  { id: 5, title: "校园开发者成长营", category: "项目", provider: "创新实验室", level: "团队", duration: "6 周", desc: "与跨专业同学协作交付校园数字化产品，优秀项目可孵化。", tags: ["项目", "协作"], color: "orange" },
  { id: 6, title: "全国大学生计算机设计大赛", category: "竞赛", provider: "教务处", level: "团队", duration: "8月1日截止", desc: "软件应用与信息可视化方向开放报名，提供往届案例库。", tags: ["作品", "答辩"], color: "pink" },
  { id: 7, title: "一对一简历门诊", category: "服务", provider: "就业指导中心", level: "预约", duration: "30 分钟", desc: "就业导师逐段反馈简历，帮助量化项目贡献与学习成果。", tags: ["简历", "求职"], color: "blue" },
  { id: 8, title: "开源贡献入门计划", category: "项目", provider: "开源社团", level: "入门", duration: "4 周", desc: "从第一个 Issue 到 Pull Request，积累可公开验证的协作成果。", tags: ["GitHub", "开源"], color: "green" },
];

const statusLabel: Record<DirectoryStatus, string> = {
  synced: "已同步官网公开目录",
  no_public_directory: "未发现结构化公开目录",
  no_official_url: "学校官网未公开学院入口",
  site_unavailable: "同步时官网暂时无法访问",
};

const imnuIndex = imnuPublicIndex as ImnuPublicIndex;

export default function ResourcesClient() {
  const profile = useStudentProfile();
  const [mode, setMode] = useState<"resources" | "mentors" | "imnu">("resources");
  const [category, setCategory] = useState("全部");
  const [mentorLevel, setMentorLevel] = useState("全部师资");
  const [imnuSection, setImnuSection] = useState("全部");
  const [query, setQuery] = useState("");
  const [saved, setSaved] = useState<number[]>([]);
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [selectedFaculty, setSelectedFaculty] = useState<Faculty | null>(null);
  const [college, setCollege] = useState("人工智能学院");
  const [colleges, setColleges] = useState<CollegeDirectory[]>([]);
  const [directory, setDirectory] = useState<Directory | null>(null);
  const [directoryError, setDirectoryError] = useState("");
  const [toast, setToast] = useState("");
  const [joiningResource, setJoiningResource] = useState<number | null>(null);
  const [joinedResource, setJoinedResource] = useState<number | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("section") === "mentors") setMode("mentors");
    if (params.get("section") === "imnu") setMode("imnu");
    if (params.get("college")) setCollege(params.get("college")!);
    loadCloudState<number[]>("resource_saved", []).then(setSaved).catch(() => null);
  }, []);

  useEffect(() => {
    if (mode !== "mentors") return;
    const controller = new AbortController();
    setDirectory(null); setDirectoryError(""); setSelectedFaculty(null);
    apiFetch(`/api/mentors?college=${encodeURIComponent(college)}`, { signal: controller.signal })
      .then(async response => {
        const body = await response.json() as { colleges?: CollegeDirectory[]; directory?: Directory; error?: string };
        if (!response.ok || !body.directory) throw new Error(body.error || "导师目录读取失败");
        setColleges(body.colleges ?? []); setDirectory(body.directory);
      })
      .catch(error => { if (error.name !== "AbortError") setDirectoryError(error instanceof Error ? error.message : "导师目录读取失败"); });
    return () => controller.abort();
  }, [college, mode]);

  const filteredResources = useMemo(() => resources.filter(item =>
    (category === "全部" || item.category === category || category === "已收藏" && saved.includes(item.id)) &&
    `${item.title}${item.provider}${item.tags.join("")}`.toLowerCase().includes(query.toLowerCase())), [category, query, saved]);
  const filteredFaculty = useMemo(() => (directory?.faculty ?? []).filter(item =>
    (mentorLevel === "全部师资" || item.mentorLevel === mentorLevel) &&
    `${item.name}${item.title}${item.position}${item.mentorLevel}${item.researchAreas.join("")}${item.description}`.toLowerCase().includes(query.toLowerCase())), [directory, mentorLevel, query]);
  const filteredImnuItems = useMemo(() => imnuIndex.items.filter(item =>
    (imnuSection === "全部" || item.section === imnuSection) &&
    `${item.title}${item.summary}${item.section}`.toLowerCase().includes(query.toLowerCase())), [imnuSection, query]);

  const switchMode = (next: "resources" | "mentors" | "imnu") => {
    setMode(next); setQuery("");
    const url = next === "mentors" ? `/resources?section=mentors&college=${encodeURIComponent(college)}` : next === "imnu" ? "/resources?section=imnu" : "/resources";
    window.history.replaceState({}, "", url);
  };
  const chooseCollege = (next: string) => {
    setCollege(next); setMentorLevel("全部师资"); setQuery("");
    window.history.replaceState({}, "", `/resources?section=mentors&college=${encodeURIComponent(next)}`);
  };
  const toggleSave = (id: number) => {
    const next = saved.includes(id) ? saved.filter(item => item !== id) : [...saved, id];
    setSaved(next); saveCloudState("resource_saved", next).catch(() => setToast("云端收藏保存失败，请稍后重试"));
  };
  const join = async (item: Resource) => {
    setJoiningResource(item.id);
    const semesterIndex = currentSemesterForGrade(profile.grade);
    try {
      const response = await apiFetch("/api/growth-path", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: linkedGrowthTaskId("resource", String(item.id), semesterIndex),
          semesterIndex,
          title: `完成：${item.title}`,
          note: `${item.provider} · ${item.level} · 完成后提交作品、证书或反馈作为佐证`,
          type: item.category,
          xp: item.level === "进阶" || item.level === "团队" ? 35 : 25,
        }),
      });
      if (!response.ok) throw new Error("成长任务创建失败");
      if (!saved.includes(item.id)) toggleSave(item.id);
      setJoinedResource(item.id);
      setToast(`“${item.title}”已加入成长地图`);
      setTimeout(() => setToast(""), 2600);
    } catch (reason) {
      setToast(reason instanceof Error ? reason.message : "加入失败，请稍后重试");
    } finally {
      setJoiningResource(null);
    }
  };
  const sourceLinks = directory ? [
    { href: directory.sourceUrl, label: "学院公开目录 ↗" },
    { href: directory.mentorSourceUrl, label: "导师信息页 ↗" },
    { href: directory.officialUrl, label: "学院官网 ↗" },
  ].filter((item, index, all) => item.href && all.findIndex(other => other.href === item.href) === index) : [];

  return <PortalFrame
    active="resources"
    eyebrow={mode === "mentors" ? "IMNU FACULTY DIRECTORY" : mode === "imnu" ? "IMNU PUBLIC INDEX" : "RESOURCE HUB"}
    title={mode === "mentors" ? "导师中心" : mode === "imnu" ? "内师公开信息" : "成长资源"}
    subtitle={mode === "mentors" ? "按内蒙古师范大学二级学院筛选公开师资信息；个人资料均可回到学院官网核验。" : mode === "imnu" ? "索引内蒙古师范大学官网的公开信息并始终跳转原文；不复制正文、图片、附件或登录系统内容。" : "浏览课程、竞赛和实践机会；未形成真实画像前不显示虚构匹配度。"}
    actions={<label className="resource-search">⌕<input value={query} onChange={event => setQuery(event.target.value)} placeholder={mode === "mentors" ? "搜索教师、研究方向或职称" : mode === "imnu" ? "搜索官网标题、栏目或摘要" : "搜索课程、竞赛或技能"} /></label>}
  >
    <nav className="resource-switch" aria-label="资源中心栏目">
      <button className={mode === "resources" ? "active" : ""} onClick={() => switchMode("resources")}><span>成长机会</span><small>课程 · 竞赛 · 项目</small></button>
      <button className={mode === "mentors" ? "active" : ""} onClick={() => switchMode("mentors")}><span>导师中心</span><small>二级学院 · 公开目录</small></button>
      <button className={mode === "imnu" ? "active" : ""} onClick={() => switchMode("imnu")}><span>内师公开信息</span><small>官网索引 · 原文核验</small></button>
    </nav>

    {mode === "resources" ? <>
      <section className="resource-banner"><div><span>✦ RESOURCE EXPLORATION</span><h2>从真实目标出发选择成长机会</h2><p>新账号不预设兴趣和能力结论；你可以先浏览资源，形成已核验证据后再进行个性化推荐。</p></div><div><strong>{saved.length}</strong><small>已收藏资源</small></div></section>
      <section className="resource-viz-grid">
        <AnimatedBarChart title="公开资源分类" description="展示当前目录中的真实资源数量，不代表推荐排名。" data={[...new Set(resources.map(item => item.category))].map(categoryName => ({ label: categoryName, value: resources.filter(item => item.category === categoryName).length, detail: `${categoryName}类公开资源` }))} />
        <AnimatedDonutChart title="收藏状态" description="收藏变化后圆环会立即重新展开。" centerLabel="目录资源" data={[
          { label: "已收藏", value: saved.length, detail: "已同步到你的云端收藏", color: "var(--chart-blue-2)" },
          { label: "未收藏", value: Math.max(0, resources.length - saved.length), detail: "仍可浏览的目录资源", color: "var(--chart-neutral)" },
        ]} />
      </section>
      <div className="filter-tabs">{["全部", "课程", "竞赛", "项目", "活动", "服务", "已收藏"].map(item => <button className={category === item ? "active" : ""} onClick={() => setCategory(item)} key={item}>{item}{item === "已收藏" && saved.length > 0 ? ` ${saved.length}` : ""}</button>)}</div>
      <section className="resource-grid">{filteredResources.map(item => <article className="resource-card portal-card" key={item.id}><div className={`resource-cover ${item.color}`}><span>{item.category}</span><b>{item.title.slice(0, 2)}</b><em>公开资源</em></div><div className="resource-body"><div><span>{item.provider}</span><button aria-label={saved.includes(item.id) ? "取消收藏" : "收藏"} className={saved.includes(item.id) ? "saved" : ""} onClick={() => toggleSave(item.id)}>♡</button></div><h2>{item.title}</h2><p>{item.desc}</p><div className="resource-tags">{item.tags.map(tag => <span key={tag}>{tag}</span>)}</div><footer><span>{item.level} · {item.duration}</span><button onClick={() => setSelectedResource(item)}>查看详情 →</button></footer></div></article>)}</section>
      {filteredResources.length === 0 && <div className="empty-state"><span>⌕</span><h2>没有找到匹配资源</h2><p>换一个关键词或分类试试。</p></div>}
    </> : mode === "mentors" ? <>
      <section className="mentor-hero">
        <div><span>INNER MONGOLIA NORMAL UNIVERSITY</span><h2>{directory?.college ?? "学院师资目录"}</h2><p>{directory?.sourceNote ?? "正在连接学院官网公开目录…"}</p></div>
        <div className="mentor-stats"><div><strong>{directory?.total ?? "-"}</strong><small>公开条目</small></div><div><strong>{directory?.doctoralCount ?? "-"}</strong><small>博士生导师</small></div><div><strong>{directory?.masterCount ?? "-"}</strong><small>硕士生导师</small></div></div>
      </section>
      <section className="resource-viz-grid single">
        {!directory ? <VizSkeleton label="正在读取师资分布" /> : <AnimatedBarChart title="公开师资构成" description="数据来自当前学院官网可核验目录。" data={[
          { label: "博士生导师", value: directory.doctoralCount, detail: "官网公开标注的博士生导师" },
          { label: "硕士生导师", value: directory.masterCount, detail: "官网公开标注的硕士生导师" },
          { label: "其他教师", value: Math.max(0, directory.total - directory.doctoralCount - directory.masterCount), detail: "未标注上述导师级别的公开师资条目" },
        ]} />}
      </section>
      <div className="mentor-toolbar">
        <label className="mentor-college-select"><span>选择学院</span><select value={college} onChange={event => chooseCollege(event.target.value)}>{colleges.map(item => <option key={item.id} value={item.college}>{item.college}</option>)}</select></label>
        <div className="filter-tabs">{["全部师资", "博士研究生导师", "硕士研究生导师", "教师"].map(item => <button className={mentorLevel === item ? "active" : ""} onClick={() => setMentorLevel(item)} key={item}>{item}</button>)}</div>
        <small>{directory ? `显示 ${filteredFaculty.length} / ${directory.total} 条` : "正在读取官网师资数据…"}</small>
      </div>
      {directoryError && <div className="mentor-status error"><b>目录读取失败</b><span>{directoryError}</span><button onClick={() => window.location.reload()}>重新加载</button></div>}
      {!directory && !directoryError && <div className="mentor-loading"><span /><span /><span /><span /><span /><span /></div>}
      {directory && directory.sourceStatus !== "synced" && <div className="mentor-status"><b>{statusLabel[directory.sourceStatus]}</b><span>{directory.sourceNote}</span></div>}
      {directory && filteredFaculty.length > 0 && <section className="mentor-grid">{filteredFaculty.map(item => <article className="mentor-card portal-card" key={item.id} onClick={() => setSelectedFaculty(item)}>
        <div className="mentor-card-head"><span className="mentor-avatar">{item.name.slice(0, 1)}</span><div><em>{item.mentorLevel}</em><h2>{item.name}</h2><p>{[item.title, item.position].filter(Boolean).join(" · ") || "学院官网公开师资条目"}</p></div><button aria-label={`查看${item.name}详情`}>↗</button></div>
        <p className="mentor-desc">{item.description}</p>
        <div className="mentor-tags">{item.researchAreas.length ? item.researchAreas.slice(0, 3).map(area => <span key={area}>{area}</span>) : <span>以官网个人主页为准</span>}</div>
        <footer><span>{item.researchAreas.length ? `${item.researchAreas.length} 个研究方向` : "公开页面可核验"}</span><b>查看官网资料 →</b></footer>
      </article>)}</section>}
      {directory && directory.total === 0 && <div className="empty-state"><span>◎</span><h2>该学院暂未提供可稳定识别的公开师资目录</h2><p>{directory.sourceNote}</p></div>}
      {directory && directory.total > 0 && filteredFaculty.length === 0 && <div className="empty-state"><span>⌕</span><h2>没有找到匹配教师</h2><p>可更换关键词，或直接前往学院官网核验。</p></div>}
      {directory && <aside className="mentor-source"><div><b>数据来源</b><span>更新于 {directory.updatedAt} · {statusLabel[directory.sourceStatus]} · 仅使用学院官网公开信息</span></div><div>{sourceLinks.map(item => <a key={item.href} href={item.href} target="_blank" rel="noreferrer">{item.label}</a>)}</div></aside>}
    </> : <>
      <section className="resource-banner imnu-index-banner"><div><span>✦ INNER MONGOLIA NORMAL UNIVERSITY</span><h2>官网公开信息，一处查找、回到原文核验</h2><p>{imnuIndex.source.scope}</p></div><div><strong>{filteredImnuItems.length}</strong><small>当前显示条目</small></div></section>
      <section className="resource-viz-grid single">
        <AnimatedBarChart title="官网公开栏目分布" description="展示已同步的公开页面索引；打开条目后将跳转至内蒙古师范大学官网原文。" data={imnuIndex.sections.map(section => ({ label: section, value: imnuIndex.items.filter(item => item.section === section).length, detail: `${section}公开条目` }))} />
      </section>
      <div className="filter-tabs">{["全部", ...imnuIndex.sections].map(item => <button className={imnuSection === item ? "active" : ""} onClick={() => setImnuSection(item)} key={item}>{item}</button>)}</div>
      <section className="resource-grid">{filteredImnuItems.map(item => <article className="resource-card portal-card" key={item.id}><div className="resource-cover blue"><span>{item.section}</span><b>内师</b><em>官方原文</em></div><div className="resource-body"><div><span>内蒙古师范大学官网</span></div><h2>{item.title}</h2><p>{item.summary || "该条目仅保留公开标题和官方来源链接；完整内容以官网原文为准。"}</p><div className="resource-tags"><span>{item.sourceHost}</span><span>公开索引</span></div><footer><span>{item.publishedAt ?? `同步于 ${item.syncedAt.slice(0, 10)}`}</span><a href={item.sourceUrl} target="_blank" rel="noreferrer">查看官网原文 ↗</a></footer></div></article>)}</section>
      {filteredImnuItems.length === 0 && <div className="empty-state"><span>⌕</span><h2>没有找到匹配的官网公开信息</h2><p>可更换关键词或栏目；完整信息请在学校官网查看。</p></div>}
      <aside className="mentor-source"><div><b>同步边界</b><span>生成于 {imnuIndex.generatedAt.slice(0, 10)} · {imnuIndex.source.copyrightNotice}</span></div><div><a href={imnuIndex.source.homeUrl} target="_blank" rel="noreferrer">访问内蒙古师范大学官网 ↗</a></div></aside>
    </>}

      {selectedResource && <div className="modal-backdrop" onMouseDown={() => !joiningResource && setSelectedResource(null)}><section className="portal-modal resource-modal" onMouseDown={event => event.stopPropagation()}><button className="modal-close" onClick={() => setSelectedResource(null)} disabled={Boolean(joiningResource)}>×</button><span className="modal-kicker">{selectedResource.category} · 公开成长资源</span><h2>{selectedResource.title}</h2><p>{selectedResource.desc}</p><div className="resource-detail"><div><span>提供方</span><b>{selectedResource.provider}</b></div><div><span>难度</span><b>{selectedResource.level}</b></div><div><span>时间</span><b>{selectedResource.duration}</b></div></div><h3>使用建议</h3><p>加入后会同时收藏并创建成长任务；完成后提交可核验成果，审核通过才会进入成长进度。</p>{joinedResource === selectedResource.id ? <Link className="modal-submit" href={`/growth-map?from=resources&target=${encodeURIComponent(selectedResource.title)}`}>已加入，前往成长地图 →</Link> : <button className="modal-submit" disabled={joiningResource === selectedResource.id} onClick={() => void join(selectedResource)}>{joiningResource === selectedResource.id ? "正在加入…" : "加入成长地图"}</button>}</section></div>}
    {selectedFaculty && <div className="modal-backdrop" onMouseDown={() => setSelectedFaculty(null)}><section className="portal-modal mentor-modal" onMouseDown={event => event.stopPropagation()}><button className="modal-close" onClick={() => setSelectedFaculty(null)}>×</button><div className="mentor-modal-profile"><span className="mentor-avatar large">{selectedFaculty.name.slice(0, 1)}</span><div><span className="modal-kicker">{selectedFaculty.mentorLevel}</span><h2>{selectedFaculty.name}</h2><p>{[selectedFaculty.title, selectedFaculty.position].filter(Boolean).join(" · ") || "学院官网公开师资条目"}</p></div></div>{selectedFaculty.researchAreas.length > 0 && <div className="mentor-modal-section"><h3>研究方向</h3><div className="mentor-tags">{selectedFaculty.researchAreas.map(area => <span key={area}>{area}</span>)}</div></div>}<div className="mentor-modal-section"><h3>公开资料说明</h3><p>{selectedFaculty.description}</p></div>{selectedFaculty.email && <div className="mentor-contact"><span>公开邮箱</span><a href={`mailto:${selectedFaculty.email}`}>{selectedFaculty.email}</a></div>}{selectedFaculty.profileUrl && <a className="modal-submit mentor-profile-link" href={selectedFaculty.profileUrl} target="_blank" rel="noreferrer">前往学院官网查看完整资料 ↗</a>}<small className="mentor-modal-note">资料来源：学院官网公开页面 · 更新于 {selectedFaculty.sourceUpdatedAt}</small></section></div>}
    {toast && <div className="portal-toast">✓ {toast}</div>}
  </PortalFrame>;
}
