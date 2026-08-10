# 薪火未来 — 团队模块所有权 (v2.0 修正版)

> 基于三份正式功能文档重新对齐: AI简历+面试 / 任务匹配+榜样激励 / 智能岗位匹配

---

## Shared/Core — 平台公共底座

公共基础设施和主数据，不属于任何业务组，由项目维护者/后端负责人管理。

### 职责

| 类别 | 内容 |
|------|------|
| 认证 | 注册/登录/登出/密码找回/会话管理 |
| 用户主数据 | 学生档案/教师档案/敏感信息管理 |
| 标准字典 | 专业标准/岗位标准/代码值 |
| 学校组织 | 大学/学院/开设专业 |
| 招生数据 | 入学记录/高考成绩 |
| 文件存储 | 统一文件上传/下载 |
| 数据导入 | 原始数据暂存/清洗/入库 |
| 管理 | 账号审核/审计日志/数据统计 |
| 基础设施 | 配置/安全/异常/日志/数据库/Alembic |

### 拥有模块

```
backend/app/core/
backend/app/db/
backend/app/main.py
backend/app/modules/auth/
backend/app/modules/users/
backend/app/modules/reference/
backend/app/modules/organization/
backend/app/modules/admission/
backend/app/modules/admin/
backend/app/modules/files/
backend/app/modules/imports/
```

### 拥有数据库表

`users`, `student_profiles`, `student_private_profiles`, `teacher_profiles`, `user_sessions`
`ref_major_standard`, `ref_job_standard`, `ref_code_values`
`universities`, `colleges`, `university_major_programs`
`student_admissions`, `student_admission_scores`
`audit_logs`, `recovery_requests`, `deletion_requests`
`files`
`data_import_batches`, `data_import_rows`

### 前端页面

| 页面 | 路由 |
|------|------|
| 登录/注册 | `/` |
| 个人中心 | `/account` |
| 管理中心 | `/admin` |
| 教师工作台 | `/teacher` |
| 资源中心 | `/resources` |

---

## Group1 — AI简历 + AI模拟面试

### 职责

| 子领域 | 功能 |
|--------|------|
| AI简历生成 | 学生履历读取 / 目标岗位JD解析 / 经历筛选重组 / AI简历生成 / 多岗位定制 / 版本管理 / 模板管理 / 预览 / PDF导出 / ATS适配 |
| AI模拟面试 | 面试计划生成 / 面试题 / 动态追问 / 文字面试 / 语音面试 / ASR / TTS / 面试评分 / 面试复盘 / 能力短板分析 / 面试训练建议 / 面试报告 |

### 拥有模块

```
backend/app/modules/resume/
backend/app/modules/interview/
backend/app/integrations/llm/
backend/app/integrations/asr/
backend/app/integrations/tts/
backend/app/integrations/ocr/
```

### 拥有数据库表

`generated_resumes`, `resume_templates`, `interview_sessions`, `resume_upload_chunks`

### 前端页面

| 页面 | 路由 |
|------|------|
| 模拟面试 | `/interview` |

### 依赖 (只读)

| 依赖模块 | 数据 | 用途 |
|----------|------|------|
| Shared/users | StudentProfile | 读取学生履历信息 |
| Shared/reference | RefJobStandard | 岗位标准字典 |
| Group3/career | CareerJob, JobRequirements | 读取岗位JD |
| Group2/growth | StudentPortrait | 读取能力画像（面试上下文） |
| Shared/files | File | 简历/报告文件存储 |

---

## Group2 — 任务匹配 + 榜样激励

### 职责

