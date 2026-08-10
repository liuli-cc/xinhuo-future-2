# 薪火未来16 生产回档指南

## 基线信息

| 项目 | 值 |
|------|-----|
| 版本号 | 薪火未来16 |
| 源码目录 | `/Users/liuli/内蒙古师范大学/创新项目-薪火未来/国创赛/薪火未来16` |
| 原始压缩包 | `/Users/liuli/内蒙古师范大学/创新项目-薪火未来/国创赛/薪火未来16.tar.gz` |
| 原始压缩包 SHA-256 | `7c52adce532333c720dc8929a6c826255a5325f846c59792fbd1a065bce05f9a` |
| 生产回档包 | `/Users/liuli/内蒙古师范大学/创新项目-薪火未来/国创赛/薪火未来16-生产回档包.tar.gz` |
| 生产回档包 SHA-256 | `af2b69ee82277dc5ab7551f40b1e3ccd2c0887692c3261f04d9faae60a4d05de` |
| 正式网站 | `https://xinhuo-d8gxyksn2f7095c5a-1459723948.tcloudbaseapp.com` |
| CloudBase 环境 ID | `xinhuo-d8gxyksn2f7095c5a` |
| 云端 API | `https://xinhuo-d8gxyksn2f7095c5a.service.tcloudbase.com/api` |
| 框架 | Next.js 16.2.6 (Turbopack) + `output: "export"` |
| Node.js 要求 | >= 22.13.0 |

## 快速回档步骤

### 1. 恢复源码

```bash
cd /tmp
tar xzf "/Users/liuli/内蒙古师范大学/创新项目-薪火未来/国创赛/薪火未来16.tar.gz"
```

或者直接使用生产回档包（含已构建产物）：

```bash
cd /tmp
tar xzf "/Users/liuli/内蒙古师范大学/创新项目-薪火未来/国创赛/薪火未来16-生产回档包.tar.gz"
```

### 2. 安装依赖并构建

```bash
cd /tmp/薪火未来16  # 或解压后的目录
npm install
npm run build
```

构建产物在 `out/` 目录。

### 3. 部署云函数

将 `functions/xinhuo-api/index.js` 部署到腾讯云 CloudBase 云函数：

1. 登录腾讯云 CloudBase 控制台
2. 进入环境 `xinhuo-d8gxyksn2f7095c5a`
3. 选择「云函数」→「xinhuo-api」
4. 上传 `functions/xinhuo-api/index.js`
5. 确认环境变量配置完整（不含密钥值）

### 4. 部署静态网站

将 `out/` 目录部署到 CloudBase 静态网站托管：

```bash
# 使用 CloudBase CLI
tcb hosting deploy out/ -e xinhuo-d8gxyksn2f7095c5a
```

### 5. CDN 缓存刷新

在 CloudBase 控制台 → 静态网站托管 → 缓存配置 → 刷新全部缓存。

### 6. 验证

按以下顺序验证：

1. **主页可访问**：打开 `https://xinhuo-d8gxyksn2f7095c5a-1459723948.tcloudbaseapp.com`
2. **登录页**：确认可以正常显示登录表单
3. **管理端**：使用管理员账号登录，确认 `/admin` 页面正常
4. **学生端**：使用学生账号登录，确认 `/dashboard` 正常
5. **API 健康检查**：访问 `/api/health` 返回 `{"ok":true}`
6. **成长地图**：`/growth-map` 正常加载
7. **实习就业**：`/career` 正常加载
8. **模拟面试**：`/interview` 正常加载

## 数据库保护

- 回档只替换前端静态资源和云函数代码
- **不执行任何数据库删除、清空或迁移操作**
- 现有 `xh_users`、`xh_sessions`、`xh_growth_tasks` 等集合保持不变
- 如果新版本添加了集合（如 `xh_interview_sessions`），回档后旧数据保留，新功能不可用但不会报错

## 注意事项

- 薪火未来16 源码目录是只读基线，不要直接编辑
- 回档后需等待 CDN 缓存刷新（通常 5-15 分钟）
- 如果回档后 API 报错，检查云函数环境变量是否正确配置
- DeepSeek API Key 不在源码或压缩包中，需在云函数环境变量中单独配置

## 校验命令

```bash
# 校验原始压缩包
shasum -a 256 "/Users/liuli/内蒙古师范大学/创新项目-薪火未来/国创赛/薪火未来16.tar.gz"
# 期望：7c52adce532333c720dc8929a6c826255a5325f846c59792fbd1a065bce05f9a

# 校验生产回档包
shasum -a 256 "/Users/liuli/内蒙古师范大学/创新项目-薪火未来/国创赛/薪火未来16-生产回档包.tar.gz"
# 期望：af2b69ee82277dc5ab7551f40b1e3ccd2c0887692c3261f04d9faae60a4d05de
```
