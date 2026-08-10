import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const AdmZip = require("../functions/xinhuo-api/node_modules/adm-zip");
const {
  MAX_RESUME_BYTES,
  ResumeDocumentError,
  parseResumeDocument,
} = require("../functions/xinhuo-api/document-parser.js");

function toPayload(fileName, buffer) {
  return {
    fileName,
    fileSize: buffer.length,
    base64: buffer.toString("base64"),
  };
}

test("parses TXT resume content", async () => {
  const buffer = Buffer.from("张三\\n教育背景 内蒙古师范大学\\n专业 人工智能\\n项目经历 校园成长平台");
  const result = await parseResumeDocument(toPayload("resume.txt", buffer));
  assert.match(result.text, /人工智能/);
});

test("parses Markdown resume content as UTF-8 text", async () => {
  const buffer = Buffer.from("# 王五\\n\\n## 教育背景\\n内蒙古师范大学\\n\\n## 项目经历\\nAI模拟面试平台");
  const result = await parseResumeDocument(toPayload("resume.md", buffer));
  assert.equal(result.extension, ".md");
  assert.match(result.text, /AI模拟面试平台/);
});

test("parses DOCX main document XML", async () => {
  const zip = new AdmZip();
  zip.addFile("[Content_Types].xml", Buffer.from('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'));
  zip.addFile("word/document.xml", Buffer.from(
    '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>李四 简历</w:t></w:r></w:p><w:p><w:r><w:t>教育背景 内蒙古师范大学 人工智能学院</w:t></w:r></w:p><w:p><w:r><w:t>项目经历 智能面试平台开发与测试</w:t></w:r></w:p></w:body></w:document>',
  ));
  const buffer = zip.toBuffer();
  const result = await parseResumeDocument(toPayload("resume.docx", buffer));
  assert.match(result.text, /智能面试平台/);
});

test("extracts text from a PDF without native runtime dependencies", async () => {
  const buffer = fs.readFileSync(
    new URL("../functions/xinhuo-api/node_modules/pdf-parse/test/data/04-valid.pdf", import.meta.url),
  );
  const result = await parseResumeDocument(toPayload("resume.pdf", buffer));
  assert.ok(result.text.length > 20);
});

test("rejects spoofed and oversized resume files with explicit errors", async () => {
  await assert.rejects(
    () => parseResumeDocument(toPayload("fake.pdf", Buffer.from("not a real pdf document with enough characters"))),
    error => error instanceof ResumeDocumentError && /不是有效PDF/.test(error.message),
  );
  const oversized = Buffer.alloc(MAX_RESUME_BYTES + 1, 65);
  await assert.rejects(
    () => parseResumeDocument(toPayload("large.txt", oversized)),
    error => error instanceof ResumeDocumentError && error.statusCode === 413,
  );
});
