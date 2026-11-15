import { writeFile, mkdir } from "node:fs/promises";
const origin = "http://localhost:5173";
const login = await fetch(origin + "/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: origin },
  body: JSON.stringify({
    email: "admin@pharmaflow.local",
    password: "PharmaFlow!2026",
  }),
});
if (!login.ok) throw new Error("Local fictional demo login failed");
const cookie = login.headers.get("set-cookie").split(";")[0];
const response = await fetch(origin + "/api/bootstrap", {
  headers: { Cookie: cookie },
});
if (!response.ok) throw new Error("Snapshot export failed");
const snapshot = await response.json();
snapshot.user = {
  id: "portfolio-visitor",
  name: "Portfolio Visitor",
  email: "visitor@pharmaflow.example",
  role: "admin",
  demo: true,
};
snapshot.resources.staff = [];
snapshot.resources.audit = [];
// Curated fictional records only. No sessions, password hashes or environment values.
for (const records of Object.values(snapshot.resources))
  for (const record of records) {
    delete record.passwordHash;
    delete record.password;
    delete record.image;
  }
const sales = snapshot.resources.sales || [];
const anchor = new Date();
anchor.setHours(12, 0, 0, 0);
sales.forEach((sale, i) => {
  const day = new Date(anchor);
  day.setDate(day.getDate() - (i % 7));
  sale.createdAt = day.toISOString();
});
snapshot.demoGeneratedAt = anchor.toISOString();
await mkdir("apps/web/src/demo", { recursive: true });
await writeFile(
  "apps/web/src/demo/snapshot.json",
  JSON.stringify(snapshot, null, 2) + "\n",
);
await fetch(origin + "/api/auth/logout", {
  method: "POST",
  headers: {
    Cookie: cookie,
    Origin: origin,
    "Content-Type": "application/json",
  },
  body: "{}",
});
console.log("Prepared fictional read-only portfolio snapshot");
