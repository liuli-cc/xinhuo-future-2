# Group1 — AI简历 + AI模拟面试 开发任务清单

> 基于: AI简历与AI模拟面试功能模块文档
> 分支: `group1-dev` → `feature/g1-xxx`
> 依赖: Shared/Core (users, files, reference), Group3 (career_jobs), Group2 (portrait)

---

## 任务优先级说明

| 优先级 | 含义 |
|--------|------|
| P0 | 阻塞性 — 其他功能依赖此项 |
| P1 | 高优先级 — 核心业务价值 |
| P2 | 中优先级 — 增强功能 |
| P3 | 低优先级 — 锦上添花 |

---

## G1-01: 简历模板管理

| 属性 | 内容 |
|------|------|
| **任务名称** | 简历模板 CRUD |
| **业务依据** | AI简历功能文档 — 简历模板 |
| **所属前端页面** | `/interview` (简历模块区域) |
| **所属FastAPI模块** | `backend/app/modules/resume/` |
| **需要的数据库表** | `resume_templates` |
| **依赖Contract** | 无外部依赖 |
| **输入** | 模板名称、分类、布局配置JSON、样式配置JSON、段落定义JSON |
| **输出** | `GET /api/v1/resumes/templates` — 模板列表 |
| **验收标准** | (1) 可创建/编辑/删除模板 (2) 支持多分类 (3) 默认模板标记 |
| **测试要求** | Repository CRUD 单元测试 |
| **优先级** | P1 |
| **依赖其他组** | 无 |
| **可Mock独立开发** | ✅ 完全独立 |
| **Feature Branch** | `feature/g1-resume-template` |

## G1-02: AI简历生成引擎

| 属性 | 内容 |
|------|------|
| **任务名称** | AI简历生成核心逻辑 |
| **业务依据** | AI简历功能文档 — 学生经历筛选重组 + AI简历生成 |
| **所属前端页面** | `/interview` |
| **所属FastAPI模块** | `backend/app/modules/resume/` |
| **需要的数据库表** | `generated_resumes`, `users`, `student_profiles`, `student_portraits`, `evidence`, `career_jobs` |
| **依赖Contract** | `StudentSummary` (Shared), `StudentPortraitSummary` (Group2), `JobRequirementProfile` (Group3) |
| **输入** | user_id, career_job_id, 经历筛选参数, 模板选择 |
| **输出** | `POST /api/v1/resumes/{id}/generate` — `GeneratedResumeSummary` |
| **验收标准** | (1) 根据学生履历+岗位JD生成结构化简历 (2) 生成的简历包含: 基本信息/教育背景/技能/项目经历/实习经历 (3) 支持JSON结构化输出 |
| **测试要求** | Service层单元测试 (Mock LLM), 集成测试 |
| **优先级** | P0 — 核心功能 |
| **依赖其他组** | Group3 (JobRequirementProfile — 用Mock), Group2 (StudentPortraitSummary — 用Mock) |
| **可Mock独立开发** | ✅ 使用 `tests/fixtures/mock_data.py` |

## G1-03: 简历版本管理

| 属性 | 内容 |
|------|------|
| **任务名称** | 多版本简历管理 |
| **业务依据** | AI简历功能文档 — 多岗位定制简历 + 简历版本管理 |
| **所属前端页面** | `/interview` |
| **所属FastAPI模块** | `backend/app/modules/resume/` |
| **需要的数据库表** | `generated_resumes` |
| **依赖Contract** | `GeneratedResumeSummary` |
| **输入** | user_id, job_id (可选) |
| **输出** | `GET /api/v1/resumes` — 简历列表, `GET /api/v1/resumes/{id}` — 单份简历详情 |
| **验收标准** | (1) 列出学生所有简历 (2) 按岗位/版本号展示 (3) 支持标记当前版本 (4) 支持归档 |
| **测试要求** | Repository 单元测试 |
| **优先级** | P1 |
| **依赖其他组** | 无 |
| **可Mock独立开发** | ✅ |

## G1-04: 简历预览与PDF导出

