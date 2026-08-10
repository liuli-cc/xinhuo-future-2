# 薪火未来 — API 契约文档

## 基础信息

- **Base URL**: `/api/v1`
- **Content-Type**: `application/json; charset=utf-8`
- **认证方式**: Bearer Token (`Authorization: Bearer <token>`) 或 HttpOnly Cookie (`xinhuo_session`)
- **CORS**: 支持 `http://localhost:3000` 和配置的 `WEB_ORIGIN`

## 通用响应格式

### 成功
```json
{
  "user": { ... }
}
```
或
```json
{
  "data": [...],
  "total": 100
}
```

### 错误
```json
{
  "success": false,
  "data": null,
  "message": "错误描述",
  "error_code": "unauthorized",
  "request_id": "..."
}
```

**注意**: 第一阶段保持与旧前端兼容的响应格式。未来可统一为 `{success, data, message, error_code}` 标准格式。

## 公共ID体系

所有模块必须引用统一ID:

| ID | 说明 | 类型 |
|----|------|------|
| `user_id` | 用户账号ID | int |
| `student_id` | 学生档案ID (student_profiles.id) | int |
| `teacher_id` | 教师档案ID (teacher_profiles.id) | int |
| `college_id` | 学院ID | int |
| `major_standard_id` | 标准专业ID (ref_major_standard.id) | int |
| `major_program_id` | 学校专业ID (university_major_programs.id) | int |
| `job_standard_id` | 标准岗位ID (ref_job_standard.id) | int |
| `employment_id` | 就业记录ID | int |
| `evidence_id` | 证据ID | int |
| `file_id` | 文件ID | string (UUID) |

---

## Phase 1 API 清单 (已实现基础)

### Auth

| Method | Path | Status | Owner | Description |
|--------|------|--------|-------|-------------|
| GET | `/api/v1/auth/me` | READY | Group1 | 当前用户信息 |
| POST | `/api/v1/auth/login` | READY | Group1 | 登录 |
| POST | `/api/v1/auth/logout` | READY | Group1 | 登出 |
| POST | `/api/v1/auth/register` | READY | Group1 | 注册 |

**请求示例**:
```
POST /api/v1/auth/login
{
  "studentId": "20251106001",
  "password": "Password123"
}

Response 200:
{
  "user": { "id": 1, "studentId": "20251106001", "name": "张三", ... },
  "sessionToken": "abc123..."
}
```

### Users

| Method | Path | Status | Owner | Description |
|--------|------|--------|-------|-------------|
| GET | `/api/v1/users/{id}` | READY | Group1 | 用户公开信息 |
| PATCH | `/api/v1/users/{id}` | READY | Group1 | 更新个人资料 |

### Reference (标准字典)

| Method | Path | Status | Owner | Description |
|--------|------|--------|-------|-------------|
| GET | `/api/v1/reference/majors` | READY | Group1 | 标准专业列表 (支持筛选) |
| GET | `/api/v1/reference/majors/disciplines` | READY | Group1 | 学科门类列表 |
| GET | `/api/v1/reference/majors/{id}` | READY | Group1 | 单个标准专业 |
| GET | `/api/v1/reference/jobs` | READY | Group1 | 标准岗位列表 |
| GET | `/api/v1/reference/jobs/domains` | READY | Group1 | 岗位大类列表 |
| GET | `/api/v1/reference/jobs/{id}` | READY | Group1 | 单个标准岗位 |
| GET | `/api/v1/reference/codes/{namespace}` | READY | Group1 | 代码值列表 |

### Organization (学校组织)

| Method | Path | Status | Owner | Description |
|--------|------|--------|-------|-------------|
| GET | `/api/v1/organization/universities` | READY | Group1 | 大学列表 |
| GET | `/api/v1/organization/colleges` | READY | Group1 | 学院列表 |
| GET | `/api/v1/organization/colleges/{id}` | READY | Group1 | 单个学院 |
| GET | `/api/v1/organization/majors` | READY | Group1 | 学校专业列表 |
| GET | `/api/v1/organization/majors/{id}` | READY | Group1 | 单个学校专业 |

### Files (文件)

| Method | Path | Status | Owner | Description |
|--------|------|--------|-------|-------------|
| POST | `/api/v1/files/upload` | READY | Group1 | 文件上传 |
| GET | `/api/v1/files/{id}` | READY | Group1 | 文件元数据 |

### Imports (数据导入)

| Method | Path | Status | Owner | Description |
|--------|------|--------|-------|-------------|
| GET | `/api/v1/imports/batches` | READY | Group1 | 导入批次列表 |
| GET | `/api/v1/imports/batches/{id}` | READY | Group1 | 导入批次详情 |
| GET | `/api/v1/imports/batches/{id}/rows` | READY | Group1 | 批次数据行 |