| 子领域 | 功能 |
|--------|------|
| 基线测评 | 学生基础信息 / 高考成绩 / 院校专业 / 职业意向 / 职业倾向 / 专业基础能力 / 性格特质 / 软实力测评 / 基线画像 / 能力短板 |
| 大学四年成长 | 分学期成长计划 / 学科竞赛 / 证书 / 实习 / 科研项目 / 任务推荐 / 任务优先级 / 时间节点 / 自定义调整 / 任务打卡 / 进度管理 / 阶段成长率 |
| 榜样激励 | 往届优秀学生案例 / 背景标签 / 高考分数段 / 学校专业背景 / 目标行业岗位 / 四年成长轨迹 / 竞赛实习证书经历 / 最终offer/就业结果 / 榜样智能匹配 / 同期进度对比 / 成长里程碑 / 激励反馈 |
| 证据管理 | 证据提交/核验/审核 |

### 拥有模块

```
backend/app/modules/evidence/
backend/app/modules/growth/
```

### 拥有数据库表

`evidence`, `evidence_reviews`, `evidence_files`, `growth_tasks`, `cloud_states`
`baseline_assessments`, `student_portraits`, `growth_plans`, `growth_task_progress`
`role_models`, `role_model_experiences`, `role_model_milestones`, `role_model_matches`

### 前端页面

| 页面 | 路由 |
|------|------|
| 仪表盘 | `/dashboard` |
| 成长地图 | `/growth-map` |
| 能力画像 | `/portrait` |
| AI决策 | `/ai` |

### 依赖 (只读)

| 依赖模块 | 数据 | 用途 |
|----------|------|------|
| Shared/users | StudentProfile | 读取学生基本信息 |
| Shared/organization | College, MajorProgram | 院校专业信息 |
| Shared/admission | StudentAdmission, Scores | 高考成绩用于基线测评 |
| Shared/reference | RefJobStandard | 职业方向参考 |
| Group1/resume | GeneratedResume | 简历作为评估参考 |
| Group1/interview | InterviewSession | 面试结果作为评估参考 |
| Group3/career | CareerJob | 目标岗位信息 |

---

## Group3 — 智能岗位匹配

### 职责

| 子领域 | 功能 |
|--------|------|
| 岗位资源 | 企业 / 岗位 / JD / 岗位要求 / 岗位标签 |
| 人岗匹配 | 学生综合数据读取 / 基线画像 / 成长任务完成情况 / AI简历 / AI面试结果 / 求职意向 / 地域 / 薪资 / JD解析 / 硬性条件 / 专业能力匹配 / 综合能力匹配 / 发展潜力 / 综合得分 / 匹配解释 / 能力缺口 |
| 求职全过程 | 岗位推荐 / 企业候选人推荐 / 简历授权 / 投递 / 企业阅览 / 面试邀约 / 面试结果 / Offer / 入职/实习 / 实习评价 / 求职复盘 |
| 校企定向 | 合作企业 / 定向岗位 / 候选人推送 / 学生授权 / 试点数据统计 |

### 拥有模块

```
backend/app/modules/employment/
backend/app/modules/career/
```

### 拥有数据库表

`employers`, `student_employments`, `employment_reviews`, `study_abroad_records`, `graduate_administration`
`career_jobs`, `career_matches`, `career_applications`, `career_events`, `recommendation_feedback`
`candidate_pushes`, `student_data_authorizations`

### 前端页面

| 页面 | 路由 |
|------|------|
| 职业发展 | `/career` |

### 依赖 (只读)

| 依赖模块 | 数据 | 用途 |
|----------|------|------|
| Shared/users | StudentProfile | 读取学生信息 |
| Shared/organization | College, MajorProgram | 学校专业 |
| Shared/admission | StudentAdmission, Scores | 高考成绩 |
| Shared/reference | RefJobStandard | 岗位标准字典 |
| Shared/files | File | 就业材料 |
| Group2/growth | StudentPortrait, BaselineAssessment | 学生画像与测评 |
| Group2/growth | GrowthTask, GrowthTaskProgress | 成长任务完成情况 |
| Group1/resume | GeneratedResume | AI简历（授权后读取） |
| Group1/interview | InterviewSession, Report | 面试结果 |
