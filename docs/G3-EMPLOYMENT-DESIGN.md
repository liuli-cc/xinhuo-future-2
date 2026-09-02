# 实习就业模块 v2 设计 — 岗位大厅 · 校招公告 · 求职工作台

> Group 3 · 本文档是 /grill-with-docs 拷问会的结论，术语见根目录 [CONTEXT.md](../CONTEXT.md)，关键决策见 [ADR-0001](adr/0001-deterministic-match-engine.md)、[ADR-0002](adr/0002-jobs-announcements-split.md)。

## 一、决策速览

| 决策点 | 结论 |
|--------|------|
| 数据结构 | 岗位、公告、岗位投递、公告投递、岗位收藏、公告收藏**全部分表**；employers 共用（ADR-0002） |
| 页面结构 | 侧边栏保持「实习就业」一个入口，页内三个标签：**岗位 / 校招公告 / 求职工作台** |
| 匹配范围 | 智能推荐只做**岗位**；公告不做匹配，永远时间倒序 + 筛选 |
| 匹配架构 | 三层管线：入库时 AI 结构化岗位需求（无密钥降级关键词）→ 学生侧结构化（基本信息+佐证，简历二期接入）→ 匹配时纯确定性计算（硬条件卡掉 + 维度加权 + 逐条解释）。运行时不调 LLM（ADR-0001） |
| 投递状态 | 阶段 7 态（待投递→已投递→待笔试→已笔试→待面试→已面试→已Offer）+ 结束原因 2 态（未通过/已终止），两层分开存储 |
| 数据导入 | 管理员 + 被授予「就业管理」权限的教师，后台上传 xlsx 直接入库，按「公司+岗位名+投递网址」去重，类别自动推断可改，写审计 |
| 过期规则 | 有截止时间按截止时间；没有的——岗位发布起 **3 个月**、公告发布起 **6 个月**自动过期（查询时动态计算，无定时任务）；管理员保留提前下架按钮 |
| 学生导入岗位 | 降级为「自定义岗位」，仅进自己工作台，不出现在大厅 |
| 校企合作 | v1 教师/管理员代录 + 「校企合作」徽章；企业账号、候选人推送留二期 |

## 二、数据库变更

```
career_jobs（改造：学生个人快照 → 共享岗位表）
  + category        ENUM('intern','campus','social')   实习/校招/社招
  + majors_text     VARCHAR(500)   专业限制原文
  + industries      VARCHAR(200)   行业标签（逗号分隔）
  + company_nature  VARCHAR(40)    企业性质（国企/央企/…）
  + published_at    BIGINT         发布/录入时间（默认排序依据）
  + deadline        BIGINT NULL    截止时间
  + source          ENUM('import','school_coop','custom')
  + visibility      ENUM('public','private')   private=学生自定义岗位
  + status          ENUM('active','offline')   过期由规则动态判定，不落库
  + requirement_profile  JSON      AI 解析的结构化需求档案（第 1 层产物）
  user_id → created_by（仅 custom 来源有值）

career_announcements（新表）
  id / title(简章标题) / employer_id / city_text / cohort(届数,如"27届")
  positions_text(岗位清单原文) / detail_url / apply_url
  published_at / deadline NULL / source('import','school_coop') / status

career_applications（岗位投递，改造现有表）
  status(旧7态单字段) → stage ENUM('saved','applied','written_test_pending',
        'written_test','interview_pending','interview','offer')
        + outcome ENUM('rejected','withdrawn') NULL + closed_at NULL
  迁移映射：saved→saved, applied→applied, written_test→written_test_pending,
        interview→interview_pending, offer→offer,
        rejected→outcome=rejected, withdrawn→outcome=withdrawn

career_announcement_applications（新表，字段与上表一致，指向 announcement_id）
career_events / career_announcement_events（事件表随投递各一张，结构相同）
career_favorites / career_announcement_favorites（各：id/user_id/目标id/created_at）
employers 复用现有表与去重逻辑
```

## 三、接口清单

