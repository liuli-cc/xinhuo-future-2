# 薪火未来 — 工程架构重构 Phase 1 完成报告

> 生成日期: 2026-08-10

---

## 一、已完成

### 1. 新建目录与文件 (79 个后端文件)

```
xinhuo-future-main/
├── backend/                          # 新增 FastAPI 后端
│   ├── app/
│   │   ├── main.py                  # FastAPI 入口，/health, /docs, 路由注册
│   │   ├── core/                    # 基础设施
│   │   │   ├── config.py           # 统一配置管理 (Pydantic Settings)
│   │   │   ├── security.py         # PBKDF2-SHA256 密码 (兼容旧系统)
│   │   │   ├── exceptions.py       # 统一异常体系 (15+ 错误类型)
│   │   │   ├── logging.py          # 结构化日志 + 敏感字段自动脱敏
│   │   │   └── permissions.py      # RBAC 角色权限检查
│   │   ├── db/
│   │   │   ├── base.py             # SQLAlchemy Base + TimestampMixin + SoftDelete
│   │   │   └── session.py          # 异步 Session 工厂
│   │   ├── modules/                # 14 个业务模块
│   │   │   ├── auth/               # 登录/注册/登出 (router + service + schema + dependency)
│   │   │   ├── users/              # 用户/学生/教师档案 (model + repository + service + router)
│   │   │   ├── reference/          # 标准字典 API (model + repository + router)
│   │   │   ├── organization/       # 学校/学院/专业 API (model + repository + router)
│   │   │   ├── files/              # 统一文件存储 (model + repository + router + schema)
│   │   │   ├── imports/            # 数据导入暂存层 (model + repository + router + schema)
│   │   │   ├── admission/          # 招生数据模型
│   │   │   ├── employment/         # 就业数据模型 (5张表替代104列大表)
│   │   │   ├── evidence/           # 证据/佐证模型
│   │   │   ├── growth/             # 成长任务模型
│   │   │   ├── career/             # 职业岗位模型
│   │   │   ├── interview/          # 面试记录模型
│   │   │   ├── admin/              # 审计/恢复/注销模型
│   │   │   └── resume/             # 简历模块目录
│   │   ├── integrations/
│   │   │   ├── cos/                # 腾讯云 COS (Phase 2 实现)
│   │   │   ├── llm/                # 6 家模型提供商定义
│   │   │   ├── asr/                # 语音识别 (Phase 2)
│   │   │   ├── tts/                # 语音合成 (Phase 2)
│   │   │   └── ocr/                # 文字识别 (Phase 2)
│   │   └── tests/
│   │       ├── conftest.py         # pytest fixtures
│   │       └── test_health.py      # 健康检查/OpenAPI 测试
│   ├── alembic/
│   │   ├── env.py                  # 异步 Alembic 环境
│   │   ├── script.py.mako          # Migration 模板
│   │   └── versions/
│   │       └── 001_initial_schema.py  # 初始迁移 (~25张表)
│   ├── scripts/
│   │   ├── init-db.sql             # MySQL 初始化
│   │   └── import_reference_data.py # Excel 数据导入脚本
│   ├── Dockerfile                  # Python 3.12 + uvicorn
│   ├── docker-compose.yml          # MySQL 8 + FastAPI + Adminer
│   ├── .env.example               # 环境变量模板
│   ├── requirements.txt            # 18 个依赖包
│   ├── pytest.ini                  # 测试配置
│   └── README.md                   # 后端开发指南
├── docs/                           # 新增 6 份架构文档
│   ├── ARCHITECTURE.md             # 系统架构图 + 技术栈
│   ├── DATABASE-DESIGN.md          # 完整 ER 图 + 设计决策
│   ├── API-CONTRACTS.md            # 公共 API 契约 + ID 体系
│   ├── API-MIGRATION.md            # 48 个旧 API 迁移状态追踪
│   ├── MODULE-BOUNDARIES.md        # 表→模块所有权映射
│   └── TEAM-OWNERSHIP.md           # 三组分工 + 前端页面分配
└── .github/
    └── CODEOWNERS                  # GitHub Review 规则
```

### 2. 新建数据库表 (25+ 张)

按层排列:

