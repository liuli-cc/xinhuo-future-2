"use client";

export type ResumeOcrProgress = {
  stage: "loading" | "rendering" | "recognizing" | "complete";
  progress: number;
  message: string;
};

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".bmp"]);
const OCR_PDF_PAGE_LIMIT = 4;

function extensionOf(name: string) {
  const normalized = name.trim().toLowerCase();
  const dot = normalized.lastIndexOf(".");
  return dot >= 0 ? normalized.slice(dot) : "";
}

export function isResumeImage(name: string) {
  return IMAGE_EXTENSIONS.has(extensionOf(name));
}

export function canUseLocalResumeOcr(name: string) {
  return isResumeImage(name) || extensionOf(name) === ".pdf";
}

function normalizeOcrText(text: string) {
  return text
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 50_000);
}

async function renderPdfPages(file: File, onProgress?: (progress: ResumeOcrProgress) => void) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "/ocr/pdf.worker.min.mjs";
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const pdf = await loadingTask.promise;
  if (pdf.numPages > OCR_PDF_PAGE_LIMIT) {
    await loadingTask.destroy();
    throw new Error(`扫描简历最多支持 ${OCR_PDF_PAGE_LIMIT} 页，请拆分后重新上传`);
  }
  const pageCount = pdf.numPages;
  const images: HTMLCanvasElement[] = [];

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    onProgress?.({
      stage: "rendering",
      progress: Math.round((pageNumber - 1) / Math.max(1, pageCount) * 18),
      message: `正在准备扫描页 ${pageNumber}/${pageCount}`,
    });
    const page = await pdf.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(2.2, 2400 / Math.max(1, baseViewport.width));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("浏览器无法创建 OCR 画布");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    images.push(canvas);
    page.cleanup();
  }
  await loadingTask.destroy();
  return images;
}

export async function extractResumeTextWithOcr(
  file: File,
  onProgress?: (progress: ResumeOcrProgress) => void,
) {
  onProgress?.({ stage: "loading", progress: 1, message: "正在加载本地 OCR 引擎" });
  const { createWorker, OEM } = await import("tesseract.js");
  const pageImages: Array<File | HTMLCanvasElement> = extensionOf(file.name) === ".pdf"
    ? await renderPdfPages(file, onProgress)
    : [file];
  const totalPages = pageImages.length;
  let activePage = 0;

  // Keep English first: Tesseract's combined-language initialization is more
  // stable in this order, while chi_sim still supplies the Chinese glyph set.
  const worker = await createWorker(["eng", "chi_sim"], OEM.LSTM_ONLY, {
    workerPath: "/ocr/worker.min.js",
    corePath: "/ocr/tesseract-core-simd-lstm.wasm.js",
    langPath: "/ocr",
    gzip: true,
    logger: event => {
      if (event.status !== "recognizing text") return;
      const pageBase = 18 + activePage / Math.max(1, totalPages) * 80;
      const pageSpan = 80 / Math.max(1, totalPages);
      onProgress?.({
        stage: "recognizing",
        progress: Math.min(98, Math.round(pageBase + pageSpan * event.progress)),
        message: `正在识别第 ${activePage + 1}/${totalPages} 页文字`,
      });
    },
  });

  const textParts: string[] = [];
  try {
    for (activePage = 0; activePage < pageImages.length; activePage += 1) {
      const result = await worker.recognize(pageImages[activePage]);
      textParts.push(result.data.text);
    }
  } finally {
    await worker.terminate();
    for (const page of pageImages) {
      if (page instanceof HTMLCanvasElement) { page.width = 0; page.height = 0; }
    }
  }

  const text = normalizeOcrText(textParts.join("\n\n"));
  if (text.replace(/\s/g, "").length < 20) {
    throw new Error("OCR 没有识别到足够文字，请上传更清晰、正向且无遮挡的简历图片");
  }
  onProgress?.({ stage: "complete", progress: 100, message: "OCR 识别完成" });
  return text;
}
