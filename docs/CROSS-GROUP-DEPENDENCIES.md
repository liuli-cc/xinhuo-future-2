# 薪火未来 — 跨组依赖分析与并行开发计划

> Phase 2 准备文档 — 指导三组并行开发

---

## 一、组间依赖总图

```
                            ┌──────────────────┐
                            │   Shared / Core   │
                            │  (平台公共底座)     │
                            │                   │
                            │  users, profiles   │
                            │  colleges, majors  │
                            │  ref_job_standard  │
                            │  admissions        │
                            │  files             │
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

---

## 二、哪些工作必须先完成 (阻塞项)

### 2.1 Shared/Core 必须就绪

| 项目 | 负责 | 理由 |
|------|------|------|
| `/api/v1/auth/*` (login/me/logout) | Shared | 所有业务API需要认证 |
| `/api/v1/files/upload` | Shared | Group1简历导出, Group2证据附件, Group3就业材料 |
| `/api/v1/reference/jobs` | Shared | Group2任务推荐, Group3岗位标准化 |
| `/api/v1/organization/colleges`, `/majors` | Shared | Group2基线测评, Group3匹配 |
| `student_profiles` + `users` CRUD | Shared | 所有组的基础数据 |

### 2.2 Group3 岗位资源必须先完成

| 任务 | 理由 |
|------|------|
| G3-01 岗位资源管理 | Group1的简历生成需要目标岗位JD |
| G3-02 JD智能解析 | Group2的决策引擎需要岗位要求 |

### 2.3 Group2 画像必须先完成

| 任务 | 理由 |
|------|------|
| G2-01 基线测评 | G2-02画像的数据来源 |
| G2-02 五维画像 | Group1简历生成上下文, Group3匹配核心输入 |

---

## 三、哪些工作可以同时进行

### 第一批 (Week 1-2): 完全独立的任务

| Group | 任务 | 依赖 |
|-------|------|------|
| Shared | auth完善 (account, sessions, recovery) | 无 |
| Shared | files上传完善 | 无 |
| Group1 | G1-11 LLM代理服务 | 无 |
| Group1 | G1-01 简历模板管理 | 无 |
| Group2 | G2-05 证据提交/审核 | Shared/files |
| Group2 | G2-07 榜样数据管理 | Shared/files |
| Group3 | G3-01 岗位资源管理 | Shared/reference |
| Group3 | G3-02 JD智能解析 | 无 |
| Group3 | G3-05 求职投递管理 | 无 |

### 第二批 (Week 2-3): 使用Mock依赖的任务

| Group | 任务 | Mock什么 |
|-------|------|----------|
| Group1 | G1-06 面试计划生成 | Mock Group3的JobSummary |
| Group1 | G1-07 文字面试引擎 | Mock LLM |
| Group2 | G2-01 基线测评系统 | 无 |
| Group2 | G2-03 学期成长计划 | Mock portrait数据 |
| Group3 | G3-03 人岗匹配引擎 | Mock Group2 Portrait + Group1 Resume/Interview |

### 第三批 (Week 3-4): 替换Mock为真实依赖

| Group | 任务 | 真实依赖就绪 |
|-------|------|-------------|
| Group1 | G1-02 AI简历生成 | G3-01 + G2-02 (画像) |
| Group1 | G1-09 面试评分 | G1-07 (面试引擎) |
| Group2 | G2-02 五维画像 | G2-05 + G2-01 |
| Group3 | G3-04 能力缺口 | G3-03 (匹配引擎) |
| Group3 | G3-07 校企定向 | G3-01 + G3-08 |

### 第四批 (Week 4+): 增强功能

| Group | 任务 |
|-------|------|
| Group1 | G1-03 简历版本, G1-04 PDF导出, G1-08 语音, G1-10 训练建议, G1-05 ATS |
| Group2 | G2-04 打卡进度, G2-06 决策引擎, G2-08 榜样匹配 |
| Group3 | G3-06 岗位推荐, G3-09 就业数据 |

---

## 四、Mock开发指南

当某个Contract的数据源尚未实现时, 使用Mock:

```python
# Group3 开发匹配引擎时, Group2画像还没就绪:
from app.tests.fixtures.mock_data import (
    make_student_portrait,
    make_growth_progress,
    make_generated_resume_summary,
    make_interview_assessment,
    make_job_requirement_profile,
)

# 组装匹配请求
request = make_job_match_request(user_id=1, job_id="test-job")

# 开发匹配算法
result = match_engine.compute(request)
```

Mock数据特点:
- 符合Contract字段定义
- 包含典型业务数据
- 支持参数覆盖 `make_xxx(user_id=42, **{"overall_score": 85})`

---

## 五、Feature Branch 命名规范

```
基础模式:  feature/g{组号}-{简短描述}

Group1:
  feature/g1-resume-generation     (AI简历生成)
  feature/g1-interview-session     (面试引擎)
  feature/g1-llm-proxy             (LLM代理)
  feature/g1-resume-template       (简历模板)
  feature/g1-voice-interview       (语音面试)

Group2:
  feature/g2-baseline-assessment   (基线测评)
  feature/g2-portrait-engine       (画像计算)
  feature/g2-growth-plan           (成长计划)
  feature/g2-evidence-review       (证据审核)
  feature/g2-role-model-match      (榜样匹配)

Group3:
  feature/g3-job-resource          (岗位资源)
  feature/g3-jd-parser             (JD解析)
  feature/g3-job-match             (人岗匹配)
  feature/g3-application-tracking  (投递管理)
  feature/g3-enterprise-channel    (校企定向)

Shared:
  feature/shared-file-upload       (文件上传)
  feature/shared-auth-sessions     (会话管理)
  feature/shared-account-crud      (账号管理)
```

---

## 六、PR流程速查

```
feature/g1-xxx ──PR──► group1-dev ──PR──► develop ──PR──► main
feature/g2-xxx ──PR──► group2-dev ──PR──► develop
feature/g3-xxx ──PR──► group3-dev ──PR──► develop
feature/shared-xxx ──PR──► develop
```

- **组内PR**: feature → groupX-dev (该组成员Review)
- **集成PR**: groupX-dev → develop (至少一个其他组成员Review)
- **生产PR**: develop → main (Shared负责人 + 所有组代表)

---

## 七、风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Group2画像未完成 | Group1简历+Group3匹配无法使用真实画像 | Mock独立开发, Contract已定义 |
| Group3岗位JD未完成 | Group1简历+面试缺少目标 | Mock JobSummary/JobRequirementProfile |
| Group1简历/面试未完成 | Group3匹配缺少综合数据 | Mock, 匹配算法独立开发 |
| Shared API不够用 | 各组自行绕过, 产生重复代码 | 各组通过PR补充Shared API |
| Contract字段不够 | 各组自定义补充, 产生不兼容 | Contract修改需跨组Review |

---

## 八、更新记录

| 日期 | 变更 |
|------|------|
| 2026-08-10 | Phase 2准备 — 初始版本 |
