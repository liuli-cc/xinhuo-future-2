"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, BookOpenText, CheckCircle, FlagBanner, GraduationCap, Medal, Sparkle, TrendUp, UsersThree, WarningCircle } from "@phosphor-icons/react";
import { apiFetch } from "@/modules/shared/api/bmob-api";
import PortalFrame, { useStudentProfile } from "@/modules/shared/components/PortalFrame";

type DirectionId = "postgraduate" | "civil-service" | "teaching" | "employment";
type Metric = "专业学习" | "项目实践" | "创新探索" | "沟通协作" | "职业准备";
type Assessment = Record<Metric, number>;
type Task = { id: string; stage: string; title: string; detail: string; deliverable: string; metric: Metric; threshold: number; weeks: number; priority: "高" | "中" | "低" };
type Resource = { id: string; type: "网课" | "竞赛"; title: string; provider: string; detail: string; fit: string; gpa: string; tags: string[] };
type RoleModel = { id: string; name: string; school: string; major: string; destination: string; similarity: number; achievements: string[]; turningPoint: string; turningPointDetail: string };

const metrics: Metric[] = ["专业学习", "项目实践", "创新探索", "沟通协作", "职业准备"];
const directionOptions: Array<{ id: DirectionId; label: string; description: string; color: string }> = [
  { id: "postgraduate", label: "考研", description: "围绕初试、复试与科研经历，分阶段补齐学业和研究能力。", color: "violet" },
  { id: "civil-service", label: "考公", description: "围绕行测、申论和面试表达，建立稳定的备考节奏。", color: "blue" },
  { id: "teaching", label: "考编", description: "围绕教师资格、学科知识和试讲，准备教师编制考试。", color: "green" },
  { id: "employment", label: "就业 / 实习", description: "围绕岗位技能、项目作品和求职表达，形成可验证成果。", color: "orange" },
];

