# 薪火未来 v0.5.0

面向大学生的证据型成长、岗位匹配与模拟面试平台。当前版本已将河流版前端完整接到 **FastAPI + MySQL 模块化单体**，旧 CloudBase 函数仅保留作迁移对照，不参与运行。

## v0.5 已实现

- 学生任务 → 佐证上传 → 教师按班级审核 → 五维画像更新 → 岗位匹配/补强任务的闭环。
- 真实文件存储：本地开发目录或腾讯 COS；内容签名、大小、归属和下载权限校验。
- 服务端模型网关：超时、重试、并发上限、服务端密钥；无模型密钥时保留确定性本地流程。
- 登录锁定、接口限流、来源校验、安全响应头、会话撤销、强密码和生产配置启动拦截。
- 管理后台：账号审核、教师账号、佐证审核、容量统计、审计日志、找回密码和注销撤销期。
- 个人数据导出、隐私政策、服务协议、同意版本记录和数据清理流程。
- 健康探针、数据库就绪探针、Prometheus 文本指标、结构化日志和请求 ID。
- MySQL 迁移、旧数据导入、备份/恢复校验、CI、依赖更新与发布清单。

## 本地使用（推荐）

前提：Docker Desktop、Node.js 22.13+。后端容器使用 Python 3.12；若不用 Docker，本机 Python 必须 3.12+。

```bash
git clone https://github.com/liuli-cc/xinhuo-future-2.git
cd xinhuo-future-2/backend
cp .env.example .env
docker compose up --build -d
curl http://localhost:8000/health/ready
```

另开终端：

```bash
cd xinhuo-future-2/frontend
cp .env.example .env.local
npm ci
npm run dev
```

浏览器打开 [http://localhost:3000](http://localhost:3000)。API 文档在 [http://localhost:8000/docs](http://localhost:8000/docs)，数据库管理工具在 [http://localhost:8080](http://localhost:8080)。

首次使用：先在后端容器中执行 `python scripts/bootstrap_admin.py --student-id 你的工号 --name 你的姓名`，交互式创建首个学校管理员（密码不会出现在命令历史）；再注册学生/教师账号并由管理员审核。详细步骤见 [使用手册](docs/USAGE.md)。

## 测试

```bash
cd backend
pytest

cd ../frontend
npm run lint
npm test
```

当前验收覆盖后端边界/业务集成、安全与隐私，以及前端生产构建、91 项功能测试和 14 项静态页面测试。

## 配置边界

- 开发默认 `FILE_STORAGE_BACKEND=local`，文件写到 `backend/storage/`（已忽略）。
- 正式环境必须使用随机 `SECRET_KEY`、HTTPS 来源、安全 Cookie 和 `FILE_STORAGE_BACKEND=cos`；否则应用拒绝启动。
- 正式环境还必须设置 `RETURN_SESSION_TOKEN=false` 和 `METRICS_TOKEN`；登录只使用 HttpOnly Cookie，指标端点必须携带监控令牌。
- 模型密钥仅放后端 `.env`。`ALLOW_CLIENT_LLM_KEYS=false` 时浏览器输入的密钥不会被使用。
- 静态前端的 `NEXT_PUBLIC_API_BASE` 在构建时写入，改变 API 地址后必须重新构建。
- 本次未部署任何云服务、未配置真实 COS/模型密钥、未对生产数据执行恢复或删除。

## 文档

- [最新使用手册](docs/USAGE.md)
- [测试账号说明](docs/TEST-ACCOUNTS.md)
- [招聘数据导入教程](docs/IMPORT-GUIDE.md)
- [数据迁移手册](docs/DATA-MIGRATION-RUNBOOK.md)
- [备份与恢复](docs/BACKUP-RESTORE.md)
- [运营与告警](docs/OPERATIONS-RUNBOOK.md)
- [上线前清单](docs/PRODUCTION-CHECKLIST.md)
- [模块边界](docs/MODULE-BOUNDARIES.md)
