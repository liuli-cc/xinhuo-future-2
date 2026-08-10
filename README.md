# 薪火未来 · 大学生成长决策平台

面向大学生的 AI 驱动成长规划与智能职业匹配平台。

当前阶段从 CloudBase 单体架构重构为 **FastAPI + MySQL 模块化单体**，
支持三个业务组并行开发。

---

## 当前开发状态

| Phase | 内容 | 状态 |
|-------|------|------|
| Phase 1 | FastAPI + MySQL + Docker 工程底座 | ✅ 完成 |
| Phase 1.1 | 三组业务职责重新对齐 + 架构纠偏 | ✅ 完成 |
| Phase 2 | 跨组 Contract + Mock + Backlog 建设 | ✅ 完成 |
| Phase 2.x | 三组正式业务开发 | 🔜 即将开始 |

> **重要**: Backlog 中列出的业务功能尚未实现。当前仅完成了工程架构、数据库模型、API 骨架和跨组契约。

---

## 技术栈

| 层 | 技术 | 版本 |
|----|------|------|
| Frontend | Next.js + React + TypeScript | 16.x / 19.x |
| Backend | FastAPI (Python) | 0.136+ |
| Database | MySQL | 8.0+ |
| ORM | SQLAlchemy | 2.0+ |
| Migration | Alembic | 1.19+ |
| Validation | Pydantic | 2.13+ |
| Testing | pytest | 9.x |
| File Storage | 腾讯云 COS | — |
| Deployment | Docker + 腾讯云 | — |
| Architecture | 模块化单体 (Modular Monolith) | — |

**旧系统**: CloudBase Node.js 后端 (`functions/xinhuo-api/`) 暂时保留，仅用于迁移参考和接口行为对照。

---

## 项目目录结构

```
xinhuo-future-main/
├── app/                     # Next.js 前端 (App Router)
│   ├── page.tsx             # 登录/注册首页
│   ├── components/          # 共享组件
│   ├── dashboard/           # Group2 — 仪表盘
│   ├── growth-map/          # Group2 — 成长地图
│   ├── portrait/            # Group2 — 能力画像
│   ├── ai/                  # Group2 — 成长决策
│   ├── interview/           # Group1 — AI模拟面试
│   ├── career/              # Group3 — 职业发展
│   ├── account/             # Shared — 个人中心
│   ├── admin/               # Shared — 管理中心
│   ├── teacher/             # Shared — 教师工作台
│   └── resources/           # Shared — 资源中心
│
├── backend/                 # FastAPI 后端
│   ├── app/
│   │   ├── main.py          # FastAPI 入口
│   │   ├── core/            # 配置/安全/异常/日志/权限
│   │   ├── db/              # SQLAlchemy Base + Session
│   │   ├── modules/         # 业务模块 (见下表)
│   │   ├── contracts/       # 跨组数据契约 (Pydantic DTO)
│   │   ├── integrations/    # COS/LLM/ASR/TTS/OCR
│   │   └── tests/           # pytest
│   ├── alembic/             # 数据库迁移
│   ├── scripts/             # 导入脚本
│   ├── docker-compose.yml   # 本地开发环境
│   └── .env.example         # 环境变量模板
│
├── functions/xinhuo-api/    # 旧 CloudBase Node 后端 (保留)
├── lib/                     # 前端业务引擎 (TypeScript)
├── tests/                   # 前端测试
├── docs/                    # 项目文档
└── .github/                 # CODEOWNERS
```

### 后端模块归属

| 目录 | 归属 | 职责 |
|------|------|------|
| `backend/app/modules/auth/` | Shared | 认证/登录 |
| `backend/app/modules/users/` | Shared | 用户/学生/教师档案 |
| `backend/app/modules/reference/` | Shared | 标准字典 |
| `backend/app/modules/organization/` | Shared | 学校/学院/专业 |
| `backend/app/modules/admission/` | Shared | 招生数据 |
| `backend/app/modules/admin/` | Shared | 管理/审计 |
| `backend/app/modules/files/` | Shared | 统一文件存储 |
| `backend/app/modules/imports/` | Shared | 数据导入 |
| `backend/app/modules/resume/` | Group1 | AI简历 |
| `backend/app/modules/interview/` | Group1 | AI面试 |
| `backend/app/modules/evidence/` | Group2 | 证据管理 |
| `backend/app/modules/growth/` | Group2 | 画像/成长/榜样 |
| `backend/app/modules/employment/` | Group3 | 就业数据 |
| `backend/app/modules/career/` | Group3 | 岗位/匹配/投递 |

---

## 三组正式职责

### Group1 — AI简历 + AI模拟面试

- 长期分支: `group1-dev`
- Backlog: [docs/GROUP1-BACKLOG.md](docs/GROUP1-BACKLOG.md)
- 拥有: resume, interview, llm, asr, tts, ocr
- 前端: `/interview`

### Group2 — 任务匹配 + 榜样激励

- 长期分支: `group2-dev`
- Backlog: [docs/GROUP2-BACKLOG.md](docs/GROUP2-BACKLOG.md)
- 拥有: evidence, growth (含 assessment, portrait, role_models)
- 前端: `/dashboard`, `/growth-map`, `/portrait`, `/ai`

