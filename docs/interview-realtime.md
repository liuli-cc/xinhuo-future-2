# 双向实时语音面试

核对日期：2026-09-23。实现使用 OpenAI Realtime GA 的 WebRTC unified interface，独立于现有浏览器识别＋文本模型＋浏览器朗读模式。页面不会因探测能力而创建付费通话。

## 开启

在后端环境中设置以下变量，重启服务；禁止放进 NEXT_PUBLIC 变量或浏览器代码：

```dotenv
OPENAI_REALTIME_API_KEY=
REALTIME_MODEL=gpt-realtime-2.1
REALTIME_VOICE=marin
REALTIME_VAD_MODE=semantic_vad
REALTIME_MAX_SECONDS=900
```

REALTIME_MODEL 默认值取自当前官方 WebRTC 示例与模型页面；账户仍需具备该模型权限和额度，可由管理员配置另一个支持 GA Realtime 的模型。此密钥不会回退使用文本模型的 LLM_API_KEY。普通智能面试继续沿用 LLM_PROVIDER、LLM_MODEL、LLM_API_KEY / DEEPSEEK_API_KEY。

学生登录后，选择面试提纲，在语音方式中选“双向实时语音”，勾选声音与经历传输同意，再点击进入通话。只有这一步才协商上游会话。浏览器必须使用 HTTPS 或 localhost，并允许麦克风；浏览器和后端都需要能够连接 OpenAI。若自动播放被浏览器阻止，页面会显示播放按钮。

## 数据与连接

1. 浏览器创建 RTCPeerConnection、麦克风轨道及 oai-events data channel，再生成 SDP。
2. POST /api/v1/interview/realtime/session 需要平台登录、consent=true、受限大小的有效 SDP。后端把 SDP 与服务端确定的模型、指令、VAD、音色一起以 multipart 提交到 /v1/realtime/calls；供应商密钥只存在服务器。
3. 浏览器只接收 SDP answer、签名通话凭据、时长上限和 VAD 设置。音频通过 WebRTC 媒体轨道双向流动；文字事件走 data channel。此路径不依赖 SSE，因此临时 HTTP 隧道的 SSE 缓冲不影响音频流。
4. 默认 semantic_vad、medium、interrupt_response=true、create_response=true；它根据语义判断是否说完。将 REALTIME_VAD_MODE 设为 server_vad 时，使用 900ms 静默与 300ms 前置缓存。页面暂停/恢复会保留服务端选择。
5. 开口时服务端 VAD 自动取消并截断未播放的音频。手动打断发送 response.cancel（仅生成仍活跃时）与 output_audio_buffer.clear。暂停同时禁用麦克风轨道和自动接话。
6. 结束、卸载和断线会释放麦克风、播放器、AudioContext、data channel 与 peer；另以所有者绑定的签名凭据调用服务端 hangup。前端和服务进程的 watchdog 都设置最长 15 分钟上限，每账户每进程最多每分钟开始 3 次。

watchdog 与启动频率限制目前是进程内状态；正式多进程部署应使用共享额度与持久调度，并在 OpenAI 项目配置支出上限。worker 重启时不能把进程内 watchdog 当作绝对账单保证。挂断网络失败时前端仍关闭本地媒体，后台 watchdog 兜底。

## 转写与反馈

输入转写使用 gpt-4o-mini-transcribe，要求保留实际语气词和自我修正。输入音频由 Realtime 模型直接处理；旁路转写是异步结果，不等同于模型精确听到的内容。事件按 item_id 去重，在 speech_started 时保留顺序与题目，避免后返回的转写配到下一题。被打断的面试官文本带标记，不能声称生成的全部文本都已播放。

麦克风与模型输出分别采样音量，动画分别回应学生和面试官。只保留能量帧统计，没有原始录音缓存。候选人的回答关联有效语音时长、内部停顿、开口等待与转写可见的语气词；这些是近似观测，转写可能省略语气词。句末助词、普通承接词不统一视为迟疑；不推断性格、情绪障碍或就业结论。

实时通话结束时等待短暂的异步转写排空，只对已完成文本形成练习报告；如仍有未完成转写，会提示只保存完成的回答。原生语音模型本身不冒充数值评分器。此模式在没有普通评分模型时使用明确标注的练习量表；已配置普通模型并确认对应数据传输时，每轮转写在后台调用 /interview/model review，通过服务端 interview-coach.md 注入评估规则，只有可定位原文的维度分数参与计分。评分请求不阻塞音频。结束通话后报告最多等待 8 秒；未完成的评分保留提纲分并注明，报告锁定后迟到响应不修改已保存结果。

## 当前验证

已做模拟的 SDP 协商、迟到协商取消、异步转写顺序/去重、输入和输出分离、打断事件、登录/同意校验、签名凭据归属，以及服务端模型/指令不能被客户端覆盖的测试。没有配置真实密钥，未产生付费调用；没有实测真实麦克风接话延迟、服务商端转写精度或打断音频的尾延迟。上线前用真实账户和耳机验收这些行为。

## 官方依据

- [Realtime WebRTC unified interface](https://developers.openai.com/api/docs/guides/voice-webrtc?api=realtime)
- [GPT-Realtime-2.1 模型](https://developers.openai.com/api/docs/models/gpt-realtime-2.1)
- [VAD 与自动打断](https://developers.openai.com/api/docs/guides/realtime-vad)
- [WebRTC 中断、自动截断和输出缓冲清理](https://developers.openai.com/api/docs/guides/realtime-conversations#interruption-and-truncation)
- [会话输入转写与音色字段](https://developers.openai.com/api/reference/resources/realtime/subresources/client_secrets/methods/create)
- [结束 WebRTC 通话](https://developers.openai.com/api/reference/resources/realtime/subresources/calls/methods/hangup)
