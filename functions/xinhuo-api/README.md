# xinhuo-api

CloudBase HTTP 云函数。该函数只通过云函数身份访问文档数据库；不在前端、静态网页或仓库中保存数据库口令。

本地安装依赖后可用下列命令发布为事件函数：

```bash
tcb fn deploy xinhuo-api --env-id xinhuo-d8gxyksn2f7095c5a --dir . --force
```

然后在 CloudBase HTTP 访问服务中将 `/api` 映射到 `xinhuo-api`，开启路径透传。发布后先请求 `GET /api/health`。业务数据集合会按需创建；管理员账号必须通过数据库安全初始化，公开注册只允许学生或教师。
