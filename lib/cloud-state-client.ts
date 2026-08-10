import { apiFetch } from "./bmob-api";

export type CloudStateKey = "ai_chat" | "resource_saved" | "career_saved" | "career_applied" | "interview_history";

export async function loadCloudState<T>(key: CloudStateKey, fallback: T): Promise<T> {
  const response = await apiFetch(`/api/cloud-state?key=${encodeURIComponent(key)}`);
  if (!response.ok) return fallback;
  const body = await response.json() as { value?: T | null };
  return body.value ?? fallback;
}

export async function saveCloudState(key: CloudStateKey, value: unknown) {
  const response = await apiFetch(`/api/cloud-state?key=${encodeURIComponent(key)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value }),
  });
  if (!response.ok) throw new Error("云端状态保存失败");
}

export async function clearCloudState(key: CloudStateKey) {
  const response = await apiFetch(`/api/cloud-state?key=${encodeURIComponent(key)}`, { method: "DELETE" });
  if (!response.ok) throw new Error("云端状态清理失败");
}
