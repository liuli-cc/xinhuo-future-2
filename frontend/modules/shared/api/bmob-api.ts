/**
 * FastAPI/MySQL browser adapter.
 *
 * The filename is retained temporarily so the migrated growth-river pages keep
 * their imports. Requests never fall back to a legacy function gateway:
 * only FastAPI routes with an explicit compatibility mapping are sent.
 */
const SESSION_STORAGE_KEY = "xinhuo_fastapi_session";
const PROFILE_STORAGE_KEY = "xinhuo_fastapi_profile";
const PROFILE_EVENT = "xinhuo:profile";
let profileCache: unknown | null | undefined;

type ApiInput = string | URL | Request;

function apiBase() {
  return (process.env.NEXT_PUBLIC_API_BASE ?? "").trim().replace(/\/+$/, "");
}

function sessionToken() {
  if (typeof window === "undefined") return "";
  migrateLegacySession();
  return window.sessionStorage.getItem(SESSION_STORAGE_KEY) ?? "";
}

function saveSession(token: string) {
  if (typeof window !== "undefined" && token) {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, token);
  }
}

function migrateLegacySession() {
  if (typeof window === "undefined") return;
  const token = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (!token) return;
  window.sessionStorage.setItem(SESSION_STORAGE_KEY, token);
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
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

export function updateCachedUserProfile(profile: unknown) {
  saveProfile(profile);
}

function clearSession() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
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

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function localError(message: string) {
  return jsonResponse(503, { error: message, error_code: "api_unavailable" });
}

async function normalizeErrorResponse(response: Response) {
  if (response.ok) return response;
  const payload = await response.clone().json().catch(() => null) as Record<string, unknown> | null;
  if (!payload || typeof payload.error === "string") return response;
  const message = typeof payload.message === "string"
    ? payload.message
    : typeof payload.detail === "string"
      ? payload.detail
      : "请求失败";
  return jsonResponse(response.status, { ...payload, error: message });
}

function mappedEndpoint(pathname: string) {
  if (pathname === "/api/health") return "/api/health";
  if (pathname === "/api/health/ready") return "/health/ready";
  // v0.5 exposes the river frontend's complete compatibility contract under
  // the versioned FastAPI namespace. No legacy function gateway fallback.
  return `/api/v1${pathname.slice(4)}`;
}

/** Replacement for client-side fetch('/api/...') calls in the river frontend. */
export async function apiFetch(input: ApiInput, init?: RequestInit): Promise<Response> {
  const url = requestUrl(input);
  if (!url.pathname.startsWith("/api/")) return fetch(input, init);

  const base = apiBase();
  if (!base) return localError("平台后端尚未配置，请设置 NEXT_PUBLIC_API_BASE");

  const endpoint = mappedEndpoint(url.pathname);

  try {
    const headers = new Headers(init?.headers);
    const token = sessionToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const response = await fetch(`${base}${endpoint}${url.search}`, {
      ...init,
      headers,
      credentials: "include",
    });

    if ((url.pathname === "/api/auth/login" || url.pathname === "/api/auth/me") && response.ok) {
      const payload = await response.clone().json() as { sessionToken?: string; user?: unknown };
      if (payload.sessionToken) saveSession(payload.sessionToken);
      if (payload.user) saveProfile(payload.user);
    }
    if (url.pathname === "/api/auth/logout" && response.ok) clearSession();
    if (url.pathname === "/api/account" && response.ok) {
      const payload = await response.clone().json().catch(() => null) as { user?: unknown } | null;
      if (payload?.user) saveProfile(payload.user);
    }
    if (response.status === 401 && url.pathname !== "/api/auth/login") clearSession();
    return normalizeErrorResponse(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "FastAPI 后端暂时不可用";
    return localError(
      /load failed|failed to fetch|networkerror/i.test(message)
        ? "网络请求被浏览器或网关中断，请检查 API 地址后重试"
        : message,
    );
  }
}

export function fastApiConfigured() {
  return Boolean(apiBase());
}

/** @deprecated Compatibility export retained for existing migrated imports. */
export const bmobConfigured = fastApiConfigured;

export function clearFastApiSession() {
  clearSession();
}

/** @deprecated Compatibility export retained for existing migrated imports. */
export const clearBmobSession = clearFastApiSession;
