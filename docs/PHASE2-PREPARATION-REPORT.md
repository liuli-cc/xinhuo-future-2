# 薪火未来 — Phase 2 准备完成报告

> 日期: 2026-08-10
> 状态: 完成，等待人工分配开发任务

---

## 一、三个组完整 Backlog

| 文件 | 任务数 | 位置 |
|------|--------|------|
| GROUP1-BACKLOG.md | 11 任务 (G1-01 ~ G1-11) | `docs/GROUP1-BACKLOG.md` |
| GROUP2-BACKLOG.md | 8 任务 (G2-01 ~ G2-08) | `docs/GROUP2-BACKLOG.md` |
| GROUP3-BACKLOG.md | 9 任务 (G3-01 ~ G3-09) | `docs/GROUP3-BACKLOG.md` |

### Group1 任务清单 (AI简历 + AI模拟面试)

| ID | 任务 | 优先级 | 依赖 |
|----|------|--------|------|
| G1-01 | 简历模板管理 | P1 | 无 |
| G1-02 | AI简历生成引擎 | P0 | Group3(JD-Mock), Group2(画像-Mock) |
| G1-03 | 简历版本管理 | P1 | G1-02 |
| G1-04 | 简历预览与PDF导出 | P2 | Shared/files |
| G1-05 | ATS适配分析 | P3 | Group3(JD-Mock) |
| G1-06 | 面试计划生成 | P0 | G1-11, Group3(Job-Mock) |
| G1-07 | 文字面试引擎 | P0 | G1-11, G1-06 |
| G1-08 | 语音面试 (ASR+TTS) | P1 | G1-07 |
| G1-09 | 面试评分与复盘 | P0 | G1-07 |
| G1-10 | 面试训练建议 | P2 | G1-09, Group2(进度-Mock) |
| G1-11 | LLM代理服务 | P0 | 无 |

### Group2 任务清单 (任务匹配 + 榜样激励)

| ID | 任务 | 优先级 | 依赖 |
|----|------|--------|------|
| G2-01 | 基线测评系统 | P0 | Shared |
| G2-02 | 五维能力画像计算 | P0 | G2-01, G2-05 |
| G2-03 | 学期成长计划管理 | P0 | G2-01 |
| G2-04 | 任务打卡与进度追踪 | P1 | G2-03 |
| G2-05 | 证据提交与审核 | P0 | Shared/files |
| G2-06 | 成长决策引擎 | P1 | G2-02, Group3(JD-Mock) |
| G2-07 | 榜样数据管理 | P1 | Shared/files |
| G2-08 | 榜样智能匹配 | P1 | G2-02, G2-07 |

### Group3 任务清单 (智能岗位匹配)

| ID | 任务 | 优先级 | 依赖 |
|----|------|--------|------|
| G3-01 | 岗位资源管理 | P0 | Shared/reference |
| G3-02 | JD智能解析 | P0 | 无 |
| G3-03 | 人岗匹配引擎 | P0 | G3-01, G3-02, Mock Group1/Group2 |
| G3-04 | 能力缺口分析 | P1 | G3-03 |
| G3-05 | 求职投递管理 | P0 | 无 |
| G3-06 | 岗位推荐 | P2 | G3-03, Group2(画像-Mock) |
| G3-07 | 校企定向通道 | P1 | G3-01, G3-08 |
| G3-08 | 学生数据授权 | P1 | 无 |
| G3-09 | 就业数据管理 | P2 | Shared/imports |

---

## 二、公共 Contract (跨组数据 Schema)

| Contract | Owner | 文件 | Consumers |
|----------|-------|------|-----------|
| `StudentSummary` | Shared | `contracts/student.py` | Group1, Group2, Group3 |
| `StudentAcademicProfile` | Shared | `contracts/student.py` | Group2, Group3 |
| `StudentCareerIntent` | Shared/Group2 | `contracts/student.py` | Group1, Group3 |
| `StudentPortraitSummary` | Group2 | `contracts/portrait.py` | Group1, Group3 |
| `GrowthProgressSummary` | Group2 | `contracts/portrait.py` | Group3 |
| `RoleModelMatchSummary` | Group2 | `contracts/role_model.py` | Group1, Group3 |
| `JobSummary` | Group3 | `contracts/job.py` | Group1, Group2 |
| `JobRequirementProfile` | Group3 | `contracts/job.py` | Group1, Group2 |
| `GeneratedResumeSummary` | Group1 | `contracts/resume.py` | Group3 |
| `InterviewAssessmentSummary` | Group1 | `contracts/interview.py` | Group3 |
| `JobMatchRequest` | Group3 | `contracts/matching.py` | (internal assembly) |
| `JobMatchResult` | Group3 | `contracts/matching.py` | Group1, Group2 |