### Group3 — 智能岗位匹配

- 长期分支: `group3-dev`
- Backlog: [docs/GROUP3-BACKLOG.md](docs/GROUP3-BACKLOG.md)
- 拥有: employment, career (含 candidate_pushes, authorizations)
- 前端: `/career`

### Shared/Core — 平台公共底座

- 不属于任何单一业务组，由项目维护者管理
- 拥有: auth, users, reference, organization, admission, admin, files, imports
- 所有组都可以读取，禁止各组创建自己的 student/job/file 表

---

## 组间数据关系

```
Shared Student Data
  → Group2 基线测评 / 画像 / 成长任务
    → Group1 AI简历 / 模拟面试
    → Group3 岗位匹配 / 投递

同时: Group3 的岗位/JD 被 Group1 和 Group2 使用
```

详细数据流: [docs/BUSINESS-DATA-FLOW.md](docs/BUSINESS-DATA-FLOW.md)
跨组依赖分析: [docs/CROSS-GROUP-DEPENDENCIES.md](docs/CROSS-GROUP-DEPENDENCIES.md)

---

## 本地启动

### 前提

- Node.js >= 22.13
- Python >= 3.12
- Docker Desktop

### 1. Clone 项目

```bash
git clone <repo-url> xinhuo-future
cd xinhuo-future
git checkout groupX-dev   # 切换到你的组分支
```

### 2. 前端

```bash
npm install
npm run dev               # http://localhost:3000
```

### 3. 后端

```bash
cd backend

# 复制环境变量
cp .env.example .env

# 安装依赖
pip install -r requirements.txt
pip install aiomysql

# 启动 MySQL + FastAPI
docker compose up -d

# 运行数据库迁移
docker compose exec backend alembic upgrade head

# 或本地启动:
# alembic upgrade head
# uvicorn app.main:app --reload --port 8000
```

### 4. 验证

```
http://localhost:8000/health   → {"ok": true}
http://localhost:8000/docs     → Swagger UI
http://localhost:3000          → 前端
```

### 5. 导入参考数据

```bash
cd backend
python scripts/import_reference_data.py --type all
```

### 6. 运行测试

```bash
cd backend
pytest                        # 全部测试 (13+)
```

---

## 环境变量

```bash
cp backend/.env.example backend/.env
```

必须填写的变量:

| 变量 | 说明 |
|------|------|
| `MYSQL_HOST` / `MYSQL_PASSWORD` | MySQL 连接 |
| `SECRET_KEY` | 随机字符串 (生产环境必须更换) |
| `COS_SECRET_ID` / `COS_SECRET_KEY` / `COS_BUCKET` | 腾讯云 COS (Phase 2) |
| `TENCENT_SECRET_ID` / `TENCENT_SECRET_KEY` | ASR/TTS (Phase 2) |

**禁止提交 `.env` 到 Git。**

---

## Git 开发流程

```
main          ← 稳定/生产 (禁止直接 Push)
  ↑ PR
develop       ← 集成 (通过 PR 从 groupX-dev 合并)
  ↑ PR
group1-dev    ← Group1 长期开发
group2-dev    ← Group2 长期开发
group3-dev    ← Group3 长期开发
  ↑ PR
feature/gX-xxx ← 个人开发分支
```

### 个人开发流程

```bash
git checkout groupX-dev
git pull
git checkout -b feature/gX-任务编号
# 开发...
git add -A
git commit -m "feat: 任务描述"
git push origin feature/gX-任务编号
# 在 GitHub 创建 PR → groupX-dev
```

### Feature Branch 命名

```
Group1:  feature/g1-resume-generation
Group2:  feature/g2-baseline-assessment
Group3:  feature/g3-job-match
Shared:  feature/shared-xxx
```

---

## 如何领取任务

各组的 Backlog 见:

- [Group1 Backlog](docs/GROUP1-BACKLOG.md) — 任务编号 G1-01 ~ G1-11
- [Group2 Backlog](docs/GROUP2-BACKLOG.md) — 任务编号 G2-01 ~ G2-08
- [Group3 Backlog](docs/GROUP3-BACKLOG.md) — 任务编号 G3-01 ~ G3-09

任务编号对应 Feature Branch 名称，如 `G1-02` → `feature/g1-resume-generation`。

---

## 跨组依赖怎么办

**不要等待其他组功能完成。** 使用公共 Contract 和 Mock 独立开发:

```python
# 当 Group3 开发匹配引擎时，Group2 的画像还没完成:
from app.tests.fixtures.mock_data import make_student_portrait
portrait = make_student_portrait(user_id=1)
```

- 公共 Contract: `backend/app/contracts/`
- Mock 数据: `backend/app/tests/fixtures/mock_data.py`
- 跨组契约文档: [docs/API-CONTRACTS.md](docs/API-CONTRACTS.md)

> **禁止**: 为了开发方便复制其他组的数据库表或业务逻辑。
> 跨组数据必须通过 Contract 和 Service 接口获取。

---

## 数据库开发规范

