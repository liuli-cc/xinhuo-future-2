# 薪火未来 — API 迁移清单

本文档追踪所有旧 CloudBase Node.js API 向 FastAPI 的迁移状态。

## Migration Status 说明

| Status | 含义 |
|--------|------|
| LEGACY | 仍在旧 CloudBase 后端运行 |
| DESIGNED | 已在 FastAPI 中定义路由和 Schema |
| MIGRATING | 正在迁移实现中 |
| READY | 已完成迁移，可独立运行 |
| VERIFIED | 通过测试验证，与前端兼容 |

---

## Phase 1 — 已完成迁移

这些 API 已在 FastAPI 后端实现基础功能:

| # | API | Method | 旧文件 | 调用页面 | Owner Group | FastAPI Module | Status |
|---|-----|--------|--------|----------|-------------|----------------|--------|
| 1 | `/api/health` | GET | index.js:1889 | System | Group1 | main.py | READY |
| 2 | `/api/v1/auth/me` | GET | index.js:1896-1899 | PortalFrame, page.tsx | Group1 | auth/router.py | READY |
| 3 | `/api/v1/auth/login` | POST | index.js:1895 | page.tsx | Group1 | auth/router.py | READY |
| 4 | `/api/v1/auth/logout` | POST | index.js:1900-1908 | PortalFrame | Group1 | auth/router.py | READY |
| 5 | `/api/v1/auth/register` | POST | index.js:1890-1891 | page.tsx | Group1 | auth/router.py | READY |
| 6 | `/api/v1/users/{id}` | GET | — | — | Group1 | users/router.py | READY |
| 7 | `/api/v1/reference/majors` | GET | — | — | Group1 | reference/router.py | READY |
| 8 | `/api/v1/reference/jobs` | GET | — | — | Group1 | reference/router.py | READY |
| 9 | `/api/v1/organization/colleges` | GET | — | — | Group1 | organization/router.py | READY |
| 10 | `/api/v1/organization/majors` | GET | — | — | Group1 | organization/router.py | READY |
| 11 | `/api/v1/files/upload` | POST | — | — | Group1 | files/router.py | READY |
| 12 | `/api/v1/imports/batches` | GET | — | — | Group1 | imports/router.py | READY |

---

## Phase 2 — 待迁移 (Group1: Users & Growth)

| # | 旧 API | Method | 旧 Handler | 调用页面 | Status |
|---|--------|--------|-----------|----------|--------|
| 13 | `/api/account` | PATCH | handleAccount | account/page.tsx | LEGACY |
| 14 | `/api/account/export` | GET | handleAccountExport | account/page.tsx | LEGACY |
| 15 | `/api/account/sessions` | GET/DELETE | handleAccountSessions | account/page.tsx | LEGACY |
| 16 | `/api/account/deletion` | GET/POST/DELETE | handleAccountDeletion | account/page.tsx | LEGACY |
| 17 | `/api/auth/recovery` | POST | handleRecovery | page.tsx | LEGACY |
| 18 | `/api/growth-path` | GET/POST/PUT/DELETE | handleGrowthPath | dashboard, growth-map | LEGACY |
| 19 | `/api/growth-path/evidence` | POST | handleGrowthEvidence | growth-map | LEGACY |
| 20 | `/api/evidence-files` | POST | handleEvidenceFiles | growth-map, portrait | LEGACY |
| 21 | `/api/portrait` | GET/POST/DELETE | handlePortrait | dashboard, portrait | LEGACY |
| 22 | `/api/cloud-state` | GET/PUT/DELETE | handleCloudState | ai, career, resources | LEGACY |
| 23 | `/api/management/accounts` | GET/PATCH | handleManagementAccounts | AccountManagementPanel | LEGACY |
| 24 | `/api/admin/evidence` | GET/PATCH | handleAdminEvidence | admin, teacher | LEGACY |
| 25 | `/api/admin/overview` | GET | handleAdminOverview | PortalFrame, admin | LEGACY |
| 26 | `/api/admin/audit` | GET | handleAdminAudit | admin | LEGACY |
| 27 | `/api/admin/staff` | GET/POST | handleAdminStaff | admin | LEGACY |
| 28 | `/api/admin/deletions` | GET/POST | handleAdminDeletions | admin | LEGACY |
| 29 | `/api/admin/recovery` | GET/POST | handleAdminRecovery | admin | LEGACY |
| 30 | `/api/mentors` | GET | handleMentors | resources | LEGACY |

