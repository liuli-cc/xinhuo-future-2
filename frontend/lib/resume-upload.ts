// CloudBase's public HTTP gateway can reject JSON bodies well below 512KB.
// Keep each Base64 request under 100KB including JSON overhead.
export const RESUME_UPLOAD_CHUNK_BYTES = 96 * 1024;
export const RESUME_UPLOAD_MAX_CHUNKS = 48;

export function splitResumeBase64(
  base64: string,
  chunkSize = RESUME_UPLOAD_CHUNK_BYTES,
) {
  if (!Number.isInteger(chunkSize) || chunkSize <= 0 || chunkSize % 4 !== 0) {
    throw new Error("简历分片大小配置无效");
  }
  const chunks: string[] = [];
  for (let offset = 0; offset < base64.length; offset += chunkSize) {
    chunks.push(base64.slice(offset, offset + chunkSize));
  }
  if (!chunks.length) throw new Error("简历内容为空");
  if (chunks.length > RESUME_UPLOAD_MAX_CHUNKS) {
    throw new Error("简历编码后体积异常，请确认文件不超过3MB");
  }
  return chunks;
}

export function createResumeUploadId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `resume-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