所有 Contract 基于实际数据库列设计，字段映射已验证通过。详见 `docs/API-CONTRACTS.md` 和 `backend/app/contracts/README.md`。

---

## 三、Stub / Fixture 设计

**位置**: `backend/app/tests/fixtures/mock_data.py`

**10 个 Mock 生成器**，每个对应一个 Contract 类型:

| 生成器 | 对应 Contract |
|--------|--------------|
| `make_student_summary()` | `StudentSummary` |
| `make_student_academic_profile()` | `StudentAcademicProfile` |
| `make_student_career_intent()` | `StudentCareerIntent` |
| `make_student_portrait()` | `StudentPortraitSummary` |
| `make_growth_progress()` | `GrowthProgressSummary` |
| `make_role_model_match()` | `RoleModelMatchSummary` |
| `make_job_summary()` | `JobSummary` |
| `make_job_requirement_profile()` | `JobRequirementProfile` |
| `make_generated_resume_summary()` | `GeneratedResumeSummary` |
| `make_interview_assessment()` | `InterviewAssessmentSummary` |
| `make_job_match_request()` | `JobMatchRequest` (组装所有组数据) |
| `make_job_match_result()` | `JobMatchResult` |

**使用方式**:

```python
from app.tests.fixtures.mock_data import make_student_portrait

# Group3 开发匹配算法时 Group2 画像未就绪:
portrait = make_student_portrait(user_id=1, **{"overall_score": 85})
```

---

## 四、模块边界测试

**位置**: `backend/app/tests/test_boundaries.py`

**9 个测试** (全部通过):

| 测试类 | 测试数 | 验证内容 |
|--------|--------|----------|
| `TestTableOwnership` | 3 | 每个组拥有的表不重叠、不与Shared冲突、无遗漏 |
| `TestCrossGroupAccess` | 4 | 各组只读允许的表、不写其他组的表 |
| `TestContractSchemas` | 2 | Mock数据全部有效、Contract字段对应真实DB列 |

全部测试 (`13 passed`): 4 个健康检查 + 9 个边界测试

---

## 五、组间依赖图

```
                            ┌──────────────────┐
                            │   Shared / Core   │
                            │  users, profiles   │
                            │  colleges, majors  │
                            │  ref_job_standard  │
                            │  admissions, files │
                            └──────┬─┬─┬────────┘
                                   │ │ │
                    ┌──────────────┼─┼─┼──────────────┐
                    │              │ │ │              │
                    ▼              ▼   ▼              ▼
            ┌──────────┐   ┌──────────┐   ┌──────────┐
            │  Group1  │   │  Group2  │   │  Group3  │
            │AI简历+面试│   │任务+榜样  │   │智能匹配   │
            └────┬─────┘   └────┬─────┘   └────┬─────┘
                 │              │              │
                 │  Portrait ◄──┤              │
                 │  Growth   ◄──┤              │
                 │              │              │
                 ├── Resume ────┼──────────────►
                 ├── Interview ─┼──────────────►
                 │              │              │
                 │         JobSummary ◄────────┤
                 │   JobRequirement ◄──────────┤
                 │              │              │
                 │         JobMatchResult ◄────┤
                 │         JobGap ◄────────────┤
                 └──────────────┴──────────────┘
```

核心数据流: `Shared → Group2(画像) → Group3(匹配) ← Group1(简历/面试)`

---

## 六、第一批建议并行开发任务

### Batch 1 (完全独立，可立即开始)

