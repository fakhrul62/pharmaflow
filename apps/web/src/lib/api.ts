import type { Entity, User } from "@pharmaflow/shared";
export type { Entity, User } from "@pharmaflow/shared";
let businessTimezone = "Asia/Dhaka";
export function setBusinessTimezone(timezone: string) {
  businessTimezone = timezone;
}
export const dayKey = (value: unknown) =>
  new Date(String(value)).toLocaleDateString("en-CA", {
    timeZone: businessTimezone,
  });
export type Snapshot = {
  user: User;
  resources: Record<string, Entity[]>;
  settings: Record<string, any>;
};
export async function api<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  if (import.meta.env.VITE_PORTFOLIO_DEMO === "true") {
    const { demoApi } = await import("./demo");
    return (await demoApi(path, options)) as T;
  }
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const data = await response.json().catch(() => {
    throw new Error("The server returned an unreadable response.");
  });
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith("/auth"))
      window.dispatchEvent(new Event("session-expired"));
    throw new Error(
      Array.isArray(data.message)
        ? data.message.join(". ")
        : data.message || `Request failed (${response.status})`,
    );
  }
  return data;
}
export const post = <T = any>(path: string, body: unknown) =>
  api<T>(path, { method: "POST", body: JSON.stringify(body) });
export const patch = <T = any>(path: string, body: unknown) =>
  api<T>(path, { method: "PATCH", body: JSON.stringify(body) });
export const money = (value: unknown, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    Number(value || 0) / 100,
  );
export const date = (value: unknown) =>
  value
    ? new Date(String(value)).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: /^\d{4}-\d{2}-\d{2}$/.test(String(value))
          ? "UTC"
          : businessTimezone,
      })
    : "—";
export const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: businessTimezone });
export const daysUntil = (value: unknown) =>
  Math.ceil(
    (new Date(String(value)).getTime() - new Date(today()).getTime()) /
      86400000,
  );
export const sum = (items: Entity[], field: string) =>
  items.reduce((a, b) => a + Number(b[field] || 0), 0);
