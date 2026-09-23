"use client";

import { apiFetch } from "../../shared/api/bmob-api";
import { validateResumeFile, type ResumeStructured } from "./resume-parser";
import { createResumeUploadId, splitResumeBase64 } from "./resume-upload";
import { extractResumeTextWithOcr, isResumeImage } from "./client-resume-ocr";

export type ImportedResume = { resume: ResumeStructured; text: string };
export type ImportProgress = { progress: number; message: string };

async function post(path: string, payload: unknown): Promise<ImportedResume> {
  const response = await apiFetch(`/api/interview/resume/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || body.detail || "简历识别失败，请重试");
  return body;
}

export async function importResumeFile(file: File, onProgress?: (value: ImportProgress) => void): Promise<ImportedResume> {
  const error = validateResumeFile(file.name, file.size, file.type);
  if (error) throw new Error(error);
  if (/\.doc$/i.test(file.name)) throw new Error("请将旧版 DOC 简历另存为 DOCX 或 PDF 后上传");
  const recognize = async () => {
    const text = await extractResumeTextWithOcr(file, onProgress);
    onProgress?.({ progress: 98, message: "正在整理简历内容" });
    const parsed = await post("parse-text", { text, source: file.name });
    return { ...parsed, text };
  };
  if (isResumeImage(file.name)) return recognize();
  onProgress?.({ progress: 3, message: "正在读取简历" });
  if (/\.(?:txt|md|markdown)$/i.test(file.name)) {
    const bytes = await file.arrayBuffer();
    let text: string;
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
    catch { text = new TextDecoder(new Uint8Array(bytes)[0] === 0xff ? "utf-16le" : new Uint8Array(bytes)[0] === 0xfe ? "utf-16be" : "gb18030").decode(bytes); }
    const parsed = await post("parse-text", { text, source: file.name });
    return { ...parsed, text };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const encoded: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 0x6000) encoded.push(String.fromCharCode(...bytes.subarray(offset, offset + 0x6000)));
  const chunks = splitResumeBase64(btoa(encoded.join("")));
  const uploadId = createResumeUploadId();
  let next = 0;
  let completed = 0;
  await Promise.all(Array.from({ length: Math.min(3, chunks.length) }, async () => {
    while (next < chunks.length) {
      const index = next++;
      await post("chunk", { uploadId, index, total: chunks.length, data: chunks[index] });
      completed += 1;
      onProgress?.({ progress: Math.round(10 + completed / chunks.length * 60), message: "正在上传简历" });
    }
  }));
  onProgress?.({ progress: 75, message: "正在识别简历内容" });
  try {
    const result = await post("parse", { uploadId, total: chunks.length, fileName: file.name, mimeType: file.type, fileSize: file.size });
    onProgress?.({ progress: 100, message: "识别完成" });
    return result;
  } catch (cause) {
    if (/\.pdf$/i.test(file.name) && cause instanceof Error && /OCR|扫描/.test(cause.message)) return recognize();
    throw cause;
  }
}
