# Group2 — 任务匹配 + 榜样激励 开发任务清单

> 基于: 任务匹配+榜样激励功能模块文档
> 分支: `group2-dev` → `feature/g2-xxx`
> 依赖: Shared/Core (users, admission, organization, files)

---

## G2-01: 基线测评系统

| 属性 | 内容 |
|------|------|
| **任务名称** | 学生基线测评 — 数据采集与画像生成 |
| **业务依据** | 任务匹配文档 — 基线测评与专属画像 (高考成绩/院校专业/职业意向/职业倾向/专业基础能力/性格特质/软实力/能力短板) |
| **所属前端页面** | `/dashboard`, `/portrait` |
| **所属FastAPI模块** | `backend/app/modules/growth/` |
| **需要的数据库表** | `baseline_assessments`, `users`, `student_profiles`, `student_admissions`, `student_admission_scores` |
| **依赖Contract** | `StudentAcademicProfile` (Shared), `StudentCareerIntent` |
| **输入** | user_id, 测评问卷数据/导入数据 |
| **输出** | `POST /api/v1/growth/assessments` — 测评结果, `GET /api/v1/growth/assessments/{id}` — 测评详情 |
| **验收标准** | (1) 支持手动录入和批量导入 (2) 包含所有指定维度 (3) 生成基线画像数据 (4) 标记能力短板和优势 |
| **测试要求** | Repository + Service 单元测试 |
| **优先级** | P0 |
| **依赖其他组** | Shared (StudentAcademicProfile — 已经可用) |
| **可Mock独立开发** | ✅ |
| **Feature Branch** | `feature/g2-baseline-assessment` |

## G2-02: 五维能力画像计算

| 属性 | 内容 |
|------|------|
| **任务名称** | 基于证据数据的五维画像计算引擎 |
| **业务依据** | 任务匹配文档 — 基线画像; 现有XH-EGM-2.0算法 |
| **所属前端页面** | `/portrait` |
| **所属FastAPI模块** | `backend/app/modules/growth/` |
| **需要的数据库表** | `student_portraits`, `evidence`, `growth_tasks` |
| **依赖Contract** | `StudentPortraitSummary` (输出), `DimensionScore`, `WeaknessItem` |
| **输入** | user_id, evidence数据 |
| **输出** | `GET /api/v1/growth/portrait/{user_id}` — `StudentPortraitSummary` |
| **验收标准** | (1) 五维度分数计算 (2) 证据权重算法 (3) 置信度计算 (4) 画像缓存机制 (5) 与旧XH-EGM-2.0算法一致 |
| **测试要求** | Service层单元测试 (验证算法结果) |
| **优先级** | P0 — 被Group1和Group3依赖 |
| **依赖其他组** | 无 |
| **可Mock独立开发** | ✅ |

## G2-03: 学期成长计划管理

| 属性 | 内容 |
|------|------|
| **任务名称** | 大学四年分学期成长计划 |
| **业务依据** | 任务匹配文档 — 大学四年成长任务 (分学期成长计划/任务推荐/优先级/时间节点/自定义调整) |
| **所属前端页面** | `/growth-map` |
| **所属FastAPI模块** | `backend/app/modules/growth/` |
| **需要的数据库表** | `growth_plans`, `growth_tasks`, `growth_task_progress` |
| **依赖Contract** | `GrowthProgressSummary` |
| **输入** | user_id, semester_index, 推荐任务列表 |
| **输出** | `GET/POST /api/v1/growth/plans` — 计划CRUD, `POST /api/v1/growth/tasks` — 任务CRUD |
| **验收标准** | (1) 8个学期计划模板 (2) 任务推荐算法 (3) 支持自定义任务 (4) 优先级和时间节点标记 |
| **测试要求** | Repository + Service 单元测试 |
| **优先级** | P0 |
| **依赖其他组** | 无 |
| **可Mock独立开发** | ✅ |

## G2-04: 任务打卡与进度追踪

| 属性 | 内容 |
|------|------|
| **任务名称** | 成长任务打卡/进度/完成率 |
| **业务依据** | 任务匹配文档 — 任务打卡 + 进度管理 + 阶段成长率 |
| **所属前端页面** | `/growth-map`, `/dashboard` |
| **所属FastAPI模块** | `backend/app/modules/growth/` |
| **需要的数据库表** | `growth_task_progress`, `growth_tasks` |
| **依赖Contract** | `GrowthProgressSummary` (输出) |
| **输入** | task_id, check_in数据 |
| **输出** | `POST /api/v1/growth/tasks/{id}/check-in` — 打卡, `GET /api/v1/growth/progress/{user_id}` — `GrowthProgressSummary` |
| **验收标准** | (1) 打卡次数记录 (2) 完成百分比 (3) 阶段成长率计算 (4) 核验状态同步 |
| **测试要求** | Repository + Service 单元测试 |
| **优先级** | P1 |
| **依赖其他组** | 无 |
| **可Mock独立开发** | ✅ |

## G2-05: 证据提交与审核

