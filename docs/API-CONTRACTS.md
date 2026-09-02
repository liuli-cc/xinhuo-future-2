# 薪火未来 — API 契约文档 (v2.0 修正版)

## 基础信息

- **Base URL**: `/api/v1`
- **Content-Type**: `application/json; charset=utf-8`
- **认证**: Bearer Token 或 HttpOnly Cookie (`xinhuo_session`)

---

## 公共 ID 体系

所有模块必须使用统一 ID，禁止各组自建独立的 Student/Candidate/UserProfile 等概念:

| ID | 类型 | Owner | 说明 |
|----|------|-------|------|
| `user_id` | int | SHARED | 用户账号 ID |
| `student_id` / `student_profile_id` | int | SHARED | 学生档案 ID |
| `teacher_id` | int | SHARED | 教师档案 ID |
| `college_id` | int | SHARED | 学院 ID |
| `major_standard_id` | int | SHARED | 标准专业 ID |
| `major_program_id` | int | SHARED | 学校专业 ID |
| `job_standard_id` | int | SHARED | 标准岗位 ID |
| `evidence_id` | int | GROUP2 | 证据 ID |
| `portrait_id` | int | GROUP2 | 画像 ID |
| `resume_id` | str | GROUP1 | 简历 ID |
| `interview_session_id` | str | GROUP1 | 面试记录 ID |
| `career_job_id` | str | GROUP3 | 岗位快照 ID |
| `match_id` | str | GROUP3 | 匹配结果 ID |
| `file_id` | str | SHARED | 文件 ID |

---

## Shared/Core API (Phase 1 已实现)

### Auth

| Method | Path | Owner |
|--------|------|-------|
| GET | `/api/v1/auth/me` | SHARED |
| POST | `/api/v1/auth/login` | SHARED |
| POST | `/api/v1/auth/logout` | SHARED |
| POST | `/api/v1/auth/register` | SHARED |

### Users

| Method | Path | Owner |
|--------|------|-------|
| GET | `/api/v1/users/{id}` | SHARED |
| PATCH | `/api/v1/users/{id}` | SHARED |

### Reference

| Method | Path | Owner |
|--------|------|-------|
| GET | `/api/v1/reference/majors` | SHARED |
| GET | `/api/v1/reference/jobs` | SHARED |
| GET | `/api/v1/reference/codes/{ns}` | SHARED |

### Organization

| Method | Path | Owner |
|--------|------|-------|
| GET | `/api/v1/organization/colleges` | SHARED |
| GET | `/api/v1/organization/majors` | SHARED |

### Files

| Method | Path | Owner |
|--------|------|-------|
| POST | `/api/v1/files/upload` | SHARED |
| GET | `/api/v1/files/{id}` | SHARED |

### Imports

| Method | Path | Owner |
|--------|------|-------|
| GET | `/api/v1/imports/batches` | SHARED |
| GET | `/api/v1/imports/batches/{id}` | SHARED |

### System

| Method | Path | Owner |
|--------|------|-------|
| GET | `/health` | SHARED |

---

## Phase 2 API — Group2 (任务匹配 + 榜样激励)

迁移自旧 CloudBase 后端 + 新增功能:

| Method | Path | Status | 对应旧API |
|--------|------|--------|-----------|
| GET/POST | `/api/v1/growth/tasks` | DESIGNED | `/api/growth-path` |
| GET/POST | `/api/v1/growth/evidence` | DESIGNED | `/api/growth-path/evidence` |
| GET/POST/DELETE | `/api/v1/growth/portrait` | DESIGNED | `/api/portrait` |
| GET/PUT/DELETE | `/api/v1/growth/cloud-state` | DESIGNED | `/api/cloud-state` |
| GET/PATCH | `/api/v1/growth/admin/evidence` | DESIGNED | `/api/admin/evidence` |
| GET/POST | `/api/v1/growth/decision` | DESIGNED | `/api/decision` |
| GET/POST | `/api/v1/growth/assessments` | NEW | — |
| GET | `/api/v1/growth/assessments/{id}` | NEW | — |
| GET | `/api/v1/growth/portrait/{user_id}` | NEW | — |
| GET | `/api/v1/growth/role-models` | NEW | — |
| GET | `/api/v1/growth/role-models/{id}` | NEW | — |
| POST | `/api/v1/growth/role-models/match` | NEW | — |

