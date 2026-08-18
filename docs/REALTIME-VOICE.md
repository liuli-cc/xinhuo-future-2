# 实时双工中文语音接入

模拟面试前端现在按以下优先级自动选择语音链路：

1. `SoulX-Duplug`：语义 VAD 判断用户是否真正说完，适合随时插话的全双工对话。
2. `FunASR`：中文 2-pass 流式识别，实时返回在线结果，再用离线结果校正标点与同音词。
3. `sherpa-onnx`：随仓库提供可启动的 macOS/Linux CPU 本地桥接，使用 14M 中文流式 Zipformer 模型。
4. `Chrome SpeechRecognition`：前三项不可用时的兼容回退。

前端始终持续采集麦克风音量用于自适应端点检测；浏览器开启回声消除、降噪和自动增益。岗位名、技能、当前问题和简历技能会作为上下文热词传给 FunASR，并用于 Chrome 的多候选重排。面试官播报与识别文本高度重合时会按扬声器回声剔除，真正不同的回答仍会触发打断。

## 配置

复制 `frontend/.env.example` 为 `frontend/.env.local`，至少配置一个开源 WebSocket：

```dotenv
NEXT_PUBLIC_SOULX_DUPLEX_WS_URL=ws://localhost:8000/turn
NEXT_PUBLIC_FUNASR_WS_URL=ws://localhost:10095
NEXT_PUBLIC_SHERPA_ONNX_WS_URL=ws://localhost:6006
```

重新执行 `npm run dev` 或生产构建后生效。线上 HTTPS 页面必须使用有有效证书的 `wss://` 地址，否则浏览器会拦截混合内容。这三个变量会写入前端产物，不能放密钥。

服务端部署和模型下载请以项目上游说明为准：

- [SoulX-Duplug](https://github.com/Soul-AILab/SoulX-Duplug)：Apache-2.0；提供流式语义 VAD 和 `/turn` WebSocket，中文部署应选择其 Paraformer 配置。
- [FunASR](https://github.com/modelscope/FunASR)：MIT；提供 streaming ASR、VAD、标点与 2-pass WebSocket runtime。
- [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx)：Apache-2.0；本分支已按其[流式 WebSocket 协议](https://k2-fsa.github.io/sherpa/onnx/websocket/online-websocket.html)提供本地 Node 桥接。首次执行 `npm run asr:setup` 下载约 74MB 的官方中文模型，再执行 `npm run asr:start` 启动 `ws://127.0.0.1:6006`。

## 文本与隐私边界

- 实时音频仅发送给当前选中的识别服务，前端不落盘、不上传原始录音到薪火未来 API。
- AI 追问和评分只接收清理后的回答，降低“嗯、呃、那个那个、然后然后”等表达噪声。
- 原始转写和清理数量随本轮答案保存，用于口头语统计与用户展开核对；它仍属于个人数据，应遵循平台隐私和删除流程。
- 自动清理采取保守规则。过短回答不会被清空，用户可在对话记录中查看原文。

## 验收建议

自动测试可以验证协议消息、16 kHz 重采样、PCM 转换、热词重排、口头语清理和回声判断，但无法替代真实麦克风验收。发布前至少在 Chrome 做四组人工测试：正常音量、小声距离 50 cm、带同音岗位词、面试官播报中途插话。扬声器外放环境受物理回声影响，推荐耳机以获得最稳定的双工打断效果。
