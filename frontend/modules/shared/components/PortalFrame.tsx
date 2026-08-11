"use client";

import { apiFetch, cachedUserProfile, subscribeUserProfile } from "@/modules/shared/api/bmob-api";
import { useRouteMotion } from "@/modules/shared/motion/RouteMotionProvider";
import { MotionPreference, useMotionPreference } from "@/modules/shared/motion/motion-preference";
import {
  ArrowLeft,
  Bell,
  BookOpenText,
  Briefcase,
  CaretDown,
  ChartDonut,
  FireSimple,
  HouseLine,
  IdentificationCard,
  List,
  LockKey,
  MapTrifold,
  Robot,
  ShieldCheck,
  SignOut,
  SidebarSimple,
  Sparkle,
  UserCircleGear,
  UsersThree,
  X,
} from "@phosphor-icons/react";
import Link from "next/link";
import { ReactNode, useEffect, useRef, useState, useSyncExternalStore } from "react";

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
const roleLabels: Record<Profile["role"], string> = { unknown: "正在核验", student: "学生", teacher: "教师", counselor: "辅导员", college_admin: "学院管理员", school_admin: "学校管理员", admin: "平台管理员" };
const motionOptions: { label: string; value: MotionPreference }[] = [
  { value: "full", label: "完整动效" },
  { value: "reduced", label: "减少动效" },
  { value: "system", label: "跟随系统" },
];

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
    .catch(() => { /* 页面保持可用，后续数据请求仍会执行后端鉴权 */ })
    .finally(() => { profileRequest = null; });
  return profileRequest;
}

const studentNav = [
  { id: "dashboard", href: "/dashboard", icon: HouseLine, label: "成长首页", group: "总览" },
  { id: "map", href: "/growth-map", icon: MapTrifold, label: "成长地图", group: "规划" },
  { id: "portrait", href: "/portrait", icon: ChartDonut, label: "能力画像", group: "规划" },
  { id: "ai", href: "/ai", icon: Sparkle, label: "成长决策", group: "规划" },
  { id: "interview", href: "/interview", icon: Robot, label: "模拟面试", group: "实践" },
  { id: "resources", href: "/resources", icon: BookOpenText, label: "成长资源", group: "实践" },
  { id: "career", href: "/career", icon: Briefcase, label: "实习就业", group: "实践" },
];
const teacherNav = [
  { id: "teacher", href: "/teacher", icon: UsersThree, label: "教师工作台", group: "教学" },
  { id: "resources", href: "/resources", icon: BookOpenText, label: "成长资源", group: "教学" },
];
const adminNav = [
  { id: "admin", href: "/admin", icon: ShieldCheck, label: "管理中心", group: "治理" },
  { id: "resources", href: "/resources", icon: BookOpenText, label: "成长资源", group: "治理" },
];

export function useStudentProfile() {
  const profile = useSyncExternalStore(subscribeUserProfile, clientProfileSnapshot, () => fallback);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
    void refreshProfile();
  }, []);
  return hydrated ? profile : fallback;
}

