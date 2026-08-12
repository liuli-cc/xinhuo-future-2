# v0.5.0 使用手册

## 1. 启动

在 `backend/` 复制 `.env.example` 为 `.env`，随后运行：

```bash
docker compose up --build -d
docker compose exec backend alembic current
curl http://localhost:8000/health/ready
```

首次初始化管理员（只执行一次）：

```bash
docker compose exec backend python scripts/bootstrap_admin.py --student-id 你的工号 --name 你的姓名
```

按提示输入两次强密码；脚本发现同工号账号时会拒绝覆盖。随后用该账号登录管理台并审核学生、教师账号。

在 `frontend/` 复制 `.env.example` 为 `.env.local`，确认 `NEXT_PUBLIC_API_BASE=http://localhost:8000`，运行：

```bash
npm ci
npm run dev
```

开发地址为 `http://localhost:3000`。若要验证与最终静态产物一致的页面：

```bash
npm run build -- --webpack
npm start
```

再打开 `http://localhost:3000/index.html`；`npm start` 只启动本机静态预览，不属于部署。

## 2. 角色使用

学生：注册并审核通过后，先完善账号资料；在成长地图提交任务佐证或在能力画像添加佐证；审核通过后画像和进度自动更新；在职业工作台粘贴真实岗位、保存快照、计算匹配、建立投递记录；面试页可用免费本地计划，也可由管理员配置服务端模型。

教师/辅导员：只看到同院系且同班级学生；审核学生账号和佐证，驳回必须写明原因。

学院管理员：管理本学院账号、归属、教职工与佐证。学校/平台管理员还可查看审计日志、处理找回密码与撤销期届满的注销申请。

## 3. 数据权利

“账号与隐私”支持资料更正、修改密码、退出其他设备、导出 JSON、申请注销与 7 天内撤销。永久清理只能在撤销期届满后由学校/平台管理员执行。

## 4. 可观测性

- `/health/live`：进程存活。
- `/health/ready`：数据库可用。
- `/metrics`：请求数和耗时总量；配置 `METRICS_TOKEN` 后需携带 Bearer 令牌。
- 每个响应都有 `X-Request-ID`，可用于日志排查。

## 5. 不部署情况下的限制

本地存储只适合单机开发；真实邮件/短信通知、分布式限流、集中日志、异地备份和云端高可用需要部署后配置。没有模型密钥时，岗位匹配、画像、面试计划和评分仍可本地确定性运行，只有生成式追问不可用。