## Phase 2 API — Group1 (AI简历 + AI模拟面试)

| Method | Path | Status | 对应旧API |
|--------|------|--------|-----------|
| GET/POST | `/api/v1/interview/sessions` | DESIGNED | `/api/interview` |
| POST | `/api/v1/interview/model` | DESIGNED | `/api/interview/model` |
| POST | `/api/v1/interview/resume/parse` | DESIGNED | `/api/interview/resume/parse` |
| POST | `/api/v1/interview/resume/chunk` | DESIGNED | `/api/interview/resume/chunk` |
| POST | `/api/v1/interview/job/parse` | DESIGNED | `/api/interview/job/parse` |
| POST | `/api/v1/interview/plan` | DESIGNED | `/api/interview/plan` |
| POST | `/api/v1/interview/asr` | DESIGNED | `/api/interview/asr` |
| POST | `/api/v1/interview/tts` | DESIGNED | `/api/interview/tts` |
| POST | `/api/v1/interview/speech-metrics` | DESIGNED | `/api/interview/speech-metrics` |
| GET/POST | `/api/v1/resumes` | NEW | — |
| GET | `/api/v1/resumes/{id}` | NEW | — |
| POST | `/api/v1/resumes/{id}/generate` | NEW | — |
| GET | `/api/v1/resumes/templates` | NEW | — |

## Phase 2 API — Group3 (智能岗位匹配)

| Method | Path | Status | 对应旧API |
|--------|------|--------|-----------|
| GET/POST | `/api/v1/career/jobs` | DESIGNED | `/api/career/jobs` |
| POST | `/api/v1/career/jobs/parse` | DESIGNED | `/api/career/jobs/parse` |
| POST | `/api/v1/career/jobs/{id}/match` | DESIGNED | `/api/career/jobs/:id/match` |
| POST | `/api/v1/career/jobs/{id}/gap-tasks` | DESIGNED | `/api/career/jobs/:id/gap-tasks` |
| GET/POST | `/api/v1/career/applications` | DESIGNED | `/api/career/applications` |
| POST | `/api/v1/career/applications/{id}/events` | DESIGNED | `/api/career/applications/:id/events` |
| GET/POST | `/api/v1/career/employers` | NEW | — |
| GET | `/api/v1/career/employers/{id}` | NEW | — |
| POST | `/api/v1/career/candidate-pushes` | NEW | — |
| GET | `/api/v1/career/candidate-pushes/{id}` | NEW | — |
| POST | `/api/v1/career/authorizations` | NEW | — |

---

## 跨组数据 DTO

在 `backend/app/schemas/` 下建立公共 DTO:

```python
# backend/app/schemas/student.py
class StudentSummary(BaseModel):   # Shared → All
    user_id: int
    student_no: str
    name: str
    college: str
    major: str
    grade: str

# backend/app/schemas/portrait.py
class StudentPortraitSummary(BaseModel):  # Group2 → Group1, Group3
    user_id: int
    dimensions: dict  # {专业学习: 85, 项目实践: 72, ...}
    overall_score: int
    confidence: int

# backend/app/schemas/job.py
class TargetJob(BaseModel):  # Group3 → Group1, Group2
    job_id: str
    title: str
    company: str
    description: str
    requirements: list

# backend/app/schemas/resume.py
class ResumeSummary(BaseModel):  # Group1 → Group3
    resume_id: str
    title: str
    version: int
    target_job_id: str

# backend/app/schemas/interview.py
class InterviewAssessmentSummary(BaseModel):  # Group1 → Group3
    session_id: str
    overall_score: int
    weaknesses: list
    strengths: list
```