- 所有表结构变更必须通过 **Alembic Migration**
- 禁止手工修改数据库后不写 Migration
- 禁止一组创建另一套 `student` / `job` / `file` 表
- 详见: [docs/DATABASE-DESIGN.md](docs/DATABASE-DESIGN.md), [docs/MODULE-BOUNDARIES.md](docs/MODULE-BOUNDARIES.md)

---

## API 开发规范

每个模块遵循 **Router → Service → Repository → Model → Schema** 五层:

| 层 | 文件 | 职责 |
|----|------|------|
| Router | `router.py` | HTTP 请求/响应处理 |
| Service | `service.py` | 业务逻辑 |
| Repository | `repository.py` | 数据库读写 |
| Model | `model.py` | SQLAlchemy 表定义 |
| Schema | `schema.py` | Pydantic 请求/响应模型 |

> **禁止**: 把所有逻辑塞进 Router。

---

## 文件管理

- 文件上传至 **腾讯云 COS**
- MySQL `files` 表仅保存元数据和 `object_key`
- **禁止**: 将 Base64 文件直接长期存入 MySQL

---

## 测试

```bash
cd backend
pytest                          # 全部测试
pytest -m unit                  # 仅单元测试
pytest app/tests/test_boundaries.py  # 模块边界测试
```

PR 提交前必须:
```bash
pytest                          # 全部通过
```

---

## Legacy 旧系统

`functions/xinhuo-api/` 是旧 CloudBase Node.js 后端。

- **禁止新业务写入旧后端**
- 仅用于: 迁移参考 / 接口行为对照 / 兼容旧前端
- 只有在对应 FastAPI 模块迁移完成并通过测试后才能删除

---

## 当前未完成内容

| 模块 | 状态 |
|------|------|
| Shared — auth (login/me/logout) | READY |
| Shared — users/{id} | READY |
| Shared — reference/* | READY |
| Shared — organization/* | READY |
| Shared — files/upload | READY |
| Shared — imports/batches | READY |
| Shared — account/sessions/deletion | NOT STARTED |
| Group1 — 全部业务功能 | NOT STARTED |
| Group2 — 全部业务功能 | NOT STARTED |
| Group3 — 全部业务功能 | NOT STARTED |

---

## 项目文档导航

### 必读 (首次加入必看)

| # | 文档 | 内容 |
|---|------|------|
| 1 | [README.md](README.md) | 你正在看 — 项目总览 |
| 2 | [docs/TEAM-OWNERSHIP.md](docs/TEAM-OWNERSHIP.md) | 哪个组管哪些模块 |
| 3 | 你的 Group Backlog | [G1](docs/GROUP1-BACKLOG.md) / [G2](docs/GROUP2-BACKLOG.md) / [G3](docs/GROUP3-BACKLOG.md) |
| 4 | [docs/API-CONTRACTS.md](docs/API-CONTRACTS.md) | 跨组数据契约 |
| 5 | [docs/CROSS-GROUP-DEPENDENCIES.md](docs/CROSS-GROUP-DEPENDENCIES.md) | 依赖关系与 Mock 开发指南 |
| 6 | [backend/README.md](backend/README.md) | 后端环境搭建详情 |

### 架构与设计

| 文档 | 内容 |
|------|------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 系统架构图 + 技术选型 |
| [docs/DATABASE-DESIGN.md](docs/DATABASE-DESIGN.md) | 数据库 ER 图 + 设计决策 |
| [docs/MODULE-BOUNDARIES.md](docs/MODULE-BOUNDARIES.md) | 表所有权 + 读写权限 |
| [docs/BUSINESS-DATA-FLOW.md](docs/BUSINESS-DATA-FLOW.md) | 跨组数据流 Mermaid 图 |

### 开发参考

| 文档 | 内容 |
|------|------|
| [docs/API-CONTRACTS.md](docs/API-CONTRACTS.md) | API 契约 + 公共 ID 体系 |
| [docs/API-MIGRATION.md](docs/API-MIGRATION.md) | 旧 API 迁移状态追踪 |
| [docs/CROSS-GROUP-DEPENDENCIES.md](docs/CROSS-GROUP-DEPENDENCIES.md) | 依赖分析 + 并行开发计划 |

### 阶段报告

| 文档 | 内容 |
|------|------|
| [docs/PHASE1-ACCEPTANCE.md](docs/PHASE1-ACCEPTANCE.md) | Phase 1 验收结果 |
| [docs/PHASE1.1-CORRECTION-REPORT.md](docs/PHASE1.1-CORRECTION-REPORT.md) | 业务边界修正 |
| [docs/PHASE2-PREPARATION-REPORT.md](docs/PHASE2-PREPARATION-REPORT.md) | Phase 2 准备完成 |

### 历史参考

| 文档 | 内容 |
|------|------|
| [docs/CORE-V2.md](docs/CORE-V2.md) | 旧系统核心算法文档 |
| [docs/DEVLOG-2026-07-28.md](docs/DEVLOG-2026-07-28.md) | 开发日志 |
| [docs/ROLLBACK.md](docs/ROLLBACK.md) | 回滚指南 |
