import test from "node:test";
import assert from "node:assert/strict";
import {
  derivePasswordHash,
  hashSessionToken,
  passwordIssue,
  randomToken,
  staffIdIssue,
  studentIdIssue,
  validPassword,
  validStudentId,
  verifyPassword,
} from "../lib/auth.ts";

test("密码使用随机盐派生且可以正确验证", async () => {
  const password = "StrongPass2026";
  const first = await derivePasswordHash(password);
  const second = await derivePasswordHash(password);
  assert.notEqual(first.salt, second.salt);
  assert.notEqual(first.hash, second.hash);
  assert.equal(await verifyPassword(password, first.salt, first.hash), true);
  assert.equal(await verifyPassword("WrongPass2026", first.salt, first.hash), false);
});

test("会话令牌不以明文作为数据库主键", async () => {
  const token = randomToken();
  const digest = await hashSessionToken(token);
  assert.notEqual(token, digest);
  assert.ok(token.length >= 40);
});

test("注册字段执行基础安全校验", () => {
  assert.equal(validStudentId("20251106304"), true);
  assert.equal(validStudentId("abc"), false);
  assert.equal(validPassword("SafePassword2026"), true);
  assert.equal(validPassword("123456"), false);
});

test("注册校验能够返回具体字段问题", () => {
  assert.equal(studentIdIssue("12A456"), "学号只能包含数字");
  assert.equal(studentIdIssue("12345"), "学号长度必须为 6-20 位");
  assert.equal(staffIdIssue("12345"), "教师工号长度必须为 6-12 位");
  assert.equal(staffIdIssue("1234567890123"), "教师工号长度必须为 6-12 位");
  assert.equal(passwordIssue("lowercase2026"), "密码必须包含至少 1 个大写英文字母");
  assert.equal(passwordIssue("UPPERCASE2026"), "密码必须包含至少 1 个小写英文字母");
  assert.equal(passwordIssue("MixedLetters"), "密码必须包含至少 1 个数字");
  assert.equal(passwordIssue("SecurePass2026"), "");
});
