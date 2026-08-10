"use client";

import { apiFetch } from "../../lib/bmob-api";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import PortalFrame, { useStudentProfile } from "../components/PortalFrame";
import { ABILITY_DIMENSIONS, SOURCE_META, type AbilityDimension, type EvidenceSource } from "../../lib/growth-engine";

type Task = {
  id: string;
  title: string;
  note: string;
  type: string;
  xp: number;
};

type SavedTask = Task & {
  taskId: string;
  semesterIndex: number;
  isCustom: boolean;
  completed: boolean;
  evidenceStatus: "none" | "pending" | "verified" | "rejected";
  evidenceId: number | null;
};

type Phase = {
  title: string;
  detail: string;
  suggestion: string;
};

type Semester = {
  label: string;
  theme: string;
  summary: string;
  phases: Phase[];
  tasks: Task[];
};

const semesterLabels = ["大一上", "大一下", "大二上", "大二下", "大三上", "大三下", "大四上", "大四下"];

function getCurrentSemester(grade: string) {
  const entryYear = Number(grade.match(/\d{4}/)?.[0]);
  if (!entryYear) return 0;
  const now = new Date();
  const academicYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  const term = now.getMonth() >= 8 ? 0 : 1;
  return Math.max(0, Math.min(7, (academicYear - entryYear) * 2 + term));
}

function getCurrentPhase() {
  const month = new Date().getMonth();
  if (month === 0 || month === 5 || month === 6 || month === 7) return 3;
  if (month === 1 || month === 2 || month === 8) return 0;
  if (month === 3 || month === 9) return 1;
  return 2;
}

