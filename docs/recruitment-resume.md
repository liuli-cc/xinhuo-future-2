# 企业端与 AI 简历

入口：学生 `/resume-ai`，企业 `/enterprise`。使用平台已有登录会话，学生导航新增 AI 简历入口。

学生可以编辑教育背景、个人信息、技能与经历，点击“保存简历”写入账号数据库，重新登录后恢复。支持三种打印模板，通过浏览器打印面板保存 PDF。AI 建议需要核对并点击“采用建议”，之后保存；不会直接覆盖原稿。

选择企业、勾选分享范围并投递后，企业获得该次简历和已核验成长证据的快照。后续修改草稿不会自动修改已投递资料。学生可查看处理状态、撤回后重新投递。企业可搜索、查看完整简历、标记已查看和收藏，状态持久保存。企业之间的数据隔离由后端校验。

## 初始化

在 backend 的已配置环境中执行 `alembic upgrade head`（为 Alembic 显式提供 DATABASE_URL）。新增迁移 004 仅建立投递表，简历使用既有 generated_resumes 表。

管理员在服务器执行 `python scripts/bootstrap_admin.py --student-id 900100 --name 企业名称 --role enterprise` 创建企业账号，密码通过交互输入，不存在公共固定密码。企业不能通过公开注册自行获得角色。此脚本不覆盖现有账号。

前端设置 NEXT_PUBLIC_API_BASE 为 FastAPI 地址；后端 TRUSTED_ORIGINS 需包含前端来源。生产仍使用项目已有的部署和 HTTPS 配置。

## 真实 AI

后端 `.env` 设置 LLM_PROVIDER、LLM_MODEL 及 LLM_API_KEY（DeepSeek 可使用 DEEPSEEK_API_KEY），然后重启后端。沿用现有模型网关，不在浏览器保存或提交密钥。AI 接收目标岗位、简介、技能和经历，不传姓名、电话、邮箱。模型被要求保留事实，输出只作为建议，需要学生确认。

无密钥、供应商失败或返回无效 JSON 时明确报错，不伪装生成成功。没有配置密钥时，编辑、数据库保存、PDF 打印和企业投递仍可使用。

## 验证

`cd backend && .venv/bin/python -m pytest app/tests -q`

先在 `functions/xinhuo-api` 执行 `npm ci --ignore-scripts`，安装旧文档解析测试使用的依赖。

`cd frontend && npm run lint && npm run build -- --webpack && npm run test:unit`

新增集成测试覆盖跨账号隔离、同意分享、重复投递、核验记录筛选、快照、收藏持久化、撤回、AI 网关调用与未配置错误。AI 网关测试使用受控替身，不代表已完成真实供应商联调。
