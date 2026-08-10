# 薪火未来 — 数据库设计文档 (v2.0 修正版)

## 表结构按 Owner 分组

### Shared/Core (11 表)
`users` `student_profiles` `student_private_profiles` `teacher_profiles` `user_sessions`
`ref_major_standard` `ref_job_standard` `ref_code_values`
`universities` `colleges` `university_major_programs`
`student_admissions` `student_admission_scores`
`audit_logs` `recovery_requests` `deletion_requests`
`files`
`data_import_batches` `data_import_rows`
`cloud_states`

### Group1 — AI简历+AI面试 (4 表)
`generated_resumes` `resume_templates`
`interview_sessions` `resume_upload_chunks`

### Group2 — 任务匹配+榜样激励 (12 表)
`baseline_assessments` `student_portraits`
`growth_plans` `growth_tasks` `growth_task_progress`
`evidence` `evidence_reviews` `evidence_files`
`role_models` `role_model_experiences` `role_model_milestones` `role_model_matches`

### Group3 — 智能岗位匹配 (12 表)
`employers` `career_jobs` `career_matches` `career_applications` `career_events` `recommendation_feedback`
`student_employments` `employment_reviews` `study_abroad_records` `graduate_administration`
`candidate_pushes` `student_data_authorizations`

---

## 关键新增表说明 (Alembic 002)

### Group1: generated_resumes
AI 生成的简历。每个学生可以为不同岗位生成多份简历，同一岗位可有多个版本。

### Group1: resume_templates
简历模板（布局、样式、段落定义）。Group1 维护。

### Group2: baseline_assessments
学生基线测评。包含高考成绩、专业基础、性格特质、软实力、职业意向、各维度得分和画像数据。支持多次重测。

### Group2: student_portraits
学生能力画像缓存。从证据数据计算五维分数（专业学习/项目实践/创新探索/沟通协作/职业准备）。缓存后供 Group1 和 Group3 查询。

### Group2: growth_plans
学期成长计划。一个计划包含多个 growth_tasks，按学期组织。

### Group2: growth_task_progress
任务级别的进度追踪。打卡记录、完成百分比、核验状态。

### Group2: role_models / _experiences / _milestones / _matches
榜样激励体系。role_models 存储往届优秀学生案例，experiences 和 milestones 是他们的经历和里程碑，matches 记录学生与榜样的匹配关系。

### Group3: candidate_pushes
校企通道候选人推送。包含推送方、授权状态、企业查看/反馈、最终结果。

### Group3: student_data_authorizations
学生数据分享授权。控制向企业分享简历/画像/成绩/证据/联系方式的权限范围。

---

## 跨组数据依赖 (表级)

```
users ─────────────────→ 所有业务表
student_profiles ──────→ baseline_assessments, generated_resumes, career_applications
student_portraits ─────→ generated_resumes(Group1), career_matches(Group3)
career_jobs ───────────→ generated_resumes(Group1), growth_tasks(Group2)
generated_resumes ─────→ candidate_pushes(Group3), career_matches(Group3)
interview_sessions ────→ career_matches(Group3)
growth_tasks ──────────→ career_matches(Group3)
```

---

## Alembic 迁移历史

| Revision | 说明 | 表数 | 日期 |
|----------|------|------|------|
| `001` | Initial schema — Phase 1 platform base | 25+ | 2026-08-10 |
| `002` | Phase 1.1 business alignment — resume/assessment/role models/enterprise | 12 new | 2026-08-10 |

后续迁移从 `002` 继续。

---

## 设计原则重申

1. **禁止巨型表**: 就业数据拆成 5 表，不建 104 列大表
2. **键值对高考成绩**: 支持新旧高考模式
3. **敏感数据隔离**: student_private_profiles 单独存储
4. **原始数据暂存**: 所有 Excel 先入 staging 层
5. **可扩展字典**: ref_code_values 用 namespace+code 模式
6. **utf8mb4** 全部表
7. **created_at / updated_at** 用 MySQL DATETIME(timezone=True)，业务时间戳用 Unix 毫秒整数
