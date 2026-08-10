import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  ResumeChunkError,
  validateResumeChunk,
  assembleResumeChunks,
} = require("../functions/xinhuo-api/resume-chunks.js");

const uploadId = "123e4567-e89b-12d3-a456-426614174000";

test("validates and assembles resume chunks in index order", () => {
  const chunks = [
    validateResumeChunk({ uploadId, index: 1, total: 2, data: "V29ybGQ=" }),
    validateResumeChunk({ uploadId, index: 0, total: 2, data: "SGVsbG8g" }),
  ];
  assert.equal(assembleResumeChunks(chunks, 2), "SGVsbG8gV29ybGQ=");
});

test("rejects missing chunks and invalid upload identifiers", () => {
  assert.throws(
    () => assembleResumeChunks([{ index: 0, total: 2, data: "QQ==" }], 2),
    error => error instanceof ResumeChunkError && error.statusCode === 409,
  );
  assert.throws(
    () => validateResumeChunk({ uploadId: "../bad", index: 0, total: 1, data: "QQ==" }),
    error => error instanceof ResumeChunkError,
  );
});