function makeSemesters(majorValue: string): Semester[] {
  const major = majorValue && majorValue !== "专业未填写" ? majorValue : "所学专业";
  return [
    {
      label: "大一·上学期",
      theme: "适应大学，认识自己和专业",
      summary: `了解${major}的培养方案，建立适合自己的学习与生活节奏。`,
      phases: [
        { title: "入学适应", detail: "熟悉课程、校园资源和时间安排。", suggestion: "先把作息、课表和学习记录稳定下来。" },
        { title: "自我认知", detail: "识别兴趣、优势与需要改善的方面。", suggestion: "用真实的课程和活动体验验证自己的判断。" },
        { title: "专业认知", detail: `了解${major}的核心课程和常见发展方向。`, suggestion: "阅读培养方案，并向一位老师或高年级同学请教。" },
        { title: "学期复盘", detail: "整理成绩、活动和个人感受。", suggestion: "写下三件做得好的事和一件下学期要改进的事。" },
      ],
      tasks: [
        { id: "s0-1", title: `阅读${major}培养方案`, note: "标记核心课程与学分要求", type: "学业", xp: 20 },
        { id: "s0-2", title: "建立每周学习计划", note: "保留复习、运动和休息时间", type: "习惯", xp: 20 },
        { id: "s0-3", title: "参加一次专业认知活动", note: "记录三条真实收获", type: "探索", xp: 25 },
        { id: "s0-4", title: "完成第一份学期复盘", note: "整理成绩、经历和下阶段目标", type: "复盘", xp: 30 },
      ],
    },
    {
      label: "大一·下学期",
      theme: "拓宽边界，找到值得投入的方向",
      summary: `在稳定${major}基础学习的同时，用活动、实践和小作品验证兴趣。`,
      phases: [
        { title: "学习巩固", detail: "根据上学期结果调整学习方法。", suggestion: "优先改进一门薄弱课程，不同时设置过多目标。" },
        { title: "兴趣探索", detail: "选择社团、公益或学术活动参与。", suggestion: "选择能留下具体成果的活动。" },
        { title: "小型实践", detail: "完成一次团队任务或小型作品。", suggestion: "明确自己的分工，保存过程记录和成果。" },
        { title: "学年总结", detail: "形成大二阶段的学习重点。", suggestion: "从学业、能力、经历三个方面各确定一个目标。" },
      ],
      tasks: [
        { id: "s1-1", title: "改进一门核心课程的学习方法", note: "每两周检查一次实际效果", type: "学业", xp: 25 },
        { id: "s1-2", title: "参加一项校内实践", note: "明确个人分工与交付结果", type: "实践", xp: 25 },
        { id: "s1-3", title: `完成一份${major}小作品`, note: "保存成果和制作过程", type: "作品", xp: 30 },
        { id: "s1-4", title: "完成大一学年总结", note: "制定大二的三项重点", type: "复盘", xp: 30 },
      ],
    },
    {
      label: "大二·上学期",
      theme: "能力筑基，把知识变成作品",
      summary: `围绕${major}核心课程构建基础能力，通过作品和任务证明学习结果。`,
      phases: [
        { title: "方向梳理", detail: "从课程与经历中选择一个重点方向。", suggestion: "重点方向应与当前课程和真实兴趣同时相关。" },
        { title: "核心学习", detail: "完成重点课程和阶段性练习。", suggestion: "用每周固定时间保证持续练习。" },
        { title: "作品交付", detail: "产出一份可展示、可说明的课程作品。", suggestion: "作品要包含目标、过程、结果和个人贡献。" },
        { title: "反馈改进", detail: "邀请老师或同学评价作品。", suggestion: "把反馈转化为一份有截止时间的改进清单。" },
      ],
      tasks: [
        { id: "s2-1", title: `梳理${major}核心课程`, note: "明确先修关系与本学期重点", type: "学业", xp: 20 },
        { id: "s2-2", title: "制定一个八周能力提升计划", note: "每周至少一次可检查产出", type: "计划", xp: 25 },
        { id: "s2-3", title: "完成一份课程作品", note: "整理过程说明和最终成果", type: "作品", xp: 35 },
        { id: "s2-4", title: "获取一次正式反馈", note: "根据意见完成一轮改进", type: "反馈", xp: 25 },
      ],
    },
    {
      label: "大二·下学期",
      theme: "项目实践，让能力变成经历",
      summary: `把${major}知识放进真实任务，在团队协作中完成可验收的成果。`,
      phases: [
        { title: "目标确定", detail: "明确本学期要改善的一项核心能力。", suggestion: "选择一项能通过作品或项目验证的能力。" },
        { title: "项目准备", detail: "确定问题、团队分工和时间表。", suggestion: "把自己的责任和交付标准写清楚。" },
        { title: "项目执行", detail: "按节点交付任务并记录问题。", suggestion: "每周至少保留一项可证明的进展。" },
        { title: "成果沉淀", detail: "整理成果、个人贡献与改进点。", suggestion: "用简洁语言说清问题、行动和结果。" },
      ],
      tasks: [
        { id: "s3-1", title: `选择一项${major}相关实践`, note: "明确个人职责与可验收成果", type: "实践", xp: 30 },
        { id: "s3-2", title: "建立每周项目记录", note: "记录进展、问题与下一步", type: "习惯", xp: 20 },
        { id: "s3-3", title: "完成一次阶段成果展示", note: "收集至少两条外部反馈", type: "展示", xp: 30 },
        { id: "s3-4", title: "将项目整理进成长档案", note: "说明个人行动和具体收获", type: "档案", xp: 30 },
      ],
    },
    {
      label: "大三·上学期",
      theme: "理解职业，准备第一次实习",
      summary: `了解${major}可对应的多种发展路径，把课程和实践经历整理成求职资料。`,
      phases: [
        { title: "方向调研", detail: "了解不同职业路径的真实工作内容。", suggestion: "至少对比三种方向，不只看职位名称。" },
        { title: "材料整理", detail: "整理简历、作品和个人介绍。", suggestion: "只写真实经历，突出自己的行动和结果。" },
        { title: "模拟练习", detail: "通过模拟面试检查表达与准备度。", suggestion: "每次练习只重点改进一个问题。" },
        { title: "机会准备", detail: "建立实习或实践机会清单。", suggestion: "根据自己的真实时间制定投递节奏。" },
      ],
      tasks: [
        { id: "s4-1", title: `调研${major}的三种发展方向`, note: "记录工作内容、要求和个人兴趣", type: "调研", xp: 25 },
        { id: "s4-2", title: "完成第一版个人简历", note: "仅使用真实经历与结果", type: "材料", xp: 30 },
        { id: "s4-3", title: "整理两项可展示成果", note: "每项说明背景、行动和收获", type: "档案", xp: 30 },
        { id: "s4-4", title: "完成一次模拟面试", note: "根据反馈修改简历和自介", type: "练习", xp: 25 },
      ],
    },
    {
      label: "大三·下学期",
      theme: "进入真实场景，验证职业方向",
      summary: "通过实习、企业项目或高质量实践，验证能力、兴趣与工作方式。",
      phases: [
        { title: "机会筛选", detail: "筛选与自身阶段和时间匹配的机会。", suggestion: "优先关注工作内容、学习机会和指导方式。" },
        { title: "申请准备", detail: "针对不同机会修改材料并准备面试。", suggestion: "每进行一轮申请就根据反馈调整。" },
        { title: "实践交付", detail: "在真实任务中按时交付并获取反馈。", suggestion: "主动记录任务背景、个人行动和结果。" },
        { title: "经历复盘", detail: "确认自己更匹配的职业方向和工作环境。", suggestion: "更新简历与成长档案，保留可验证的证据。" },
      ],
      tasks: [
        { id: "s5-1", title: "建立实习或实践机会清单", note: "按匹配度和截止时间排序", type: "规划", xp: 20 },
        { id: "s5-2", title: "完成一轮定向申请", note: "保存申请记录和反馈", type: "行动", xp: 30 },
        { id: "s5-3", title: "建立每周实践日志", note: "记录任务、困难、反馈与成果", type: "记录", xp: 25 },
        { id: "s5-4", title: "更新简历和成长档案", note: "用真实结果说明个人贡献", type: "复盘", xp: 30 },
      ],
    },
    {
      label: "大四·上学期",
      theme: "聚焦去向，把准备转化为结果",
      summary: "根据真实能力、个人偏好和时间节点，推进就业、升学或其他发展路径。",
      phases: [
        { title: "去向确认", detail: "明确主要路径与一条合理备选。", suggestion: "主要路径应获得大部分时间和精力。" },
        { title: "集中行动", detail: "按时间表完成申请、备习或面试。", suggestion: "用每周数据检查进度，不因短期结果打乱节奏。" },
        { title: "选择评估", detail: "统一比较不同选项的长期价值。", suggestion: "将发展空间、匹配度和个人偏好纳入判断。" },
        { title: "衔接准备", detail: "为毕业后的第一个阶段制定准备计划。", suggestion: "只提前学习下一阶段真正会用到的内容。" },
      ],
      tasks: [
        { id: "s6-1", title: "确认毕业去向与备选路径", note: "写明选择理由、节点和资源", type: "决策", xp: 30 },
        { id: "s6-2", title: "建立关键节点进度表", note: "每周更新完成情况和下一步", type: "行动", xp: 25 },
        { id: "s6-3", title: "完成三次针对性练习", note: "根据主要去向选择练习内容", type: "练习", xp: 30 },
        { id: "s6-4", title: "制定下一阶段衔接计划", note: "确定需要提前补足的能力", type: "衔接", xp: 25 },
      ],
    },
    {
      label: "大四·下学期",
      theme: "完成毕业，平稳走向下一站",
      summary: "完成学业与毕业交付，整理四年成长资产，为入职或继续学习建立节奏。",
      phases: [
        { title: "毕业交付", detail: "按节点完成论文、设计和学业清单。", suggestion: "把大任务拆成每周可验收的小任务。" },
        { title: "能力衔接", detail: "针对下一阶段要求完成预学习。", suggestion: "优先学习入职或继续学习初期真正会用到的内容。" },
        { title: "身份转换", detail: "练习协作、沟通、反馈与自主管理。", suggestion: "建立清晰汇报问题、进度和风险的习惯。" },
        { title: "四年总结", detail: "整理成长档案与未来一年计划。", suggestion: "保留作品、证书、反馈和关键复盘。" },
      ],
      tasks: [
        { id: "s7-1", title: "完成毕业事项清单", note: "检查学分、毕业交付和相关材料", type: "毕业", xp: 25 },
        { id: "s7-2", title: "整理四年成长档案", note: "归档作品、经历、证书和反馈", type: "档案", xp: 30 },
        { id: "s7-3", title: "完成下一阶段预学习", note: "围绕真实要求确定学习清单", type: "衔接", xp: 25 },
        { id: "s7-4", title: "制定未来一年行动计划", note: "设定一个能力目标和一个成果目标", type: "未来", xp: 30 },
      ],
    },
  ];
}

