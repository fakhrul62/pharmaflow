import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { writeFile } from "node:fs/promises";
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1440, height: 1000 } });
const p = await c.newPage();
const report = [];
await p.goto("http://localhost:5173");
await p.getByRole("button", { name: "Enter demo workspace" }).click();
await p.getByRole("heading", { name: /Good / }).waitFor();
for (const path of [
  "/dashboard",
  "/inventory/medicines",
  "/sales/pos",
  "/settings/general",
  "/reports/sales",
  "/help",
]) {
  await p.goto("http://localhost:5173" + path);
  await p.locator("h1").waitFor();
  const a = await new AxeBuilder({ page: p })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  report.push({ path, violations: a.violations });
}
await writeFile(
  ".local/accessibility-all.json",
  JSON.stringify(report, null, 2),
);
console.log(
  JSON.stringify(
    report.map((r) => ({
      path: r.path,
      violations: r.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          data: n.any[0]?.data,
          html: n.html,
        })),
      })),
    })),
    null,
    2,
  ),
);
await b.close();