const directionData: Record<DirectionId, { title: string; eyebrow: string; tasks: Task[]; resources: Resource[]; roleModels: RoleModel[] }> = {
  postgraduate: {
    title: "考研 · 研究生路径", eyebrow: "POSTGRADUATE TRACK",
    tasks: [
      { id: "pg-1", stage: "现在 · 2 周", title: "完成目标院校与专业对照表", detail: "收集近三年分数线、专业课参考书和招生人数，形成一页决策表。", deliverable: "3 所院校对照表 + 选择理由", metric: "职业准备", threshold: 60, weeks: 2, priority: "高" },
      { id: "pg-2", stage: "基础 · 6 周", title: "建立专业课错题与知识地图", detail: "按章节拆分薄弱知识点，每周完成一次闭环测验和复盘。", deliverable: "知识地图 + 6 次测验记录", metric: "专业学习", threshold: 78, weeks: 6, priority: "高" },
      { id: "pg-3", stage: "提升 · 8 周", title: "完成一次可复现科研实验", detail: "选择一个公开数据集或论文方法，记录环境、过程、结果和局限。", deliverable: "实验报告 + 代码仓库", metric: "创新探索", threshold: 68, weeks: 8, priority: "中" },
      { id: "pg-4", stage: "复试 · 4 周", title: "进行 3 次结构化复试模拟", detail: "围绕自我介绍、专业追问和科研计划练习，保留反馈与改稿。", deliverable: "复试问答稿 + 三次反馈", metric: "沟通协作", threshold: 65, weeks: 4, priority: "中" },
    ],
    resources: [
      { id: "pg-r1", type: "网课", title: "考研数学基础与错题系统", provider: "中国大学 MOOC · 公开课", detail: "用周计划拆解极限、线代和概率，适合建立长期复习节奏。", fit: "专业学习差距较大时优先", gpa: "建议绩点 ≥ 2.8", tags: ["数学", "基础", "周计划"] },
      { id: "pg-r2", type: "网课", title: "科研入门：从文献阅读到复现实验", provider: "学堂在线", detail: "学习检索、阅读、实验记录与学术表达，产出复现报告。", fit: "创新探索低于 70 分时推荐", gpa: "建议绩点 ≥ 3.0", tags: ["科研", "论文", "实验"] },
      { id: "pg-r3", type: "竞赛", title: "全国大学生数学竞赛", provider: "中国数学会 · 校内选拔", detail: "适合作为数学基础的阶段性检验，关注校内报名与考试时间。", fit: "数学基础稳固后挑战", gpa: "通常无硬性绩点", tags: ["数学", "考试", "证书"] },
      { id: "pg-r4", type: "竞赛", title: "大学生创新创业训练计划", provider: "校团委 / 教务处", detail: "以科研或社会问题为主题，寻找导师并完成立项、中期和结题。", fit: "为复试准备真实科研经历", gpa: "部分学院要求绩点 ≥ 2.5", tags: ["科研", "导师", "项目"] },
    ],
    roleModels: [
      { id: "pg-m1", name: "陈思远（示例）", school: "内蒙古师范大学 · 2021 届", major: "计算机科学与技术", destination: "清华大学计算机学院（示例）", similarity: 89, achievements: ["专业前 10%", "完成 2 项科研复现实验", "发表中文核心论文 1 篇"], turningPoint: "大二下第一次科研复现", turningPointDetail: "把课程作业升级为可复现的实验报告，找到导师后持续迭代，最终形成复试可讲述的研究主线。" },
      { id: "pg-m2", name: "周雨桐（示例）", school: "内蒙古师范大学 · 2022 届", major: "教育技术学", destination: "北京师范大学教育学部（示例）", similarity: 76, achievements: ["跨专业备考上岸", "获校级奖学金 2 次", "参与 1 项教育实验"], turningPoint: "大三暑期完成方向取舍", turningPointDetail: "通过院校信息表和三次学长访谈，放弃盲目追逐热门学校，确定了匹配自身基础的专业方向。" },
    ],
  },
  "civil-service": {
    title: "考公 · 公务员路径", eyebrow: "CIVIL SERVICE TRACK",
    tasks: [
      { id: "gov-1", stage: "认知 · 2 周", title: "拆解目标岗位与专业限制", detail: "对照国考、省考公告，记录招录机关、学历、专业和基层经历要求。", deliverable: "10 个岗位筛选表", metric: "职业准备", threshold: 62, weeks: 2, priority: "高" },
      { id: "gov-2", stage: "基础 · 6 周", title: "完成行测五模块诊断", detail: "每个模块做一套限时题，统计正确率、耗时和易错题型。", deliverable: "五模块诊断表 + 错题本", metric: "专业学习", threshold: 72, weeks: 6, priority: "高" },
      { id: "gov-3", stage: "提升 · 6 周", title: "完成 6 篇申论小题与 2 篇大作文", detail: "按审题、提炼、结构、表达四步复盘，找同学或老师进行批改。", deliverable: "8 份申论练习 + 批改反馈", metric: "沟通协作", threshold: 70, weeks: 6, priority: "高" },
      { id: "gov-4", stage: "面试 · 4 周", title: "参加一次结构化面试训练营", detail: "练习综合分析、组织管理、应急应变和人际沟通四类题型。", deliverable: "面试录像 + 个人改进清单", metric: "职业准备", threshold: 75, weeks: 4, priority: "中" },
    ],
    resources: [
      { id: "gov-r1", type: "网课", title: "行测模块化精讲", provider: "国家教育资源公共服务平台", detail: "按数量、言语、判断、资料和常识建立错题复盘节奏。", fit: "先补最高频薄弱模块", gpa: "无绩点要求", tags: ["行测", "刷题", "计时"] },
      { id: "gov-r2", type: "网课", title: "申论写作与政策阅读", provider: "学习强国 · 公共课", detail: "通过政策原文和范文拆解，训练概括、提出对策和公文写作。", fit: "沟通表达低于 70 分时优先", gpa: "无绩点要求", tags: ["申论", "政策", "写作"] },
      { id: "gov-r3", type: "竞赛", title: "大学生模拟政协提案大赛", provider: "校团委", detail: "围绕真实公共议题完成调研、提案和答辩，积累公共表达证据。", fit: "沟通协作和公共议题兴趣匹配", gpa: "通常无硬性绩点", tags: ["调研", "提案", "答辩"] },
      { id: "gov-r4", type: "竞赛", title: "大学生社会调查与分析大赛", provider: "中国商业统计学会", detail: "完成问卷设计、数据分析和调研报告，训练申论所需的事实与论证能力。", fit: "适合把专业学习转成公共问题分析", gpa: "部分赛道建议绩点 ≥ 2.5", tags: ["调查", "数据", "报告"] },
    ],
    roleModels: [
      { id: "gov-m1", name: "李婧（示例）", school: "内蒙古师范大学 · 2020 届", major: "行政管理", destination: "国家税务总局某市税务局（示例）", similarity: 86, achievements: ["国考行测 78 分", "省级社会调查大赛一等奖", "完成 40 篇申论复盘"], turningPoint: "大三暑期完成第一套真题复盘", turningPointDetail: "发现自己不是刷题量不够，而是时间分配不稳定，于是用模块正确率和耗时做周追踪，八周后稳定提升。" },
      { id: "gov-m2", name: "刘子涵（示例）", school: "内蒙古师范大学 · 2021 届", major: "新闻学", destination: "某市宣传部（示例）", similarity: 72, achievements: ["校级优秀毕业生", "主持 3 次校园议题调研", "面试模拟综合评价 A"], turningPoint: "把校园采访经验迁移到申论", turningPointDetail: "将采访提纲改造成申论审题模板，开始用事实、对象、措施和结果组织答案，面试表达也变得更稳定。" },
    ],
  },
  teaching: {
    title: "考编 · 教师职业路径", eyebrow: "TEACHING TRACK",
    tasks: [
      { id: "teach-1", stage: "资格 · 4 周", title: "完成教师资格证科目规划", detail: "确认学段和学科，拆解综合素质、教育知识与学科知识的考试范围。", deliverable: "考试日历 + 每周学习表", metric: "职业准备", threshold: 58, weeks: 4, priority: "高" },
      { id: "teach-2", stage: "备课 · 6 周", title: "完成 6 份完整教学设计", detail: "每周选择一个知识点，练习目标、活动、评价和板书的完整闭环。", deliverable: "6 份教案 + 同伴反馈", metric: "专业学习", threshold: 68, weeks: 6, priority: "高" },
      { id: "teach-3", stage: "试讲 · 4 周", title: "录制 4 次十分钟试讲", detail: "关注导入、提问、节奏和课堂语言，保留前后版本进行对比。", deliverable: "4 段试讲视频 + 改进清单", metric: "沟通协作", threshold: 72, weeks: 4, priority: "高" },
      { id: "teach-4", stage: "实践 · 8 周", title: "完成一次真实教学实践", detail: "参加支教、助教或学习辅导，记录学生反馈和一次教学调整。", deliverable: "实践证明 + 教学反思", metric: "项目实践", threshold: 60, weeks: 8, priority: "中" },
    ],
    resources: [
      { id: "teach-r1", type: "网课", title: "教师资格证教育知识与能力", provider: "国家智慧教育公共服务平台", detail: "按章节学习教育学、心理学和教学评价，配合真题检验。", fit: "职业准备低于 60 分时优先", gpa: "无绩点要求", tags: ["教资", "教育学", "真题"] },
      { id: "teach-r2", type: "网课", title: "微格教学与十分钟试讲", provider: "高校教师发展中心", detail: "从教学目标到板书设计逐项练习，适合录制后获得同伴反馈。", fit: "沟通协作低于 75 分时优先", gpa: "建议绩点 ≥ 2.5", tags: ["试讲", "板书", "表达"] },
      { id: "teach-r3", type: "竞赛", title: "师范生教学技能大赛", provider: "校教务处", detail: "通过说课、片段教学和答辩训练，把教案转化为可展示的教学成果。", fit: "适合建立试讲作品集", gpa: "部分学院要求绩点 ≥ 2.8", tags: ["教学", "说课", "答辩"] },
      { id: "teach-r4", type: "竞赛", title: "大学生志愿服务项目大赛", provider: "校团委", detail: "以支教或教育公益为主题，积累真实服务时长和项目组织经验。", fit: "项目实践低于 65 分时推荐", gpa: "通常无硬性绩点", tags: ["支教", "公益", "实践"] },
    ],
    roleModels: [
      { id: "teach-m1", name: "王晨（示例）", school: "内蒙古师范大学 · 2021 届", major: "汉语言文学", destination: "呼和浩特市某中学（示例）", similarity: 91, achievements: ["教师资格证笔试面试一次通过", "校级教学技能大赛一等奖", "完成 80 小时支教实践"], turningPoint: "大二加入支教项目", turningPointDetail: "第一次面对真实学生后，发现备课不是堆知识点，而是设计学生能完成的活动，于是开始系统记录课堂反馈。" },
      { id: "teach-m2", name: "赵可欣（示例）", school: "内蒙古师范大学 · 2022 届", major: "数学与应用数学", destination: "某旗县重点高中（示例）", similarity: 79, achievements: ["连续两年专业奖学金", "教学设计作品集 12 份", "通过教师编制面试"], turningPoint: "把每次试讲都录下来", turningPointDetail: "用录像复盘语速、板书和提问，不再只凭感觉练习，四周后试讲结构和课堂节奏明显稳定。" },
    ],
  },
  employment: {
    title: "就业 / 实习 · 职业路径", eyebrow: "EMPLOYMENT TRACK",
    tasks: [
      { id: "job-1", stage: "定位 · 2 周", title: "完成目标岗位关键词清单", detail: "从 5 个真实岗位中提取技能、项目和成果关键词，标注已有证据与缺口。", deliverable: "岗位关键词对照表", metric: "职业准备", threshold: 65, weeks: 2, priority: "高" },
      { id: "job-2", stage: "作品 · 6 周", title: "交付一个可演示项目", detail: "选择一个真实问题，完成需求、开发、测试和上线演示，明确个人贡献。", deliverable: "作品链接 + 项目复盘", metric: "项目实践", threshold: 72, weeks: 6, priority: "高" },
      { id: "job-3", stage: "能力 · 4 周", title: "完成一次岗位技能专项训练", detail: "针对目标岗位选择 SQL、数据分析、产品设计或算法中的一项，保留结果。", deliverable: "训练记录 + 测验结果", metric: "专业学习", threshold: 70, weeks: 4, priority: "中" },
      { id: "job-4", stage: "求职 · 3 周", title: "完成 2 次模拟面试并迭代简历", detail: "使用平台模拟面试和 AI 简历，基于反馈修改表达和项目成果。", deliverable: "面试报告 + 新版简历", metric: "沟通协作", threshold: 72, weeks: 3, priority: "中" },
    ],
    resources: [
      { id: "job-r1", type: "网课", title: "数据分析与 SQL 实战", provider: "学堂在线", detail: "从清洗、查询到可视化，完成一个可放入作品集的分析项目。", fit: "专业学习或项目实践低于 75 分时优先", gpa: "建议绩点 ≥ 2.5", tags: ["SQL", "数据", "作品"] },
      { id: "job-r2", type: "网课", title: "产品思维与用户研究", provider: "中国大学 MOOC", detail: "用访谈、竞品分析和原型验证训练产品岗位的完整工作流。", fit: "目标岗位包含产品 / 用户关键词时推荐", gpa: "无绩点要求", tags: ["产品", "用户", "原型"] },
      { id: "job-r3", type: "竞赛", title: "中国国际大学生创新大赛", provider: "校创新创业学院", detail: "把真实问题做成方案、原型和路演材料，形成跨角色协作证据。", fit: "项目实践和创新探索的综合练习", gpa: "以校内通知为准", tags: ["创新", "路演", "团队"] },
      { id: "job-r4", type: "竞赛", title: "全国大学生计算机设计大赛", provider: "校教务处", detail: "适合软件应用和信息可视化方向，用作品和答辩展示专业能力。", fit: "适合沉淀公开作品与答辩经验", gpa: "部分赛道建议绩点 ≥ 2.5", tags: ["作品", "软件", "答辩"] },
    ],
    roleModels: [
      { id: "job-m1", name: "赵宇（示例）", school: "内蒙古师范大学 · 2022 届", major: "计算机科学与技术", destination: "字节跳动产品经理（示例）", similarity: 88, achievements: ["完成 3 个完整项目", "获得计算机设计大赛省赛奖项", "通过 4 次模拟面试迭代简历"], turningPoint: "大二暑期把课程作业升级成真实项目", turningPointDetail: "不再只追求代码完成，而是访谈用户、上线测试并记录数据，项目开始能在简历和面试中被验证。" },
      { id: "job-m2", name: "郭子轩（示例）", school: "内蒙古师范大学 · 2021 届", major: "信息管理与信息系统", destination: "某互联网公司数据分析师（示例）", similarity: 81, achievements: ["完成 SQL 专项训练", "开源贡献 6 次", "实习转正"], turningPoint: "第一次公开提交 Pull Request", turningPointDetail: "通过开源协作学会写清问题、方案和测试，沟通协作能力被真实团队验证，最终拿到第一份实习。" },
    ],
  },
};

