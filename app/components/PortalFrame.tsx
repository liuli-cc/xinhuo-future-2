"use client";

import { apiFetch, cachedUserProfile, subscribeUserProfile } from "../../lib/bmob-api";

import Link from "next/link";
import { ReactNode, useEffect, useState, useSyncExternalStore } from "react";

export type Profile = {
  id: number;
  name: string;
  college: string;
  major: string;
  className: string;
  studentId: string;
  grade: string;
  email: string;
  phone: string;
  bio: string;
  role: "unknown" | "student" | "teacher" | "counselor" | "college_admin" | "school_admin" | "admin";
  accountStatus: "pending" | "active" | "rejected" | "suspended";
  accountReviewNote: string;
  forcePasswordChange: boolean;
  targetRole: string;
  developmentTrack: string;
  interests: string[];
  consentAt: number | null;
};

const fallback: Profile = { id: 0, name: "账户", college: "", major: "个人资料", className: "", studentId: "", grade: "", email: "", phone: "", bio: "", role: "unknown", accountStatus: "active", accountReviewNote: "", forcePasswordChange: false, targetRole: "探索方向", developmentTrack: "exploration", interests: [], consentAt: null };
const validRoles = new Set<Profile["role"]>(["student", "teacher", "counselor", "college_admin", "school_admin", "admin"]);

function clientProfileSnapshot() {
  const cached = cachedUserProfile<Profile>();
  return cached && validRoles.has(cached.role) ? cached : fallback;
}

let profileRequest: Promise<void> | null = null;
let profileVerifiedAt = 0;

function refreshProfile() {
  if (profileRequest) return profileRequest;
  if (clientProfileSnapshot() !== fallback && Date.now() - profileVerifiedAt < 30_000) return Promise.resolve();
  profileRequest = apiFetch("/api/auth/me")
    .then(async response => {
      if (response.status === 401) {
        window.location.replace("/");
        return null;
      }
      return response.ok ? response.json() : null;
    })
    .then(body => {
      if (body?.user) profileVerifiedAt = Date.now();
      if (body?.user?.forcePasswordChange && window.location.pathname !== "/account") window.location.replace("/account?required=1");
    })
    .catch(() => { /* 页面保持可用，后续数据请求仍会执行云端鉴权 */ })
    .finally(() => { profileRequest = null; });
  return profileRequest;
}

const nav = [
  { id: "dashboard", href: "/dashboard", icon: "首", label: "成长首页" },
  { id: "map", href: "/growth-map", icon: "图", label: "成长地图" },
  { id: "interview", href: "/interview", icon: "面", label: "模拟面试" },
  { id: "portrait", href: "/portrait", icon: "像", label: "能力画像" },
  { id: "ai", href: "/ai", icon: "策", label: "成长决策" },
  { id: "resources", href: "/resources", icon: "资", label: "成长资源" },
  { id: "career", href: "/career", icon: "职", label: "实习就业" },
];
const teacherNav = [
  { id: "teacher", href: "/teacher", icon: "师", label: "教师工作台" },
  { id: "resources", href: "/resources", icon: "资", label: "成长资源" },
];
const adminNav = [
  { id: "admin", href: "/admin", icon: "管", label: "管理中心" },
  { id: "resources", href: "/resources", icon: "资", label: "成长资源" },
];

export function useStudentProfile() {
  const profile = useSyncExternalStore(subscribeUserProfile, clientProfileSnapshot, () => fallback);
  useEffect(() => {
    void refreshProfile();
  }, []);
  return profile;
}

export default function PortalFrame({ active, eyebrow, title, subtitle, actions, children }: { active: string; eyebrow: string; title: string; subtitle: string; actions?: ReactNode; children: ReactNode }) {
  const profile = useStudentProfile();
  const [storageWarning, setStorageWarning] = useState(false);
  useEffect(() => {
    if (!["college_admin", "school_admin", "admin"].includes(profile.role)) return;
    apiFetch("/api/admin/overview")
      .then(response => response.ok ? response.json() : null)
      .then(body => setStorageWarning(Boolean(body?.overview?.storage?.warning)))
      .catch(() => { /* 管理页仍可手动查看 */ });
  }, [profile.role]);
  const logout = async () => {
    await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    window.location.href = "/";
  };
  const visibleNav = profile.role === "student"
    ? nav
    : ["teacher", "counselor"].includes(profile.role)
      ? teacherNav
      : ["college_admin", "school_admin", "admin"].includes(profile.role)
        ? adminNav
        : [];
  const homeHref = profile.role === "student" ? "/dashboard" : ["teacher", "counselor"].includes(profile.role) ? "/teacher" : ["college_admin", "school_admin", "admin"].includes(profile.role) ? "/admin" : "/";
  return (
    <main className="portal-shell">
      <aside className="portal-sidebar">
        <Link className="portal-brand" href={homeHref}><span><i /></span><b>薪火</b></Link>
        <nav>{visibleNav.map(item => {
  const isActive = active === item.id;
  return <Link key={item.id} className={isActive ? "active" : ""} href={item.href} title={item.label} aria-current={isActive ? "page" : undefined}>
    <i aria-hidden="true">{item.icon}</i>
    <span>{item.label}</span>
    {isActive && <em className="nav-active-indicator" />}
  </Link>;
})}</nav>
        <div className="portal-user"><span>{profile.name.slice(0, 1)}</span><div><b>{profile.name}</b><small>{profile.major}</small></div></div>
      </aside>
      <section className="portal-main">
        <header className="portal-topbar"><div><span className="status-dot" />腾讯云 · 数据安全存储{["college_admin", "school_admin", "admin"].includes(profile.role) && storageWarning && <Link className="admin-storage-alert" href="/admin">容量即将不足</Link>}</div><div className="portal-account-actions"><Link href="/account">账号与隐私</Link><button onClick={logout}>退出</button></div></header>
        <div className="portal-page">
          <div className="portal-title"><div><span>{eyebrow}</span><h1>{title}</h1><p>{subtitle}</p></div>{actions && <div className="portal-actions">{actions}</div>}</div>
          {children}
        </div>
      </section>
    </main>
  );
}