---

## Phase 2 — 待迁移 (Group2: Career)

| # | 旧 API | Method | 旧 Handler | 调用页面 | Status |
|---|--------|--------|-----------|----------|--------|
| 31 | `/api/career/jobs` | GET/POST | handleCareerJobs | CareerWorkbench | LEGACY |
| 32 | `/api/career/jobs/parse` | POST | handleCareerParse | CareerJobDiscovery | LEGACY |
| 33 | `/api/career/jobs/:id/match` | POST | handleCareerJobAction | CareerWorkbench | LEGACY |
| 34 | `/api/career/jobs/:id/gap-tasks` | POST | handleCareerJobAction | CareerWorkbench | LEGACY |
| 35 | `/api/career/applications` | GET/POST | handleCareerApplications | CareerWorkbench, interview | LEGACY |
| 36 | `/api/career/applications/:id/events` | POST | handleCareerEvent | CareerWorkbench | LEGACY |

---

## Phase 2 — 待迁移 (Group3: AI & Interview)

| # | 旧 API | Method | 旧 Handler | 调用页面 | Status |
|---|--------|--------|-----------|----------|--------|
| 37 | `/api/decision` | GET/POST | handleDecision | ai/page.tsx | LEGACY |
| 38 | `/api/interview` | GET/POST | handleInterview | interview/page.tsx | LEGACY |
| 39 | `/api/interview/model` | POST | handleInterviewModel | interview/page.tsx | LEGACY |
| 40 | `/api/interview/resume/chunk` | POST | handleResumeChunk | ResumeUploader | LEGACY |
| 41 | `/api/interview/resume/parse` | POST | handleResumeParse | ResumeUploader | LEGACY |
| 42 | `/api/interview/resume/parse-text` | POST | handleResumeTextParse | interview/page.tsx | LEGACY |
| 43 | `/api/interview/job/parse` | POST | handleJobParse | interview/page.tsx | LEGACY |
| 44 | `/api/interview/plan` | POST | handleInterviewPlan | interview/page.tsx | LEGACY |
| 45 | `/api/interview/asr` | POST | handleAsr | ContinuousSpeechRecognition | LEGACY |
| 46 | `/api/interview/tts` | POST | handleTts | interview/page.tsx | LEGACY |
| 47 | `/api/interview/speech-metrics` | POST | handleSpeechMetrics | interview/page.tsx | LEGACY |
| 48 | `/api/interview/speech/status` | GET | — | interview/page.tsx | LEGACY |

---

## 兼容性注意事项

1. **路径前缀**: 旧后端使用 `/api/xxx`，新后端使用 `/api/v1/xxx`。
   第一阶段的兼容方案：前端通过 `NEXT_PUBLIC_API_BASE` 切换后端地址。
   未来可添加 `/api/` → `/api/v1/` 的路由兼容层。

2. **响应字段**: 新后端尽量保持与旧后端相同的 JSON 字段名 (camelCase)，
   但数据库使用 snake_case 列名。Pydantic Schema 负责转换。

3. **时间戳格式**: 旧后端使用 Unix 毫秒整数，新后端保持兼容。
   数据库 `created_at`/`updated_at` 使用 MySQL DATETIME。

4. **Session Cookie**: 新后端使用相同的 `xinhuo_session` Cookie 名称和格式。

## 迁移优先级建议

1. **Group1 优先**: auth, users, growth-path, evidence (核心用户功能)
2. **Group2 其次**: career (不依赖 interview)
3. **Group3 最后**: interview, decision (依赖 career 和 users)