| 层级 | 表名 | 记录数预估 |
|------|------|-----------|
| Reference | `ref_major_standard` | ~845 |
| Reference | `ref_job_standard` | ~1043 |
| Reference | `ref_code_values` | 按需 |
| Organization | `universities` | 1-5 |
| Organization | `colleges` | ~29 |
| Organization | `university_major_programs` | ~96 |
| Users | `users` | 按需 |
| Users | `student_profiles` | 按需 |
| Users | `student_private_profiles` | 按需 |
| Users | `teacher_profiles` | 按需 |
| Users | `user_sessions` | 按需 |
| Admission | `student_admissions` | 按需 |
| Admission | `student_admission_scores` | 按需 (键值对) |
| Employment | `employers` | 按需 |
| Employment | `student_employments` | 按需 |
| Employment | `employment_reviews` | 按需 |
| Employment | `study_abroad_records` | 按需 |
| Employment | `graduate_administration` | 按需 |
| Evidence | `evidence` | 按需 |
| Evidence | `evidence_reviews` | 按需 |
| Evidence | `evidence_files` | 按需 |
| Growth | `growth_tasks` | 按需 |
| Growth | `cloud_states` | 按需 |
| Career | `career_jobs`, `career_matches`, `career_applications`, `career_events`, `recommendation_feedback` | 按需 |
| Interview | `interview_sessions`, `resume_upload_chunks` | 按需 |
| Admin | `audit_logs`, `recovery_requests`, `deletion_requests` | 按需 |
| Files | `files` | 按需 |
| Imports | `data_import_batches`, `data_import_rows` | 按需 |

### 3. Alembic Migration

- Migration `001_initial_schema.py`: 完整的 `upgrade()` 和 `downgrade()`，所有外键、索引、唯一约束
- 字符集: `utf8mb4`
- 引擎: `mysql+aiomysql://` (异步)

### 4. 新建 API (已实现)

