# 薪火未来 · 大学生成长决策平台

面向大学生的成长与职业规划平台。当前版本由腾讯云 CloudBase 静态网站托管、HTTP 云函数和文档数据库组成，适合中国大陆网络访问。

## 功能

- 学生学号与教师工号自助注册、分角色登录、失败锁定和设备会话
- 学生档案、四年成长地图和自定义成长任务
- 佐证文件上传、SHA-256 完整性记录、多角色审核和真实进度计算
- XH-EGM-2.0 证据型能力画像与公开评分方法
- XH-DPE-1.0 目标差距和动态行动优先级
- XH-JFM-1.0 真实岗位快照、证据型匹配、投递复盘与成长补强闭环
- XH-SIE-3.0 六厂商动态模拟面试、100 分制规则计分、口语表达分析与 PDF/Word 报告导出
- 内蒙古师范大学人工智能学院导师中心
- 新账号审核、停用与恢复；教师按院系和班级管理学生，管理员管理全范围账号
- 独立教师工作台、学生账号审核、成长佐证审核与班级归属校正
- 个人数据导出、7 天注销撤销期和管理员辅助密码找回
- 管理员用户统计、佐证审核、文件容量预警和注销处理

成长规划仍由确定性规则引擎生成。模拟面试支持用户临时连接 DeepSeek、Kimi、智谱 GLM、通义千问、MiMo 或豆包官方 API：外部模型只负责生成问题、动态追问和提取回答依据，最终分数仍由 XH-SIE 规则引擎计算。API Key 仅保存在当前页面内存，不写入数据库、日志或源码。完整方法见 [`docs/CORE-V2.md`](docs/CORE-V2.md)。

## 数据规则

账号、学生档案、成长任务、能力证据、模拟面试、岗位快照、匹配报告和投递过程全部保存在 CloudBase 文档数据库。静态网页只在浏览器 `localStorage` 中保存一枚有期限的随机会话令牌；密码散列、业务记录和数据库访问身份都不进入前端代码。

新注册学生和教师默认进入 `pending` 状态：学生由本班教师或管理员审核，教师由管理员核验工号、院系与负责班级。审核通过前不能登录；驳回和停用原因会明确反馈给账号本人。

新注册学生的任务进度、能力指数和职业准备度从 0 开始。学生提交文件、成果链接、证书编号、教务记录或教师评价后，佐证先进入人工审核；只有 `verified` 状态的佐证才会完成任务并增加进度。

## 主要数据集合

- `xh_users`：学号或工号、角色、审核状态、学籍资料和密码派生结果
- `xh_sessions`：不可逆摘要作为主键的登录会话
- `xh_growth_tasks`：每位学生独立的成长任务
- `xh_evidence`、`xh_evidence_files`、`xh_evidence_reviews`：佐证、附件和审核历史
- `xh_interview_sessions`：结构化面试答案和可解释报告
- `xh_career_jobs`、`xh_career_matches`：学生导入的岗位快照和证据匹配
- `xh_career_applications`、`xh_career_events`：投递阶段与复盘历史
- `xh_recommendation_feedback`：行动建议反馈
- `xh_audit_logs`：关键账号、审核和隐私操作审计
- `xh_recovery_requests`、`xh_deletion_requests`：账号恢复与带撤销期的注销流程
- `xh_cloud_state`：收藏、对话等轻量个人状态

密码使用 PBKDF2-SHA256、随机盐和 310,000 次迭代派生；旧版本哈希在修改密码前兼容验证。管理员初始化参数和数据库连接只通过服务端环境变量提供，不写入前端代码。

## 外部面试模型

`/api/interview/model` 只允许访问三家预设的官方对话接口，不接受自定义 Base URL：

- DeepSeek：`https://api.deepseek.com/chat/completions`
- Kimi：`https://api.moonshot.cn/v1/chat/completions`
- 智谱 GLM：`https://open.bigmodel.cn/api/paas/v4/chat/completions`
- 通义千问：`https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions`
- MiMo：`https://api.xiaomimimo.com/v1/chat/completions`
- 豆包：`https://ark.cn-beijing.volces.com/api/v3/chat/completions`
- Kimi：`https://api.moonshot.cn/v1/chat/completions`
- 智谱 GLM：`https://open.bigmodel.cn/api/paas/v4/chat/completions`

