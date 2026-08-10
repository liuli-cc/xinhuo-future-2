"use client";

import { apiFetch } from "../../lib/bmob-api";

import { useCallback, useEffect, useState } from "react";
import AccountManagementPanel from "../components/AccountManagementPanel";
import PortalFrame, { useStudentProfile } from "../components/PortalFrame";

type ReviewItem = {
  id: number;
  studentId: string;
  studentName: string;
  taskTitle: string;
  title: string;
  dimension: string;
  detail: string;
  evidenceRef: string;
  evidenceDate: string;
  relevance: number;
  quality: number;
  contribution: number;
  attachmentId?: string | null;
  attachmentName?: string | null;
  attachmentBytes?: number | null;
  attachmentSha256?: string | null; attachmentUrl?: string | null;
};

function size(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 ** 2).toFixed(1)} MB`;
}

export default function TeacherPage() {
  const profile = useStudentProfile();
  const isTeacher = ["teacher", "counselor"].includes(profile.role);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({});
  const [reviewScores, setReviewScores] = useState<Record<number, { relevance: number; quality: number; contribution: number }>>({});
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), 3000);
    return () => window.clearTimeout(timer);
  }, [message]);

  const readReviews = useCallback(async () => {
    const response = await apiFetch("/api/admin/evidence");
    const body = await response.json() as { reviews?: ReviewItem[]; error?: string };
    if (!response.ok || !body.reviews) throw new Error(body.error || "学生佐证读取失败");
    setReviews(body.reviews);
  }, []);

  useEffect(() => {
    if (!profile.studentId || !isTeacher) return;
    readReviews().catch(reason => setError(reason instanceof Error ? reason.message : "学生佐证读取失败"));
  }, [isTeacher, profile.studentId, readReviews]);

  const review = async (id: number, status: "verified" | "rejected") => {
    const reviewerNote = (reviewNotes[id] ?? "").trim();
    const item = reviews.find(reviewItem => reviewItem.id === id);
    if (!item) return;
    if (status === "rejected" && reviewerNote.length < 2) {
      setError("驳回佐证时必须填写至少 2 个字的具体原因");
      return;
    }
    const metrics = reviewScores[id] ?? { relevance: item.relevance, quality: item.quality, contribution: item.contribution };
    setReviewingId(id); setError(""); setMessage("");
    try {
      const response = await apiFetch("/api/admin/evidence", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, reviewerNote, ...metrics }),
      });
      const body = await response.json() as { reviews?: ReviewItem[]; error?: string };
      if (!response.ok || !body.reviews) throw new Error(body.error || "佐证审核失败");
      setReviews(body.reviews);
      setReviewNotes(current => { const next = { ...current }; delete next[id]; return next; });
      setMessage(status === "verified" ? "佐证已核验并计入学生成长进度" : "佐证已驳回，学生可根据原因重新提交");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "佐证审核失败");
    } finally {
      setReviewingId(null);
    }
  };

  if (profile.role === "student") {
    return <PortalFrame active="teacher" eyebrow="TEACHER ONLY" title="教师工作台" subtitle="该页面仅向教师和辅导员开放。"><div className="empty-state"><span>×</span><h2>没有教师权限</h2><p>请使用已通过审核的教师账号登录。</p></div></PortalFrame>;
  }
  if (profile.role !== "unknown" && !isTeacher) {
    return <PortalFrame active="teacher" eyebrow="ADMIN ROUTING" title="教师工作台" subtitle="管理员请在管理中心处理全校账号。"><div className="empty-state"><span>→</span><h2>请前往管理中心</h2><p>管理员账号拥有更完整的全校管理与审计能力。</p><a className="account-export" href="/admin">进入管理中心</a></div></PortalFrame>;
  }

  return <PortalFrame
    active="teacher"
    eyebrow="CLASS OPERATIONS"
    title="教师工作台"
    subtitle={`负责范围：${profile.college} / ${profile.className || "尚未分配班级"}。账号和佐证均只能在该班级范围内审核。`}
  >
    {(error || message) && <div className={`account-feedback ${error ? "error" : ""}`}>{error || message}</div>}
    {!profile.className && <div className="admin-capacity-alert critical"><div><span>!</span><div><b>尚未分配负责班级</b><p>请联系管理员完善班级范围；未分配前不会显示任何学生账号或佐证。</p></div></div></div>}
    <AccountManagementPanel profile={profile} />
    <section className="portal-card admin-review-card teacher-evidence-review">
      <div className="admin-section-head"><div><span>STUDENT EVIDENCE REVIEW</span><h2>本班成长佐证审核</h2></div><b>{reviews.length} 条待处理</b></div>
      <p className="admin-review-intro">只有审核通过的真实材料才会增加学生任务进度。驳回时必须说明材料缺少什么或哪项信息不一致。</p>
      {reviews.length ? <div className="admin-review-list">{reviews.map(item => <article key={item.id}>
        <header><span>{item.studentName.slice(0, 1)}</span><div><b>{item.studentName}</b><small>{item.studentId} · {item.dimension} · {item.evidenceDate}</small></div><em>待审核</em></header>
        <h3>{item.taskTitle || item.title}</h3>
        <p><b>{item.title}</b>：{item.detail}</p>
        <div className="admin-evidence-ref"><span>可核验材料</span>{item.attachmentUrl ? <a href={item.attachmentUrl} target="_blank" rel="noreferrer">查看文件：{item.attachmentName} · {size(item.attachmentBytes ?? 0)} ↗</a> : /^https?:\/\//i.test(item.evidenceRef) ? <a href={item.evidenceRef} target="_blank" rel="noreferrer">打开成果链接 ↗</a> : <strong>{item.evidenceRef || "未提供"}</strong>}</div>
        {item.attachmentSha256 && <small className="evidence-hash">SHA-256：{item.attachmentSha256}</small>}
        <div className="review-score-grid">{(["relevance", "quality", "contribution"] as const).map(key => <label key={key}><span>{key === "relevance" ? "能力相关度" : key === "quality" ? "成果质量" : "个人贡献度"}</span><select value={(reviewScores[item.id] ?? item)[key]} onChange={event => setReviewScores(current => ({ ...current, [item.id]: { relevance: current[item.id]?.relevance ?? item.relevance, quality: current[item.id]?.quality ?? item.quality, contribution: current[item.id]?.contribution ?? item.contribution, [key]: Number(event.target.value) } }))}>{[40, 50, 60, 70, 80, 90, 100].map(value => <option value={value} key={value}>{value}</option>)}</select></label>)}</div>
        <textarea value={reviewNotes[item.id] ?? ""} onChange={event => setReviewNotes(current => ({ ...current, [item.id]: event.target.value }))} placeholder="审核说明；驳回时必须说明缺少的材料或错误信息" maxLength={300} />
        <footer><button disabled={reviewingId === item.id} onClick={() => review(item.id, "rejected")}>驳回并说明</button><button className="approve" disabled={reviewingId === item.id} onClick={() => review(item.id, "verified")}>{reviewingId === item.id ? "处理中…" : "确认有效并计入进度"}</button></footer>
      </article>)}</div> : <div className="admin-review-empty"><span>✓</span><div><b>本班暂无待审核佐证</b><p>学生提交真实材料后会自动出现在这里。</p></div></div>}
    </section>
  </PortalFrame>;
}
