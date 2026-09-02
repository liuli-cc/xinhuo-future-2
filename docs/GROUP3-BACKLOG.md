# Group3 — 智能岗位匹配 开发任务清单

> 基于: 智能岗位匹配模块文档
> 分支: `group3-dev` → `feature/g3-xxx`
> 依赖: Shared/Core (users, reference, organization, files), Group2 (portrait, growth), Group1 (resume, interview)

---

## G3-01: 岗位资源管理

| 属性 | 内容 |
|------|------|
| **任务名称** | 岗位快照/企业库/JD管理 |
| **业务依据** | 智能岗位匹配文档 — 岗位资源 (企业/岗位/JD/岗位要求/岗位标签) |
| **所属前端页面** | `/career` |
| **所属FastAPI模块** | `backend/app/modules/career/` |
| **需要的数据库表** | `career_jobs`, `employers` |
| **依赖Contract** | `JobSummary`, `JobRequirementProfile` (输出) |
| **输入** | 岗位标题/公司/描述/来源URL (手动或粘贴) |
| **输出** | `GET/POST /api/v1/career/jobs` — 岗位CRUD, `GET /api/v1/career/employers` — 企业CRUD |
| **验收标准** | (1) 岗位导入(手动+粘贴) (2) JD结构化解析 (3) 企业库去重 (4) 岗位标签 |
| **测试要求** | Repository + Service 单元测试 |
| **优先级** | P0 — 被所有组依赖 |
| **依赖其他组** | Shared/reference (ref_job_standard — 岗位标准化) |
| **可Mock独立开发** | ✅ |
| **Feature Branch** | `feature/g3-job-resource` |

## G3-02: JD智能解析

| 属性 | 内容 |
|------|------|
| **任务名称** | 岗位描述 → 结构化需求解析 |
| **业务依据** | 智能岗位匹配文档 — JD解析 (硬性条件判断/专业能力匹配/综合能力匹配) |
| **所属前端页面** | `/career` |
| **所属FastAPI模块** | `backend/app/modules/career/` |
| **需要的数据库表** | `career_jobs` |
| **依赖Contract** | `JobRequirementProfile` (输出), `JobRequirementItem` |
| **输入** | 岗位标题+描述文本 |
| **输出** | `POST /api/v1/career/jobs/parse` — `JobRequirementProfile` |
| **验收标准** | (1) 技能关键词提取 (2) 经验要求识别 (3) 职责拆解 (4) 核心能力点 (5) 难度分级 |
| **测试要求** | Service层单元测试 (关键词语法验证) |
| **优先级** | P0 |
| **依赖其他组** | 无 |
| **可Mock独立开发** | ✅ |

## G3-03: 人岗匹配引擎

| 属性 | 内容 |
|------|------|
| **任务名称** | 综合匹配算法 — 画像+成长+简历+面试+意向 → 匹配分数 |
| **业务依据** | 智能岗位匹配文档 — 人岗匹配 (综合数据读取/硬性条件/专业能力/综合能力/发展潜力/匹配得分/匹配解释/能力缺口) |
| **所属前端页面** | `/career` |
| **所属FastAPI模块** | `backend/app/modules/career/` |
| **需要的数据库表** | `career_matches`, `career_jobs`, `student_portraits` (只读), `generated_resumes` (只读), `interview_sessions` (只读) |
| **依赖Contract** | `JobMatchRequest` (组装输入), `JobMatchResult` (输出), `StudentPortraitSummary`, `GrowthProgressSummary`, `GeneratedResumeSummary`, `InterviewAssessmentSummary`, `JobRequirementProfile` |
| **输入** | `JobMatchRequest` — 由所有组数据组装 |
| **输出** | `POST /api/v1/career/jobs/{id}/match` — `JobMatchResult` |
| **验收标准** | (1) 五维度匹配评分 (2) 硬性条件过滤 (3) 能力缺口识别 (4) 匹配理由可解释 (5) 置信度计算 |
| **测试要求** | Service层单元测试 (Mock全部依赖), 集成测试 |
| **优先级** | P0 — 核心功能 |
| **依赖其他组** | Group2 (StudentPortraitSummary, GrowthProgressSummary), Group1 (GeneratedResumeSummary, InterviewAssessmentSummary) — 全用Mock |
| **可Mock独立开发** | ✅ |

## G3-04: 能力缺口分析

| 属性 | 内容 |
|------|------|
| **任务名称** | 针对匹配结果的详细缺口分析 + 补强建议 |
| **业务依据** | 智能岗位匹配文档 — 能力缺口 + 匹配解释 |
| **所属前端页面** | `/career` |
| **所属FastAPI模块** | `backend/app/modules/career/` |
| **需要的数据库表** | `career_matches`, `growth_tasks` (只读 — 通过Group2写入) |
| **依赖Contract** | `JobMatchResult`, `JobGapItem` |
| **输入** | match_id |
| **输出** | 缺口详情 + 补强建议 (可选: 转换为 growth_tasks) |
| **验收标准** | (1) 每个缺口有具体差距值 (2) 优先级排序 (3) 可操作的补强建议 (4) 支持一键转为成长任务 |
| **测试要求** | Service层单元测试 |
| **优先级** | P1 |
| **依赖其他组** | Group2 (通过Service写入 growth_tasks) |
| **可Mock独立开发** | ✅ |

## G3-05: 求职投递管理

