import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { WebSocket, WebSocketServer } from "ws";

const require = createRequire(import.meta.url);
const sherpa = require("sherpa-onnx-node");
const modelName = "sherpa-onnx-streaming-zipformer-zh-14M-2023-02-23";
const modelDir = path.resolve(process.env.SHERPA_ONNX_MODEL_DIR || path.join(process.cwd(), ".local-asr", modelName));
const port = Number(process.env.SHERPA_ONNX_PORT || 6006);
const modelPath = file => path.join(modelDir, file);
const files = {
  tokens: modelPath("tokens.txt"),
  encoder: modelPath("encoder-epoch-99-avg-1.onnx"),
  decoder: modelPath("decoder-epoch-99-avg-1.onnx"),
  joiner: modelPath("joiner-epoch-99-avg-1.onnx"),
};

if (!Object.values(files).every(existsSync)) {
  console.error(`未找到完整模型：${modelDir}\n请先执行 npm run asr:setup`);
  process.exit(1);
}

const recognizer = new sherpa.OnlineRecognizer({
  featConfig: { sampleRate: 16_000, featureDim: 80 },
  modelConfig: {
    transducer: { encoder: files.encoder, decoder: files.decoder, joiner: files.joiner },
    tokens: files.tokens,
    numThreads: Math.max(2, Math.min(6, Number(process.env.SHERPA_ONNX_THREADS || 4))),
    provider: "cpu",
    debug: 0,
  },
  decodingMethod: "modified_beam_search",
  maxActivePaths: 4,
  enableEndpoint: true,
  rule1MinTrailingSilence: 2.4,
  rule2MinTrailingSilence: 1.2,
  rule3MinUtteranceLength: 20,
});

const server = new WebSocketServer({ host: "127.0.0.1", port });
server.on("connection", socket => {
  const stream = recognizer.createStream();
  let lastText = "";
  socket.on("message", (data, isBinary) => {
    if (!isBinary) return;
    try {
      const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data);
      const exact = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      if (exact.byteLength < 4 || exact.byteLength % 4 !== 0) return;
      stream.acceptWaveform({ sampleRate: 16_000, samples: new Float32Array(exact) });
      while (recognizer.isReady(stream)) recognizer.decode(stream);
      const text = recognizer.getResult(stream).text.trim();
      const isFinal = recognizer.isEndpoint(stream);
      if ((text && text !== lastText) || (isFinal && text)) {
        lastText = text;
        socket.send(JSON.stringify({ text, is_final: isFinal }));
      }
      if (isFinal) {
        recognizer.reset(stream);
        lastText = "";
      }
    } catch (error) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ error: error instanceof Error ? error.message : "sherpa-onnx decode failed" }));
      }
    }
  });
});

server.on("listening", () => console.log(`sherpa-onnx 中文实时识别：ws://127.0.0.1:${port}`));
server.on("error", error => {
  console.error(error);
  process.exitCode = 1;
});
