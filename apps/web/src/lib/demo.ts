import snapshot from "../demo/snapshot.json";
const sessionKey = "pharmaflow-portfolio-session";
const lifetime = 30 * 60 * 1000;
export async function demoApi(path: string, options: RequestInit = {}) {
  const method = options.method || "GET";
  if (path === "/auth/demo" && method === "POST") {
    sessionStorage.setItem(sessionKey, String(Date.now() + lifetime));
    return structuredClone(snapshot.user);
  }
  if (path === "/auth/logout") {
    sessionStorage.removeItem(sessionKey);
    return { ok: true };
  }
  if (Number(sessionStorage.getItem(sessionKey) || 0) <= Date.now()) {
    window.dispatchEvent(new Event("session-expired"));
    throw new Error(
      "Your demo session ended. Open a new demo session to continue.",
    );
  }
  if (method !== "GET")
    throw new Error(
      "This portfolio preview is read-only. See the walkthrough for checkout and receiving, or run the full app locally.",
    );
  if (path === "/auth/me") return structuredClone(snapshot.user);
  if (path === "/bootstrap") {
    const data = structuredClone(snapshot);
    // Keep the fictional timeline current without changing any persisted records.
    const shift =
      Math.floor(
        (Date.now() - new Date(snapshot.demoGeneratedAt).getTime()) / 86400000,
      ) * 86400000;
    const visit = (value: any): any => {
      if (Array.isArray(value)) return value.map(visit);
      if (value && typeof value === "object")
        return Object.fromEntries(
          Object.entries(value).map(([k, v]) => [k, visit(v)]),
        );
      if (
        typeof value === "string" &&
        /^\d{4}-\d{2}-\d{2}(T.*)?$/.test(value)
      ) {
        const shifted = new Date(
          new Date(value).getTime() + shift,
        ).toISOString();
        return value.length === 10 ? shifted.slice(0, 10) : shifted;
      }
      return value;
    };
    return visit(data);
  }
  throw new Error("This action is available in the full local application.");
}
