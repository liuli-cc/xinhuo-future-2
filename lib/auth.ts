const encoder = new TextEncoder();
const PASSWORD_ITERATIONS = 310_000;
const LEGACY_PASSWORD_ITERATIONS = 60_000;
export const SESSION_COOKIE = "xinhuo_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

export function randomToken(byteLength = 32) {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

async function deriveWithIterations(password: string, salt: string, iterations: number) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({
    name: "PBKDF2",
    hash: "SHA-256",
    salt: base64UrlToBytes(salt),
    iterations,
  }, key, 256);
  return { salt, hash: bytesToBase64Url(new Uint8Array(bits)) };
}

export async function derivePasswordHash(password: string, salt = randomToken(16)) {
  return deriveWithIterations(password, salt, PASSWORD_ITERATIONS);
}

function constantTimeEqual(value: string, expected: string) {
  if (value.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < value.length; index += 1) difference |= value.charCodeAt(index) ^ expected.charCodeAt(index);
  return difference === 0;
}

export async function verifyPassword(password: string, salt: string, expectedHash: string) {
  const { hash } = await derivePasswordHash(password, salt);
  if (constantTimeEqual(hash, expectedHash)) return true;
  const legacy = await deriveWithIterations(password, salt, LEGACY_PASSWORD_ITERATIONS);
  return constantTimeEqual(legacy.hash, expectedHash);
}

export async function hashSessionToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(token));
  return bytesToBase64Url(new Uint8Array(digest));
}

export function readSessionToken(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  for (const part of cookie.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === SESSION_COOKIE) return decodeURIComponent(value.join("="));
  }
  return "";
}

export function sessionCookie(token: string, request: Request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}${secure}`;
}

export function clearSessionCookie(request: Request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export function validStudentId(value: string) {
  return studentIdIssue(value) === "";
}

export function studentIdIssue(value: string) {
  if (!value) return "学号不能为空";
  if (!/^\d+$/.test(value)) return "学号只能包含数字";
  if (value.length < 6 || value.length > 20) return "学号长度必须为 6-20 位";
  return "";
}

export function staffIdIssue(value: string) {
  if (!value) return "教师工号不能为空";
  if (!/^\d+$/.test(value)) return "教师工号只能包含数字";
  if (value.length < 6 || value.length > 12) return "教师工号长度必须为 6-12 位";
  return "";
}

export function accountIdIssue(value: string) {
  if (!value) return "学号或工号不能为空";
  if (!/^\d+$/.test(value)) return "学号或工号只能包含数字";
  if (value.length < 6 || value.length > 20) return "学号或工号长度必须为 6-20 位";
  return "";
}

export function nameIssue(value: string) {
  if (!value) return "姓名不能为空";
  if (value.length < 2 || value.length > 30) return "姓名长度必须为 2-30 个字";
  return "";
}

export function validEmail(value: string) {
  return value === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function validPassword(value: string) {
  return passwordIssue(value) === "";
}

export function passwordIssue(value: string) {
  if (!value) return "密码不能为空";
  if (value.length < 10 || value.length > 128) return "密码长度必须为 10-128 位";
  if (!/[A-Z]/.test(value)) return "密码必须包含至少 1 个大写英文字母";
  if (!/[a-z]/.test(value)) return "密码必须包含至少 1 个小写英文字母";
  if (!/\d/.test(value)) return "密码必须包含至少 1 个数字";
  return "";
}