| 属性 | 内容 |
|------|------|
| **任务名称** | 简历预览 + PDF导出 |
| **业务依据** | AI简历功能文档 — 简历预览 + PDF导出 |
| **所属前端页面** | `/interview` |
| **所属FastAPI模块** | `backend/app/modules/resume/` |
| **需要的数据库表** | `generated_resumes`, `resume_templates`, `files` |
| **依赖Contract** | `GeneratedResumeSummary` |
| **输入** | resume_id, 模板配置 |
| **输出** | HTML预览端点 / PDF文件下载 |
| **验收标准** | (1) HTML格式预览 (2) PDF生成并上传到COS (3) 返回file_id |
| **测试要求** | Service层单元测试 |
| **优先级** | P2 |
| **依赖其他组** | Shared/files (文件上传) |
| **可Mock独立开发** | ✅ (PDF生成可独立测试) |

## G1-05: ATS适配分析

| 属性 | 内容 |
|------|------|
| **任务名称** | 简历ATS评分与优化建议 |
| **业务依据** | AI简历功能文档 — ATS适配 |
| **所属前端页面** | `/interview` |
| **所属FastAPI模块** | `backend/app/modules/resume/` |
| **需要的数据库表** | `generated_resumes` |
| **依赖Contract** | `GeneratedResumeSummary` |
| **输入** | resume_id, job_requirements (可选) |
| **输出** | ATS评分 + 优化建议 (保存到generated_resumes.ats_score/ats_feedback) |
| **验收标准** | (1) ATS兼容性评分 (2) 关键词匹配分析 (3) 格式问题检测 (4) 具体修改建议 |
| **测试要求** | Service层单元测试 |
| **优先级** | P3 |
| **依赖其他组** | Group3 (JobRequirementProfile — 用Mock) |
| **可Mock独立开发** | ✅ |

## G1-06: 面试计划生成

| 属性 | 内容 |
|------|------|
| **任务名称** | 根据简历+岗位生成面试计划 |
| **业务依据** | AI模拟面试功能文档 — 面试计划 |
| **所属前端页面** | `/interview` |
| **所属FastAPI模块** | `backend/app/modules/interview/` |
| **需要的数据库表** | `interview_sessions`, `generated_resumes`, `career_jobs` |
| **依赖Contract** | `GeneratedResumeSummary`, `JobSummary`, `JobRequirementProfile` |
| **输入** | user_id, resume_id (可选), career_job_id (可选), 面试难度 |
| **输出** | `POST /api/v1/interview/plan` — 面试计划 (6-8题, 含分类和考察点) |
| **验收标准** | (1) 根据简历内容生成针对性问题 (2) 支持8类题型 (3) 每题含考察点说明 |
| **测试要求** | Service层单元测试 (Mock LLM) |
| **优先级** | P0 — 核心功能 |
| **依赖其他组** | Group3 (JobSummary — 用Mock) |
| **可Mock独立开发** | ✅ |

## G1-07: 文字面试引擎

| 属性 | 内容 |
|------|------|
| **任务名称** | 文字面试核心流程: 开场/答题/追问/结束 |
| **业务依据** | AI模拟面试功能文档 — 文字面试 + 动态追问 |
| **所属前端页面** | `/interview` |
| **所属FastAPI模块** | `backend/app/modules/interview/` |
| **需要的数据库表** | `interview_sessions` |
| **依赖Contract** | `InterviewAssessmentSummary` |
| **输入** | 面试计划、用户回答、历史上下文 |
| **输出** | 下一题/追问/分析/最终报告 |
| **验收标准** | (1) 标准面试流程 (2) 根据回答质量动态追问 (3) 支持最多10轮对话 |
| **测试要求** | Service层单元测试 (Mock LLM) |
| **优先级** | P0 — 核心功能 |
| **依赖其他组** | 无 |
| **可Mock独立开发** | ✅ |

## G1-08: 语音面试 (ASR + TTS)

| 属性 | 内容 |
|------|------|
| **任务名称** | 语音面试 — 语音输入输出 |
| **业务依据** | AI模拟面试功能文档 — 语音面试 + ASR + TTS |
| **所属前端页面** | `/interview` |
| **所属FastAPI模块** | `backend/app/modules/interview/`, `backend/app/integrations/asr/`, `backend/app/integrations/tts/` |
| **需要的数据库表** | `interview_sessions` |
| **依赖Contract** | 无跨组依赖 |
| **输入** | 音频Base64/WAV, 文本 |
| **输出** | `POST /api/v1/interview/asr` — 识别文本, `POST /api/v1/interview/tts` — 音频Base64 |
| **验收标准** | (1) WAV录音识别为文本 (2) 文本合成为MP3音频 (3) 错误时回退文字模式 |
| **测试要求** | Service层单元测试 (Mock腾讯云API) |
| **优先级** | P1 |
| **依赖其他组** | 无 |
| **可Mock独立开发** | ✅ |

