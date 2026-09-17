"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { request, type StudioUser } from "./api/recruitment";
import styles from "../../app/enterprise/page.module.css";

export default function StudioLogin({ role, onLogin }: { role: "student" | "enterprise"; onLogin: (user: StudioUser) => void }) {
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const result = await request<{user: StudioUser}>("/auth/login", "POST", { studentId: account.trim(), password });
      if (result.user.role !== role) {
        await request("/auth/logout", "POST");
        throw new Error(`请使用${role === "student" ? "学生" : "企业"}账号登录`);
      }
      onLogin(result.user);
    } catch (e) { setError(e instanceof Error ? e.message : "登录失败"); }
    finally { setBusy(false); }
  }
  return <main className={styles.loginPage}><section className={styles.loginStory}><div className={styles.brand}><b>薪火未来</b></div><div className={styles.storyCopy}><h1>{role === "enterprise" ? "看见简历背后的成长轨迹。" : "让真实经历成为你的下一次机会。"}</h1><p>简历、成长证据与企业投递，在这里连接。</p></div></section><section className={styles.loginPanel}><div className={styles.loginCard}><h1>{role === "enterprise" ? "企业工作台" : "AI 简历工坊"}</h1><form className={styles.loginForm} onSubmit={submit}><label>账号<input required autoComplete="username" value={account} onChange={e => setAccount(e.target.value)} /></label><label>密码<input required type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></label>{error && <p role="alert">{error}</p>}<button disabled={busy}>{busy ? "登录中…" : "登录"}</button></form><Link href="/">返回首页</Link></div></section></main>;
}