| 属性 | 内容 |
|------|------|
| **任务名称** | 成长证据提交/文件上传/教师审核 |
| **业务依据** | 任务匹配文档 — 佐证管理; 现有 evidence 流程 |
| **所属前端页面** | `/growth-map`, `/teacher` |
| **所属FastAPI模块** | `backend/app/modules/evidence/` |
| **需要的数据库表** | `evidence`, `evidence_reviews`, `evidence_files`, `files` |
| **依赖Contract** | 无跨组输出 |
| **输入** | 证据标题/类别/维度/详情/日期/附件 |
| **输出** | `POST /api/v1/growth/evidence` — 提交证据, `GET/PATCH /api/v1/growth/evidence` — 审核 |
| **验收标准** | (1) 证据CRUD (2) 文件附件上传 (3) pending→verified/rejected审核流程 (4) 审核历史记录 |
| **测试要求** | Repository + Service + API 测试 |
| **优先级** | P0 — 画像计算的数据来源 |
| **依赖其他组** | Shared/files (文件上传) |
| **可Mock独立开发** | ✅ |

## G2-06: 成长决策引擎

| 属性 | 内容 |
|------|------|
| **任务名称** | 目标差距分析 + 动态行动推荐 |
| **业务依据** | 任务匹配文档; 现有XH-DPE-1.0决策引擎 |
| **所属前端页面** | `/ai` |
| **所属FastAPI模块** | `backend/app/modules/growth/` |
| **需要的数据库表** | `student_portraits`, `growth_tasks`, `career_jobs` (只读) |
| **依赖Contract** | `StudentPortraitSummary`, `JobRequirementProfile` (Group3) |
| **输入** | user_id, target_role |
| **输出** | `GET/POST /api/v1/growth/decision` — 决策报告 |
| **验收标准** | (1) 目标画像与当前画像对比 (2) 五维度差距计算 (3) 按优先级排序的行动建议 (4) 与旧XH-DPE-1.0算法一致 |
| **测试要求** | Service层单元测试 (算法验证) |
| **优先级** | P1 |
| **依赖其他组** | Group3 (JobRequirementProfile — 用Mock) |
| **可Mock独立开发** | ✅ |

## G2-07: 榜样数据管理

| 属性 | 内容 |
|------|------|
| **任务名称** | 往届优秀学生案例录入与管理 |
| **业务依据** | 榜样激励文档 — 往届优秀学生案例 (背景标签/高考分数段/学校专业/目标行业岗位/四年轨迹/竞赛实习/最终offer) |
| **所属前端页面** | `/dashboard` (榜样模块), 管理后台 |
| **所属FastAPI模块** | `backend/app/modules/growth/` |
| **需要的数据库表** | `role_models`, `role_model_experiences`, `role_model_milestones` |
| **依赖Contract** | `RoleModelMatchSummary` (输出) |
| **输入** | 榜样基本信息/背景标签/经历/里程碑 |
| **输出** | `GET/POST /api/v1/growth/role-models` — 榜样CRUD, `GET /api/v1/growth/role-models/{id}` — 榜样详情 |
| **验收标准** | (1) 完整背景标签系统 (2) 多年经历和里程碑 (3) 支持发布/精选标记 (4) 支持导入excel |
| **测试要求** | Repository + Service 单元测试 |
| **优先级** | P1 |
| **依赖其他组** | Shared/files (头像上传) |
| **可Mock独立开发** | ✅ |

## G2-08: 榜样智能匹配

| 属性 | 内容 |
|------|------|
| **任务名称** | 学生→榜样自动匹配算法 |
| **业务依据** | 榜样激励文档 — 榜样智能匹配 + 同期进度对比 |
| **所属前端页面** | `/dashboard` |
| **所属FastAPI模块** | `backend/app/modules/growth/` |
| **需要的数据库表** | `role_model_matches`, `role_models`, `student_portraits`, `baseline_assessments` |
| **依赖Contract** | `RoleModelMatchSummary`, `StudentPortraitSummary`, `StudentAcademicProfile` |
| **输入** | user_id |
| **输出** | `POST /api/v1/growth/role-models/match` — 匹配结果列表 |
| **验收标准** | (1) 基于背景标签+能力画像的匹配 (2) 匹配分数+理由 (3) 同期进度对比 (4) 激励反馈记录 |
| **测试要求** | Service层单元测试 (算法验证) |
| **优先级** | P1 |
| **依赖其他组** | 无 |
| **可Mock独立开发** | ✅ (使用Mock学生数据) |

---

## Group2 开发顺序建议

```
Phase A (可并行):
  G2-01 基线测评        ← P0, 无外部依赖
  G2-05 证据提交/审核    ← P0, 依赖 Shared/files

Phase B (依赖A):
  G2-02 五维画像计算     ← P0, 依赖 G2-01 + G2-05 (证据数据)
  G2-03 学期成长计划     ← P0, 依赖 G2-01

Phase C (依赖B):
  G2-04 任务打卡/进度    ← P1, 依赖 G2-03
  G2-07 榜样数据管理     ← P1, 无代码依赖
  G2-06 成长决策引擎     ← P1, 依赖 G2-02 + Group3(已Mock)

Phase D:
  G2-08 榜样智能匹配     ← P1, 依赖 G2-02 + G2-07
```
