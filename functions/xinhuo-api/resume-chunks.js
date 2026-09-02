"use strict";

const RESUME_CHUNK_MAX_CHARACTERS = 96 * 1024;
const RESUME_CHUNK_MAX_COUNT = 48;
const RESUME_UPLOAD_ID_PATTERN = /^(?:[0-9a-f]{8}-[0-9a-f-]{27,36}|resume-\d{10,}-[0-9a-f]{6,})$/i;

class ResumeChunkError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "ResumeChunkError";
    this.statusCode = statusCode;
  }
}

function validateResumeUploadId(value) {
  const uploadId = String(value || "").trim();
  if (!RESUME_UPLOAD_ID_PATTERN.test(uploadId) || uploadId.length > 80) {
    throw new ResumeChunkError("简历上传标识无效，请重新选择文件");
  }
  return uploadId;
}

function validateResumeChunk(payload) {
  const uploadId = validateResumeUploadId(payload?.uploadId);
  const index = Number(payload?.index);
  const total = Number(payload?.total);
  const data = String(payload?.data || "").trim();
  if (!Number.isInteger(total) || total < 1 || total > RESUME_CHUNK_MAX_COUNT) {
    throw new ResumeChunkError("简历分片数量无效，请重新上传");
  }
  if (!Number.isInteger(index) || index < 0 || index >= total) {
    throw new ResumeChunkError("简历分片序号无效，请重新上传");
  }
  if (!data || data.length > RESUME_CHUNK_MAX_CHARACTERS) {
    throw new ResumeChunkError("简历分片大小无效，请重新上传", 413);
  }
  if (!/^[A-Za-z0-9+/_-]*={0,4}$/.test(data)) {
    throw new ResumeChunkError("简历分片编码无效，请重新上传");
  }
  return { uploadId, index, total, data };
}

function assembleResumeChunks(chunks, expectedTotal) {
  const total = Number(expectedTotal);
  if (!Number.isInteger(total) || total < 1 || total > RESUME_CHUNK_MAX_COUNT) {
    throw new ResumeChunkError("简历分片数量无效，请重新上传");
  }
  const ordered = [...(chunks || [])].sort((a, b) => Number(a.index) - Number(b.index));
  if (ordered.length !== total) {
    throw new ResumeChunkError("简历上传不完整，请检查网络后重试", 409);
  }
  for (let index = 0; index < total; index += 1) {
    const item = ordered[index];
    if (Number(item.index) !== index || Number(item.total) !== total) {
      throw new ResumeChunkError("简历分片顺序异常，请重新上传", 409);
    }
    if (!item.data || String(item.data).length > RESUME_CHUNK_MAX_CHARACTERS) {
      throw new ResumeChunkError("简历分片内容异常，请重新上传", 409);
    }
  }
  return ordered.map(item => String(item.data)).join("");
}

module.exports = {
  RESUME_CHUNK_MAX_CHARACTERS,
  RESUME_CHUNK_MAX_COUNT,
  ResumeChunkError,
  validateResumeUploadId,
  validateResumeChunk,
  assembleResumeChunks,
};
