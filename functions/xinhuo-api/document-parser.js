"use strict";

const AdmZip = require("adm-zip");
const WordExtractor = require("word-extractor");

const MAX_RESUME_BYTES = 3 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([".pdf", ".doc", ".docx", ".txt", ".md", ".markdown"]);

class ResumeDocumentError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "ResumeDocumentError";
    this.statusCode = statusCode;
  }
}

function extensionOf(fileName) {
  const normalized = String(fileName || "").trim().toLowerCase();
  const dot = normalized.lastIndexOf(".");
  return dot >= 0 ? normalized.slice(dot) : "";
}

function decodeBase64Document(base64, declaredSize) {
  const normalized = String(base64 || "").replace(/\s+/g, "");
  if (!normalized) throw new ResumeDocumentError("请选择需要上传的简历文件");
  // Accept standard and URL-safe base64 (A-Za-z0-9+/ and -_)
  if (!/^[A-Za-z0-9+/_-]*={0,4}$/.test(normalized)) {
    throw new ResumeDocumentError("文件编码无效，请重新选择原始简历文件");
  }

  const buffer = Buffer.from(normalized, "base64");
  if (!buffer.length) throw new ResumeDocumentError("文件内容为空，请选择有效简历");
  if (buffer.length > MAX_RESUME_BYTES) {
    throw new ResumeDocumentError("文件超过3MB，请压缩简历后重新上传", 413);
  }
  if (declaredSize > 0 && Math.abs(buffer.length - declaredSize) > 256) {
    throw new ResumeDocumentError("文件传输不完整，请检查网络后重新上传");
  }
  return buffer;
}

function assertDocumentSignature(buffer, extension) {
  if (extension === ".pdf" && buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw new ResumeDocumentError("文件扩展名是PDF，但内容不是有效PDF，请重新导出后上传");
  }
  if (extension === ".docx" && !(buffer[0] === 0x50 && buffer[1] === 0x4b)) {
    throw new ResumeDocumentError("文件扩展名是DOCX，但内容不是有效Word文档，请重新导出后上传");
  }
  if (
    extension === ".doc"
    && !buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))
  ) {
    throw new ResumeDocumentError("文件扩展名是DOC，但内容不是有效的旧版Word文档，请重新另存后上传");
  }
}

function decodeXmlEntities(text) {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"');
}

function normalizeExtractedText(text) {
  return String(text || "")
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 50_000);
}

async function extractPdfText(buffer) {
  // pdf-parse is intentionally loaded only when a PDF is uploaded.  This
  // keeps the rest of the HTTP function (login, growth data, voice, etc.)
  // available even if the optional PDF runtime has a platform-specific issue.
  let pdfModule;
  try {
    pdfModule = require("pdf-parse");
  } catch (error) {
    console.error("[xinhuo-api] Failed to load PDF parser:", error);
    throw new ResumeDocumentError("PDF解析组件暂未就绪，请稍后重试或先上传DOCX/TXT简历", 503);
  }

  console.log("[xinhuo-api] Starting PDF text extraction, buffer length:", buffer.length);

  // pdf-parse 1.x is pure JavaScript and works in CloudBase's Linux runtime.
  // Keep the 2.x branch for local/newer runtimes without tying cloud parsing
  // to optional native canvas binaries.
  if (typeof pdfModule === "function") {
    try {
      const result = await pdfModule(buffer, { max: 10 });
      console.log("[xinhuo-api] PDF extraction completed, text length:", result.text?.length || 0);
      return normalizeExtractedText(result.text);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      console.error("[xinhuo-api] PDF text extraction failed:", error);
      if (/password/i.test(message)) {
        throw new ResumeDocumentError("PDF已加密，请取消密码保护后重新上传");
      }
      throw new ResumeDocumentError("PDF文字提取失败；如果是扫描版简历，请先导出为可复制文字的PDF");
    }
  }

  const PDFParse = pdfModule?.PDFParse;
  if (typeof PDFParse !== "function") {
    throw new ResumeDocumentError("PDF解析组件版本不兼容，请先上传DOCX或TXT简历", 503);
  }
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText({ first: 10 });
    console.log("[xinhuo-api] PDF extraction completed, text length:", result.text?.length || 0);
    return normalizeExtractedText(result.text);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/password/i.test(message)) {
      throw new ResumeDocumentError("PDF已加密，请取消密码保护后重新上传");
    }
    throw new ResumeDocumentError("PDF文字提取失败；如果是扫描版简历，请先导出为可复制文字的PDF");
  } finally {
    await parser.destroy().catch(() => {});
  }
}

function extractDocxText(buffer) {
  try {
    const zip = new AdmZip(buffer);
    const entry = zip.getEntry("word/document.xml");
    if (!entry) throw new ResumeDocumentError("DOCX缺少正文内容，请重新导出Word文档");
    const xml = entry.getData().toString("utf8");
    const text = decodeXmlEntities(
      xml
        .replace(/<w:tab\b[^>]*\/>/g, "\t")
        .replace(/<w:br\b[^>]*\/>/g, "\n")
        .replace(/<\/w:p>/g, "\n")
        .replace(/<\/w:tr>/g, "\n")
        .replace(/<\/w:tc>/g, "\t")
        .replace(/<[^>]+>/g, ""),
    );
    return normalizeExtractedText(text);
  } catch (error) {
    if (error instanceof ResumeDocumentError) throw error;
    throw new ResumeDocumentError("DOCX解析失败，请确认文件未损坏，并使用Word重新另存为DOCX");
  }
}

async function extractLegacyDocText(buffer) {
  try {
    const extractor = new WordExtractor();
    const document = await extractor.extract(buffer);
    return normalizeExtractedText([
      document.getBody(),
      document.getTextboxes({ includeHeadersAndFooters: false }),
      document.getHeaders(),
      document.getFootnotes(),
      document.getEndnotes(),
    ].filter(Boolean).join("\n"));
  } catch (error) {
    console.error("[xinhuo-api] Legacy DOC extraction failed:", error);
    throw new ResumeDocumentError("DOC解析失败，请确认文件未损坏，或另存为DOCX后重试");
  }
}

async function parseResumeDocument({ fileName, fileSize, base64 }) {
  const extension = extensionOf(fileName);
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new ResumeDocumentError(`不支持${extension || "未知"}格式，请上传PDF、Word、TXT或Markdown`);
  }

  const buffer = decodeBase64Document(base64, Number(fileSize) || 0);
  assertDocumentSignature(buffer, extension);

  const text = extension === ".pdf"
    ? await extractPdfText(buffer)
    : extension === ".docx"
      ? extractDocxText(buffer)
      : extension === ".doc"
        ? await extractLegacyDocText(buffer)
      : normalizeExtractedText(buffer.toString("utf8"));

  if (text.replace(/\s/g, "").length < 20) {
    throw new ResumeDocumentError(
      extension === ".pdf"
        ? "PDF中没有提取到足够文字；系统可返回浏览器使用本地OCR后重新识别"
        : "简历内容过短，请上传包含完整经历的文件",
    );
  }

  return { text, extension, bytes: buffer.length };
}

module.exports = {
  MAX_RESUME_BYTES,
  ResumeDocumentError,
  extensionOf,
  decodeBase64Document,
  assertDocumentSignature,
  extractDocxText,
  extractLegacyDocText,
  extractPdfText,
  parseResumeDocument,
};
