# 薪火未来 — 团队模块所有权

## 分组总览

系统按业务领域分为三个开发组，各组拥有明确的模块和功能边界。

---

## Group1 — 平台基础 & 学生成长

### 职责范围

平台基础设施、用户体系、标准字典、学校组织、招生数据、
学生成长证据、管理员功能、文件存储、数据导入

### 拥有模块

| 模块 | 功能 | 关键表 |
|------|------|--------|
| auth | 注册/登录/会话 | users, user_sessions |
| users | 用户/学生/教师档案 | users, student_profiles, student_private_profiles, teacher_profiles |
| reference | 标准专业/岗位字典 | ref_major_standard, ref_job_standard, ref_code_values |
| organization | 学校/学院/专业目录 | universities, colleges, university_major_programs |
| admission | 招生录取数据 | student_admissions, student_admission_scores |
| evidence | 成长证据与审核 | evidence, evidence_reviews, evidence_files |
| growth | 成长任务与云状态 | growth_tasks, cloud_states |
| admin | 管理员功能与审计 | audit_logs, recovery_requests, deletion_requests |
| files | 统一文件存储 | files |
| imports | 数据导入暂存 | data_import_batches, data_import_rows |

### 前端页面

| 页面 | 路由 | 主要功能 |
|------|------|----------|
| 登录页 | `/` | 登录/注册/密码找回 |
| 仪表盘 | `/dashboard` | 个人数据概览 |
| 成长地图 | `/growth-map` | 四年成长任务 |
| 能力画像 | `/portrait` | 五维能力评估 |
| 个人中心 | `/account` | 资料修改/导出/注销 |
| 管理中心 | `/admin` | 用户审核/证据审核/统计 |
| 教师工作台 | `/teacher` | 班级管理/证据审核 |
| 资源中心 | `/resources` | 导师目录/学院信息 |

### 依赖其他组

- 无 (Group1 是基础层)

---

## Group2 — 就业 & 职业发展

### 职责范围

就业数据管理、用人单位库、职业岗位快照、能力匹配引擎、
投递管理与复盘

### 拥有模块

| 模块 | 功能 | 关键表 |
|------|------|--------|
| employment | 就业记录/审核/升学/行政 | employers, student_employments, employment_reviews, study_abroad_records, graduate_administration |
| career | 岗位快照/匹配/投递 | career_jobs, career_matches, career_applications, career_events, recommendation_feedback |

### 前端页面

| 页面 | 路由 | 主要功能 |
|------|------|----------|
| 职业发展 | `/career` | 岗位搜索/导入/匹配/投递追踪 |

### 依赖 Group1

- `users`: 获取学生信息和档案
- `organization`: 获取学院和专业
- `reference`: 标准岗位字典 (ref_job_standard)
- `files`: 就业证明材料上传

### 被依赖

- Group3 (interview 模块读取 career_jobs, career_applications)

---

## Group3 — AI & 智能面试

### 职责范围

成长决策引擎、AI模拟面试、LLM集成、简历解析、语音处理

### 拥有模块

| 模块 | 功能 | 关键表 |
|------|------|--------|
| interview | 模拟面试/报告 | interview_sessions, resume_upload_chunks |
| integrations/llm | 多家模型API代理 | — (无持久化) |
| integrations/asr | 腾讯云语音识别 | — (无持久化) |
| integrations/tts | 腾讯云语音合成 | — (无持久化) |
| integrations/ocr | OCR文字识别 | — (无持久化) |

### 前端页面

| 页面 | 路由 | 主要功能 |
|------|------|----------|
| AI决策 | `/ai` | 成长决策与差距分析 |
| 模拟面试 | `/interview` | AI面试/简历解析/语音 |

### 依赖 Group1

- `users`: 获取学生信息
- `growth`: 读取成长任务和云状态
- `evidence`: 读取证据用于能力分析
- `files`: 面试报告文件上传

### 依赖 Group2

- `career`: 读取岗位信息用于面试上下文
- `employment`: 读取就业数据用于决策分析

---

## 公共基础设施 (Shared)

以下由 Group1 主要负责维护，但所有组都可以提交改进 PR:

| 路径 | 内容 |
|------|------|
| `backend/app/core/` | 配置/安全/异常/日志/权限 |
| `backend/app/db/` | 数据库连接/Base Model |
| `backend/app/main.py` | FastAPI 入口/路由注册 |
| `backend/alembic/` | 数据库迁移 |
| `backend/docker-compose.yml` | 本地开发环境 |
| `docs/` | 项目文档 |

---

## 未来扩展

如果后续需要增加模块:

- **通知模块**: 可在 Group1 下新增 `notifications/`
- **数据分析**: 可独立为 Group4，或附属于各业务组
- **短信/邮件**: 可新增 `integrations/messaging/`

---

## 更新记录

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-08-10 | 初始版本 | Architecture Team |
