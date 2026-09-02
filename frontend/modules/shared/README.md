# Shared · 平台公共层

公共层只放三组都依赖的基础能力：API 客户端、登录校验、会话状态、角色外壳和账号管理组件。

- `components/PortalFrame.tsx`：统一应用壳、菜单、返回按钮和账户入口。
- `components/DataViz.tsx`：只接收真实数值的共享动态图表。
- `motion/RouteMotionProvider.tsx`：路由过渡、按钮反馈和低动态模式。

任何面试、成长或岗位专属逻辑都应放回对应小组模块。修改公共层会影响整个平台，应由至少一个非提交者复核。
