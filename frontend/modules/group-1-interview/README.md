# Group 1 · AI 简历与模拟面试

负责简历解析、OCR、面试计划、动态追问、语音指标、评分和报告导出。

- `client/`：浏览器侧业务逻辑与纯函数。
- `components/`：面试专属 React 组件。
- `backend/app/modules/`：FastAPI/MySQL 的认证、用户、文件与导入模块；简历解析、面试、语音业务接口仍待迁移。
- 路由入口保留在 `app/interview/`，仅用于满足 Next.js App Router 约定。

不得在浏览器代码或仓库中保存任何云服务密钥、模型 API Key 或用户简历原文。未迁移接口会明确返回 `backend_module_not_migrated`，不会回退到旧后端。
