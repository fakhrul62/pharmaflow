import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
const base = process.env.PORTFOLIO_URL || "http://localhost:4173";
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const errors = [];
const apiRequests = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => {
  if (new URL(r.url()).pathname.startsWith("/api")) apiRequests.push(r.url());
});
await page.goto(base + "/inventory/medicines");
await page.getByRole("button", { name: "Enter demo workspace" }).click();
await page.getByRole("heading", { name: "Medicines", exact: true }).waitFor();
assert.equal(await page.locator(".demo-banner").count(), 1);
await page.goto(base + "/customers/all");
await page.getByRole("heading", { name: "Customers", exact: true }).waitFor();
await page.getByRole("button", { name: "Add customer", exact: true }).click();
await page.getByLabel("Name", { exact: true }).fill("Visitor must not persist");
await page
  .getByRole("button", { name: "Create customer", exact: true })
  .click();
await page.getByRole("alert").filter({ hasText: "read-only" }).waitFor();
await page.keyboard.press("Escape");
await page.goto(base + "/dashboard");
await page.getByRole("heading", { name: /Good / }).waitFor();
await page.getByRole("button", { name: "Switch to dark theme" }).click();
for (const path of [
  "/dashboard",
  "/inventory/medicines",
  "/sales/pos",
  "/settings/general",
]) {
  await page.goto(base + path);
  await page.locator("h1").waitFor();
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  assert.deepEqual(
    result.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
    [],
    path,
  );
}
await page.evaluate(() =>
  sessionStorage.setItem("pharmaflow-portfolio-session", "1"),
);
await page.reload();
await page.getByRole("button", { name: "Enter demo workspace" }).waitFor();
await page.getByRole("button", { name: "Enter demo workspace" }).click();
await page.getByRole("heading", { name: "Settings", exact: true }).waitFor();
assert.deepEqual(errors, []);
assert.deepEqual(apiRequests, []);
const caseStudy = await page.goto(base + "/case-study/");
assert.equal(caseStudy.status(), 200);
await page
  .getByRole("heading", { name: "A clearer day at the pharmacy." })
  .waitFor();
for (const asset of [
  "/showcase/walkthrough.mp4",
  "/showcase/captions.vtt",
  "/social-preview.png",
])
  assert.equal((await page.request.get(base + asset)).status(), 200, asset);
await browser.close();
console.log(
  "Portfolio preview passed: direct routes, visitor entry, rejected writes, expiry/re-entry, four dark axe scans, zero API requests/errors, case study and media",
);