### System

| Method | Path | Status | Owner | Description |
|--------|------|--------|-------|-------------|
| GET | `/health` | READY | Group1 | 健康检查 |
| GET | `/api/health` | READY | Group1 | 健康检查 (兼容旧路径) |

---

## Phase 2 API (尚未实现 — 待后续迁移)

这些API已在旧CloudBase后端存在，需要在第二阶段逐步迁移:

### Growth & Evidence (Group1)

| Method | Path | Old Handler | Status |
|--------|------|-------------|--------|
| GET/POST | `/api/growth-path` | handleGrowthPath | LEGACY |
| POST | `/api/growth-path/evidence` | handleGrowthEvidence | LEGACY |
| POST | `/api/evidence-files` | handleEvidenceFiles | LEGACY |
| GET/POST/DELETE | `/api/portrait` | handlePortrait | LEGACY |
| GET/PUT/DELETE | `/api/cloud-state` | handleCloudState | LEGACY |

### Account Management (Group1)

| Method | Path | Old Handler | Status |
|--------|------|-------------|--------|
| PATCH | `/api/account` | handleAccount | LEGACY |
| GET | `/api/account/export` | handleAccountExport | LEGACY |
| GET/DELETE | `/api/account/sessions` | handleAccountSessions | LEGACY |
| GET/POST/DELETE | `/api/account/deletion` | handleAccountDeletion | LEGACY |

### Career (Group2)

| Method | Path | Old Handler | Status |
|--------|------|-------------|--------|
| GET/POST | `/api/career/jobs` | handleCareerJobs | LEGACY |
| POST | `/api/career/jobs/parse` | handleCareerParse | LEGACY |
| POST | `/api/career/jobs/:id/match` | handleCareerJobAction | LEGACY |
| POST | `/api/career/jobs/:id/gap-tasks` | handleCareerJobAction | LEGACY |
| GET/POST | `/api/career/applications` | handleCareerApplications | LEGACY |
| POST | `/api/career/applications/:id/events` | handleCareerEvent | LEGACY |

### Decision / AI (Group3)

| Method | Path | Old Handler | Status |
|--------|------|-------------|--------|
| GET/POST | `/api/decision` | handleDecision | LEGACY |

### Interview (Group3)

| Method | Path | Old Handler | Status |
|--------|------|-------------|--------|
| GET/POST | `/api/interview` | handleInterview | LEGACY |
| POST | `/api/interview/model` | handleInterviewModel | LEGACY |
| POST | `/api/interview/resume/chunk` | handleResumeChunk | LEGACY |
| POST | `/api/interview/resume/parse` | handleResumeParse | LEGACY |
| POST | `/api/interview/resume/parse-text` | handleResumeTextParse | LEGACY |
| POST | `/api/interview/job/parse` | handleJobParse | LEGACY |
| POST | `/api/interview/plan` | handleInterviewPlan | LEGACY |
| POST | `/api/interview/asr` | handleAsr | LEGACY |
| POST | `/api/interview/tts` | handleTts | LEGACY |
| POST | `/api/interview/speech-metrics` | handleSpeechMetrics | LEGACY |
| GET | `/api/interview/speech/status` | handleSpeechStatus | LEGACY |

### Admin (Group1)

| Method | Path | Old Handler | Status |
|--------|------|-------------|--------|
| GET/PATCH | `/api/management/accounts` | handleManagementAccounts | LEGACY |
| GET/PATCH | `/api/admin/evidence` | handleAdminEvidence | LEGACY |
| GET | `/api/admin/overview` | handleAdminOverview | LEGACY |
| GET | `/api/admin/audit` | handleAdminAudit | LEGACY |
| GET/POST | `/api/admin/staff` | handleAdminStaff | LEGACY |
| GET/POST | `/api/admin/deletions` | handleAdminDeletions | LEGACY |
| GET/POST | `/api/admin/recovery` | handleAdminRecovery | LEGACY |

### Resources

| Method | Path | Old Handler | Status |
|--------|------|-------------|--------|
| GET | `/api/mentors` | handleMentors | LEGACY |

---

## API 命名约定

### 路径命名
- 资源名使用复数或不可数名词
- 层级关系: `/resource/{id}/sub-resource`
- 版本: `/api/v1/`

### 查询参数
- 分页: `?limit=100&offset=0`
- 筛选: `?discipline=工学&search=计算机`
- 排序: 后续按需添加

### 请求/响应
- JSON body
- 字段使用 camelCase（兼容现有前端）
- 数据库字段使用 snake_case
