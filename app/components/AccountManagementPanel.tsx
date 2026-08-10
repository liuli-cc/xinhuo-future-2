"use client";

import { apiFetch } from "../../lib/bmob-api";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Profile } from "./PortalFrame";
import { imnuCollegeNames, isOfficialImnuCollege } from "../../data/imnu-colleges";

type AccountStatus = "pending" | "active" | "rejected" | "suspended";
type ManagedAccount = {
  id: number;
  studentId: string;
  name: string;
  email: string;
  role: Profile["role"];
  accountStatus: AccountStatus;
  accountReviewNote: string;
  accountReviewedAt: number | null;
  college: string;
  major: string;
  className: string;
  grade: string;
  createdAt: number;
  lastLoginAt: number | null;
};

const roleLabels: Record<Profile["role"], string> = {
  unknown: "账号",
  student: "学生",
  teacher: "教师",
  counselor: "辅导员",
  college_admin: "学院管理员",
  school_admin: "学校管理员",
  admin: "平台管理员",
};
const statusLabels: Record<AccountStatus, string> = {
  pending: "待审核",
  active: "正常",
  rejected: "未通过",
  suspended: "已停用",
};

export default function AccountManagementPanel({ profile }: { profile: Profile }) {
  const [accounts, setAccounts] = useState<ManagedAccount[]>([]);
  const [scope, setScope] = useState({ role: "", college: "", className: "" });
  const [statusFilter, setStatusFilter] = useState<"all" | AccountStatus>("all");
  const [roleFilter, setRoleFilter] = useState<"all" | "student" | "staff">("all");
  const [collegeFilter, setCollegeFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [action, setAction] = useState<{ targetId: number; type: "reject" | "suspend" } | null>(null);
  const [note, setNote] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [placement, setPlacement] = useState({ college: "", major: "", className: "", grade: "" });
  const [busyId, setBusyId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(""), 3000);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const readAccounts = useCallback(async () => {
    const response = await apiFetch("/api/management/accounts");
    const body = await response.json() as { accounts?: ManagedAccount[]; scope?: typeof scope; error?: string };
    if (!response.ok || !body.accounts) throw new Error(body.error || "账号列表读取失败");
    setAccounts(body.accounts);
    if (body.scope) setScope(body.scope);
  }, []);

  useEffect(() => {
    if (!profile.studentId || profile.role === "student") return;
    readAccounts().catch(reason => setError(reason instanceof Error ? reason.message : "账号列表读取失败"));
  }, [profile.role, profile.studentId, readAccounts]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return accounts.filter(item => {
      if (statusFilter !== "all" && item.accountStatus !== statusFilter) return false;
      if (roleFilter === "student" && item.role !== "student") return false;
      if (roleFilter === "staff" && item.role === "student") return false;
      if (collegeFilter !== "all" && item.college !== collegeFilter) return false;
      if (!normalizedQuery) return true;
      return [item.name, item.studentId, item.college, item.major, item.className]
        .some(value => value.toLowerCase().includes(normalizedQuery));
    });
  }, [accounts, collegeFilter, query, roleFilter, statusFilter]);

  const applyAction = async (targetId: number, nextAction: "approve" | "reject" | "suspend" | "activate") => {
    if (["reject", "suspend"].includes(nextAction) && note.trim().length < 2) {
      setError(nextAction === "reject" ? "驳回账号时必须填写至少 2 个字的具体原因" : "停用账号时必须填写至少 2 个字的具体原因");
      return;
    }
    setBusyId(targetId); setError(""); setFeedback("");
    try {
      const response = await apiFetch("/api/management/accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId, action: nextAction, note: note.trim() }),
      });
      const body = await response.json() as { accounts?: ManagedAccount[]; error?: string };
      if (!response.ok || !body.accounts) throw new Error(body.error || "账号操作失败");
      setAccounts(body.accounts);
      setAction(null);
      setNote("");
      setFeedback(nextAction === "approve" ? "账号已审核通过" : nextAction === "reject" ? "账号已驳回并记录原因" : nextAction === "suspend" ? "账号已停用，原登录会话已失效" : "账号已恢复使用");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "账号操作失败");
    } finally {
      setBusyId(null);
    }
  };

  const startPlacement = (item: ManagedAccount) => {
    setEditingId(item.id);
    setPlacement({ college: item.college, major: item.major, className: item.className, grade: item.grade });
    setError("");
  };

  const savePlacement = async (targetId: number) => {
    if (!isOfficialImnuCollege(placement.college)) return setError("院系必须从内蒙古师范大学二级学院官方名单中选择");
    if (placement.major.trim().length < 2) return setError("专业、岗位或职称长度必须至少为 2 个字");
    if (placement.className.trim().length < 2) return setError("班级名称长度必须至少为 2 个字");
    setBusyId(targetId); setError(""); setFeedback("");
    try {
      const response = await apiFetch("/api/management/accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId, action: "placement", ...placement }),
      });
      const body = await response.json() as { accounts?: ManagedAccount[]; error?: string };
      if (!response.ok || !body.accounts) throw new Error(body.error || "班级信息保存失败");
      setAccounts(body.accounts);
      setEditingId(null);
      setFeedback("院系、身份信息和班级范围已更新");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "班级信息保存失败");
    } finally {
      setBusyId(null);
    }
  };

  const canEditPlacement = ["college_admin", "school_admin", "admin"].includes(profile.role);
  const pendingCount = accounts.filter(item => item.accountStatus === "pending").length;
  const activeCount = accounts.filter(item => item.accountStatus === "active").length;

  return <section className="portal-card account-management-panel">
    <div className="admin-section-head">
      <div><span>ACCOUNT GOVERNANCE</span><h2>账号审核与管理</h2></div>
      <b>{pendingCount} 个待审核</b>
    </div>
    <p className="admin-review-intro">
      {["teacher", "counselor"].includes(profile.role)
        ? `你的管理范围：${scope.college || profile.college} / ${scope.className || "尚未分配班级"}。只能查看和审核该班学生账号。`
        : "管理员可审核全部注册账号、停用异常账号，并校正教师负责班级与学生学籍归属。"}
    </p>
    <div className="account-management-metrics">
      <div><span>范围内账号</span><b>{accounts.length}</b></div>
      <div><span>待审核</span><b>{pendingCount}</b></div>
      <div><span>正常使用</span><b>{activeCount}</b></div>
      <div><span>停用或驳回</span><b>{accounts.length - pendingCount - activeCount}</b></div>
    </div>
    <div className="account-management-toolbar">
      <label><span>搜索账号</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="姓名、学号、工号或班级" /></label>
      <label><span>审核状态</span><select value={statusFilter} onChange={event => setStatusFilter(event.target.value as typeof statusFilter)}><option value="all">全部状态</option><option value="pending">待审核</option><option value="active">正常</option><option value="rejected">未通过</option><option value="suspended">已停用</option></select></label>
      {! ["teacher", "counselor"].includes(profile.role) && <label><span>院系归档</span><select value={collegeFilter} onChange={event => setCollegeFilter(event.target.value)}><option value="all">全部院系</option>{imnuCollegeNames.map(college => <option key={college} value={college}>{college}</option>)}</select></label>}
      {! ["teacher", "counselor"].includes(profile.role) && <label><span>账号类型</span><select value={roleFilter} onChange={event => setRoleFilter(event.target.value as typeof roleFilter)}><option value="all">全部账号</option><option value="student">学生账号</option><option value="staff">教职工账号</option></select></label>}
    </div>
    {(error || feedback) && <div className={`account-feedback ${error ? "error" : ""}`}>{error || feedback}</div>}
    <div className="managed-account-list">
      {filtered.map(item => <article key={item.id} className={`managed-account ${item.accountStatus}`}>
        <header>
          <span>{item.name.slice(0, 1)}</span>
          <div><b>{item.name}</b><small>{item.studentId} · {roleLabels[item.role]}</small></div>
          <em>{statusLabels[item.accountStatus]}</em>
        </header>
        <dl>
          <div><dt>院系</dt><dd>{item.college || "未填写"}</dd></div>
          <div><dt>{item.role === "student" ? "专业" : "岗位 / 职称"}</dt><dd>{item.major || "未填写"}</dd></div>
          <div><dt>{item.role === "student" ? "所属班级" : "负责班级"}</dt><dd>{item.className || "未分配"}</dd></div>
          <div><dt>注册时间</dt><dd>{new Date(item.createdAt).toLocaleDateString("zh-CN")}</dd></div>
        </dl>
        {item.accountReviewNote && <p className="managed-account-note"><b>最近审核说明：</b>{item.accountReviewNote}</p>}
        {editingId === item.id ? <div className="placement-editor">
          <label><span>院系</span><select value={placement.college} onChange={event => setPlacement(current => ({ ...current, college: event.target.value }))}>{imnuCollegeNames.map(college => <option key={college} value={college}>{college}</option>)}</select></label>
          <label><span>{item.role === "student" ? "专业" : "岗位 / 职称"}</span><input value={placement.major} onChange={event => setPlacement(current => ({ ...current, major: event.target.value }))} /></label>
          <label><span>{item.role === "student" ? "所属班级" : "负责班级"}</span><input value={placement.className} onChange={event => setPlacement(current => ({ ...current, className: event.target.value }))} /></label>
          {item.role === "student" && <label><span>年级</span><input value={placement.grade} onChange={event => setPlacement(current => ({ ...current, grade: event.target.value }))} placeholder="例如：2025级" /></label>}
          <div><button type="button" onClick={() => setEditingId(null)}>取消</button><button type="button" className="primary" disabled={busyId === item.id} onClick={() => savePlacement(item.id)}>保存归属</button></div>
        </div> : action?.targetId === item.id ? <div className="account-action-reason">
          <label><span>{action.type === "reject" ? "具体驳回原因" : "具体停用原因"}</span><textarea value={note} onChange={event => setNote(event.target.value)} maxLength={200} placeholder={action.type === "reject" ? "例如：工号与学校名册不一致，请核对后重新提交" : "例如：账号归属信息异常，等待管理员复核"} /></label>
          <div><button type="button" onClick={() => { setAction(null); setNote(""); }}>取消</button><button type="button" className="danger" disabled={busyId === item.id} onClick={() => applyAction(item.id, action.type)}>确认{action.type === "reject" ? "驳回" : "停用"}</button></div>
        </div> : <footer>
          {canEditPlacement && item.id !== profile.id && <button type="button" onClick={() => startPlacement(item)}>调整班级</button>}
          {item.id !== profile.id && item.accountStatus === "pending" && <><button type="button" onClick={() => { setAction({ targetId: item.id, type: "reject" }); setNote(""); }}>驳回</button><button type="button" className="approve" disabled={busyId === item.id} onClick={() => applyAction(item.id, "approve")}>审核通过</button></>}
          {item.id !== profile.id && item.accountStatus === "active" && <button type="button" className="danger-ghost" onClick={() => { setAction({ targetId: item.id, type: "suspend" }); setNote(""); }}>停用账号</button>}
          {item.id !== profile.id && ["rejected", "suspended"].includes(item.accountStatus) && <button type="button" className="approve" disabled={busyId === item.id} onClick={() => applyAction(item.id, "activate")}>恢复使用</button>}
        </footer>}
      </article>)}
      {!filtered.length && <div className="admin-review-empty"><span>✓</span><div><b>当前筛选条件下没有账号</b><p>新注册账号会自动出现在对应管理员或班级教师的待审核列表中。</p></div></div>}
    </div>
  </section>;
}
