"use client";

import { apiFetch } from "../../lib/bmob-api";

import { FormEvent, useEffect, useState } from "react";
import PortalFrame, { useStudentProfile } from "../components/PortalFrame";

type DeviceSession = { id: string; deviceName: string; createdAt: number; lastSeenAt: number; expiresAt: number; current: boolean };
type DeletionRequest = { requestedAt: number; scheduledAt: number; cancelledAt: number | null; completedAt: number | null };
const roleLabels: Record<string, string> = { student: "学生", teacher: "教师", counselor: "辅导员", college_admin: "学院管理员", school_admin: "学校管理员", admin: "平台管理员" };

export default function AccountPage() {
  const profile = useStudentProfile();
  const [form, setForm] = useState(profile);
  const [password, setPassword] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [required, setRequired] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), 3000);
    return () => window.clearTimeout(timer);
  }, [message]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [deletion, setDeletion] = useState<DeletionRequest | null>(null);

  useEffect(() => setForm(profile), [profile]);
  useEffect(() => setRequired(new URLSearchParams(window.location.search).get("required") === "1"), []);
  useEffect(() => {
    if (!profile.studentId) return;
    apiFetch("/api/account/sessions").then(response => response.json()).then(body => setSessions(body.sessions ?? [])).catch(() => null);
    apiFetch("/api/account/deletion").then(response => response.json()).then(body => setDeletion(body.request ?? null)).catch(() => null);
  }, [profile.studentId]);

  const update = (field: "name" | "email" | "phone" | "college" | "major" | "className" | "grade" | "bio" | "targetRole" | "developmentTrack", value: string) =>
    setForm(current => ({ ...current, [field]: value }));

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    try {
      const response = await apiFetch("/api/account", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, action: "profile" }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "保存失败");
      setMessage("个人与发展信息已保存到腾讯云");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "保存失败"); }
    finally { setSaving(false); }
  };

  const savePassword = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    if (password.newPassword !== password.confirmPassword) { setError("两次输入的新密码不一致"); setSaving(false); return; }
    try {
      const response = await apiFetch("/api/account", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "password", currentPassword: password.currentPassword, newPassword: password.newPassword }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "密码修改失败");
      setPassword({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setRequired(false);
      setMessage("密码已更新，其他设备已自动退出");
      window.history.replaceState({}, "", "/account");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "密码修改失败"); }
    finally { setSaving(false); }
  };

  const revokeOthers = async () => {
    const response = await apiFetch("/api/account/sessions", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "others" }) });
    const body = await response.json() as { sessions?: DeviceSession[]; error?: string };
    if (!response.ok) return setError(body.error || "设备退出失败");
    setSessions(body.sessions ?? []);
    setMessage("其他设备已退出登录");
  };

  const changeDeletion = async (cancel = false) => {
    if (!cancel && !confirm("确认申请注销账号吗？系统会保留 7 天撤销期，期间不会立即删除。")) return;
    const response = await apiFetch("/api/account/deletion", { method: cancel ? "DELETE" : "POST" });
    const body = await response.json() as { request?: DeletionRequest; error?: string };
    if (!response.ok) return setError(body.error || "注销申请处理失败");
    setDeletion(body.request ?? null);
    setMessage(cancel ? "注销申请已撤销" : "注销申请已提交，7 天内可以撤销");
  };

  const exportData = async () => {
    setError("");
    const response = await apiFetch("/api/account/export");
    if (!response.ok) {
      const body = await response.json() as { error?: string };
      return setError(body.error || "个人数据导出失败");
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `xinhuo-${profile.studentId || "account"}-data.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setMessage("个人数据已导出");
  };

  return <PortalFrame active="" eyebrow="ACCOUNT, SECURITY & PRIVACY" title="账号与隐私" subtitle="管理个人资料、发展目标、登录设备和属于你的云端数据。">
    {(required || profile.forcePasswordChange) && <div className="account-required"><b>首次登录需要修改临时密码</b><span>完成密码更新后，才能安全地继续使用管理功能。</span></div>}
    {(message || error) && <div className={`account-feedback ${error ? "error" : ""}`}>{error || message}</div>}
    <section className="account-grid">
      <form className="portal-card account-card" onSubmit={saveProfile}>
        <div className="account-head"><div><span>PERSONAL PROFILE</span><h2>个人与发展信息</h2></div><em>{roleLabels[profile.role] ?? "平台账号"}</em></div>
        <div className="account-form">
          <label><span>姓名</span><input value={form.name} onChange={event => update("name", event.target.value)} /></label>
          <label><span>学号 / 工号</span><input value={form.studentId} disabled /></label>
          <label><span>邮箱</span><input type="email" value={form.email} onChange={event => update("email", event.target.value)} placeholder="选填" /></label>
          <label><span>联系电话</span><input value={form.phone} onChange={event => update("phone", event.target.value)} placeholder="选填" /></label>
          <label><span>院系</span><input value={form.college} disabled={profile.role !== "student"} onChange={event => update("college", event.target.value)} /></label>
          <label><span>专业</span><input value={form.major} disabled={profile.role !== "student"} onChange={event => update("major", event.target.value)} /></label>
          <label><span>班级 / 审核范围</span><input value={form.className} disabled={profile.role !== "student"} onChange={event => update("className", event.target.value)} /></label>
          <label><span>年级</span><select value={form.grade} disabled={profile.role !== "student"} onChange={event => update("grade", event.target.value)}>{["", "2022级", "2023级", "2024级", "2025级", "2026级"].map(item => <option key={item} value={item}>{item || "不适用"}</option>)}</select></label>
          <label><span>发展目标</span><select value={form.targetRole} onChange={event => update("targetRole", event.target.value)}>{["探索方向", "后端开发", "算法工程师", "数据分析", "产品经理", "升学科研"].map(item => <option key={item}>{item}</option>)}</select></label>
          <label><span>发展路径</span><select value={form.developmentTrack} onChange={event => update("developmentTrack", event.target.value)}><option value="exploration">方向探索</option><option value="employment">就业实践</option><option value="postgraduate">升学科研</option></select></label>
          <label className="wide"><span>兴趣标签（逗号分隔）</span><input value={form.interests.join("，")} onChange={event => setForm(current => ({ ...current, interests: event.target.value.split(/[，,]/).map(item => item.trim()).filter(Boolean).slice(0, 8) }))} placeholder="例如：后端、数据库、公益项目" /></label>
          <label className="wide"><span>个人简介</span><textarea value={form.bio} onChange={event => update("bio", event.target.value)} placeholder="可以填写研究兴趣、成长目标或个人特长" /></label>
        </div>
        <button className="modal-submit" disabled={saving}>保存个人信息</button>
      </form>
      <form className="portal-card account-card password-card" onSubmit={savePassword}>
        <div className="account-head"><div><span>SECURITY</span><h2>修改登录密码</h2></div></div>
        <p>密码只保存 PBKDF2 派生结果。连续 5 次登录失败后，账号会锁定 15 分钟。</p>
        <label><span>当前密码</span><input type="password" value={password.currentPassword} onChange={event => setPassword(current => ({ ...current, currentPassword: event.target.value }))} autoComplete="current-password" /></label>
        <label><span>新密码</span><input type="password" value={password.newPassword} onChange={event => setPassword(current => ({ ...current, newPassword: event.target.value }))} placeholder="10-128 位，含大小写字母和数字" autoComplete="new-password" /></label>
        <label><span>确认新密码</span><input type="password" value={password.confirmPassword} onChange={event => setPassword(current => ({ ...current, confirmPassword: event.target.value }))} autoComplete="new-password" /></label>
        <button className="modal-submit" disabled={saving}>更新密码</button>
        <div className="account-security-note"><b>账号安全提示</b><span>请勿与他人共享密码，管理员也不会向你索要密码。</span></div>
      </form>
    </section>
    <section className="account-data-grid">
      <article className="portal-card account-data-card">
        <div className="account-head"><div><span>ACTIVE SESSIONS</span><h2>登录设备</h2></div><button type="button" onClick={revokeOthers}>退出其他设备</button></div>
        <p>平台只保存设备类型和不可逆摘要，不保存完整 IP 地址。</p>
        <div className="account-session-list">{sessions.length ? sessions.map(item => <div key={item.id}><span>{item.current ? "本机" : "设备"}</span><div><b>{item.deviceName}{item.current ? " · 当前会话" : ""}</b><small>最近活动 {new Date(item.lastSeenAt || item.createdAt).toLocaleString("zh-CN")}</small></div></div>) : <small>正在读取登录设备…</small>}</div>
      </article>
      <article className="portal-card account-data-card">
        <div className="account-head"><div><span>DATA CONTROL</span><h2>我的数据权利</h2></div></div>
        <p>可下载个人资料、成长任务、证据元数据与面试报告。导出文件不包含密码和文件二进制内容。</p>
        <button className="account-export" type="button" onClick={exportData}>下载个人数据 JSON</button>
        {deletion && !deletion.cancelledAt && !deletion.completedAt ? <div className="account-deletion pending"><b>注销申请已提交</b><span>计划处理时间：{new Date(deletion.scheduledAt).toLocaleString("zh-CN")}</span><button onClick={() => changeDeletion(true)}>撤销注销申请</button></div> : <div className="account-deletion"><b>账号注销</b><span>提交后有 7 天撤销期，正式删除需管理员执行并记录审计日志。</span><button onClick={() => changeDeletion(false)}>申请注销账号</button></div>}
      </article>
    </section>
  </PortalFrame>;
}