export default function PortalFrame({
  active,
  eyebrow,
  title,
  subtitle,
  actions,
  children,
}: {
  active: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const profile = useStudentProfile();
  const { goBack } = useRouteMotion();
  const { preference: motionPreference, setPreference: setMotionPreference, systemReducedMotion } = useMotionPreference();
  const [storageWarning, setStorageWarning] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!["college_admin", "school_admin", "admin"].includes(profile.role)) return;
    apiFetch("/api/admin/overview")
      .then(response => response.ok ? response.json() : null)
      .then(body => setStorageWarning(Boolean(body?.overview?.storage?.warning)))
      .catch(() => { /* 管理页仍可手动查看 */ });
  }, [profile.role]);

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) setProfileOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  const logout = async () => {
    await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    window.location.href = "/";
  };
  const visibleNav = profile.role === "student"
    ? studentNav
    : ["teacher", "counselor"].includes(profile.role)
      ? teacherNav
      : ["college_admin", "school_admin", "admin"].includes(profile.role)
        ? adminNav
        : [];
  const homeHref = profile.role === "student" ? "/dashboard" : ["teacher", "counselor"].includes(profile.role) ? "/teacher" : ["college_admin", "school_admin", "admin"].includes(profile.role) ? "/admin" : "/";
  const groups = [...new Set(visibleNav.map(item => item.group))];
  const motionDescription = motionPreference === "system"
    ? `当前系统：${systemReducedMotion ? "减少动效" : "完整动效"}`
    : motionPreference === "reduced"
      ? "已减少位移与闪动反馈"
      : "已开启完整过渡与反馈";

  return <main className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
    <button className={`app-sidebar-scrim ${mobileOpen ? "visible" : ""}`} aria-label="关闭导航" onClick={() => setMobileOpen(false)} />
    <aside className={`app-sidebar ${mobileOpen ? "mobile-open" : ""}`}>
      <div className="app-sidebar-head">
        <Link className="app-brand" href={homeHref} aria-label="返回薪火首页">
          <span><FireSimple size={22} weight="fill" /></span><b>薪火</b><small>成长操作系统</small>
        </Link>
        <button className="app-sidebar-mobile-close" onClick={() => setMobileOpen(false)} aria-label="关闭菜单"><X size={20} /></button>
      </div>
      <nav className="app-navigation" aria-label="主要导航">
        {groups.map(group => <section key={group}>
          <span className="app-nav-group">{group}</span>
          {visibleNav.filter(item => item.group === group).map(item => {
            const isActive = active === item.id;
            const Icon = item.icon;
            return <Link key={item.id} className={isActive ? "active" : ""} href={item.href} title={item.label} aria-current={isActive ? "page" : undefined} onClick={() => setMobileOpen(false)}>
              <i aria-hidden="true"><Icon size={20} weight={isActive ? "fill" : "duotone"} /></i>
              <span>{item.label}</span>
              {isActive && <em className="app-nav-active" />}
            </Link>;
          })}
        </section>)}
      </nav>
      <div className="app-sidebar-foot">
        <div className="app-cloud-note"><ShieldCheck size={18} weight="duotone" /><span><b>云端档案已连接</b><small>权限和数据按角色隔离</small></span></div>
        <button className="app-sidebar-collapse" onClick={() => setCollapsed(value => !value)} aria-label={collapsed ? "展开侧栏" : "收起侧栏"}><SidebarSimple size={19} weight="duotone" /><span>{collapsed ? "展开" : "收起侧栏"}</span></button>
      </div>
    </aside>

    <section className="app-main">
      <header className="app-topbar">
        <div className="app-topbar-left">
          <button className="app-mobile-menu" onClick={() => setMobileOpen(true)} aria-label="打开菜单"><List size={21} /></button>
          <button className="app-back" onClick={goBack} aria-label="返回上一页"><ArrowLeft size={19} weight="bold" /><span>返回</span></button>
          <span className="app-title-divider" />
          <div className="app-breadcrumb"><small>{eyebrow || "薪火成长平台"}</small><b>{title}</b></div>
        </div>
        <div className="app-topbar-right">
          <span className="app-cloud-status"><i />平台服务已连接</span>
          <Link className="app-topbar-icon" href={profile.role === "student" ? "/growth-map" : homeHref} aria-label="成长提醒"><Bell size={20} weight="duotone" />{storageWarning && <i />}</Link>
          <div className="app-profile-menu" ref={profileMenuRef}>
            <button className="app-profile-trigger" onClick={() => setProfileOpen(value => !value)} aria-expanded={profileOpen} aria-haspopup="dialog">
              <span className="app-profile-avatar">{(profile.name || "账").slice(0, 1)}</span>
              <span className="app-profile-copy"><b>{profile.name}</b><small>{roleLabels[profile.role]}</small></span>
              <CaretDown size={14} weight="bold" />
            </button>
            {profileOpen && <div className="app-profile-popover" role="dialog" aria-label="账户与设置">
              <header><span className="app-profile-avatar large">{(profile.name || "账").slice(0, 1)}</span><div><b>{profile.name}</b><small>{profile.studentId || roleLabels[profile.role]}</small><p>{profile.major || profile.college || "个人资料"}</p></div></header>
              <nav>
                <Link href="/account#profile" onClick={() => setProfileOpen(false)}><IdentificationCard size={19} weight="duotone" /><span><b>个人信息</b><small>姓名、专业与发展目标</small></span></Link>
                <Link href="/account#security" onClick={() => setProfileOpen(false)}><LockKey size={19} weight="duotone" /><span><b>账号安全</b><small>密码与登录设备</small></span></Link>
                <Link href="/account#data-rights" onClick={() => setProfileOpen(false)}><UserCircleGear size={19} weight="duotone" /><span><b>设置与隐私</b><small>数据导出与注销</small></span></Link>
              </nav>
              <section className="app-motion-setting" aria-labelledby="app-motion-setting-label">
                <div className="app-motion-setting-head">
                  <Sparkle size={18} weight="duotone" aria-hidden="true" />
                  <span><b id="app-motion-setting-label">动效偏好</b><small>{motionDescription}</small></span>
                </div>
                <div className="app-motion-options" role="radiogroup" aria-labelledby="app-motion-setting-label">
                  {motionOptions.map(option => <button
                    key={option.value}
                    type="button"
                    className={motionPreference === option.value ? "active" : ""}
                    role="radio"
                    aria-checked={motionPreference === option.value}
                    onClick={() => setMotionPreference(option.value)}
                  >{option.label}</button>)}
                </div>
              </section>
              <button className="app-profile-logout" onClick={logout}><SignOut size={18} /><span>退出登录</span></button>
            </div>}
          </div>
        </div>
      </header>

      <div className="app-page">
        <div className="app-page-heading">
          <div><span>{eyebrow || "薪火成长平台"}</span><h1>{title}</h1><p>{subtitle}</p></div>
          {actions && <div className="app-page-actions">{actions}</div>}
        </div>
        <div className="app-page-content">{children}</div>
      </div>
    </section>
  </main>;
}