| 属性 | 内容 |
|------|------|
| **任务名称** | 投递记录/状态追踪/复盘 |
| **业务依据** | 智能岗位匹配文档 — 求职全过程 (简历授权/投递/企业阅览/面试邀约/面试结果/Offer/入职实习/求职复盘) |
| **所属前端页面** | `/career` |
| **所属FastAPI模块** | `backend/app/modules/career/` |
| **需要的数据库表** | `career_applications`, `career_events` |
| **依赖Contract** | `JobSummary`, `JobMatchResult` |
| **输入** | job_id, 投递状态变更 |
| **输出** | `GET/POST /api/v1/career/applications` — 投递CRUD, `POST /api/v1/career/applications/{id}/events` — 状态事件 |
| **验收标准** | (1) 投递状态机(saved→applied→written_test→interview→offer→rejected/withdrawn) (2) 复盘笔记 (3) 时间线事件记录 |
| **测试要求** | Repository + Service 单元测试 |
| **优先级** | P0 |
| **依赖其他组** | 无 |
| **可Mock独立开发** | ✅ |

## G3-06: 岗位推荐

| 属性 | 内容 |
|------|------|
| **任务名称** | 基于画像和匹配的个性化岗位推荐 |
| **业务依据** | 智能岗位匹配文档 — 岗位推荐 |
| **所属前端页面** | `/career` |
| **所属FastAPI模块** | `backend/app/modules/career/` |
| **需要的数据库表** | `career_jobs`, `career_matches`, `student_portraits` (只读) |
| **依赖Contract** | `StudentPortraitSummary`, `JobSummary`, `JobMatchResult` |
| **输入** | user_id, 筛选条件 (地域/薪资/行业) |
| **输出** | `GET /api/v1/career/recommendations` — 推荐岗位列表 |
| **验收标准** | (1) 基于画像的岗位排序 (2) 支持多维筛选 (3) 配有匹配度预览 |
| **测试要求** | Service层单元测试 |
| **优先级** | P2 |
| **依赖其他组** | Group2 (StudentPortraitSummary — 用Mock) |
| **可Mock独立开发** | ✅ |

## G3-07: 校企定向通道

| 属性 | 内容 |
|------|------|
| **任务名称** | 合作企业定向推送 + 学生授权管理 |
| **业务依据** | 智能岗位匹配文档 — 校企定向通道 (合作企业/定向岗位/候选人推送/学生授权/试点数据统计) |
| **所属前端页面** | `/career`, 管理后台 |
| **所属FastAPI模块** | `backend/app/modules/career/` |
| **需要的数据库表** | `candidate_pushes`, `student_data_authorizations`, `employers` |
| **依赖Contract** | `StudentSummary`, `JobSummary` |
| **输入** | employer_id, job_id, user_id, 授权范围 |
| **输出** | `POST /api/v1/career/candidate-pushes` — 推送, `POST /api/v1/career/authorizations` — 授权 |
| **验收标准** | (1) 教师/管理员推送学生 (2) 学生授权/拒绝 (3) 企业查看/反馈 (4) 推送结果追踪 (5) 试点统计 |
| **测试要求** | Repository + Service + API 测试 |
| **优先级** | P1 |
| **依赖其他组** | Shared/users (学生信息) |
| **可Mock独立开发** | ✅ |

## G3-08: 学生数据授权

| 属性 | 内容 |
|------|------|
| **任务名称** | 细粒度数据分享授权管理 |
| **业务依据** | 智能岗位匹配文档 — 学生授权 |
| **所属前端页面** | `/career`, `/account` |
| **所属FastAPI模块** | `backend/app/modules/career/` |
| **需要的数据库表** | `student_data_authorizations` |
| **依赖Contract** | `StudentSummary` |
| **输入** | user_id, employer_id, 授权范围 (简历/画像/成绩/证据/联系方式) |
| **输出** | 授权CRUD + 状态管理 (active/revoked/expired) |
| **验收标准** | (1) 五类数据独立授权 (2) 过期自动失效 (3) 撤销即时生效 (4) 授权历史追踪 |
| **测试要求** | Repository + Service 单元测试 |
| **优先级** | P1 |
| **依赖其他组** | 无 |
| **可Mock独立开发** | ✅ |

## G3-09: 就业数据管理

| 属性 | 内容 |
|------|------|
| **任务名称** | 正式就业数据导入/查询/统计 |
| **业务依据** | 智能岗位匹配文档 — 求职全过程 + 就业结果 + 实习评价 |
| **所属前端页面** | `/career`, 管理后台 |
| **所属FastAPI模块** | `backend/app/modules/employment/` |
| **需要的数据库表** | `student_employments`, `employers`, `employment_reviews`, `data_import_batches`, `data_import_rows` |
| **依赖Contract** | `StudentSummary`, `JobSummary` |
| **输入** | Excel/手动录入就业数据 |
| **输出** | 就业记录CRUD + 导入 + 审核 + 统计 |
| **验收标准** | (1) Excel批量导入 (2) 就业审核流程 (3) 去向统计 (4) 升学/留学单独记录 |
| **测试要求** | Repository + Service + Import 测试 |
| **优先级** | P2 |
| **依赖其他组** | Shared/imports (数据导入基础设施) |
| **可Mock独立开发** | ✅ |

---

## Group3 开发顺序建议

```
Phase A (可并行, 无外部组依赖):
  G3-01 岗位资源管理    ← P0
  G3-02 JD智能解析       ← P0
  G3-05 求职投递管理    ← P0

Phase B (依赖A, 外部用Mock):
  G3-03 人岗匹配引擎     ← P0, 依赖 G3-01 + G3-02 + Mock Group1/Group2
  G3-04 能力缺口分析     ← P1, 依赖 G3-03

Phase C (可并行):
  G3-08 学生数据授权     ← P1
  G3-07 校企定向通道     ← P1, 依赖 G3-01 + G3-08

Phase D:
  G3-06 岗位推荐         ← P2, 依赖 G3-03
  G3-09 就业数据管理     ← P2, 依赖 Shared/imports
```
