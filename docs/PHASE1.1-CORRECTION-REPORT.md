# 薪火未来 — Phase 1.1 业务边界修正报告

> 日期: 2026-08-10
> 版本: v2.0 (覆盖 Phase 1 报告中的错误分组)

---

## 修正摘要

Phase 1 报告错误地将平台基础模块 (auth, users, reference, organization, admission, admin, files, imports) 归给了 Group1。

**修正后**: 这些是 **Shared/Core** 公共底座，不属于任何业务组。

---

## 一、修正后的三组职责

### Shared/Core — 平台公共底座
- 认证/用户主数据/标准字典/学校组织/招生数据
- 文件存储/数据导入/管理/审计
- 基础设施 (config, security, logging, database, alembic)
- 前端: `/`, `/account`, `/admin`, `/teacher`, `/resources`

### Group1 — AI简历 + AI模拟面试
- 拥有: resume, interview, llm, asr, tts, ocr
- 数据库: `generated_resumes`, `resume_templates`, `interview_sessions`, `resume_upload_chunks`
- 前端: `/interview`
- 依赖: Shared (users, files, reference), Group2 (portrait), Group3 (career_jobs)

### Group2 — 任务匹配 + 榜样激励
- 拥有: evidence, growth
- 数据库: `baseline_assessments`, `student_portraits`, `growth_plans`, `growth_tasks`, `growth_task_progress`, `role_models` 系列, `evidence` 系列
- 前端: `/dashboard`, `/growth-map`, `/portrait`, `/ai`
- 依赖: Shared (users, org, admission, reference), Group1 (resume, interview), Group3 (career_jobs)

### Group3 — 智能岗位匹配
- 拥有: employment, career
- 数据库: `employers`, `career_jobs`, `career_matches`, `career_applications`, `career_events`, `student_employments`, `candidate_pushes`, `student_data_authorizations` 等
- 前端: `/career`
- 依赖: Shared (users, org, admission, reference), Group2 (portrait, growth), Group1 (resume, interview)

---

## 二、API 重新分类

| Owner | API 数量 | READY | LEGACY |
|-------|---------|-------|--------|
| SHARED | 18 | 5 | 13 |
| GROUP1 | 11 | 0 | 11 |
| GROUP2 | 6 | 0 | 6 |
| GROUP3 | 6 | 0 | 6 |

详见 `docs/API-MIGRATION.md`

---

## 三、数据库变更

### Alembic 001 (Phase 1) — 25+ 表
平台基础表 + 所有业务模块骨架表

### Alembic 002 (Phase 1.1 新增) — 12 张新表

| Group | 新增表 |
|-------|--------|
| Group1 | `generated_resumes`, `resume_templates` |
| Group2 | `baseline_assessments`, `student_portraits`, `growth_plans`, `growth_task_progress`, `role_models`, `role_model_experiences`, `role_model_milestones`, `role_model_matches` |
| Group3 | `candidate_pushes`, `student_data_authorizations` |

### 新增模型文件
- `backend/app/modules/resume/model.py` (新建)
- `backend/app/modules/growth/model.py` (扩展)
- `backend/app/modules/career/model.py` (扩展)

---

## 四、修改的文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `docs/TEAM-OWNERSHIP.md` | 重写 | Shared/Core 独立，Group1/2/3 按正式文档 |
| `docs/MODULE-BOUNDARIES.md` | 重写 | 新增 Shared/Core 所有权，完整 RW 映射 |
| `docs/API-CONTRACTS.md` | 重写 | 按 Shared/Group1/2/3 分类 |
| `docs/API-MIGRATION.md` | 重写 | 按 Shared/Group1/2/3 重新标记 |
| `docs/DATABASE-DESIGN.md` | 重写 | 按 Owner 分组，新增 002 迁移说明 |
| `docs/BUSINESS-DATA-FLOW.md` | **新建** | Mermaid 数据流图 |
| `docs/PHASE1.1-CORRECTION-REPORT.md` | **新建** | 本报告 |
| `.github/CODEOWNERS` | 重写 | Shared/Group1/2/3 + 前端文件 |
| `backend/alembic/env.py` | 更新 | 导入新模型 |
| `backend/alembic/versions/002_business_alignment.py` | **新建** | 12 张新表 |
| `backend/app/modules/resume/model.py` | **新建** | GeneratedResume, ResumeTemplate |
| `backend/app/modules/growth/model.py` | 扩展 | +6 张 Group2 新表 |
| `backend/app/modules/career/model.py` | 扩展 | +2 张 Group3 新表 |

---

## 五、Git 分支状态

```
main          → 10d1b9a (initial scaffold)
develop       → 10d1b9a (same)
group1-dev    → 10d1b9a (same, no unique commits)
group2-dev    → 10d1b9a (same, no unique commits)
group3-dev    → 10d1b9a (same, no unique commits)
```

**结果**: 所有分支完全同步，无需特殊处理。可直接提交修正到 develop。

---

## 六、尚未执行的业务功能

以下核心功能仅有数据模型，等待 Phase 2 实现:

### Group1
- [ ] AI 简历生成引擎
- [ ] 简历版本管理
- [ ] 简历模板系统
- [ ] 模拟面试完整流程
- [ ] LLM 模型代理
- [ ] ASR/TTS 服务集成

### Group2
- [ ] 基线测评系统
- [ ] 学生画像计算
- [ ] 学期成长计划管理
- [ ] 任务打卡与进度追踪
- [ ] 榜样数据录入与管理
- [ ] 榜样智能匹配算法
- [ ] 证据审核完整流程

### Group3
- [ ] 岗位智能匹配算法
- [ ] 候选人推送系统
- [ ] 学生数据授权管理
- [ ] 校企定向通道
- [ ] 求职全过程管理
- [ ] 能力缺口分析

---

## 七、下一阶段建议

### 立即
1. 人工审核修正后的 Team Ownership 和 Module Boundaries
2. 确认 Shared/Core 维护负责人
3. 填充 `.github/CODEOWNERS` 中的真实 GitHub 用户名

### Phase 2.1 — Shared 补充
- 补充 account/sessions/deletion 等 Shared API
- 确保文件上传 API 完整可用（被所有组依赖）

### Phase 2.2 — 各组独立开发启动
- 三组从各自的 `groupX-dev` 创建 feature 分支
- 按 API-CONTRACTS.md 中的跨组 DTO 并行开发
- 各组实现自己拥有的 API

---

## 八、验收确认

| # | 标准 | 状态 |
|---|------|------|
| 1 | Shared/Core 独立于三个业务组 | ✅ |
| 2 | Group1 职责 = AI简历 + AI面试 | ✅ |
| 3 | Group2 职责 = 任务匹配 + 榜样激励 | ✅ |
| 4 | Group3 职责 = 智能岗位匹配 | ✅ |
| 5 | 每张表有唯一 Owner | ✅ MODULE-BOUNDARIES.md |
| 6 | 跨组数据流明确 | ✅ BUSINESS-DATA-FLOW.md |
| 7 | 公共 DTO 已定义 | ✅ API-CONTRACTS.md |
| 8 | 数据库 Gap 已填补 | ✅ Alembic 002 |
| 9 | Git 分支同步 | ✅ 所有分支一致 |
| 10 | 所有文档已修正 | ✅ |

---

Phase 1.1 修正完成。等待确认后进入 Phase 2 业务迁移。