用户在模拟面试页面选择服务商、填写模型名称和自己的 API Key，并明确同意将本次面试文本发送给该服务商。若关联某条本人投递记录，服务端会再次校验归属，并把岗位原文作为不可执行的参考材料交给模型。密钥随当前请求经 HTTPS 传给服务端代理，调用结束后立即丢弃；页面刷新、结束面试或生成报告后，浏览器内存中的密钥也会清除。

DeepSeek 面试调用会显式关闭思考模式，避免连接测试或结构化追问的输出额度被推理内容占用；正式面试请求同时启用 JSON 输出模式，提升问题和分析结果的稳定性。

面试结束后，平台会按经历内容、岗位匹配、专业深度、逻辑结构和语言表达五个维度生成 100 分制报告，给出回答亮点、改进建议、三步行动计划和逐题证据。语言表达维度会记录语速、停顿、回答前思考时间和“嗯、啊”等口头语密度，但不会因为正常思考停顿机械扣分。用户可以在任意已完成一轮回答后选择“结束并生成报告”，报告即使暂时无法保存到云端也会先在当前浏览器中生成，并支持下载 Markdown、Word 和 PDF。

## 简历识别边界

- PDF、DOC、DOCX、TXT、Markdown、JPG、JPEG、PNG、WebP 和 BMP 单文件最大 3MB。
- 文本型 PDF、Word 和纯文本文件由云函数提取；结构化解析会识别基本信息、学历、专业、技能、项目、实习和竞赛栏目。
- 图片简历和扫描版 PDF 使用浏览器内置的中英文 OCR；扫描 PDF 当前最多识别前 4 页。清晰、端正的印刷体效果最佳，模糊、倾斜、手写或复杂多栏图片仍可能需要人工校正。
- 系统不会根据图片或缺失栏目编造经历；识别结果应由用户在预览区核对和修改。

## 本地开发

需要 Node.js `>=22.13.0`：

```bash
npm install
NEXT_PUBLIC_API_BASE="https://你的环境.service.tcloudbase.com/api" npm run dev
```

常用命令：

```bash
npm run lint
npm test
npm run build
npm run db:generate
```

## CloudBase 部署

- `functions/xinhuo-api/`：Node.js 20 事件函数，通过 HTTP 访问服务映射到 `/api`
- `functions/xinhuo-api/faculty.json`：云函数使用的导师公开资料快照
- `cloudbaserc.json`：当前 CloudBase 环境
- `next.config.ts`：输出纯静态站点
- `db/`、`drizzle-postgres/` 和 `legacy/`：旧 PostgreSQL/Next API 版本的迁移参考，不参与当前生产运行

当前生产环境：

- 环境 ID：`xinhuo-d8gxyksn2f7095c5a`
- API：`https://xinhuo-d8gxyksn2f7095c5a.service.tcloudbase.com/api`
- 静态站点：`https://xinhuo-d8gxyksn2f7095c5a-1459723948.tcloudbaseapp.com`

部署顺序：

```bash
cd functions/xinhuo-api
tcb fn deploy xinhuo-api --env-id xinhuo-d8gxyksn2f7095c5a --dir . --force
cd ../..
NEXT_PUBLIC_API_BASE="https://xinhuo-d8gxyksn2f7095c5a.service.tcloudbase.com/api" npm run build -- --webpack
tcb hosting deploy out / --env-id xinhuo-d8gxyksn2f7095c5a
```

首次部署还需在 CloudBase HTTP 访问服务中把 `/api` 映射到 `xinhuo-api`，并开启路径透传。管理员只能通过数据库安全初始化，不能经公开注册接口创建。

## 导师数据

导师中心仅收录内蒙古师范大学人工智能学院公开师资信息：

- `data/imnu-ai-faculty.ts`：经过核对的学院师资快照
- `scripts/fetch-imnu-faculty.mjs`：官网公开资料更新辅助脚本
- `functions/xinhuo-api/index.js`：导师目录接口

数据源：[教师名录](https://sai.imnu.edu.cn/faculty/jsml.htm) 与 [导师名录](https://sai.imnu.edu.cn/faculty/dsml.htm)。

## 参考

- [CloudBase 静态网站托管](https://docs.cloudbase.net/hosting/introduce)
- [CloudBase 云函数](https://docs.cloudbase.net/cloud-function/introduce)
- [CloudBase 文档数据库](https://docs.cloudbase.net/database/introduce)