function phaseState(semesterIndex: number, phaseIndex: number, currentSemester: number, currentPhase: number) {
  if (semesterIndex < currentSemester) return "past";
  if (semesterIndex > currentSemester) return "next";
  if (phaseIndex < currentPhase) return "past";
  if (phaseIndex === currentPhase) return "now";
  return "next";
}

const stateText = { past: "可回顾", now: "当前阶段", next: "待开始" } as const;

function dimensionForTask(task: Task): AbilityDimension {
  if (/学业|课程|学习|毕业/.test(task.type + task.title)) return "专业学习";
  if (/竞赛|创新|科研|探索/.test(task.type + task.title)) return "创新探索";
  if (/反馈|展示|团队|协作|表达/.test(task.type + task.title)) return "沟通协作";
  if (/职业|简历|面试|实习|申请|去向/.test(task.type + task.title)) return "职业准备";
  return "项目实践";
}

function freshEvidence(task: Task | null) {
  return {
    evidenceTitle: task ? `${task.title}的完成佐证` : "",
    category: task?.type || "项目实践",
    dimension: task ? dimensionForTask(task) : "项目实践" as AbilityDimension,
    detail: "",
    evidenceRef: "",
    evidenceDate: new Date().toISOString().slice(0, 10),
    sourceType: "project_artifact" as EvidenceSource,
    relevance: 80,
    quality: 75,
    contribution: 70,
  };
}

