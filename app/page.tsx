"use client";

import { apiFetch } from "../lib/bmob-api";

import { FormEvent, useEffect, useState } from "react";
import { nameIssue, passwordIssue, staffIdIssue, studentIdIssue, validEmail } from "../lib/auth";
import { imnuCollegeNames, isOfficialImnuCollege } from "../data/imnu-colleges";

type Registration = {
  accountType: "student" | "teacher";
  studentId: string;
  name: string;
  email: string;
  college: string;
  major: string;
  className: string;
  grade: string;
  password: string;
  confirmPassword: string;
  consent: boolean;
};

const emptyRegistration: Registration = {
  accountType: "student",
  studentId: "",
  name: "",
  email: "",
  college: "人工智能学院",
  major: "",
  className: "",
  grade: "2025级",
  password: "",
  confirmPassword: "",
  consent: false,
};

function destination(role: string, forcePasswordChange: boolean) {
  if (forcePasswordChange) return "/account?required=1";
  if (role === "student") return "/dashboard";
  if (role === "teacher" || role === "counselor") return "/teacher";
  return "/admin";
}

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "register" | "recovery">("login");
  const [login, setLogin] = useState({ studentId: "", password: "" });
  const [recovery, setRecovery] = useState({ studentId: "", name: "" });
  const [registration, setRegistration] = useState<Registration>(emptyRegistration);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch("/api/auth/me")
      .then(response => response.ok ? response.json() : null)
      .then(body => {
        if (body?.user) window.location.replace(destination(body.user.role, body.user.forcePasswordChange));
      })
      .catch(() => null);
  }, []);

  const changeMode = (next: "login" | "register" | "recovery") => {
    setMode(next);
    setError("");
    setNotice("");
  };
  const updateRegistration = (field: keyof Registration, value: string) => {
    setRegistration(current => ({ ...current, [field]: value }));
    if (error) setError("");
    if (notice) setNotice("");
  };

  const submitLogin = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await apiFetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(login) });
      const body = await response.json() as { user?: { role: string; forcePasswordChange: boolean }; error?: string };
      if (!response.ok || !body.user) throw new Error(body.error || "登录失败");
      window.location.href = destination(body.user.role, body.user.forcePasswordChange);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "登录失败");
      setSaving(false);
    }
  };

  const submitRegistration = async (event: FormEvent) => {
    event.preventDefault();
    const idProblem = registration.accountType === "teacher" ? staffIdIssue(registration.studentId.trim()) : studentIdIssue(registration.studentId.trim());
    const localProblem = idProblem
      || nameIssue(registration.name.trim())
      || (registration.accountType === "teacher" && !registration.email.trim() ? "教师注册必须填写工作邮箱" : "")
      || (!validEmail(registration.email.trim()) ? "邮箱格式不正确，例如 name@imnu.edu.cn" : "")
      || passwordIssue(registration.password)
      || (registration.password !== registration.confirmPassword ? "两次输入的密码不一致，请重新确认" : "")
      || (!isOfficialImnuCollege(registration.college) ? "请选择内蒙古师范大学二级学院官方名单中的院系" : "")
      || (!registration.major.trim() ? (registration.accountType === "teacher" ? "岗位或职称不能为空" : "专业不能为空") : "")
      || (!registration.className.trim() ? (registration.accountType === "teacher" ? "负责班级不能为空" : "班级不能为空") : "")
      || (!registration.consent ? "请先阅读并同意个人信息与成长数据使用说明" : "");
    if (localProblem) return setError(localProblem);
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await apiFetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(registration) });
      const body = await response.json() as { pending?: boolean; message?: string; error?: string };
      if (!response.ok || !body.pending) throw new Error(body.error || "注册失败");
      setRegistration(emptyRegistration);
      setMode("login");
      setNotice(body.message || "注册申请已提交，请等待审核");
      setSaving(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "注册失败");
      setSaving(false);
    }
  };
  const submitRecovery = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const response = await apiFetch("/api/auth/recovery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(recovery) });
      const body = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(body.error || "找回申请提交失败");
      setNotice(body.message ?? "申请已提交");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "找回申请提交失败"); }
    finally { setSaving(false); }
  };

  return <main className="setup-page auth-page">
    <header className="setup-brand"><span className="setup-logo"><i /></span><b>薪火</b><em>AI 大学生成长平台</em></header>
    <section className={`setup-shell auth-shell ${mode === "register" ? "registering" : ""}`}>
      <div className="setup-story auth-story">
        <span className="setup-kicker"><i>✦</i> PERSONAL GROWTH CLOUD</span>
        <h1>一人一档，持续记录每一步成长。</h1>
        <p>学生、教师和管理员使用各自独立账号。成长档案、班级审核与操作记录均保存在云端。</p>
        <div className="setup-steps">
          <div className="active"><span>01</span><b>选择学生或教师身份</b><small>学号、工号是唯一登录账号</small></div>
          <div><span>02</span><b>完成班级与身份审核</b><small>教师管理本班，管理员管理全校</small></div>
          <div><span>03</span><b>云端持续留痕</b><small>账号、佐证和审核记录可追溯</small></div>
        </div>
        <div className="privacy-note"><span>◈</span><div><b>账号数据加密传输</b><small>密码不会明文保存，学生之间的数据相互隔离</small></div></div>
      </div>

      <section className="profile-card auth-card">
        <div className="auth-tabs"><button className={mode === "login" ? "active" : ""} onClick={() => changeMode("login")}>登录</button><button className={mode === "register" ? "active" : ""} onClick={() => changeMode("register")}>注册账号</button><button className={mode === "recovery" ? "active" : ""} onClick={() => changeMode("recovery")}>找回密码</button></div>
        {mode === "login" ? <form onSubmit={submitLogin}>
          <div className="profile-card-head"><span>WELCOME BACK</span><h2>登录成长平台</h2><p>学生使用学号、教师使用工号，系统会自动进入对应工作台。</p></div>
          <div className="form-grid auth-form-grid">
            <label className="wide"><span>学号 / 工号</span><div><i>#</i><input value={login.studentId} onChange={event => setLogin(current => ({ ...current, studentId: event.target.value }))} placeholder="请输入 6-20 位数字账号" inputMode="numeric" autoComplete="username" /></div></label>
            <label className="wide"><span>密码</span><div><i>◇</i><input type="password" value={login.password} onChange={event => setLogin(current => ({ ...current, password: event.target.value }))} placeholder="请输入密码" autoComplete="current-password" /></div></label>
          </div>
          <div className={error || notice ? `form-error show ${notice ? "success" : ""}` : "form-error"}><span>{notice ? "✓" : "!"}</span>{error || notice || "登录信息有误"}</div>
          <button className={saving ? "submit-profile saving" : "submit-profile"} type="submit" disabled={saving}>{saving ? "正在验证账号…" : <>进入我的成长空间 <span>→</span></>}</button>
          <p className="agreement">学生、教师、管理员共用登录入口，权限由账号角色和班级范围决定</p>
        </form> : mode === "recovery" ? <form onSubmit={submitRecovery}>
          <div className="profile-card-head"><span>ACCOUNT RECOVERY</span><h2>申请找回密码</h2><p>平台暂未接入短信或邮件服务，由学校管理员核验后生成一次性临时密码。</p></div>
          <div className="form-grid auth-form-grid">
            <label className="wide"><span>学号 / 工号</span><div><i>#</i><input value={recovery.studentId} onChange={event => setRecovery(current => ({ ...current, studentId: event.target.value }))} placeholder="请输入账号" inputMode="numeric" autoComplete="username" /></div></label>
            <label className="wide"><span>账号姓名</span><div><i>○</i><input value={recovery.name} onChange={event => setRecovery(current => ({ ...current, name: event.target.value }))} placeholder="请输入注册时姓名" /></div></label>
          </div>
          <div className={error || notice ? `form-error show recovery-message ${notice ? "success" : ""}` : "form-error"}><span>{notice ? "✓" : "!"}</span>{error || notice || "请填写账号与姓名"}</div>
          <button className={saving ? "submit-profile saving" : "submit-profile"} type="submit" disabled={saving}>{saving ? "正在提交申请…" : <>提交找回申请 <span>→</span></>}</button>
          <p className="agreement">为防止账号枚举，无论信息是否匹配，页面都会返回相同提示</p>
        </form> : <form onSubmit={submitRegistration}>
          <div className="profile-card-head"><span>{registration.accountType === "teacher" ? "CREATE TEACHER ACCOUNT" : "CREATE STUDENT ACCOUNT"}</span><h2>{registration.accountType === "teacher" ? "注册教师账号" : "注册学生账号"}</h2><p>{registration.accountType === "teacher" ? "填写真实工号、院系和负责班级，提交后由管理员审核。" : "填写真实学籍与班级信息，提交后由本班教师或管理员审核。"}</p></div>
          <div className="registration-role-picker" role="group" aria-label="注册身份">
            <button type="button" className={registration.accountType === "student" ? "active" : ""} onClick={() => setRegistration(current => ({ ...current, accountType: "student", studentId: "", grade: "2025级", major: "", className: "" }))}><b>学生注册</b><small>进入个人成长空间</small></button>
            <button type="button" className={registration.accountType === "teacher" ? "active" : ""} onClick={() => setRegistration(current => ({ ...current, accountType: "teacher", studentId: "", grade: "", major: "", className: "" }))}><b>教师注册</b><small>进入班级审核工作台</small></button>
          </div>
          <div className="form-grid auth-form-grid">
            <label><span>姓名</span><div><i>○</i><input value={registration.name} onChange={event => updateRegistration("name", event.target.value)} placeholder="2-30 个字" autoComplete="name" /></div></label>
            <label><span>{registration.accountType === "teacher" ? "教师工号" : "学号"}</span><div><i>#</i><input value={registration.studentId} onChange={event => updateRegistration("studentId", event.target.value)} placeholder={registration.accountType === "teacher" ? "6-12 位数字" : "6-20 位数字"} inputMode="numeric" autoComplete="username" /></div></label>
            <label className="wide"><span>{registration.accountType === "teacher" ? "工作邮箱（必填）" : "邮箱（选填）"}</span><div><i>@</i><input type="email" value={registration.email} onChange={event => updateRegistration("email", event.target.value)} placeholder={registration.accountType === "teacher" ? "例如：name@imnu.edu.cn" : "用于后续账号通知"} autoComplete="email" /></div></label>
            <label><span>院系</span><div><i>▦</i><select value={registration.college} onChange={event => updateRegistration("college", event.target.value)}><option value="" disabled>请选择学院</option>{imnuCollegeNames.map(college => <option key={college} value={college}>{college}</option>)}</select></div></label>
            <label><span>{registration.accountType === "teacher" ? "岗位 / 职称" : "专业"}</span><div><i>⌘</i><input value={registration.major} onChange={event => updateRegistration("major", event.target.value)} placeholder={registration.accountType === "teacher" ? "例如：讲师" : "例如：计算机科学与技术"} /></div></label>
            <label><span>{registration.accountType === "teacher" ? "负责班级" : "班级"}</span><div><i>≡</i><input value={registration.className} onChange={event => updateRegistration("className", event.target.value)} placeholder="例如：计科25-1班" /></div></label>
            {registration.accountType === "student" && <label><span>年级</span><div><i>◇</i><select value={registration.grade} onChange={event => updateRegistration("grade", event.target.value)}>{["2022级", "2023级", "2024级", "2025级", "2026级"].map(grade => <option key={grade}>{grade}</option>)}</select></div></label>}
            <label><span>设置密码</span><div><i>●</i><input type="password" value={registration.password} onChange={event => updateRegistration("password", event.target.value)} placeholder="10-128 位，含大小写字母和数字" autoComplete="new-password" /></div></label>
            <label><span>确认密码</span><div><i>●</i><input type="password" value={registration.confirmPassword} onChange={event => updateRegistration("confirmPassword", event.target.value)} placeholder="再次输入密码" autoComplete="new-password" /></div></label>
          </div>
          <div className="password-requirements" aria-label="密码要求">
            <span className={registration.password.length >= 10 && registration.password.length <= 128 ? "met" : ""}>10-128 位</span>
            <span className={/[A-Z]/.test(registration.password) ? "met" : ""}>含大写字母</span>
            <span className={/[a-z]/.test(registration.password) ? "met" : ""}>含小写字母</span>
            <span className={/\d/.test(registration.password) ? "met" : ""}>含数字</span>
          </div>
          <div className={error ? "form-error show" : "form-error"}><span>!</span>{error || "注册信息尚未填写完整"}</div>
          <label className="privacy-consent"><input type="checkbox" checked={registration.consent} onChange={event => setRegistration(current => ({ ...current, consent: event.target.checked }))} /><span>我已阅读并同意：身份、班级、成长数据和审核记录将保存到腾讯云；平台按账号角色和班级范围控制访问。</span></label>
          <button className={saving ? "submit-profile saving" : "submit-profile"} type="submit" disabled={saving || !registration.consent}>{saving ? "正在提交审核…" : <>提交注册审核 <span>→</span></>}</button>
          <p className="agreement">{registration.accountType === "teacher" ? "教师账号由管理员审核通过后才能登录" : "学生账号由本班教师或管理员审核通过后才能登录，成长进度从 0 开始"}</p>
        </form>}
      </section>
    </section>
  </main>;
}
