# 内师官网公开信息索引

## 目标与边界

“内师公开信息”是对内蒙古师范大学主站 `https://www.imnu.edu.cn/` 的公开 HTML 页面建立的可检索索引。它不是官网镜像：平台只保存标题、栏目、可识别的日期线索、短摘要、同步时间和官方原文链接，阅读完整内容始终回到官网。

以下内容不在同步范围内：

- 文章全文、图片、音视频、附件及下载文件；
- 登录、办事大厅、邮箱、VPN、图书馆等需授权系统；
- 其他域名和独立子站；
- 个人敏感信息或任何需要绕过访问控制才能取得的内容。

原文版权归内蒙古师范大学及相应发布方所有。同步前应遵守官网的最新访问规则；索引脚本默认以至少 0.5 秒的请求间隔运行。

## 更新索引

在仓库根目录运行：

```bash
backend/.venv/bin/python backend/scripts/sync_imnu_public_index.py --max-pages 60
```

脚本输出为 `frontend/data/imnu-public-index.json`，同时由静态前端和 `GET /api/v1/imnu/public-content` 使用。提交新的索引后，需要重新构建前端；如果部署了后端，也要一并重新发布后端，使 API 读取同一版本的数据文件。

可选参数：

```bash
backend/.venv/bin/python backend/scripts/sync_imnu_public_index.py --max-pages 100 --delay 1.0
```

`--max-pages` 为 1–500；应根据目标站点负载和访问规则保守设置，不能把爬取覆盖数量表述为“官网全部信息”。
