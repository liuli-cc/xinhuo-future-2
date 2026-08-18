import { existsSync } from "node:fs";
import { mkdir, rename, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

const MODEL_NAME = "sherpa-onnx-streaming-zipformer-zh-14M-2023-02-23";
const MODEL_URL = `https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/${MODEL_NAME}.tar.bz2`;
const root = path.resolve(process.cwd(), ".local-asr");
const modelDir = path.join(root, MODEL_NAME);
const archive = path.join(root, `${MODEL_NAME}.tar.bz2`);

const required = ["tokens.txt", "encoder-epoch-99-avg-1.onnx", "decoder-epoch-99-avg-1.onnx", "joiner-epoch-99-avg-1.onnx"];
if (required.every(file => existsSync(path.join(modelDir, file)))) {
  console.log(`sherpa-onnx 中文模型已就绪：${modelDir}`);
  process.exit(0);
}

await mkdir(root, { recursive: true });
const temporary = `${archive}.partial`;
await rm(temporary, { force: true });
console.log(`正在下载 ${MODEL_NAME}（约 74 MB）…`);
await new Promise((resolve, reject) => {
  const child = spawn("curl", ["--fail", "--location", "--progress-bar", "--output", temporary, MODEL_URL], { stdio: "inherit" });
  child.on("error", reject);
  child.on("exit", code => code === 0 ? resolve() : reject(new Error(`curl 退出码 ${code}`)));
});
await rename(temporary, archive);

console.log("正在解压中文流式模型…");
await new Promise((resolve, reject) => {
  const child = spawn("tar", ["xjf", archive, "-C", root], { stdio: "inherit" });
  child.on("error", reject);
  child.on("exit", code => code === 0 ? resolve() : reject(new Error(`tar 退出码 ${code}`)));
});
await rm(archive, { force: true });
if (!required.every(file => existsSync(path.join(modelDir, file)))) throw new Error("模型文件不完整，请重新执行 npm run asr:setup");
console.log(`sherpa-onnx 中文模型安装完成：${modelDir}`);