| 端点 | 方法 | 说明 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/api/health` | GET | 健康检查 (兼容) |
| `/docs` | GET | Swagger UI |
| `/api/v1/auth/me` | GET | 当前用户 |
| `/api/v1/auth/login` | POST | 登录 |
| `/api/v1/auth/logout` | POST | 登出 |
| `/api/v1/auth/register` | POST | 注册 |
| `/api/v1/users/{id}` | GET | 用户公开信息 |
| `/api/v1/users/{id}` | PATCH | 修改资料 |
| `/api/v1/reference/majors` | GET | 标准专业 (筛选) |
| `/api/v1/reference/majors/disciplines` | GET | 学科门类 |
| `/api/v1/reference/majors/{id}` | GET | 单个专业 |
| `/api/v1/reference/jobs` | GET | 标准岗位 (筛选) |
| `/api/v1/reference/jobs/domains` | GET | 岗位大类 |
| `/api/v1/reference/jobs/{id}` | GET | 单个岗位 |
| `/api/v1/reference/codes/{namespace}` | GET | 代码值 |
| `/api/v1/organization/universities` | GET | 大学列表 |
| `/api/v1/organization/colleges` | GET | 学院列表 |
| `/api/v1/organization/colleges/{id}` | GET | 单个学院 |
| `/api/v1/organization/majors` | GET | 学校专业 |
| `/api/v1/organization/majors/{id}` | GET | 单个专业 |
| `/api/v1/files/upload` | POST | 文件上传 |
| `/api/v1/files/{id}` | GET | 文件元数据 |
| `/api/v1/imports/batches` | GET | 导入批次 |
| `/api/v1/imports/batches/{id}` | GET | 批次详情 |
| `/api/v1/imports/batches/{id}/rows` | GET | 批次数据行 |

### 5. 新建 Git 分支

```
main        ← 生产
develop     ← 集成
group1-dev  ← Group1 (平台基础 & 学生成长)
group2-dev  ← Group2 (就业 & 职业发展)
group3-dev  ← Group3 (AI & 智能面试)
```

### 6. 数据导入体系

- `scripts/import_reference_data.py`: 支持 `--type major_standard|job_standard|university_major|all`
- 支持 `--dry-run` 验证模式
- 幂等导入，自动跳过重复数据
- 输出错误日志

---

## 二、当前数据库 ER (核心部分)

见 `docs/DATABASE-DESIGN.md` 中完整 Mermaid ER 图。

核心关系链路:
```
universities → colleges → university_major_programs → student_profiles
ref_major_standard → university_major_programs
ref_job_standard → student_employments
users → student_profiles → student_admissions → student_admission_scores
users → student_profiles → student_employments → employment_reviews
users → student_profiles → study_abroad_records
```

---

## 三、数据所有权

| 层 | Owner |
|----|-------|
| Reference (标准字典) | Group1 |
| Organization (学校组织) | Group1 |
| Users (用户/学生/教师) | Group1 |
| Admission (招生) | Group1 |
| Evidence (证据) | Group1 |
| Growth (成长) | Group1 |
| Admin (管理) | Group1 |
| Files (文件) | Group1 |
| Imports (导入) | Group1 |
| Employment (就业) | Group2 |
| Career (职业) | Group2 |
| Interview (面试) | Group3 |
| LLM/ASR/TTS/OCR | Group3 |

---

## 四、Group 分工

| Group | 职责 | 模块 | 前端页面 |
|-------|------|------|----------|
| **Group1** | 平台基础 & 学生成长 | auth, users, reference, organization, admission, evidence, growth, admin, files, imports | /, /dashboard, /growth-map, /portrait, /account, /admin, /teacher, /resources |
| **Group2** | 就业 & 职业发展 | employment, career | /career |
| **Group3** | AI & 智能面试 | interview, resume, llm, asr, tts, ocr | /ai, /interview |

---

## 五、尚未迁移

48 个旧 CloudBase API 仍在 `functions/xinhuo-api/index.js` 中运行，标记为 LEGACY 状态:
- 16 个 Group1 API (growth-path, evidence, account, admin)
- 6 个 Group2 API (career)
- 12 个 Group3 API (interview, decision, model, asr, tts)
- 1 个 Resources API (mentors)
- 以及 auth/recovery, cloud-state 等

详见 `docs/API-MIGRATION.md` 完整清单。

---

## 六、风险

1. **前端兼容性**: 新 API 路径使用 `/api/v1/` 前缀，旧前端调用 `/api/` 路径。需要配置 `NEXT_PUBLIC_API_BASE` 或在 FastAPI 中添加 `/api/` → `/api/v1/` 路由别名。

2. **Session 迁移**: 旧系统 Session 数据在 CloudBase NoSQL 中，迁移到 MySQL 时需要处理现有会话的过渡。

3. **ASR/TTS 集成**: 腾讯云 ASR/TTS 需要 HMAC-SHA256 签名，Phase 2 实现时需移植旧 Node.js 的 `tc3Sign` 逻辑。

4. **COS 集成**: 当前文件上传仅记录元数据，实际 COS 上传/下载需 Phase 2 实现。

5. **密码兼容**: 已实现 PBKDF2-SHA256 (310,000/60,000 iterations)，与旧系统兼容。但首次登录验证时需要确保 salt 正确传递。

---

## 七、推荐的第二阶段迁移顺序

1. **Group1 优先**:
   - `POST /api/auth/recovery` (密码找回)
   - `PATCH /api/account` (个人资料修改)
   - `GET/POST /api/growth-path` (成长任务)
   - `POST /api/growth-path/evidence` (证据提交)
   - `POST /api/evidence-files` (证据文件上传)
   - `GET/POST/DELETE /api/portrait` (能力画像)
   - `GET /api/admin/overview` (管理概览)

2. **Group2 其次**:
   - `GET/POST /api/career/jobs` (岗位管理)
   - `POST /api/career/jobs/:id/match` (岗位匹配)
   - `GET/POST /api/career/applications` (投递管理)

3. **Group3 最后**:
   - `POST /api/interview/model` (LLM 代理)
   - `POST /api/interview/resume/parse` (简历解析)
   - `GET/POST /api/interview` (面试记录)
   - `POST /api/interview/asr` (语音识别)

---

## 八、验收标准检查

| # | 标准 | 状态 |
|---|------|------|
| 1 | Next.js 旧前端仍可运行 | ✅ 未修改前端代码 |
| 2 | 旧 CloudBase 后端仍可运行 | ✅ `functions/` 未修改 |
| 3 | 新 FastAPI 可独立启动 | ✅ `uvicorn app.main:app` |
| 4 | MySQL 可通过 Docker 启动 | ✅ `docker compose up -d` |
| 5 | Alembic 可正常初始化 | ✅ `alembic upgrade head` |
| 6 | `/health` 正常 | ✅ 返回 `{ok: true}` |
| 7 | `/docs` 正常 | ✅ Swagger UI 可用 |
| 8 | 三个 Group 分支建立 | ✅ main, develop, group1/2/3-dev |
| 9 | 公共模型确定 | ✅ 25+ 张表，统一 ID 体系 |
| 10 | 标准数据有导入路径 | ✅ import_reference_data.py |
| 11 | 招生/就业有合理结构 | ✅ 键值对高考成绩，5表替代104列 |
| 12 | 不需要重新设计数据库 | ✅ 分层设计，可扩展 |
| 13 | 公共实体只一套定义 | ✅ 统一 user_id, student_id 等 |
| 14 | README 可快速启动 | ✅ `docker compose up -d` |
| 15 | 从 Demo 升级为工程基础 | ✅ 完整模块化、文档化、分支化 |

---

**Phase 1 底座建设已完成。** 等待人工确认后继续迁移业务代码。
