import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { writeFile } from "node:fs/promises";
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1440, height: 1000 } });
const p = await c.newPage();
await p.goto("http://localhost:5173");
await p.getByRole("button", { name: "Enter demo workspace" }).click();
await p.getByRole("heading", { name: /Good / }).waitFor();
await p.getByRole("button", { name: "Switch to dark theme" }).click();
const results = [];
for (const path of [
  "/dashboard",
  "/inventory/medicines",
  "/sales/pos",
  "/settings/general",
]) {
  await p.goto("http://localhost:5173" + path);
  await p.locator("h1").waitFor();
  const a = await new AxeBuilder({ page: p })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  results.push({ path, violations: a.violations });
}
await writeFile(
  ".local/dark-accessibility.json",
  JSON.stringify(results, null, 2),
);
console.log(
  JSON.stringify(
    results.map((r) => ({
      path: r.path,
      violations: r.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          html: n.html,
          data: n.any[0]?.data,
        })),
      })),
    })),
    null,
    2,
  ),
);
await p.screenshot({
  path: "docs/screenshots/settings-dark.png",
  fullPage: true,
});
await b.close();
