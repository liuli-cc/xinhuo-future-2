# 薪火未来 — API 迁移清单 (v2.0 修正版)

## Migration Status

| Status | 含义 |
|--------|------|
| LEGACY | 仍在旧 CloudBase 后端运行 |
| DESIGNED | 已在 FastAPI 定义路由/Schema |
| READY | 已完成迁移 |
| VERIFIED | 通过测试 |

---

## Shared/Core API

| # | API | Method | 旧 Handler | 调用页面 | Status |
|---|-----|--------|-----------|----------|--------|
| 1 | `/api/health` | GET | index.js:1889 | System | READY |
| 2 | `/api/v1/auth/me` | GET | index.js:1896 | PortalFrame | READY |
| 3 | `/api/v1/auth/login` | POST | index.js:1895 | page.tsx | READY |
| 4 | `/api/v1/auth/logout` | POST | index.js:1900 | PortalFrame | READY |
| 5 | `/api/v1/auth/register` | POST | index.js:1890 | page.tsx | READY |
| 6 | `/api/auth/recovery` | POST | handleRecovery | page.tsx | LEGACY |
| 7 | `/api/account` | PATCH | handleAccount | account | LEGACY |
| 8 | `/api/account/export` | GET | handleAccountExport | account | LEGACY |
| 9 | `/api/account/sessions` | GET/DEL | handleAccountSessions | account | LEGACY |
| 10 | `/api/account/deletion` | GET/POST/DEL | handleAccountDeletion | account | LEGACY |
| 11 | `/api/management/accounts` | GET/PATCH | handleManagementAccounts | AccountPanel | LEGACY |
| 12 | `/api/admin/overview` | GET | handleAdminOverview | PortalFrame, admin | LEGACY |
| 13 | `/api/admin/audit` | GET | handleAdminAudit | admin | LEGACY |
| 14 | `/api/admin/staff` | GET/POST | handleAdminStaff | admin | LEGACY |
| 15 | `/api/admin/deletions` | GET/POST | handleAdminDeletions | admin | LEGACY |
| 16 | `/api/admin/recovery` | GET/POST | handleAdminRecovery | admin | LEGACY |
| 17 | `/api/mentors` | GET | handleMentors | resources | LEGACY |
| 18 | `/api/evidence-files` | POST | handleEvidenceFiles | growth-map,portrait | LEGACY |

---

## Group2 API (任务匹配 + 榜样激励)

| # | API | Method | 旧 Handler | 调用页面 | Status |
|---|-----|--------|-----------|----------|--------|
| 19 | `/api/growth-path` | GET/POST/PUT/DEL | handleGrowthPath | dashboard,growth-map | LEGACY |
| 20 | `/api/growth-path/evidence` | POST | handleGrowthEvidence | growth-map | LEGACY |
| 21 | `/api/portrait` | GET/POST/DEL | handlePortrait | dashboard,portrait | LEGACY |
| 22 | `/api/cloud-state` | GET/PUT/DEL | handleCloudState | ai,career,resources | LEGACY |
| 23 | `/api/admin/evidence` | GET/PATCH | handleAdminEvidence | admin,teacher | LEGACY |
| 24 | `/api/decision` | GET/POST | handleDecision | ai/page.tsx | LEGACY |

---

## Group1 API (AI简历 + AI模拟面试)

| # | API | Method | 旧 Handler | 调用页面 | Status |
|---|-----|--------|-----------|----------|--------|
| 25 | `/api/interview` | GET/POST | handleInterview | interview | LEGACY |
| 26 | `/api/interview/model` | POST | handleInterviewModel | interview | LEGACY |
| 27 | `/api/interview/resume/chunk` | POST | handleResumeChunk | ResumeUploader | LEGACY |
| 28 | `/api/interview/resume/parse` | POST | handleResumeParse | ResumeUploader | LEGACY |
| 29 | `/api/interview/resume/parse-text` | POST | handleResumeTextParse | interview | LEGACY |
| 30 | `/api/interview/job/parse` | POST | handleJobParse | interview | LEGACY |
| 31 | `/api/interview/plan` | POST | handleInterviewPlan | interview | LEGACY |
| 32 | `/api/interview/asr` | POST | handleAsr | SpeechRecognition | LEGACY |
| 33 | `/api/interview/tts` | POST | handleTts | interview | LEGACY |
| 34 | `/api/interview/speech-metrics` | POST | handleSpeechMetrics | interview | LEGACY |
| 35 | `/api/interview/speech/status` | GET | — | interview | LEGACY |

---

## Group3 API (智能岗位匹配)

| # | API | Method | 旧 Handler | 调用页面 | Status |
|---|-----|--------|-----------|----------|--------|
| 36 | `/api/career/jobs` | GET/POST | handleCareerJobs | CareerWorkbench | LEGACY |
| 37 | `/api/career/jobs/parse` | POST | handleCareerParse | CareerJobDiscovery | LEGACY |
| 38 | `/api/career/jobs/:id/match` | POST | handleCareerJobAction | CareerWorkbench | LEGACY |
| 39 | `/api/career/jobs/:id/gap-tasks` | POST | handleCareerJobAction | CareerWorkbench | LEGACY |
| 40 | `/api/career/applications` | GET/POST | handleCareerApplications | CareerWorkbench,interview | LEGACY |
| 41 | `/api/career/applications/:id/events` | POST | handleCareerEvent | CareerWorkbench | LEGACY |

---

## 迁移进度统计

| Owner | 总数 | READY | LEGACY | NEW (待设计) |
|-------|------|-------|--------|-------------|
| SHARED | 18 | 5 | 13 | 0 |
| GROUP1 | 11 | 0 | 11 | 4 |
| GROUP2 | 6 | 0 | 6 | 7 |
| GROUP3 | 6 | 0 | 6 | 6 |
| **Total** | **41** | **5** | **36** | **17** |

---

## 迁移优先级

### Phase 2.1 — Shared 补充 (Group1 协作)
1. PATCH `/api/account` (个人资料修改)
2. POST `/api/evidence-files` (文件上传 — 被 Group2 依赖)

### Phase 2.2 — Group2 首批 (不依赖其他组)
3. GET/POST `/api/growth-path` (成长任务)
4. GET/POST/DELETE `/api/portrait` (能力画像)
5. GET/POST `/api/decision` (成长决策)

### Phase 2.3 — Group3 首批 (依赖 Shared 文件)
6. GET/POST `/api/career/jobs` (岗位管理)
7. GET/POST `/api/career/applications` (投递)

### Phase 2.4 — Group1 首批 (依赖 Shared 文件 + Group3 岗位)
8. GET/POST `/api/interview` (面试)
9. POST `/api/interview/model` (LLM代理)
10. POST `/api/interview/resume/parse` (简历解析)
