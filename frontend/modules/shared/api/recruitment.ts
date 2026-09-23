import { apiFetch } from "./bmob-api";

const fieldLabels: Record<string, string> = { name: "姓名", role: "目标岗位", school: "学校", major: "专业", grade: "年级", city: "城市", email: "邮箱", phone: "电话", summary: "个人简介", skills: "核心技能", experiences: "项目经历", title: "项目名称", detail: "经历内容", period: "时间", org: "组织名称" };

export async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await apiFetch(`/api${path}`, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = payload?.detail;
    if (Array.isArray(detail) && detail.length) {
      const issue = detail[0];
      const label = fieldLabels[String(issue.loc?.at(-1))] || "表单内容";
      throw new Error(issue.type === "string_too_long" ? `${label}最多填写 ${issue.ctx?.max_length} 个字符` : `${label}格式有误，请检查后重试`);
    }
    throw new Error(payload?.error || (typeof detail === "string" ? detail : "请求失败，请重试"));
  }
  if (!payload) throw new Error("服务返回内容为空，请重试");
  return payload as T;
}

export type StudioUser = { id: number; name: string; role: string };