export default function GrowthMap() {
  const profile = useStudentProfile();
  const currentSemester = getCurrentSemester(profile.grade);
  const currentPhase = getCurrentPhase();
  const semesters = useMemo(() => makeSemesters(profile.major), [profile.major]);
  const [selectedSemester, setSelectedSemester] = useState<number | null>(null);
  const [selectedPhase, setSelectedPhase] = useState<number | null>(null);
  const [taskStates, setTaskStates] = useState<SavedTask[]>([]);
  const [customTasks, setCustomTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState("");
  const [toast, setToast] = useState("");
  const [evidenceTask, setEvidenceTask] = useState<Task | null>(null);
  const [evidenceForm, setEvidenceForm] = useState(() => freshEvidence(null));
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [submittingEvidence, setSubmittingEvidence] = useState(false);

  const semesterIndex = selectedSemester ?? currentSemester;
  const semester = semesters[semesterIndex];
  const defaultPhase = semesterIndex === currentSemester ? currentPhase : semesterIndex < currentSemester ? 3 : 0;
  const phaseIndex = selectedPhase ?? defaultPhase;
  const focus = semester.phases[phaseIndex];
  const tasks = [...semester.tasks, ...customTasks.filter(task => task.id.startsWith(`custom-${semesterIndex}-`))];
  const stateByTask = new Map(taskStates.map(item => [item.taskId, item]));
  const completed = tasks.filter(task => stateByTask.get(task.id)?.evidenceStatus === "verified").length;
  const pending = tasks.filter(task => stateByTask.get(task.id)?.evidenceStatus === "pending").length;
  const progress = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  };

  useEffect(() => {
    apiFetch("/api/growth-path")
      .then(async response => {
        const body = await response.json() as { tasks?: SavedTask[]; error?: string };
        if (!response.ok) throw new Error(body.error || "成长路径读取失败");
        const saved = body.tasks ?? [];
        setTaskStates(saved);
        setCustomTasks(saved.filter(item => item.isCustom).map(item => ({ id: item.taskId, title: item.title, note: item.note, type: item.type, xp: item.xp })));
      })
      .catch(() => notify("云端路径读取失败，请稍后刷新"));
  }, []);

  const chooseSemester = (index: number) => {
    setSelectedSemester(index);
    setSelectedPhase(null);
  };

  const openTaskEvidence = (id: string) => {
    const task = tasks.find(item => item.id === id);
    if (!task) return;
    const status = stateByTask.get(id)?.evidenceStatus ?? "none";
    if (status === "verified") return notify("该任务已通过佐证核验，进度已经计入");
    if (status === "pending") return notify("该任务的佐证正在等待管理员核验");
    setEvidenceTask(task);
    setEvidenceForm(freshEvidence(task));
    setEvidenceFile(null);
  };

  const submitEvidence = async (event: FormEvent) => {
    event.preventDefault();
    if (!evidenceTask || submittingEvidence) return;
    setSubmittingEvidence(true);
    try {
      let attachmentId = "";
      if (evidenceFile) {
        const upload = new FormData();
        upload.set("file", evidenceFile);
        upload.set("taskId", evidenceTask.id);
        const uploadResponse = await apiFetch("/api/evidence-files", { method: "POST", body: upload });
        const uploadBody = await uploadResponse.json() as { file?: { id: string }; error?: string };
        if (!uploadResponse.ok || !uploadBody.file) throw new Error(uploadBody.error || "佐证文件上传失败");
        attachmentId = uploadBody.file.id;
      }
      const response = await apiFetch("/api/growth-path/evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: evidenceTask.id,
          semesterIndex,
          taskTitle: evidenceTask.title,
          taskNote: evidenceTask.note,
          taskType: evidenceTask.type,
          xp: evidenceTask.xp,
          isCustom: evidenceTask.id.startsWith("custom-"),
          ...evidenceForm,
          attachmentId,
        }),
      });
      const body = await response.json() as { tasks?: SavedTask[]; error?: string; message?: string };
      if (!response.ok || !body.tasks) throw new Error(body.error || "佐证提交失败");
      setTaskStates(body.tasks);
      setEvidenceTask(null);
      setEvidenceFile(null);
      notify(body.message || "佐证已提交，审核通过后增加进度");
    } catch (reason) {
      notify(reason instanceof Error ? reason.message : "佐证提交失败，请重试");
    } finally {
      setSubmittingEvidence(false);
    }
  };

  const addTask = async (event: FormEvent) => {
    event.preventDefault();
    if (!newTask.trim()) return;
    const task: Task = { id: `custom-${semesterIndex}-${Date.now()}`, title: newTask.trim(), note: "我添加的任务", type: "自定义", xp: 20 };
    const next = [...customTasks, task];
    setCustomTasks(next);
    setNewTask("");
    try {
      const response = await apiFetch("/api/growth-path", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ taskId: task.id, semesterIndex, title: task.title, note: task.note, type: task.type, xp: task.xp }) });
      const body = await response.json() as { tasks?: SavedTask[] };
      if (!response.ok || !body.tasks) throw new Error("保存失败");
      setTaskStates(body.tasks);
      notify("任务已加入当前学期并同步云端");
    } catch {
      setCustomTasks(customTasks);
      notify("云端保存失败，请重试");
    }
  };

  const removeTask = async (id: string) => {
    const next = customTasks.filter(task => task.id !== id);
    setCustomTasks(next);
    try {
      const response = await apiFetch(`/api/growth-path?taskId=${encodeURIComponent(id)}`, { method: "DELETE" });
      const body = await response.json() as { tasks?: SavedTask[]; error?: string };
      if (!response.ok || !body.tasks) throw new Error(body.error || "删除失败");
      setTaskStates(body.tasks);
      notify("自定义任务已从云端删除");
    } catch {
      setCustomTasks(customTasks);
      notify("删除失败，请重试");
    }
  };

  return (
    <PortalFrame
      active="map"
      eyebrow="个人成长路径"
      title="成长地图"
      subtitle="根据你保存的年级和专业生成，不使用固定示例学生信息。"
      actions={<button className="ghost-action" onClick={() => { setSelectedSemester(null); setSelectedPhase(null); }}>回到当前学期</button>}
    >
      <section className="gm2-profile portal-card">
        <div className="gm2-avatar">{(profile.name || "同").slice(0, 1)}</div>
        <div className="gm2-profile-copy">
          <span>本页使用的学生信息</span>
          <h2>{profile.name || "同学"}</h2>
          <p>{profile.college}　·　{profile.major}　·　{profile.className}</p>
        </div>
        <div className="gm2-profile-meta">
          <div><span>年级</span><b>{profile.grade}</b></div>
          <div><span>自动定位</span><b>{semesterLabels[currentSemester]}</b></div>
          <Link href="/account">信息不对？去修改</Link>
        </div>
      </section>

      <section className="gm2-summary">
        <article className="gm2-current portal-card">
          <div>
            <span>{semesterIndex === currentSemester ? "当前学期" : "查看学期"}</span>
            <h2>{semester.label}：{semester.theme}</h2>
            <p>{semester.summary}</p>
          </div>
          <div className="gm2-progress" style={{ "--gm-progress": `${progress}%` } as React.CSSProperties}>
            <strong>{progress}%</strong><span>任务进度</span>
          </div>
        </article>
        <article className="gm2-stat portal-card"><span>已核验任务</span><strong>{completed}<small> / {tasks.length}</small></strong><p>{pending ? `${pending} 项佐证正在等待管理员审核` : "只有通过实际佐证核验才计入进度"}</p></article>
      </section>

      <section className="gm2-section">
        <div className="gm2-heading"><div><span>四年路线</span><h2>选择学期</h2></div><small>高亮标记为根据年级推算的当前学期</small></div>
        <div className="gm2-tabs" role="tablist" aria-label="选择学期">
          {semesters.map((item, index) => (
            <button key={item.label} role="tab" aria-selected={semesterIndex === index} className={`${semesterIndex === index ? "active" : ""} ${currentSemester === index ? "current" : ""}`} onClick={() => chooseSemester(index)}>
              <span>{index + 1}</span><b>{semesterLabels[index]}</b>{currentSemester === index && <small>当前</small>}
            </button>
          ))}
        </div>
      </section>

      <section className="gm2-section">
        <div className="gm2-heading"><div><span>阶段路径</span><h2>{semester.label}的四个阶段</h2></div><small>点击查看每个阶段的说明</small></div>
        <div className="gm2-phase-grid">
          {semester.phases.map((phase, index) => {
            const state = phaseState(semesterIndex, index, currentSemester, currentPhase);
            return <button key={phase.title} className={`gm2-phase ${state} ${phaseIndex === index ? "selected" : ""}`} onClick={() => setSelectedPhase(index)}>
              <span className="gm2-phase-number">{index + 1}</span>
              <span className="gm2-state">{stateText[state]}</span>
              <strong>{phase.title}</strong>
              <small>{phase.detail}</small>
            </button>;
          })}
        </div>
        <article className="gm2-focus portal-card">
          <div><span>当前查看</span><h3>{focus.title}</h3><p>{focus.detail}</p></div>
          <div><span>行动建议</span><p>{focus.suggestion}</p><small>建议依据：{profile.grade}、{profile.major}</small></div>
        </article>
      </section>

      <section className="gm2-section">
        <div className="gm2-heading"><div><span>行动清单</span><h2>{semesterLabels[semesterIndex]}建议任务</h2></div><small>提交实际佐证后进入审核，通过前进度保持不变</small></div>
        <div className="gm2-task-list">
          {tasks.map(task => {
            const evidenceStatus = stateByTask.get(task.id)?.evidenceStatus ?? "none";
            const isDone = evidenceStatus === "verified";
            const isPending = evidenceStatus === "pending";
            const isRejected = evidenceStatus === "rejected";
            const isCustom = task.id.startsWith("custom-");
            return <div className={`gm2-task ${isDone ? "done" : isPending ? "pending" : isRejected ? "rejected" : ""}`} key={task.id}>
              <button className="gm2-task-main" onClick={() => openTaskEvidence(task.id)} aria-label={`${isDone ? "查看已核验任务" : isPending ? "查看待审核任务" : "提交完成佐证"}：${task.title}`}>
                <span className="gm2-check">{isDone ? "已核验" : isPending ? "审核中" : isRejected ? "需补充" : "待佐证"}</span>
                <span><small>{task.type}</small><strong>{task.title}</strong><em>{task.note}</em></span>
                <b>{isDone ? `+${task.xp} 已计入` : `核验后 +${task.xp}`}</b>
              </button>
              {isCustom && <button className="gm2-remove" onClick={() => removeTask(task.id)} aria-label={`删除${task.title}`}>删除</button>}
            </div>;
          })}
        </div>
        <form className="gm2-add" onSubmit={addTask}>
          <div><label htmlFor="growth-task">添加你自己的任务</label><input id="growth-task" value={newTask} onChange={event => setNewTask(event.target.value)} placeholder="例如：本周完成一次课程复盘" /></div>
          <button type="submit" disabled={!newTask.trim()}>添加到{semesterLabels[semesterIndex]}</button>
        </form>
      </section>
      {evidenceTask && <div className="modal-backdrop" onMouseDown={() => !submittingEvidence && setEvidenceTask(null)}><form className="portal-modal ep-modal gm2-evidence-modal" onSubmit={submitEvidence} onMouseDown={event => event.stopPropagation()}>
        <button type="button" className="modal-close" aria-label="关闭" onClick={() => setEvidenceTask(null)} disabled={submittingEvidence}>关闭</button>
        <span className="modal-kicker">任务完成佐证</span><h2>{evidenceTask.title}</h2><p>提交后任务进入审核；只有管理员确认佐证有效，任务才会完成并增加进度。</p>
        <div className="ep-form-grid">
          <label className="wide"><span>佐证名称</span><input autoFocus value={evidenceForm.evidenceTitle} onChange={event => setEvidenceForm({ ...evidenceForm, evidenceTitle: event.target.value })} placeholder="例如：课程作品最终版与教师评语" /></label>
          <label><span>佐证类型</span><input value={evidenceForm.category} onChange={event => setEvidenceForm({ ...evidenceForm, category: event.target.value })} /></label>
          <label><span>对应能力</span><select value={evidenceForm.dimension} onChange={event => setEvidenceForm({ ...evidenceForm, dimension: event.target.value as AbilityDimension })}>{ABILITY_DIMENSIONS.map(item => <option key={item}>{item}</option>)}</select></label>
          <label><span>发生日期</span><input type="date" max={new Date().toISOString().slice(0, 10)} value={evidenceForm.evidenceDate} onChange={event => setEvidenceForm({ ...evidenceForm, evidenceDate: event.target.value })} /></label>
          <label><span>佐证来源</span><select value={evidenceForm.sourceType} onChange={event => setEvidenceForm({ ...evidenceForm, sourceType: event.target.value as EvidenceSource })}>{Object.entries(SOURCE_META).map(([value, meta]) => <option value={value} key={value}>{meta.label}</option>)}</select></label>
          <label className="wide"><span>行动与实际结果</span><textarea value={evidenceForm.detail} onChange={event => setEvidenceForm({ ...evidenceForm, detail: event.target.value })} placeholder="至少 12 个字，说明你具体完成了什么、承担了什么以及最终结果" /></label>
          <label className="wide"><span>上传佐证文件（推荐）</span><input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.txt" onChange={event => setEvidenceFile(event.target.files?.[0] ?? null)} /><small>支持 PDF、图片、TXT，最大 3 MB；文件会记录 SHA-256 摘要。</small></label>
          <label className="wide"><span>其他可核验来源（文件和来源至少一项）</span><input value={evidenceForm.evidenceRef} onChange={event => setEvidenceForm({ ...evidenceForm, evidenceRef: event.target.value })} placeholder="成果链接、证书编号、教务记录编号或教师评价来源" /></label>
          <label><span>相关度</span><select value={evidenceForm.relevance} onChange={event => setEvidenceForm({ ...evidenceForm, relevance: Number(event.target.value) })}><option value="60">部分相关</option><option value="80">高度相关</option><option value="100">直接证明</option></select></label>
          <label><span>成果质量</span><select value={evidenceForm.quality} onChange={event => setEvidenceForm({ ...evidenceForm, quality: Number(event.target.value) })}><option value="60">达到基本要求</option><option value="75">达到良好水平</option><option value="90">有明确优质结果</option><option value="100">获得权威认可</option></select></label>
          <label className="wide"><span>个人贡献度</span><select value={evidenceForm.contribution} onChange={event => setEvidenceForm({ ...evidenceForm, contribution: Number(event.target.value) })}><option value="50">参与者</option><option value="70">核心成员</option><option value="90">主要负责人</option><option value="100">独立完成</option></select></label>
        </div>
        <div className="ep-source-preview"><span>当前状态</span><strong>0%</strong><small>提交后仍不增加进度，管理员核验通过后自动更新。</small></div>
        <button className="modal-submit" disabled={submittingEvidence || evidenceForm.evidenceTitle.trim().length < 2 || evidenceForm.detail.trim().length < 12 || (!evidenceFile && evidenceForm.evidenceRef.trim().length < 6)}>{submittingEvidence ? "正在上传并提交…" : "提交佐证，等待核验"}</button>
      </form></div>}
      {toast && <div className="portal-toast"><span>已保存</span>{toast}</div>}
    </PortalFrame>
  );
}
