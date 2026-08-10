# 薪火未来 — 系统架构文档

## 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                    浏览器 (Browser)                       │
│              Next.js Static Export (SPA)                  │
│          localStorage: session token                     │
│          Session: Bearer token OR HttpOnly Cookie        │
└─────────────────┬───────────────────────────────────────┘
                  │ HTTPS
                  ▼
┌─────────────────────────────────────────────────────────┐
│              腾讯云 CloudBase 静态托管                     │
│         https://xinhuo-*.tcloudbaseapp.com               │
└─────────────────────────────────────────────────────────┘
                  │
                  │ API calls (NEXT_PUBLIC_API_BASE)
                  ▼
┌─────────────────────────────────────────────────────────┐
│              FastAPI Backend (新)                         │
│              OR  CloudBase HTTP函数 (旧)                  │
│                                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │  Auth    │ │  Users   │ │Reference │ │   Org    │  │
│  │  Module  │ │  Module  │ │  Module  │ │  Module  │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │Admission │ │Employmen │ │ Evidence │ │  Growth  │  │
│  │  Module  │ │  Module  │ │  Module  │ │  Module  │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │  Career  │ │Interview │ │   Admin  │ │  Files   │  │
│  │  Module  │ │  Module  │ │  Module  │ │  Module  │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│  ┌──────────┐                                          │
│  │  Imports │  ← Data Staging Layer                    │
│  │  Module  │                                          │
│  └──────────┘                                          │
└─────────────┬───────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│                   MySQL 8+                               │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Reference Layer (标准字典)                        │   │
│  │  Organization Layer (学校/学院/专业)               │   │
│  │  Users Layer (用户/学生/教师/会话)                 │   │
│  │  Admission Layer (招生)                            │   │
│  │  Employment Layer (就业)                           │   │
│  │  Evidence / Growth / Career / Interview / Admin   │   │
│  │  Files Layer (统一文件存储)                        │   │
│  │  Import Staging Layer (原始数据暂存)              │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│              腾讯云 COS (文件存储)                         │
│          xinhuo-files-{bucket}                           │
└─────────────────────────────────────────────────────────┘
```

## 架构类型

**模块化单体 (Modular Monolith)**

所有业务模块运行在同一个 FastAPI 进程中，共享同一个 MySQL 数据库，
但模块之间有明确的代码边界和数据所有权。

## 当前阶段技术栈

| 组件 | 技术 | 版本 |
|------|------|------|
| Frontend | Next.js | 16.2 |
| Backend | FastAPI | 0.115 |
| Database | MySQL | 8.0+ |
| ORM | SQLAlchemy | 2.0 |
| Migration | Alembic | 1.14 |
| Validation | Pydantic | 2.10 |
| Testing | pytest | 8.3 |
| Deployment | Docker | — |
| File Storage | 腾讯云 COS | — |

## 禁止引入

在第一阶段及可预见的后续阶段，禁止引入以下基础设施：

- ❌ 微服务框架 (Spring Cloud, etc.)
- ❌ 消息队列 (Kafka, RabbitMQ)
- ❌ 容器编排 (Kubernetes, Docker Swarm)
- ❌ 服务注册/发现 (Nacos, Consul, Eureka)
- ❌ 分布式配置中心
- ❌ Redis (当前阶段)
- ❌ Elasticsearch

## 模块设计原则

1. **Router → Service → Repository 三层分离**
   - Router: HTTP 请求/响应处理
   - Service: 业务逻辑
   - Repository: 数据库读写

2. **数据所有权**
   - 每个业务表有明确的 Owner Module
   - 只有 Owner 可以直接写入
   - 其他模块通过 Service/API 读取

3. **跨模块通信**
   - 通过明确的 Service 接口调用
   - 禁止跨模块直接操作数据库
   - 禁止循环依赖

## 三组开发边界

参见 `TEAM-OWNERSHIP.md` 和 `MODULE-BOUNDARIES.md`

## 认证流程

```
注册 → pending → 教师/管理员审核 → active → 登录 → Session Cookie
                                              ↓
                                     Session 过期 (7天)
```

兼容旧系统 PBKDF2-SHA256 密码散列，支持 Session Token (Bearer/Cookie) 双重认证。

## 文件存储

```
浏览器 → 文件上传API → COS → object_key → MySQL files 表
```

禁止: File → Base64 → MySQL (旧系统的过渡方式)
