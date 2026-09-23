# 本地预览与本次验证

保留现有深蓝侧栏、浅蓝页面、表单和卡片体系。本次修改集中在实时面试、简历识别与制作、企业招聘流程和交互性能。

## 临时预览

使用静态生产构建配合同源 API 代理，避免临时 HTTPS 链接仍请求访问者电脑上的 localhost。

```sh
cd frontend
NEXT_PUBLIC_API_BASE=same-origin npm run build -- --webpack
PORT=3100 API_UPSTREAM=http://127.0.0.1:8100 npm start
```

后端通过 `WEB_ORIGIN`/`TRUSTED_ORIGINS` 信任实际预览地址。`API_UPSTREAM` 只在本机静态服务器读取，不进入浏览器；接口仍由后端验证登录、角色和归属。原有直连 `NEXT_PUBLIC_API_BASE=http://localhost:8000` 配置继续可用。

本次临时实例使用 `.preview/preview.db` 与 `.preview/storage`，体验凭据保存在忽略提交的 `.preview/预览访问说明.md`。既有数据库和模型密钥配置未覆盖。

## 招聘数据库升级

新增迁移 `005_recruitment_jobs.py`，在已有 `004` 后执行 `alembic upgrade head`。新增企业所属岗位、按岗位的投递去重和面试安排；历史通用投递保留原数据与状态。迁移已使用 SQLite 实测历史记录保留与防止有损回退，并在 GitHub CI 的独立 MySQL 8.0 实例成功运行，未对线上数据库执行迁移。

## 已做的浏览器检查

- 最终构建、TypeScript、ESLint、前端 109 项检查和后端 44 项检查通过；静态页面的 14 项检查也单独运行通过。
- 学生与企业分别登录，企业发布岗位，学生选择岗位并保存投递，企业安排面试，学生重新打开后看到安排。
- 新企业岗位投递可直接用于模拟面试，未混用旧实习就业模块的投递 ID。
- 实际中文 PNG 与纯图片 PDF 通过浏览器 OCR，Word 文件下载成功。
- 提纲练习实际走过文字回答、暂停恢复、报告保存；打断流程使用可观测的合成浏览器朗读验证，没有冒充真实麦克风联调。
- 1440px 桌面与 390px 手机宽度检查：角色完整显示、企业岗位表单无横向溢出、弹窗焦点保持在弹窗内。
- 相同本地桌面 Chrome 场景中，延后加载 Three 后，面试页跳转诊断从约 996ms 降为约 77ms；后一次采样无超过 33ms 的帧。这是开发机器的单场景诊断，不是所有设备或真实用户的性能保证。
- 公网临时地址已实际完成登录与进入面试设置页面。

测试截图、临时浏览器检查脚本和日志保存在 `.preview/`，不包含在 Git 提交中。实时服务未配置密钥时，预览的提纲练习、简历编辑导出和招聘流程仍可使用。真实语音模型的延迟、识别准确率与耳机打断体验需在配置服务后实测。

## 相关说明

- [双向实时语音配置与验证范围](interview-realtime.md)
- [简历与企业流程](recruitment-resume.md)
- [原创 liuli 角色与许可](LIULI-AVATAR-LICENSE.md)
- 面试评分行为规则：`backend/app/modules/interview/skills/interview-coach.md`