const defaultAssessment: Assessment = { "专业学习": 68, "项目实践": 54, "创新探索": 62, "沟通协作": 71, "职业准备": 46 };

export default function TaskMatchPage() {
  const profile = useStudentProfile();
  const [direction, setDirection] = useState<DirectionId>("postgraduate");
  const [assessment, setAssessment] = useState<Assessment>(defaultAssessment);
  const [completed, setCompleted] = useState<string[]>([]);
  const [resourceType, setResourceType] = useState<"全部" | "网课" | "竞赛">("全部");
  const [selectedModel, setSelectedModel] = useState<RoleModel | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (profile.developmentTrack === "postgraduate" || profile.targetRole === "升学科研") setDirection("postgraduate");
  }, [profile.developmentTrack, profile.targetRole]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiFetch("/api/portrait")
      .then(async response => {
        if (!response.ok) return null;
        const body = await response.json() as { portrait?: { dimensions?: Array<{ name: string; score: number }> } };
        const next = { ...defaultAssessment };
        for (const item of body.portrait?.dimensions ?? []) if (metrics.includes(item.name as Metric)) next[item.name as Metric] = Math.round(item.score);
        if (active) setAssessment(next);
        return null;
      })
      .catch(() => null)
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [profile.studentId]);

  const plan = directionData[direction];
  const selectedDirection = directionOptions.find(item => item.id === direction) ?? directionOptions[0];
  const readiness = useMemo(() => Math.round(metrics.reduce((sum, metric) => sum + assessment[metric], 0) / metrics.length), [assessment]);
  const focusMetric = useMemo(() => metrics.reduce((best, metric) => assessment[metric] < assessment[best] ? metric : best, metrics[0]), [assessment]);
  const filteredResources = plan.resources.filter(item => resourceType === "全部" || item.type === resourceType);

  const toggleTask = (id: string) => setCompleted(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);

  return <PortalFrame active="task-match" eyebrow={plan.eyebrow} title="任务匹配工作台" subtitle="把测评结果、目标方向与可执行的成长机会连接起来，每次只推进下一步。">
    <div className="task-match-page">
      <section className="task-match-hero portal-card">
        <div className="task-match-hero-copy"><span><Sparkle size={16} weight="fill" /> PERSONALIZED GROWTH PLAN</span><h2>为你的「{selectedDirection.label}」方向生成下一步</h2><p>{selectedDirection.description}推荐结果来自当前能力画像与方向要求；示例资源和榜样案例请在报名或联系前再次核验。</p></div>
        <label className="task-direction-select"><span>未来意向方向</span><select value={direction} onChange={event => { setDirection(event.target.value as DirectionId); setSelectedModel(null); }}>{directionOptions.map(item => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
      </section>

      <section className="task-assessment-grid">
        <article className="portal-card task-readiness-card"><span>当前画像准备度</span><strong>{readiness}<small>/100</small></strong><p>{loading ? "正在读取测评结果…" : `基于 ${metrics.length} 个能力维度的当前分数`}</p><div className="task-readiness-bar"><i style={{ width: `${readiness}%` }} /></div></article>
        <article className="portal-card"><span>最优先补强</span><strong className="task-focus-score">{assessment[focusMetric]}<small>分</small></strong><p>{focusMetric}是当前画像中的最低项，已为你排到任务队列前面。</p></article>
        <article className="portal-card"><span>本方向可执行任务</span><strong>{plan.tasks.length - completed.filter(id => plan.tasks.some(item => item.id === id)).length}<small>项未完成</small></strong><p>完成任务后提交真实成果，才会改变能力画像。</p></article>
      </section>

      <section className="task-match-section"><header className="task-match-section-head"><div><span>01 · NEXT ACTIONS</span><h2>为「{selectedDirection.label}」准备的任务</h2><p>任务优先级会参考你的能力差距、方向门槛和预计投入时间。</p></div><a href="/ai">查看完整决策依据 <ArrowUpRight size={15} /></a></header><div className="task-list">{plan.tasks.map((task, index) => { const done = completed.includes(task.id); const currentScore = assessment[task.metric]; const gap = Math.max(0, task.threshold - currentScore); return <article className={`task-card portal-card ${done ? "completed" : ""}`} key={task.id}><div className="task-card-index">{done ? <CheckCircle size={22} weight="fill" /> : String(index + 1).padStart(2, "0")}</div><div className="task-card-main"><div className="task-card-meta"><span>{task.stage}</span><em className={`task-priority ${task.priority === "高" ? "high" : ""}`}>{task.priority}优先</em></div><h3>{task.title}</h3><p>{task.detail}</p><div className="task-card-deliverable"><FlagBanner size={15} /><span>验收物：{task.deliverable}</span></div><div className="task-card-tags"><span>{task.metric} 当前 {currentScore} / 门槛 {task.threshold}</span><span>预计 {task.weeks} 周</span>{gap > 0 && <span>仍差 {gap} 分</span>}</div></div><button className="task-complete-button" onClick={() => toggleTask(task.id)}>{done ? "已加入计划" : "加入计划"}</button></article>; })}</div></section>

      <section className="task-match-section"><header className="task-match-section-head"><div><span>02 · LEARNING & OPPORTUNITIES</span><h2>网课与竞赛推荐</h2><p>优先展示能补齐当前差距、并且可以沉淀成果的机会。</p></div><div className="task-resource-tabs">{["全部", "网课", "竞赛"].map(item => <button className={resourceType === item ? "active" : ""} key={item} onClick={() => setResourceType(item as "全部" | "网课" | "竞赛")}>{item}</button>)}</div></header><div className="task-resource-grid">{filteredResources.map(item => <article className="task-resource-card portal-card" key={item.id}><div className={`task-resource-icon ${item.type === "竞赛" ? "competition" : "course"}`}>{item.type === "竞赛" ? <Medal size={22} weight="duotone" /> : <BookOpenText size={22} weight="duotone" />}</div><div className="task-resource-body"><div className="task-resource-meta"><span>{item.type}</span><small>{item.provider}</small></div><h3>{item.title}</h3><p>{item.detail}</p><div className="task-resource-tags">{item.tags.map(tag => <span key={tag}>{tag}</span>)}</div><footer><span><GraduationCap size={14} />{item.gpa}</span><em>{item.fit}</em></footer></div></article>)}</div></section>

      <section className="task-match-section"><header className="task-match-section-head"><div><span>03 · ROLE MODEL MATCH</span><h2>与你经历相似的学长学姐</h2><p>案例为平台演示数据，匹配参考专业、发展方向和行动路径；真实信息请以本人或官方渠道为准。</p></div><span className="task-model-note"><UsersThree size={16} /> 相似度由公开经历标签计算</span></header><div className="task-model-grid">{plan.roleModels.map(model => <article className={`task-model-card portal-card ${selectedModel?.id === model.id ? "selected" : ""}`} key={model.id}><header><span className="task-model-avatar">{model.name.slice(0, 1)}</span><div><h3>{model.name}</h3><p>{model.school} · {model.major}</p></div><strong>{model.similarity}%<small>经历相似</small></strong></header><div className="task-model-destination"><span>最终去向</span><b>{model.destination}</b></div><div className="task-model-achievements"><span>代表成就</span>{model.achievements.map(item => <p key={item}><CheckCircle size={13} weight="fill" />{item}</p>)}</div><button className="task-model-button" onClick={() => setSelectedModel(selectedModel?.id === model.id ? null : model)}>查看改变人生的节点 <ArrowUpRight size={14} /></button>{selectedModel?.id === model.id && <div className="task-model-turning-point"><div><TrendUp size={17} /><span>关键转折点</span></div><b>{model.turningPoint}</b><p>{model.turningPointDetail}</p></div>}</article>)}</div></section>

      <aside className="task-match-disclaimer"><WarningCircle size={17} /><span>绩点门槛、考试公告、竞赛时间和学长学姐去向都可能更新。平台只做规划辅助，不替代学校通知、官方公告和本人确认。</span></aside>
    </div>
  </PortalFrame>;
}