| Group | 任务 | Feature Branch |
|-------|------|----------------|
| Shared | auth完善 (account, sessions) | `feature/shared-auth-sessions` |
| Shared | files上传完善 | `feature/shared-file-upload` |
| Group1 | G1-11 LLM代理服务 | `feature/g1-llm-proxy` |
| Group1 | G1-01 简历模板管理 | `feature/g1-resume-template` |
| Group2 | G2-05 证据提交与审核 | `feature/g2-evidence-review` |
| Group2 | G2-07 榜样数据管理 | `feature/g2-role-model-data` |
| Group3 | G3-01 岗位资源管理 | `feature/g3-job-resource` |
| Group3 | G3-02 JD智能解析 | `feature/g3-jd-parser` |
| Group3 | G3-05 求职投递管理 | `feature/g3-application-tracking` |

### Batch 2 (使用Mock依赖)

| Group | 任务 | Mock什么 |
|-------|------|----------|
| Group1 | G1-06 面试计划生成 | Mock G3-01 (JobSummary) |
| Group1 | G1-07 文字面试引擎 | Mock LLM |
| Group2 | G2-01 基线测评系统 | 无 |
| Group2 | G2-03 学期成长计划 | Mock portrait |
| Group3 | G3-03 人岗匹配引擎 | Mock G2-02 (Portrait) + G1 (Resume/Interview) |

### Batch 3 (替换Mock为真实)

| Group | 任务 | 真实依赖就绪 |
|-------|------|-------------|
| Group1 | G1-02 AI简历生成 | G3-01 + G2-02 |
| Group1 | G1-09 面试评分 | G1-07 |
| Group2 | G2-02 五维画像 | G2-01 + G2-05 |
| Group3 | G3-04 能力缺口 | G3-03 |

### Batch 4 (增强功能)

| Group | 任务 |
|-------|------|
| Group1 | G1-03, G1-04, G1-08, G1-10, G1-05 |
| Group2 | G2-04, G2-06, G2-08 |
| Group3 | G3-06, G3-07, G3-08, G3-09 |

---

## 七、每项任务应从哪个 Group Branch 建立 Feature Branch

| Group | 长期分支 | Feature Branch 模式 |
|-------|----------|---------------------|
| Shared | `develop` | `feature/shared-{描述}` |
| Group1 | `group1-dev` | `feature/g1-{描述}` |
| Group2 | `group2-dev` | `feature/g2-{描述}` |
| Group3 | `group3-dev` | `feature/g3-{描述}` |

示例:
```
group1-dev → feature/g1-resume-generation
group2-dev → feature/g2-baseline-assessment
group3-dev → feature/g3-job-match
develop    → feature/shared-account-crud
```

---

## 八、哪些工作必须先完成 (阻塞项)

| # | 任务 | 负责 | 阻塞原因 |
|---|------|------|----------|
| 1 | `/api/v1/auth/*` 完善 | Shared | 所有业务API需要认证 |
| 2 | `/api/v1/files/upload` 完善 | Shared | Group1简历/Group2证据/Group3材料 |
| 3 | G3-01 岗位资源管理 | Group3 | Group1简历+Group2决策都需要岗位数据 |
| 4 | G2-02 五维画像计算 | Group2 | Group1简历上下文+Group3匹配核心输入 |

---

## 九、哪些工作可以同时进行

除上述 4 项外，其余 **24 项任务都可以通过 Mock 并行开发**，互不阻塞。

详见 `docs/CROSS-GROUP-DEPENDENCIES.md` 中的 Mock 开发指南。

---

## 十、验收确认

| # | 标准 | 状态 |
|---|------|------|
| 1 | 三个组完整Backlog | ✅ 28 项任务 |
| 2 | 公共Contract定义 | ✅ 12 个Schema |
| 3 | Stub/Fixture设计 | ✅ 10 个Mock生成器 |
| 4 | 模块边界测试 | ✅ 9 个测试全部通过 (13 total) |
| 5 | 组间依赖图 | ✅ Mermaid图 + 文字说明 |
| 6 | 第一批并行任务 | ✅ Batch 1-4 计划 |
| 7 | Feature Branch规范 | ✅ 命名规则 + PR流程 |
| 8 | 阻塞项识别 | ✅ 4 项必须先完成 |
| 9 | 同时进行项识别 | ✅ 24 项可并行 |

---

**下一步**: 人工分配 Backlog 任务给具体开发人员，各开发人员从对应分支创建 Feature Branch 开始实现。

**Phase 2 准备完成。停止，等待人工确认后分配开发任务。**
