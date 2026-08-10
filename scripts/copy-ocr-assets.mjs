import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = join(root, "public", "ocr");

const assets = [
  ["node_modules/tesseract.js/dist/worker.min.js", "worker.min.js"],
  ["node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js", "tesseract-core-simd-lstm.wasm.js"],
  ["node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm", "tesseract-core-simd-lstm.wasm"],
  ["node_modules/@tesseract.js-data/chi_sim/4.0.0_best_int/chi_sim.traineddata.gz", "chi_sim.traineddata.gz"],
  ["node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz", "eng.traineddata.gz"],
  ["node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs", "pdf.worker.min.mjs"],
];

await mkdir(target, { recursive: true });
await Promise.all(assets.map(([source, name]) => copyFile(join(root, source), join(target, name))));
console.log(`[xinhuo] Prepared ${assets.length} local OCR assets in public/ocr`);