通用约定：全部在 `/api/v1` 下；列表均支持 `page/pageSize`、返回 `{items,total}`；过期条目默认不出现，`includeExpired=1` 时以灰态返回。

**岗位（大厅）**
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/career/jobs` | 筛选：`category,industry,city,q,fitForMe,includeExpired`；默认 published_at 倒序；`fitForMe=1` 按匹配分排序并在条目上带 `matchScore` |
| GET | `/career/jobs/{id}` | 详情：含 requirement_profile 摘要 + 当前学生的匹配报告（若有） |
| POST | `/career/jobs/{id}/match` | 现有接口升级：硬条件过滤 + 新打分 |
| POST | `/career/jobs/{id}/interpret` | 可选「AI 解读」文案（不改分数） |

**校招公告**
| GET | `/career/announcements` | 筛选：`cohort,industry,city,q`；时间倒序 |
| GET | `/career/announcements/{id}` | 详情：含岗位清单原文 |

**导入与治理（权限：admin 或持有就业管理授权的教师；写审计）**
| POST | `/admin/career/jobs/import` | 上传 xlsx（岗位信息1/2 列格式），解析→去重→入库→AI 需求解析 |
| POST | `/admin/career/announcements/import` | 上传 xlsx（国聘雷达列格式） |
| PATCH | `/admin/career/jobs/{id}` 与 `/admin/career/announcements/{id}` | 改类别/标签、提前下架 |
| GET | `/admin/career/import-logs` | 导入批次与冲突记录 |

**岗位投递（现有路径升级）**
| GET/POST | `/career/applications` | 列表按 `stage/outcome` 筛选（工作台进度条） |
| POST | `/career/applications/{id}/events` | 记录阶段变更+复盘（写事件表） |
| GET | `/career/applications/{id}/events` | **新增**：时间线 |

**公告投递（新，路径同构）**：`/career/announcement-applications` 全套。

**收藏**：`/career/favorites` 与 `/career/announcement-favorites`（GET 列表 / POST / DELETE）。

**权限**：`core/permissions.py` 新增 `can_manage_employment(actor)` = admin 系 OR teacher 且 `users.employment_admin=1`（新布尔列，管理员在账号管理页勾选授予）。导入、治理接口走它。

## 四、匹配管线（落地到代码的位置）

1. **第 1 层 · 需求解析**（`career/service.py` 新增 `build_requirement_profile`）：导入时调用；有 `LLM_API_KEY` 用 LLM 输出 `{skills:[{name,required}], majors[], hardReqs[]}`，异常/无 Key 降级为现有 `parse_requirements` 关键词规则。结果存 `requirement_profile`，**导入后不重复解析**。
2. **第 2 层 · 学生侧结构化**（`StudentProfileProvider`）：基本信息（专业/年级/目标方向）+ 佐证（标题/详情/维度→技能标签抽取，规则即可）；简历输入口留空，Group1 数据就绪后插入。
3. **第 3 层 · 确定性匹配**（改造 `build_match`）：
   - 硬过滤：专业（majors 为空或含"不限"→通过；否则文本包含匹配）；hardReqs 逐条比对，不满足→淘汰并在结果里说明原因
   - 打分：技能覆盖（required 权重×2）30% + 五维画像加权 40% + 年级契合 15% + 方向一致 15%
   - 输出：总分/ verdict/ 逐条解释（✓/✗ 及证据来源）
4. 公告不进此管线。`fitForMe` 排序 = 对当前学生逐岗位实时算（900 条纯函数计算 <50ms，无需预计算）。

## 五、页面布局（/career 页内三标签）

```
┌─ 实习就业 ──────────────────────────────────────────────┐
│ [岗位] [校招公告] [求职工作台]        ← 页内标签，不新增一级导航 │
│                                                          │
│ ① 岗位标签                                               │
│   筛选条：[实习|校招|社招] [类型▾] [城市▾] [搜索框]          │
│           (适合我★开关) (含已过期☐)                        │
│   岗位卡：[校招/实习章][企业性质章][校企合作章] 岗位名       │
│           公司 · 城市 · 截止 · 专业限制摘要                 │
│           [匹配分徽章(适合我时)] [★收藏] [详情展开] [投递]   │
│   分页                                                    │
│                                                          │
│ ② 校招公告标签：同构（届数筛选；卡片带岗位清单摘要；无匹配分）  │
│                                                          │
│ ③ 求职工作台标签                                          │
│   进度筛选条：全部 | 待投递 | 已投递 | 待笔试 | 已笔试       │
│              | 待面试 | 已面试 | 已Offer | 未通过 | 已终止   │
│   投递卡（岗位投递、公告投递两个分组）：状态徽章/最近复盘/     │
│     [更新阶段下拉+复盘输入] [时间线展开(事件历史)] [★]       │
│   我的收藏区（岗位/公告两组）  ·  [+自定义岗位] 入口          │
└──────────────────────────────────────────────────────────┘
```

## 六、开发任务拆分（可独立分配）

| # | 任务 | 内容 | 依赖 | 验收标准 |
|---|------|------|------|----------|
| T1 | 数据库与模型 | 全部新表/改造 + alembic 迁移 + 旧状态迁移映射 | 无 | 迁移可重复执行；旧数据按映射落位；`pytest` 全绿 |
| T2 | 权限 | `employment_admin` 列 + `can_manage_employment` + 账号管理页勾选 | 无 | 无授权教师调导入接口 403；审计可查 |
| T3 | 岗位导入 | xlsx 解析（两种列模板）、去重、类别推断、需求解析（LLM+降级）、导入日志 | T1 T2 | 900 行样本导入成功；重复导入零新增；无 Key 时走关键词 |
| T4 | 岗位大厅接口 | 列表筛选/排序/过期规则/详情 | T1 | 筛选组合正确；过期条目默认不可见；`fitForMe` 返回分数 |
| T5 | 投递状态机升级 | stage/outcome 两层 + 时间线 GET + 迁移 | T1 | 非法流转被拒；时间线完整回放；旧数据可查 |
| T6 | 公告全套 | 公告表接口 + 导入 + 公告投递 + 公告收藏（复用 T5 规则模块） | T1 T2 T5 | 公告投递全流程走通；与岗位投递共用同一状态机模块 |
| T7 | 收藏 | 两张收藏表 + 接口 | T1 | 未投递可收藏；工作台收藏区正确分组 |
| T8 | 匹配引擎 v2 | 硬条件过滤 + 需求档案比对 + 解释输出 + fitForMe | T3 | 有硬条件缺口的岗位被卡掉且说明原因；同一输入分数稳定；单测覆盖 |
| T9 | 前端·岗位标签 | 筛选条/卡片/收藏/投递/分页 | T4 T7 T8 | 三种章、匹配分徽章、过期灰态正确渲染 |
| T10 | 前端·公告标签 | 同构 | T6 | 届数筛选、岗位清单摘要展示 |
| T11 | 前端·工作台改版 | 进度筛选条/时间线/公告投递分组/自定义岗位 | T5 T6 T7 | 十个进度档计数正确；时间线可展开 |
| T12 | 演示数据与验收 | 真实 xlsx 全量导入、端到端流程脚本 | 全部 | 新学生注册→大厅→投递→复盘全流程无阻断 |

建议顺序：T1→T2 并行 T5→T3→T4→T8 后端线；T6 依赖 T5 规则模块；前端 T9-T11 在对应接口就绪后开工。T3/T8 是核心难点，建议由对匹配逻辑最熟的人做。

## 七、风险与边界

- **LLM 密钥**：所有 AI 环节必须有降级路径（已内建），演示前务必验证无 Key 模式
- **简历输入**：依赖 Group1 解析数据，二期经 Contract 接入，v1 不阻塞
- **培养方案课程级匹配**：待学校数据，二期
- **数据合规**：国聘雷达为付费数据，可用于比赛演示，公开部署前需确认版权
- **企业侧功能**（企业账号、候选人推送、学生授权）：表已预留，二期
