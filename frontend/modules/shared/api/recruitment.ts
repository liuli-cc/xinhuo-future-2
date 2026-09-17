import { apiFetch } from "./bmob-api";

export async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await apiFetch(`/api${path}`, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "请求失败，请重试");
  return payload as T;
}

export type StudioUser = { id: number; name: string; role: string };