## G1-09: 面试评分与复盘

| 属性 | 内容 |
|------|------|
| **任务名称** | 面试自动评分 + 多维度复盘 |
| **业务依据** | AI模拟面试功能文档 — 面试评分 + 面试复盘 + 能力短板分析 |
| **所属前端页面** | `/interview` |
| **所属FastAPI模块** | `backend/app/modules/interview/` |
| **需要的数据库表** | `interview_sessions` |
| **依赖Contract** | `InterviewAssessmentSummary` (输出) |
| **输入** | session_id, 全部回答记录 |
| **输出** | `InterviewAssessmentSummary` — 含评分、优势、短板、改进建议 |
| **验收标准** | (1) 五维度评分 (2) 逐题点评 (3) 优势/短板/建议 (4) 生成结构化报告 |
| **测试要求** | Service层单元测试 (Mock LLM for review) |
| **优先级** | P0 — 核心功能 |
| **依赖其他组** | 无 |
| **可Mock独立开发** | ✅ |

## G1-10: 面试训练建议

| 属性 | 内容 |
|------|------|
| **任务名称** | 基于面试结果生成训练计划 |
| **业务依据** | AI模拟面试功能文档 — 面试训练建议 |
| **所属前端页面** | `/interview` |
| **所属FastAPI模块** | `backend/app/modules/interview/` |
| **需要的数据库表** | `interview_sessions`, `growth_tasks` (只读) |
| **依赖Contract** | `InterviewAssessmentSummary`, `GrowthProgressSummary` (Group2) |
| **输入** | user_id, 最近N次面试结果 |
| **输出** | 训练建议列表 (可转为 growth_tasks) |
| **验收标准** | (1) 识别反复出现的短板 (2) 生成针对性练习建议 (3) 可选: 自动创建 growth_task |
| **测试要求** | Service层单元测试 |
| **优先级** | P2 |
| **依赖其他组** | Group2 (GrowthProgressSummary — 用Mock) |
| **可Mock独立开发** | ✅ |

## G1-11: LLM代理服务

| 属性 | 内容 |
|------|------|
| **任务名称** | 多模型API代理 (DeepSeek/Kimi/GLM/通义千问/MiMo/豆包) |
| **业务依据** | AI模拟面试功能文档 — 外部模型连接 |
| **所属前端页面** | `/interview` |
| **所属FastAPI模块** | `backend/app/integrations/llm/` |
| **需要的数据库表** | 无持久化 |
| **依赖Contract** | 无跨组依赖 |
| **输入** | provider, model, api_key, action (test/opening/turn/review), messages |
| **输出** | `POST /api/v1/interview/model` — 模型返回 |
| **验收标准** | (1) 6家模型统一代理 (2) API Key不持久化/不记录日志 (3) 超时处理 (4) JSON输出模式支持 |
| **测试要求** | Service层单元测试 (Mock HTTP) |
| **优先级** | P0 — 核心功能 |
| **依赖其他组** | 无 |
| **可Mock独立开发** | ✅ |

---

## Group1 开发顺序建议

```
Phase A (可并行):
  G1-11 LLM代理服务    ← P0, 无依赖, 被其他任务依赖
  G1-01 简历模板管理    ← P1, 无依赖

Phase B (依赖A):
  G1-06 面试计划生成    ← P0, 依赖G1-11
  G1-07 文字面试引擎    ← P0, 依赖G1-11 + G1-06

Phase C (依赖B):
  G1-02 AI简历生成      ← P0, 依赖G1-11 + Group3(已Mock) + Group2(已Mock)
  G1-09 面试评分        ← P0, 依赖G1-07

Phase D (可并行):
  G1-03 简历版本管理    ← P1, 依赖G1-02
  G1-08 语音面试        ← P1, 依赖G1-07
  G1-04 简历预览/PDF    ← P2
  G1-10 面试训练建议    ← P2, 依赖G1-09
  G1-05 ATS分析         ← P3
```
