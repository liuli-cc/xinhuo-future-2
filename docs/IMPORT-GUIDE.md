# 招聘数据导入教程（零基础版）

> 目标：把你从微信群拿到的 Excel 数据文件（岗位信息、校招公告）导入系统，
> 让「实习就业」页面显示出和其他同学一样的岗位列表。
> **不需要会写代码，全程点鼠标 + 复制粘贴，约 10 分钟。**

---

## 第 0 步：准备工作（只做一次）

1. **拉最新代码**：在项目目录执行 `git pull`（或用 GitHub Desktop 拉取 `feature/g3-job-resource` 分支合并后的最新代码）
2. **更新数据库结构**（新代码加了新表，必须执行）：
   - 用 Docker 的同学：`docker compose exec backend alembic upgrade head`
   - 本机直跑的同学：`cd backend` 后执行 `.venv\Scripts\python -m alembic upgrade head`
3. **启动前后端服务**：和平时开发一样（Docker：`docker compose up -d`；本机：后端 uvicorn + 前端 `npm run dev`）
4. **确认 Excel 文件已拿到**（微信群下载）：岗位信息类表格、校招公告类表格。文件名随意，**不用改名**。

## 第 1 步：准备一个有权限的账号

导入功能需要**管理员账号**（或已被管理员授予「就业管理」权限的教师账号）。

- **全新的数据库**（第一次搭建环境）：先创建首个管理员。在项目 backend 目录执行：
  - Docker：`docker compose exec backend python scripts/bootstrap_admin.py --student-id admin002 --name 管理员`
  - 本机：`.venv\Scripts\python scripts/bootstrap_admin.py --student-id admin002 --name 管理员`
  - 按提示设置密码（至少 10 位，输入时屏幕不显示，属正常）
- **已有管理员账号**：直接用它的工号和密码，跳到第 2 步。

## 第 2 步：打开接口管理页面

浏览器访问：**http://localhost:8000/docs**

这是后端自带的接口调试页面（Swagger）。页面右上角有一个绿色的 **Authorize** 按钮（带锁图标）。

## 第 3 步：登录拿令牌

1. 在接口列表里找到 **POST /api/v1/auth/login**（可以点开 `auth` 分组找，或用页面顶部的搜索框搜 `login`）
2. 点开它 → 点右侧 **Try it out** 按钮
3. 在 Request body 里把 `"studentId"` 改成你的工号、`"password"` 改成你的密码，例如：
   ```json
   {"studentId": "admin002", "password": "你的密码"}
   ```
4. 点 **Execute**（蓝色按钮）
5. 往下滚动看响应，找到 `"sessionToken": "xxxxx..."` —— **复制引号里面的那一长串**（复制完整，别带引号）

## 第 4 步：授权

1. 点页面右上角的 **Authorize** 按钮
2. 在 Value 输入框里**粘贴**刚才复制的令牌
3. 点 **Authorize** → 点 **Close**

> 令牌有时效（7 天），如果后面提示 401 未登录，回到第 3 步重新登录拿一次。

## 第 5 步：导入岗位数据

1. 搜索 **import**，找到 **POST /api/v1/admin/career/jobs/import**
2. 点开 → **Try it out**
3. 点 **Choose File**，选择「岗位信息」Excel 文件（一次传一个）
4. 点 **Execute**
5. 看响应：`{"imported": 280, "duplicates": 2, ...}` —— **imported 就是成功导入的条数**，duplicates 是重复跳过的（重复导入同一文件不会产生重复数据，放心）
6. 有几份岗位文件就重复几次（每次重新 Choose File → Execute）

## 第 6 步：导入校招公告数据

1. 找到 **POST /api/v1/admin/career/announcements/import**（注意是 announcements，别和岗位搞混）
2. 同样：**Try it out → Choose File → 选校招公告 Excel → Execute**
3. 看到 `{"imported": 387, ...}` 即成功

## 第 7 步：验证

打开前端 **http://localhost:3000/career**（先退出登录再用管理员号登录）：

- 「岗位」标签：应显示数百个岗位，可按 实习/校招/社招 筛选、搜索、开「智能岗位推荐」
- 「校招公告」标签：应显示数百条公告，可按届数筛选

到这里就完成了。🎉

---

## 常见问题

| 现象 | 原因与解决 |
|------|-----------|
| 响应 401 请先登录 | 令牌过期或没做第 4 步授权 → 重新登录、重新 Authorize |
| 响应 403 需要就业管理授权 | 当前账号不是管理员，或教师没被授权 → 让管理员在「账号管理」里授予 |
| 提示"未解析到有效数据行" | Excel 表头不对：岗位表必须有「公司名称」「岗位名称」列；公告表必须有「招聘简章」「公司名称」列。用原始文件，别自己删列 |
| 导完页面还是空的 | ① 确认用的是同一个数据库（别一个连 Docker 的库一个连本机的库）；② 岗位有截止时间的过期会自动隐藏，试试打开「含已过期」开关 |
| 想让某个老师也能导入 | 管理员调 `PATCH /api/v1/management/accounts`，action 填 `grant_employment`（详见 docs/TEST-ACCOUNTS.md） |

## 注意

- Excel 里的日期列识别「2026-08-20」这类格式；「未告知 / 待定」会当作没有截止时间（按发布后 3/6 个月自动过期）。
- 同一文件重复导入不会重复入库（自动去重），但不同文件里完全相同的岗位也会被去重。
- 请勿把付费数据文件提交进 git 仓库。
