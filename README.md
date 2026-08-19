# 薪火未来 v0.7.0

面向大学生的证据型成长、岗位匹配与模拟面试平台。当前版本已将河流版前端完整接到 **FastAPI + MySQL 模块化单体**，旧 CloudBase 函数仅保留作迁移对照，不参与运行。

## 当前开发分支：实时双工模拟面试

- 新增 SoulX-Duplug → FunASR 2-pass → 本地 sherpa-onnx → Chrome 的四级中文实时识别链路，无需按“说完了”。
- 面试官播报期间麦克风持续开启，候选人可以直接插话；加入回声过滤、自适应小声检测、岗位热词和 5 候选同音词校正。
- AI 评分使用清理口头语与重复表达后的文本，同时保留原始转写供复盘和口语指标分析；不保存原始录音。
- liuli 老师替换为原创六动作 AI 卡通导师，按挥手、行走、倾听、思考、提问和开心复盘状态切换。

## v0.7 已实现

- 新增“内师公开信息”入口：按栏目和关键词查询内蒙古师范大学主站公开信息，所有条目保留官方原文链接。
- 新增 `GET /api/v1/imnu/public-content` 公开索引 API，以及可复跑的 `backend/scripts/sync_imnu_public_index.py` 同步脚本。
- 索引仅保留公开 HTML 页的标题、分类、日期线索、摘要与来源链接；不镜像正文、图片、附件、登录系统或独立子站内容。
- 统一前后端发布版本为 `0.7.0`。

## v0.6 已实现

- 重做 liuli 老师虚拟导师形象：原创半写实 2.5D 视觉、待机/思考/提问/倾听/复盘状态反馈，并明确标注“AI 虚拟形象 · 非真人”。
- 打通“岗位投递 → 专项模拟面试 → 复盘改进 → 成长地图 → 佐证审核”的上下文传递。
- AI 成长建议和成长资源可直接生成稳定的成长任务，重复加入不会制造重复记录。
- 新增 `⌘ K / Ctrl K` 快捷导航、数据库就绪状态、移动端单栏布局和动效偏好。
- 移除 Three.js 程序化人物，降低前端运行与包体负担；保留 GSAP 并遵循减少动效设置。

v0.5 的平台化基础仍全部保留：

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

首次在本机启用离线中文流式识别时，再开一个终端执行：

```bash
cd xinhuo-future-2/frontend
npm run asr:setup
npm run asr:start
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

当前验收覆盖后端边界/业务集成、安全与隐私，以及前端生产构建、95 项自动测试（其中含 15 项静态产物验收）。

## 配置边界

- 开发默认 `FILE_STORAGE_BACKEND=local`，文件写到 `backend/storage/`（已忽略）。
- 正式环境必须使用随机 `SECRET_KEY`、HTTPS 来源、安全 Cookie 和 `FILE_STORAGE_BACKEND=cos`；否则应用拒绝启动。
- 正式环境还必须设置 `RETURN_SESSION_TOKEN=false` 和 `METRICS_TOKEN`；登录只使用 HttpOnly Cookie，指标端点必须携带监控令牌。
- 模型密钥仅放后端 `.env`。`ALLOW_CLIENT_LLM_KEYS=false` 时浏览器输入的密钥不会被使用。
- 静态前端的 `NEXT_PUBLIC_API_BASE` 在构建时写入，改变 API 地址后必须重新构建。
- 本次未部署任何云服务、未配置真实 COS/模型密钥、未对生产数据执行恢复或删除。

## 文档

- [最新使用手册](docs/USAGE.md)
- [内师官网公开信息索引说明](docs/IMNU-PUBLIC-INDEX.md)
- [实时双工中文语音接入说明](docs/REALTIME-VOICE.md)
- [v0.6 整体体验升级记录](docs/V0.6-EXPERIENCE-UPGRADE.md)
- [数据迁移手册](docs/DATA-MIGRATION-RUNBOOK.md)
- [备份与恢复](docs/BACKUP-RESTORE.md)
- [运营与告警](docs/OPERATIONS-RUNBOOK.md)
- [上线前清单](docs/PRODUCTION-CHECKLIST.md)
- [模块边界](docs/MODULE-BOUNDARIES.md)
