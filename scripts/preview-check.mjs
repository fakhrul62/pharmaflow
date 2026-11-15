import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
await mkdir("docs/screenshots", { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 1080 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://localhost:5173");
await page.getByRole("button", { name: "Enter demo workspace" }).click();
await page
  .getByRole("heading", { name: /Good (morning|afternoon|evening)/ })
  .waitFor();
await page.waitForTimeout(2000);
await page.screenshot({
  path: "docs/screenshots/dashboard-desktop.png",
  fullPage: true,
});
const accessibility = await new AxeBuilder({ page })
  .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
  .analyze();
await writeFile(
  ".local/accessibility-initial.json",
  JSON.stringify(accessibility.violations, null, 2),
);
console.log(
  JSON.stringify(
    {
      errors,
      violations: accessibility.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        count: v.nodes.length,
        examples: v.nodes
          .slice(0, 4)
          .map((n) => ({ html: n.html, summary: n.failureSummary })),
      })),
    },
    null,
    2,
  ),
);
await page.setViewportSize({ width: 375, height: 850 });
await page.screenshot({
  path: "docs/screenshots/dashboard-mobile.png",
  fullPage: true,
});
console.log(
  "mobile width",
  await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  })),
);
await page.goto("http://localhost:5173/sales/pos");
await page.getByRole("heading", { name: "Point of sale" }).waitFor();
await page.setViewportSize({ width: 1440, height: 1000 });
await page.screenshot({
  path: "docs/screenshots/pos-desktop.png",
  fullPage: true,
});
await browser.close();
