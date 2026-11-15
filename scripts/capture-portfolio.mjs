import { chromium } from "@playwright/test";
import { mkdir, copyFile, writeFile } from "node:fs/promises";
const directory = "apps/web/public/showcase";
await mkdir(directory, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  recordVideo: {
    dir: ".local/recordings",
    size: { width: 1440, height: 1000 },
  },
});
const page = await context.newPage();
const caption = async (text, hold = 5500) => {
  await page.evaluate((text) => {
    document.querySelector("#tour-caption")?.remove();
    const el = document.createElement("div");
    el.id = "tour-caption";
    el.textContent = text;
    el.style.cssText =
      "position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#102e35;color:white;padding:16px 25px;border-radius:12px;z-index:99999;font:600 18px system-ui;box-shadow:0 3px 20px #0003;max-width:90vw;text-align:center";
    document.body.append(el);
  }, text);
  await page.waitForTimeout(hold);
};
await page.goto("http://localhost:5173");
await page.getByRole("button", { name: "Enter demo workspace" }).click();
await page.getByRole("heading", { name: /Good / }).waitFor();
await page.waitForTimeout(2500);
await page.screenshot({ path: directory + "/dashboard.png", fullPage: true });
await caption(
  "PharmaFlow · Inventory, purchasing and checkout in one workspace",
);
await page.goto("http://localhost:5173/inventory/expiry");
await page
  .getByRole("heading", { name: "Expiry watch", exact: true })
  .waitFor();
await caption(
  "Batch expiry alerts help the team find stock that needs attention.",
);
await page.goto("http://localhost:5173/purchases/orders");
await page
  .getByRole("heading", { name: "Purchase orders", exact: true })
  .waitFor();
await caption(
  "Receive a supplier order and update its batches in one transaction.",
);
const receive = page
  .getByRole("button", { name: "Receive", exact: true })
  .first();
if (await receive.isVisible()) {
  await receive.click();
  await caption(
    "Receiving is explicit: every item is added once to its specified batch.",
    3500,
  );
  await page
    .getByRole("button", { name: "Confirm receive purchase", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await caption(
    "The order is now received. Stock and purchase status stay connected.",
    4000,
  );
}
await page.goto("http://localhost:5173/inventory/stock");
await page
  .getByRole("heading", { name: "Stock levels", exact: true })
  .waitFor();
await caption(
  "Stock levels reflect receiving, sales and recorded adjustments.",
);
await page.goto("http://localhost:5173/sales/pos");
await page
  .getByRole("heading", { name: "Point of sale", exact: true })
  .waitFor();
await page
  .locator(".product-card")
  .filter({ hasText: "Paracetamol" })
  .first()
  .click();
await page.waitForTimeout(1500);
await page.screenshot({ path: directory + "/pos.png", fullPage: true });
await caption("Search or scan a medicine, then build the customer’s sale.");
await page.getByRole("button", { name: "Continue to payment" }).click();
await caption(
  "Record the amount received. Stock eligibility is checked by the server.",
);
await page.getByRole("button", { name: "Complete sale", exact: true }).click();
await page
  .getByRole("heading", { name: "Sale completed", exact: true })
  .waitFor();
await caption(
  "A completed sale produces a receipt and updates stock atomically.",
  6500,
);
await page.keyboard.press("Escape");
await page.goto("http://localhost:5173/reports/sales");
await page
  .getByRole("heading", { name: "Sales report", exact: true })
  .waitFor();
await caption(
  "Reports make the recorded sales available for review and export.",
);
await page.goto("http://localhost:5173/dashboard");
await page.getByRole("heading", { name: /Good / }).waitFor();
await page.keyboard.press("Control+k");
await caption("Keyboard navigation keeps common pages within reach.", 4000);
await page.keyboard.press("Escape");
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: directory + "/mobile.png", fullPage: true });
await caption("Responsive layouts support smaller screens.", 4000);
await page.setViewportSize({ width: 1440, height: 1000 });
await caption(
  "React · Vite · TypeScript · NestJS · PostgreSQL — fictional demo data",
  5000,
);
const video = page.video();
await context.close();
await video.saveAs(directory + "/walkthrough.webm");
await browser.close();
await writeFile(
  directory + "/captions.vtt",
  "WEBVTT\n\n00:00.000 --> 00:15.000\nPharmaFlow: a pharmacy inventory and POS workspace. All records are fictional.\n\n00:15.000 --> 00:35.000\nReview expiry alerts, receive a supplier order, and inspect stock levels.\n\n00:35.000 --> 01:00.000\nBuild a sale, record payment, and view the completed receipt.\n\n01:00.000 --> 01:30.000\nReview reports, keyboard navigation and responsive layouts.\n",
);
console.log("Saved showcase screenshots and walkthrough recording");
