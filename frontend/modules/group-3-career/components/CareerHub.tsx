"use client";

/** 实习就业：页内三个标签 —— 岗位 / 校招公告 / 求职工作台（不新增一级导航）。 */

import { apiFetch } from "@/modules/shared/api/bmob-api";

import { useCallback, useEffect, useState } from "react";
import PortalFrame from "@/modules/shared/components/PortalFrame";
import CareerJobBoard from "./CareerJobBoard";
import CareerAnnouncementBoard from "./CareerAnnouncementBoard";
import CareerWorkbench from "./CareerWorkbench";

type Tab = "jobs" | "announcements" | "workbench";

export default function CareerHub() {
  const [tab, setTab] = useState<Tab>("jobs");
  const [toast, setToast] = useState("");
  const [badges, setBadges] = useState({ jobs: 0, applications: 0, announcementApplications: 0 });

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }, []);

  const loadBadges = useCallback(async () => {
    try {
      const [jobsRes, appsRes, annRes] = await Promise.all([
        apiFetch("/api/career/jobs?pageSize=1"),
        apiFetch("/api/career/applications"),
        apiFetch("/api/career/announcement-applications"),
      ]);
      const [jobsBody, appsBody, annBody] = await Promise.all([jobsRes.json(), appsRes.json(), annRes.json()]);
      setBadges({
        jobs: jobsBody.total ?? 0,
        applications: (appsBody.applications ?? []).length,
        announcementApplications: (annBody.applications ?? []).length,
      });
    } catch {
      // 徽标失败不打扰主流程
    }
  }, []);

  useEffect(() => { loadBadges(); }, [loadBadges, tab]);

  return <PortalFrame active="career" eyebrow="CAREER HUB" title="实习就业"
    subtitle="岗位大厅按匹配度找工作，校招公告一网打尽，工作台跟踪每一次投递。">
    <section className="career-workspace-tabs" aria-label="实习就业分区">
      <button className={tab === "jobs" ? "active" : ""} onClick={() => setTab("jobs")}>岗位 <b>{badges.jobs}</b></button>
      <button className={tab === "announcements" ? "active" : ""} onClick={() => setTab("announcements")}>校招公告</button>
      <button className={tab === "workbench" ? "active" : ""} onClick={() => setTab("workbench")}>
        求职工作台 <b>{badges.applications + badges.announcementApplications}</b></button>
    </section>

    {tab === "jobs" && <CareerJobBoard onToast={notify} onGoWorkbench={() => setTab("workbench")} />}
    {tab === "announcements" && <CareerAnnouncementBoard onToast={notify} onGoWorkbench={() => setTab("workbench")} />}
    {tab === "workbench" && <CareerWorkbench onToast={notify} />}

    {toast && <div className="portal-toast">✓ {toast}</div>}
  </PortalFrame>;
}
