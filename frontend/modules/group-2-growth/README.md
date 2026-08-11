# Group 2 · 成长任务、能力画像与榜样导师

负责成长任务、成长佐证、能力画像、决策建议、资源收藏和导师目录。

- `client/`：成长与决策规则引擎。
- `components/FourYearJourney.tsx`：八学期真实进度驱动的四年成长路径。
- `backend/app/modules/`：FastAPI/MySQL 的基础模块已接入；画像、成长任务、导师目录的业务接口仍待迁移。
- 路由入口包括 `app/growth-map/`、`app/portrait/`、`app/ai/` 和 `app/resources/`。

岗位投递和面试逻辑不放入本模块；跨组数据通过现有 API 或共享类型衔接。未迁移业务会返回明确的 501 状态，不会写入不匹配的数据表。
