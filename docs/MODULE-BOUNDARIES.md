# 薪火未来 — 模块边界与数据所有权 (v2.0 修正版)

## 核心原则

1. **Shared/Core** 拥有所有平台基础数据和基础设施
2. **Group1/2/3** 各自拥有业务数据，不拥有平台基础
3. **只有 Owner 可以直接写入** (INSERT/UPDATE/DELETE)
4. **其他模块只读** (SELECT)，通过 Owner 提供的 Service 接口获取
5. **禁止跨模块直接修改他人数据**

---

## 表 → Owner 映射 (完整版)

### Shared/Core — 平台基础

| 表名 | Owner | Group1 | Group2 | Group3 |
|------|-------|--------|--------|--------|
| `users` | SHARED | R | R | R |
| `student_profiles` | SHARED | R | R | R |
| `student_private_profiles` | SHARED | — | — | — |
| `teacher_profiles` | SHARED | R | R | R |
| `user_sessions` | SHARED | — | — | — |
| `ref_major_standard` | SHARED | R | R | R |
| `ref_job_standard` | SHARED | R | R | R |
| `ref_code_values` | SHARED | R | R | R |
| `universities` | SHARED | R | R | R |
| `colleges` | SHARED | R | R | R |
| `university_major_programs` | SHARED | R | R | R |
| `student_admissions` | SHARED | — | R | R |
| `student_admission_scores` | SHARED | — | R | R |
| `audit_logs` | SHARED | W* | W* | W* |
| `recovery_requests` | SHARED | — | — | — |
| `deletion_requests` | SHARED | — | — | — |
| `files` | SHARED | RW | RW | RW |
| `data_import_batches` | SHARED | — | — | — |
| `data_import_rows` | SHARED | — | — | — |
| `cloud_states` | SHARED | R | R | R |

*\* audit_logs: 各组通过 Shared 提供的 Service 写入审计日志*

### Group1 — AI简历 + AI模拟面试

| 表名 | Owner | Group2 | Group3 |
|------|-------|--------|--------|
| `generated_resumes` | GROUP1 | R | R |
| `resume_templates` | GROUP1 | — | — |
| `interview_sessions` | GROUP1 | R | R |
| `resume_upload_chunks` | GROUP1 | — | — |

### Group2 — 任务匹配 + 榜样激励

| 表名 | Owner | Group1 | Group3 |
|------|-------|--------|--------|
| `baseline_assessments` | GROUP2 | — | R |
| `student_portraits` | GROUP2 | R | R |
| `growth_plans` | GROUP2 | — | R |
| `growth_tasks` | GROUP2 | — | R |
| `growth_task_progress` | GROUP2 | — | R |
| `evidence` | GROUP2 | — | — |
| `evidence_reviews` | GROUP2 | — | — |
| `evidence_files` | GROUP2 | — | — |
| `role_models` | GROUP2 | — | — |
| `role_model_experiences` | GROUP2 | — | — |
| `role_model_milestones` | GROUP2 | — | — |
| `role_model_matches` | GROUP2 | — | — |

### Group3 — 智能岗位匹配

| 表名 | Owner | Group1 | Group2 |
|------|-------|--------|--------|
| `employers` | GROUP3 | R | R |
| `career_jobs` | GROUP3 | R | R |
| `career_matches` | GROUP3 | — | R |
| `career_applications` | GROUP3 | — | — |
| `career_events` | GROUP3 | — | — |
| `recommendation_feedback` | GROUP3 | — | — |
| `student_employments` | GROUP3 | — | R |
| `employment_reviews` | GROUP3 | — | — |
| `study_abroad_records` | GROUP3 | — | R |
| `graduate_administration` | GROUP3 | — | — |
| `candidate_pushes` | GROUP3 | — | — |
| `student_data_authorizations` | GROUP3 | — | — |

---

## 跨组写入规则

各组只能通过 Owner 的 Service 写入他人的数据：

```python
# ✅ 正确：Group3 通过 Group2 Service 读取画像
from app.modules.growth.service import PortraitService
portrait = await PortraitService(db).get_portrait(user_id)

# ❌ 错误：Group3 直接查询 Group2 的数据
from app.modules.growth.model import StudentPortrait
portrait = await db.get(StudentPortrait, user_id)

# ✅ 正确：Group3 通过 Shared 写入审计日志
from app.modules.admin.service import AuditService
await AuditService(db).log(action="career.match_calculated", ...)
```

---

## 文件目录所有权

```
backend/app/core/                  → SHARED (所有组可提PR，需 Review)
backend/app/db/                    → SHARED
backend/app/main.py                → SHARED
backend/alembic/                   → SHARED

backend/app/modules/auth/          → SHARED
backend/app/modules/users/         → SHARED
backend/app/modules/reference/     → SHARED
backend/app/modules/organization/  → SHARED
backend/app/modules/admission/     → SHARED
backend/app/modules/admin/         → SHARED
backend/app/modules/files/         → SHARED
backend/app/modules/imports/       → SHARED

backend/app/modules/resume/        → GROUP1
backend/app/modules/interview/     → GROUP1
backend/app/integrations/llm/      → GROUP1
backend/app/integrations/asr/      → GROUP1
backend/app/integrations/tts/      → GROUP1
backend/app/integrations/ocr/      → GROUP1

backend/app/modules/evidence/      → GROUP2
backend/app/modules/growth/        → GROUP2

backend/app/modules/employment/    → GROUP3
backend/app/modules/career/        → GROUP3

backend/scripts/                   → SHARED
backend/app/tests/                 → SHARED (各组在各自目录下)
docs/                              → SHARED
.github/                           → SHARED

app/page.tsx                       → SHARED
app/account/                       → SHARED
app/admin/                         → SHARED
app/teacher/                       → SHARED
app/resources/                     → SHARED
app/dashboard/                     → GROUP2
app/growth-map/                    → GROUP2
app/portrait/                      → GROUP2
app/ai/                            → GROUP2
app/interview/                     → GROUP1
app/career/                        → GROUP3
```
