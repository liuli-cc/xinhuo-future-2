"use client";

import { apiFetch } from "../../lib/bmob-api";

import { FormEvent, useCallback, useEffect, useState } from "react";
import AccountManagementPanel from "../components/AccountManagementPanel";
import PortalFrame, { useStudentProfile } from "../components/PortalFrame";

type Overview = {
  accounts: { total: number; students: number; admins: number; staff: number; pending: number };
  records: { growthTasks: number; evidence: number; cloudStates: number; evidenceFiles: number };
  storage: { estimatedBytes: number; databaseLimitBytes: number; usagePercent: number; warning: boolean; critical: boolean; method: string };
  recentUsers: Array<{ studentId: string; name: string; email: string; role: string; createdAt: number; lastLoginAt: number | null }>;
};
type ReviewItem = {
  id: number; studentId: string; studentName: string; taskId: string; taskTitle: string;
  title: string; category: string; dimension: string; detail: string; evidenceRef: string;
  evidenceDate: string; sourceType: string; createdAt: number;
  relevance: number; quality: number; contribution: number; sourceReliability: number;
  attachmentId?: string | null; attachmentName?: string | null; attachmentBytes?: number | null; attachmentSha256?: string | null; attachmentUrl?: string | null;
};
type Staff = { id: number; studentId: string; name: string; email: string; role: string; school: string; college: string; className: string; canReview: boolean; createdAt: number; lastLoginAt: number | null };
type AuditLog = { id: number; action: string; targetType: string; targetId: string; details: Record<string, unknown>; createdAt: number; actorName: string };
type Deletion = { userId: number; requestedAt: number; scheduledAt: number; studentId: string; name: string; email: string };
type Recovery = { id: string; userId: number; requestedAt: number; studentId: string; name: string; email: string; role: string };
const roleLabels: Record<string, string> = { student: "学生", teacher: "教师", counselor: "辅导员", college_admin: "学院管理员", school_admin: "学校管理员", admin: "平台管理员" };
const actionLabels: Record<string, string> = {
  "auth.login": "登录平台", "auth.login_failed": "登录失败", "account.register": "注册账号", "account.registered_pending": "提交注册审核", "staff.created": "创建教职工账号",
  "account.approve": "审核通过账号", "account.reject": "驳回账号", "account.suspend": "停用账号", "account.activate": "恢复账号", "account.placement_updated": "调整班级归属",
  "evidence.submitted": "提交能力佐证", "growth_task.evidence_submitted": "提交任务佐证", "evidence.verified": "通过佐证",
  "evidence.rejected": "驳回佐证", "privacy.data_exported": "导出个人数据", "privacy.deletion_requested": "申请注销账号",
  "interview.completed": "完成结构化面试", "decision.feedback": "反馈成长建议",
  "privacy.deletion_completed": "完成账号数据删除",
  "account.recovery_requested": "申请找回密码", "account.recovery_completed": "完成密码重置",
};

