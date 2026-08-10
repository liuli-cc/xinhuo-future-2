/**
 * Browser adapter for the CloudBase HTTP function.
 *
 * The public web bundle contains only the HTTPS API endpoint. Database
 * credentials and password hashes remain inside CloudBase.
 */
const SESSION_STORAGE_KEY = "xinhuo_cloudbase_session";
const PROFILE_STORAGE_KEY = "xinhuo_cloudbase_profile";
const PROFILE_EVENT = "xinhuo:profile";
const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024;
let profileCache: unknown | null | undefined;

type ApiInput = string | URL | Request;

function apiBase() {
  return (process.env.NEXT_PUBLIC_API_BASE ?? "").trim().replace(/\/+$/, "");
}

function sessionToken() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(SESSION_STORAGE_KEY) ?? "";
}

function saveSession(token: string) {
  if (typeof window !== "undefined" && token) {
    window.localStorage.setItem(SESSION_STORAGE_KEY, token);
  }
}

function saveProfile(profile: unknown) {
  if (typeof window === "undefined" || !profile || typeof profile !== "object") return;
  profileCache = profile;
  window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  window.dispatchEvent(new Event(PROFILE_EVENT));
}

export function cachedUserProfile<T>() {
  if (typeof window === "undefined") return null;
  if (profileCache !== undefined) return profileCache as T | null;
  const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
  try {
    profileCache = raw ? JSON.parse(raw) : null;
  } catch {
    profileCache = null;
    window.localStorage.removeItem(PROFILE_STORAGE_KEY);
  }
  return profileCache as T | null;
}

export function subscribeUserProfile(listener: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(PROFILE_EVENT, listener);
  return () => window.removeEventListener(PROFILE_EVENT, listener);
}

function clearSession() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    window.localStorage.removeItem(PROFILE_STORAGE_KEY);
    profileCache = null;
    window.dispatchEvent(new Event(PROFILE_EVENT));
  }
}

function requestUrl(input: ApiInput) {
  if (input instanceof Request) return new URL(input.url);
  if (input instanceof URL) return input;
  return new URL(input, typeof window === "undefined" ? "http://localhost" : window.location.origin);
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("佐证文件读取失败"));
    reader.onload = () => resolve(String(reader.result).split(",").at(-1) ?? "");
    reader.readAsDataURL(file);
  });
}

async function normalizeBody(body: BodyInit | null | undefined) {
  if (!body || typeof FormData === "undefined" || !(body instanceof FormData)) return body;
  const values: Record<string, unknown> = {};
  let file: File | null = null;
  for (const [key, value] of body.entries()) {
    if (typeof File !== "undefined" && value instanceof File) file = value;
    else values[key] = value;
  }
  if (file) {
    if (file.size > MAX_ATTACHMENT_BYTES) throw new Error("佐证文件不能超过 3MB");
    values.attachment = {
      name: file.name,
      size: file.size,
      mimeType: file.type || "application/octet-stream",
      base64: await fileToBase64(file),
    };
  }
  return JSON.stringify(values);
}

function localError(message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 503,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/** Replacement for client-side fetch('/api/...') calls. */
export async function apiFetch(input: ApiInput, init?: RequestInit): Promise<Response> {
  const url = requestUrl(input);
  if (!url.pathname.startsWith("/api/")) return fetch(input, init);
  const base = apiBase();
  if (!base) return localError("平台后端尚未配置，请联系管理员");

  try {
    const headers = new Headers(init?.headers);
    const token = sessionToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const body = await normalizeBody(init?.body);
    if (body && typeof body === "string" && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    const endpoint = `${base}${url.pathname.replace(/^\/api/, "")}${url.search}`;
    const response = await fetch(endpoint, { ...init, headers, body, credentials: "omit" });

    if ((url.pathname === "/api/auth/login" || url.pathname === "/api/auth/me") && response.ok) {
      const payload = await response.clone().json() as { sessionToken?: string; user?: unknown };
      if (payload.sessionToken) saveSession(payload.sessionToken);
      if (payload.user) saveProfile(payload.user);
    }
    if (url.pathname === "/api/auth/logout" && response.ok) clearSession();
    if (response.status === 401 && url.pathname !== "/api/auth/login") clearSession();
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "腾讯云后端暂时不可用";
    return localError(
      /load failed|failed to fetch|networkerror/i.test(message)
        ? "网络请求被浏览器或云端网关中断，请检查网络后重试"
        : message,
    );
  }
}

export function bmobConfigured() {
  return Boolean(apiBase());
}

export function clearBmobSession() {
  clearSession();
}
