# 薪火未来 v0.5 后端

FastAPI + MySQL 模块化单体，承载账号、成长任务与佐证、审核、职业匹配、模拟面试、文件、隐私权利和平台治理。旧 CloudBase 目录仅作为迁移资料，不参与当前运行。

## Docker 启动

```bash
cp .env.example .env
docker compose up --build -d
docker compose exec backend alembic current
curl http://localhost:8000/health/ready
```

首次初始化学校管理员：

```bash
docker compose exec backend python scripts/bootstrap_admin.py \
  --student-id 你的工号 --name 你的姓名
```

脚本会交互式读取强密码，不会把密码写入终端历史。开发环境 API 文档位于 `http://localhost:8000/docs`；正式环境会关闭 Swagger、ReDoc 与 OpenAPI 路由。

## 不使用 Docker

需要 Python 3.12+ 和 MySQL 8：

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

## 主要模块

- `app/modules/auth`：注册、审核状态、登录锁定、会话与找回。
- `app/modules/growth`、`evidence`：成长任务、佐证、教师审核和画像。
- `app/modules/career`、`interview`：岗位快照、匹配、投递、面试与报告。
- `app/modules/files`：本地/COS 私有文件存储和访问控制。
- `app/modules/admin`：分级权限、审计、运营概览和注销清理。
- `app/modules/users/account_router.py`：资料、密码、会话、导出与注销。
- `app/integrations`：对象存储和服务端模型网关。
- `alembic/versions`：可追踪的数据库迁移。

## 测试与运维命令

```bash
pytest -q
alembic upgrade head
python scripts/migrate_legacy_export.py --input legacy.json       # 仅预检
python scripts/run_retention.py                                  # 仅预检
```

会修改数据的迁移和保留策略命令必须显式增加 `--apply`。备份、恢复及旧数据迁移步骤分别见根目录的 `docs/BACKUP-RESTORE.md` 与 `docs/DATA-MIGRATION-RUNBOOK.md`。

## 正式环境边界

正式环境启动时会强制检查随机 `SECRET_KEY`、HTTPS 来源、安全 Cookie、仅 Cookie 会话、COS 持久化、监控令牌和非默认数据库口令。完整变量见 `.env.example`，上线前逐项执行 `docs/PRODUCTION-CHECKLIST.md`。
