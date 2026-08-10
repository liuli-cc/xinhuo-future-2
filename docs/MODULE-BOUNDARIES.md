# 薪火未来 — 模块边界与数据所有权

## 核心原则

1. **每张表有且仅有一个 Owner Module**
2. **只有 Owner 可以直接写入 (INSERT/UPDATE/DELETE)**
3. **其他模块只读 (SELECT)**，通过 Owner 提供的 Service 接口获取数据
4. **禁止跨模块直接修改数据**，必须通过 API 或 Service 调用

---

## 表 → Owner 映射

### Reference Layer (标准字典)

| 表名 | Owner | 可写 | 只读 |
|------|-------|------|------|
| `ref_major_standard` | reference | reference | 所有模块 |
| `ref_job_standard` | reference | reference | 所有模块 |
| `ref_code_values` | reference | reference | 所有模块 |

### Organization Layer (组织)

| 表名 | Owner | 可写 | 只读 |
|------|-------|------|------|
| `universities` | organization | organization | 所有模块 |
| `colleges` | organization | organization | 所有模块 |
| `university_major_programs` | organization | organization | admission, employment, users |

### Users Layer (用户)

| 表名 | Owner | 可写 | 只读 |
|------|-------|------|------|
| `users` | users | users, auth | 所有模块 (仅公开字段) |
| `student_profiles` | users | users | admission, employment, career |
| `student_private_profiles` | users | users | 无 (默认不公开) |
| `teacher_profiles` | users | users | admin |
| `user_sessions` | auth | auth | users |

### Admission Layer (招生)

| 表名 | Owner | 可写 | 只读 |
|------|-------|------|------|
| `student_admissions` | admission | admission, imports | users, employment |
| `student_admission_scores` | admission | admission, imports | users |

### Employment Layer (就业)

| 表名 | Owner | 可写 | 只读 |
|------|-------|------|------|
| `employers` | employment | employment, imports | career |
| `student_employments` | employment | employment, imports | career, users |
| `employment_reviews` | employment | employment | admin |
| `study_abroad_records` | employment | employment, imports | users |
| `graduate_administration` | employment | employment, imports | admin |

### Evidence Layer (证据)

| 表名 | Owner | 可写 | 只读 |
|------|-------|------|------|
| `evidence` | evidence | evidence | growth, career, admin |
| `evidence_reviews` | evidence | evidence | admin |
| `evidence_files` | evidence | evidence | files |

### Growth Layer (成长)

| 表名 | Owner | 可写 | 只读 |
|------|-------|------|------|
| `growth_tasks` | growth | growth | evidence, career |
| `cloud_states` | growth | growth | career, interview |

### Career Layer (职业)

| 表名 | Owner | 可写 | 只读 |
|------|-------|------|------|
| `career_jobs` | career | career | interview, decision |
| `career_matches` | career | career | decision |
| `career_applications` | career | career | interview |
| `career_events` | career | career | interview |
| `recommendation_feedback` | career | career, decision | admin |

### Interview Layer (面试)

| 表名 | Owner | 可写 | 只读 |
|------|-------|------|------|
| `interview_sessions` | interview | interview | career, admin |
| `resume_upload_chunks` | interview | interview | 无 |

### Admin Layer (管理)

| 表名 | Owner | 可写 | 只读 |
|------|-------|------|------|
| `audit_logs` | admin | admin, (所有模块通过Service) | admin |
| `recovery_requests` | admin | admin, auth | admin |
| `deletion_requests` | admin | admin, users | admin |

### Files Layer (文件)

| 表名 | Owner | 可写 | 只读 |
|------|-------|------|------|
| `files` | files | files | 所有模块 |

### Imports Layer (导入)

| 表名 | Owner | 可写 | 只读 |
|------|-------|------|------|
| `data_import_batches` | imports | imports | admin |
| `data_import_rows` | imports | imports | admin |

---

## 跨模块调用规则

### 允许的调用方式

```
Module A → Module B Service (read)
Module A → Module B Service (write through explicit API)
```

### 禁止的调用方式

```
❌ Module A 直接操作 Module B 的数据库表
❌ Module A 直接导入 Module B 的 Model
❌ Module A 直接调用 Module B 的 Repository
```

### 示例

```python
# ✅ 正确：career模块通过users服务获取学生信息
from app.modules.users.service import UserService

student = await UserService(db).get_public_profile(user_id)

# ❌ 错误：career模块直接查询student_profiles
from app.modules.users.model import StudentProfile
stmt = select(StudentProfile).where(...)
```

---

## 文件目录所有权

### Group1 — 平台基础 & 用户成长

```
backend/app/modules/auth/       → Group1
backend/app/modules/users/      → Group1
backend/app/modules/reference/  → Group1
backend/app/modules/organization/ → Group1
backend/app/modules/admission/  → Group1
backend/app/modules/evidence/   → Group1
backend/app/modules/growth/     → Group1
backend/app/modules/admin/      → Group1
backend/app/modules/files/      → Group1
backend/app/modules/imports/    → Group1
backend/app/core/               → Group1 (公共基础设施)
backend/app/db/                 → Group1 (公共基础设施)
```

### Group2 — 就业 & 职业

```
backend/app/modules/employment/ → Group2
backend/app/modules/career/     → Group2
```

### Group3 — AI & 面试

```
backend/app/modules/interview/  → Group3
backend/app/modules/resume/     → Group3
backend/app/integrations/llm/   → Group3
backend/app/integrations/asr/   → Group3
backend/app/integrations/tts/   → Group3
backend/app/integrations/ocr/   → Group3
```

### 公共 (Shared)

```
backend/app/core/               → 所有组 (需 Review)
backend/app/db/                 → 所有组 (需 Review)
backend/app/main.py             → 所有组 (需 Review)
docs/                           → 所有组
```

---

## 修改公共文件流程

任何对公共文件 (`core/`, `db/`, `main.py`) 的修改必须:

1. 在 PR 中明确说明修改理由
2. 至少获得一个其他组成员的 Review
3. 不破坏现有 API 契约
4. 通过全部测试

## 新增表/字段流程

1. 在所属模块的 `model.py` 中添加
2. 创建 Alembic Migration (`alembic revision --autogenerate -m "description"`)
3. 更新本文件 (MODULE-BOUNDARIES.md)
4. 更新 DATABASE-DESIGN.md 中的 ER 图
5. 在 PR 中说明新增原因