function size(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 ** 2).toFixed(1)} MB`;
}

export default function AdminPage() {
  const profile = useStudentProfile();
  const canManage = ["college_admin", "school_admin", "admin"].includes(profile.role);
  const canSystemManage = ["school_admin", "admin"].includes(profile.role);
  const canReview = profile.role !== "unknown" && profile.role !== "student";
  const [overview, setOverview] = useState<Overview | null>(null);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [deletions, setDeletions] = useState<Deletion[]>([]);
  const [recoveries, setRecoveries] = useState<Recovery[]>([]);
  const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({});
  const [reviewScores, setReviewScores] = useState<Record<number, { relevance: number; quality: number; contribution: number }>>({});
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [staffForm, setStaffForm] = useState({ studentId: "", name: "", email: "", role: "teacher", school: "内蒙古师范大学", college: "人工智能学院", className: "" });
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [error, setError] = useState("");

  const readReviews = useCallback(() => apiFetch("/api/admin/evidence").then(async response => {
    const body = await response.json() as { reviews?: ReviewItem[]; error?: string };
    if (!response.ok || !body.reviews) throw new Error(body.error || "待审核佐证读取失败");
    setReviews(body.reviews);
  }), []);
  const readManagement = useCallback(() => Promise.all([
    apiFetch("/api/admin/overview").then(response => response.json()),
    apiFetch("/api/admin/staff").then(response => response.json()),
    canSystemManage ? apiFetch("/api/admin/audit").then(response => response.json()) : Promise.resolve({ logs: [] }),
    canSystemManage ? apiFetch("/api/admin/deletions").then(response => response.json()) : Promise.resolve({ requests: [] }),
    canSystemManage ? apiFetch("/api/admin/recovery").then(response => response.json()) : Promise.resolve({ requests: [] }),
  ]).then(([overviewBody, staffBody, auditBody, deletionBody, recoveryBody]) => {
    if (overviewBody.overview) setOverview(overviewBody.overview);
    if (staffBody.staff) setStaff(staffBody.staff);
    if (auditBody.logs) setLogs(auditBody.logs);
    if (deletionBody.requests) setDeletions(deletionBody.requests);
    if (recoveryBody.requests) setRecoveries(recoveryBody.requests);
  }), [canSystemManage]);

  useEffect(() => {
    if (!canReview) return;
    readReviews().catch(reason => setError(reason instanceof Error ? reason.message : "待审核佐证读取失败"));
    if (canManage) readManagement().catch(() => setError("管理数据读取失败"));
  }, [canManage, canReview, readManagement, readReviews]);

  const review = async (id: number, status: "verified" | "rejected") => {
    const reviewerNote = (reviewNotes[id] ?? "").trim();
    const item = reviews.find(reviewItem => reviewItem.id === id);
    if (!item) return;
    const metrics = reviewScores[id] ?? { relevance: item.relevance, quality: item.quality, contribution: item.contribution };
    if (status === "rejected" && reviewerNote.length < 2) return setError("驳回佐证时请先填写原因");
    setReviewingId(id); setError("");
    try {
      const response = await apiFetch("/api/admin/evidence", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status, reviewerNote, ...metrics }) });
      const body = await response.json() as { reviews?: ReviewItem[]; error?: string };
      if (!response.ok || !body.reviews) throw new Error(body.error || "审核失败");
      setReviews(body.reviews);
      setReviewNotes(current => { const next = { ...current }; delete next[id]; return next; });
      if (canManage) await readManagement();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "审核失败"); }
    finally { setReviewingId(null); }
  };

  const createStaff = async (event: FormEvent) => {
    event.preventDefault(); setError(""); setTemporaryPassword("");
    const response = await apiFetch("/api/admin/staff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(staffForm) });
    const body = await response.json() as { staff?: Staff[]; temporaryPassword?: string; error?: string };
    if (!response.ok || !body.staff) return setError(body.error || "教职工账号创建失败");
    setStaff(body.staff);
    setTemporaryPassword(body.temporaryPassword ?? "");
    setStaffForm(current => ({ ...current, studentId: "", name: "", email: "", className: "" }));
    await readManagement();
  };
  const completeDeletion = async (item: Deletion) => {
    if (!confirm(`确认永久删除 ${item.name}（${item.studentId}）的个人资料、佐证文件、任务和面试记录吗？此操作不可恢复。`)) return;
    const response = await apiFetch("/api/admin/deletions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: item.userId }) });
    const body = await response.json() as { requests?: Deletion[]; error?: string };
    if (!response.ok) return setError(body.error || "账号删除失败");
    setDeletions(body.requests ?? []);
    await readManagement();
  };
  const completeRecovery = async (item: Recovery) => {
    const response = await apiFetch("/api/admin/recovery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: item.id }) });
    const body = await response.json() as { requests?: Recovery[]; temporaryPassword?: string; error?: string };
    if (!response.ok) return setError(body.error || "密码重置失败");
    setRecoveries(body.requests ?? []);
    setTemporaryPassword(body.temporaryPassword ?? "");
    await readManagement();
  };

  if (profile.role !== "unknown" && !canManage) return <PortalFrame active="admin" eyebrow="ADMIN ONLY" title="管理中心" subtitle="该页面仅管理员可见。"><div className="empty-state"><span>×</span><h2>没有管理员权限</h2><p>教师和辅导员请使用教师工作台管理本班学生。</p><a className="account-export" href="/teacher">进入教师工作台</a></div></PortalFrame>;

  return <PortalFrame active="admin" eyebrow="SCHOOL OPERATIONS" title="管理中心" subtitle="按学校、学院和班级范围审核成长佐证；高权限账号可管理人员、容量和审计记录。">
    {error && <div className="account-feedback error">{error}</div>}
    {overview?.storage.warning && <section className={`admin-capacity-alert ${overview.storage.critical ? "critical" : ""}`}><div><span>!</span><div><b>{overview.storage.critical ? "云端数据库容量严重不足" : "云端数据库容量即将不足"}</b><p>请清理无效附件或升级存储方案。此提醒只向管理账号展示。</p></div></div><strong>{overview.storage.usagePercent}%</strong></section>}
    <AccountManagementPanel profile={profile} />

    {canManage && <section className="admin-metrics">
      <article className="portal-card"><span>注册账号</span><strong>{overview?.accounts.total ?? "-"}</strong><p>{overview?.accounts.students ?? "-"} 名学生 · {overview?.accounts.staff ?? "-"} 名教职工</p></article>
      <article className="portal-card"><span>成长任务</span><strong>{overview?.records.growthTasks ?? "-"}</strong><p>按账号独立保存</p></article>
      <article className="portal-card"><span>证据与文件</span><strong>{overview?.records.evidence ?? "-"}</strong><p>{overview?.records.evidenceFiles ?? "-"} 个云端附件</p></article>
      <article className="portal-card"><span>待审核</span><strong>{overview?.accounts.pending ?? "-"}</strong><p>{reviews.length} 条成长佐证待核验</p></article>
    </section>}

    {canManage && <section className="portal-card admin-storage-card">
      <div className="admin-section-head"><div><span>STORAGE MONITOR</span><h2>云端容量监控</h2></div><b>{overview?.storage.usagePercent ?? 0}%</b></div>
      <div className="admin-storage-track"><i style={{ width: `${Math.max(overview?.storage.usagePercent ?? 0, 0.3)}%` }} /></div>
      <div className="admin-storage-copy"><span>估算已用 {overview ? size(overview.storage.estimatedBytes) : "-"}</span><span>估算剩余 {overview ? size(Math.max(0, overview.storage.databaseLimitBytes - overview.storage.estimatedBytes)) : "-"}</span></div>
      <p>{overview?.storage.method ?? "正在读取容量信息…"}。附件二进制已计入估算，80% 开始提醒。</p>
    </section>}

    <section className="portal-card admin-review-card">
      <div className="admin-section-head"><div><span>EVIDENCE REVIEW</span><h2>范围内学生佐证审核</h2></div><b>{reviews.length} 条待处理</b></div>
      <p className="admin-review-intro">先核对文件或来源，再判断任务关联、成果质量和学生实际贡献。所有审核动作都会进入审计日志。</p>
      {reviews.length ? <div className="admin-review-list">{reviews.map(item => <article key={item.id}>
        <header><span>{item.studentName.slice(0, 1)}</span><div><b>{item.studentName}</b><small>{item.studentId} · {item.dimension} · {item.evidenceDate}</small></div><em>待审核</em></header>
        <h3>{item.taskTitle || item.title}</h3><p><b>{item.title}</b>：{item.detail}</p>
        <div className="admin-evidence-ref"><span>可核验材料</span>{item.attachmentUrl ? <a href={item.attachmentUrl} target="_blank" rel="noreferrer">查看文件：{item.attachmentName} · {size(item.attachmentBytes ?? 0)} ↗</a> : /^https?:\/\//i.test(item.evidenceRef) ? <a href={item.evidenceRef} target="_blank" rel="noreferrer">打开成果链接 ↗</a> : <strong>{item.evidenceRef || "未提供"}</strong>}</div>
        {item.attachmentSha256 && <small className="evidence-hash">SHA-256：{item.attachmentSha256}</small>}
        <div className="review-score-grid">{(["relevance", "quality", "contribution"] as const).map(key => <label key={key}><span>{key === "relevance" ? "能力相关度" : key === "quality" ? "成果质量" : "个人贡献度"}</span><select value={(reviewScores[item.id] ?? item)[key]} onChange={event => setReviewScores(current => ({ ...current, [item.id]: { relevance: current[item.id]?.relevance ?? item.relevance, quality: current[item.id]?.quality ?? item.quality, contribution: current[item.id]?.contribution ?? item.contribution, [key]: Number(event.target.value) } }))}>{[40, 50, 60, 70, 80, 90, 100].map(value => <option value={value} key={value}>{value}</option>)}</select></label>)}</div>
        <textarea value={reviewNotes[item.id] ?? ""} onChange={event => setReviewNotes({ ...reviewNotes, [item.id]: event.target.value })} placeholder="审核说明；驳回时必须填写原因" />
        <footer><button disabled={reviewingId === item.id} onClick={() => review(item.id, "rejected")}>驳回补充</button><button className="approve" disabled={reviewingId === item.id} onClick={() => review(item.id, "verified")}>{reviewingId === item.id ? "处理中…" : "确认有效并计入进度"}</button></footer>
      </article>)}</div> : <div className="admin-review-empty"><span>✓</span><div><b>暂无待审核佐证</b><p>学生提交实际材料后会出现在这里。</p></div></div>}
    </section>

    {canManage && <section className="portal-card staff-management">
      <div className="admin-section-head"><div><span>ROLE & SCOPE</span><h2>教职工账号与审核范围</h2></div><b>{staff.length} 个账号</b></div>
      <form onSubmit={createStaff}>
        <label><span>工号</span><input value={staffForm.studentId} onChange={event => setStaffForm({ ...staffForm, studentId: event.target.value })} placeholder="6-12 位数字" inputMode="numeric" /></label>
        <label><span>姓名</span><input value={staffForm.name} onChange={event => setStaffForm({ ...staffForm, name: event.target.value })} /></label>
        <label><span>角色</span><select value={staffForm.role} onChange={event => setStaffForm({ ...staffForm, role: event.target.value })}><option value="teacher">教师</option><option value="counselor">辅导员</option>{canSystemManage && <option value="college_admin">学院管理员</option>}{profile.role === "admin" && <option value="school_admin">学校管理员</option>}</select></label>
        <label><span>院系</span><input value={staffForm.college} onChange={event => setStaffForm({ ...staffForm, college: event.target.value })} /></label>
        <label><span>负责班级</span><input value={staffForm.className} onChange={event => setStaffForm({ ...staffForm, className: event.target.value })} placeholder="教师/辅导员必须填写" /></label>
        <label><span>邮箱（选填）</span><input type="email" value={staffForm.email} onChange={event => setStaffForm({ ...staffForm, email: event.target.value })} /></label>
        <button>创建账号</button>
      </form>
      {temporaryPassword && <div className="temporary-password"><b>临时密码（只显示这一次）</b><code>{temporaryPassword}</code><span>请立即安全交给账号本人，首次登录必须修改。</span></div>}
      <div className="staff-list">{staff.map(item => <article key={item.id}><span>{item.name.slice(0, 1)}</span><div><b>{item.name}</b><small>{item.studentId} · {roleLabels[item.role]} · {item.college}{item.className ? ` / ${item.className}` : ""}</small></div><em>{item.canReview ? "可审核" : "只读"}</em></article>)}</div>
    </section>}

    {canSystemManage && <section className="portal-card audit-log-card">
      <div className="admin-section-head"><div><span>AUDIT TRAIL</span><h2>最近操作审计</h2></div><b>{logs.length} 条</b></div>
      <div>{logs.map(item => <article key={item.id}><span>{new Date(item.createdAt).toLocaleString("zh-CN")}</span><b>{item.actorName}</b><p>{actionLabels[item.action] ?? item.action}</p><code>{item.targetType} · {item.targetId}</code></article>)}</div>
    </section>}
    {canSystemManage && <section className="portal-card deletion-review-card">
      <div className="admin-section-head"><div><span>PRIVACY REQUESTS</span><h2>账号注销申请</h2></div><b>{deletions.length} 条</b></div>
      {deletions.length ? <div>{deletions.map(item => <article key={item.userId}><div><b>{item.name}</b><span>{item.studentId} · 申请于 {new Date(item.requestedAt).toLocaleString("zh-CN")}</span><small>最早处理：{new Date(item.scheduledAt).toLocaleString("zh-CN")}</small></div><button disabled={item.scheduledAt > Date.now()} onClick={() => completeDeletion(item)}>{item.scheduledAt > Date.now() ? "撤销期内" : "永久删除数据"}</button></article>)}</div> : <div className="admin-review-empty"><span>✓</span><div><b>暂无注销申请</b><p>学生提交申请后会有 7 天撤销期。</p></div></div>}
    </section>}
    {canSystemManage && <section className="portal-card deletion-review-card">
      <div className="admin-section-head"><div><span>ACCOUNT RECOVERY</span><h2>密码找回申请</h2></div><b>{recoveries.length} 条</b></div>
      {recoveries.length ? <div>{recoveries.map(item => <article key={item.id}><div><b>{item.name}</b><span>{item.studentId} · {roleLabels[item.role]} · {new Date(item.requestedAt).toLocaleString("zh-CN")}</span><small>管理员应线下核验本人身份后再生成临时密码</small></div><button className="recovery-action" onClick={() => completeRecovery(item)}>核验并重置</button></article>)}</div> : <div className="admin-review-empty"><span>✓</span><div><b>暂无密码找回申请</b><p>处理后旧设备会全部退出，账号首次登录必须改密。</p></div></div>}
    </section>}
  </PortalFrame>;
}
