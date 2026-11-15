import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
const tag = `Browser QA ${Date.now()}`;
const created = new Set<string>();
async function login(page: Page, role = "admin") {
  await page.goto("/dashboard");
  await page.getByLabel("Email address").fill(`${role}@pharmaflow.local`);
  await page.getByLabel("Password", { exact: true }).fill("PharmaFlow!2026");
  await page.getByRole("button", { name: "Sign in to workspace" }).click();
  await expect(page.getByRole("heading", { name: /Good / })).toBeVisible();
}
async function bootstrap(page: Page) {
  const result = await page.request.get("/api/bootstrap");
  expect(result.ok()).toBeTruthy();
  return result.json();
}
async function create(page: Page, resource: string, body: unknown) {
  const result = await page.request.post(`/api/resources/${resource}`, {
    data: body,
    headers: { Origin: "http://localhost:5173" },
  });
  expect(result.ok(), await result.text()).toBeTruthy();
  const record = await result.json();
  created.add(record.id);
  return record;
}
test.afterAll(async () => {
  const env = readFileSync("apps/api/.env", "utf8");
  const url =
    process.env.DATABASE_URL || env.match(/^DATABASE_URL=(.*)$/m)?.[1]?.trim();
  if (!url) return;
  const prisma = new PrismaClient({ datasourceUrl: url });
  try {
    const rows = await prisma.record.findMany();
    let previous = 0;
    do {
      previous = created.size;
      for (const row of rows) {
        const json = JSON.stringify(row.data);
        if (json.includes(tag) || [...created].some((id) => json.includes(id)))
          created.add(row.id);
      }
    } while (previous !== created.size);
    await prisma.record.deleteMany({ where: { id: { in: [...created] } } });
    for (const row of await prisma.idempotency.findMany())
      if ([...created].some((id) => JSON.stringify(row.result).includes(id)))
        await prisma.idempotency.delete({ where: { key: row.key } });
  } finally {
    await prisma.$disconnect();
  }
});
test("sign-in, persistence, full navigation and keyboard search", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  const routes = [
    ["/inventory/medicines", "Medicines"],
    ["/inventory/categories", "Categories"],
    ["/inventory/brands", "Brands & manufacturers"],
    ["/inventory/units", "Units of measure"],
    ["/inventory/batches", "Batches & lots"],
    ["/inventory/stock", "Stock levels"],
    ["/inventory/expiry", "Expiry watch"],
    ["/inventory/adjustments", "Stock adjustments"],
    ["/inventory/transfers", "Stock transfers"],
    ["/inventory/barcodes", "Barcode management"],
    ["/sales/all", "All sales"],
    ["/sales/invoices", "Invoices"],
    ["/sales/quotations", "Quotations"],
    ["/sales/returns", "Sales returns"],
    ["/purchases/orders", "Purchase orders"],
    ["/purchases/all", "Purchase orders"],
    ["/purchases/goods-received", "Goods received"],
    ["/purchases/suppliers", "Suppliers"],
    ["/purchases/returns", "Purchase returns"],
    ["/customers/all", "Customers"],
    ["/customers/groups", "Customer groups"],
    ["/customers/transactions", "Customer transactions"],
    ["/prescriptions/all", "Prescriptions"],
    ["/prescriptions/history", "Dispensing history"],
    ["/finance/transactions", "Financial transactions"],
    ["/finance/payments", "Payments"],
    ["/finance/expenses", "Expenses"],
    ["/finance/income", "Other income"],
    ["/finance/cash-register", "Cash register"],
    ["/staff/members", "Your pharmacy team"],
    ["/staff/roles", "Roles & permissions"],
    ["/staff/audit", "Audit trail"],
    ["/notifications", "Notifications"],
    ["/help", "How can we help?"],
    ["/reports/sales", "Sales report"],
    ["/reports/inventory", "Inventory report"],
    ["/reports/expiry", "Expiry report"],
    ["/reports/profit-loss", "Profit & loss"],
    ["/reports/customers", "Customer report"],
    ["/reports/tax", "Tax summary"],
  ];
  for (const [route, heading] of routes) {
    await page.goto(route);
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
  }
  for (const tab of [
    "general",
    "profile",
    "business",
    "tax",
    "payment",
    "invoice",
    "notifications",
    "security",
    "appearance",
  ]) {
    await page.goto(`/settings/${tab}`);
    await expect(
      page.getByRole("heading", { name: "Settings", exact: true }),
    ).toBeVisible();
  }
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("textbox", { name: "Search workspace", exact: true })
    .fill("Medicines");
  await page.getByRole("button", { name: "Medicines", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Medicines", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Medicines", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("customer create, edit, clear fields and delete persist through the API", async ({
  page,
}) => {
  await login(page);
  await page.goto("/customers/all");
  await page.getByRole("button", { name: "Add customer", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name", { exact: true }).fill(tag);
  await dialog.getByLabel("Email address").fill("qa@example.test");
  await dialog.getByLabel("Phone").fill("01234567890");
  await dialog
    .getByRole("button", { name: "Create customer", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  let record = (await bootstrap(page)).resources.customers.find(
    (c: any) => c.name === tag,
  );
  expect(record.phone).toBe("01234567890");
  created.add(record.id);
  await page.getByRole("textbox", { name: "Search customers…" }).fill(tag);
  await page.getByRole("button", { name: `Edit ${tag}`, exact: true }).click();
  await page.getByRole("dialog").getByLabel("Phone").fill("");
  await page.getByRole("dialog").getByLabel("Email address").fill("");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  record = (await bootstrap(page)).resources.customers.find(
    (c: any) => c.id === record.id,
  );
  expect(record.phone).toBe("");
  expect(record.email).toBe("");
  await page
    .getByRole("button", { name: `Delete ${tag}`, exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete record", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(
    (await bootstrap(page)).resources.customers.some(
      (c: any) => c.id === record.id,
    ),
  ).toBe(false);
});
test("medicine form, batch stock, POS payment, receipt and refresh", async ({
  page,
}) => {
  await login(page);
  await page.goto("/inventory/medicines?new=1");
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Medicine name").fill(tag + " OTC");
  await dialog.getByLabel("Generic name").fill("Demo only");
  await dialog.getByLabel("SKU", { exact: true }).fill("QA-" + Date.now());
  await dialog
    .getByLabel("Barcode", { exact: true })
    .fill("QA-BAR-" + Date.now());
  const boot = await bootstrap(page);
  await dialog
    .getByLabel("Category", { exact: true })
    .selectOption(boot.resources.categories[0].id);
  await dialog
    .getByLabel("Brand", { exact: true })
    .selectOption(boot.resources.brands[0].id);
  await dialog.getByLabel("Unit", { exact: true }).selectOption({ index: 1 });
  await dialog.getByLabel("Purchase price").fill("1.00");
  await dialog.getByLabel("Selling price").fill("2.50");
  await dialog
    .getByRole("button", { name: "Create medicine", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  const med = (await bootstrap(page)).resources.medicines.find(
    (m: any) => m.name === tag + " OTC",
  );
  expect(med).toBeTruthy();
  created.add(med.id);
  await create(page, "batches", {
    medicineId: med.id,
    batchNumber: tag,
    expiryDate: new Date(Date.now() + 120 * 86400000)
      .toISOString()
      .slice(0, 10),
    quantity: 10,
    purchasePrice: 100,
    sellingPrice: 250,
    location: "QA shelf",
    status: "active",
  });
  await page.goto("/sales/pos");
  await page
    .getByRole("textbox", { name: "Search medicines for sale" })
    .fill(tag);
  await page
    .getByRole("button")
    .filter({ hasText: tag + " OTC" })
    .click();
  await page.getByRole("button", { name: "Continue to payment" }).click();
  await page
    .getByRole("dialog")
    .getByLabel(/Amount received/)
    .fill("5.00");
  await page
    .getByRole("button", { name: "Complete sale", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your receipt is ready" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Print receipt" }),
  ).toBeVisible();
  const final = await bootstrap(page);
  expect(
    final.resources.medicines.find((m: any) => m.id === med.id).currentStock,
  ).toBe(9);
  const sale = final.resources.sales.find((s: any) =>
    s.items.some((i: any) => i.medicineId === med.id),
  );
  expect(sale.total).toBe(250);
  expect(sale.amountPaid).toBe(250);
  created.add(sale.id);
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Point of sale" }),
  ).toBeVisible();
});
test("purchase creation and receiving update stock once", async ({ page }) => {
  await login(page);
  const boot = await bootstrap(page);
  const med = await create(page, "medicines", {
    name: tag + " Purchase",
    sku: "QA-P-" + Date.now(),
    categoryId: boot.resources.categories[0].id,
    brandId: boot.resources.brands[0].id,
    dosageForm: "Tablet",
    unit: "tablet",
    purchasePrice: 100,
    sellingPrice: 200,
    reorderLevel: 5,
  });
  await page.goto("/purchases/orders?new=1");
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Order reference").fill(tag + " PO");
  await dialog
    .getByLabel("Supplier", { exact: true })
    .selectOption(boot.resources.suppliers[0].id);
  await dialog.getByLabel("Choose medicine").selectOption(med.id);
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  await dialog
    .getByRole("spinbutton", { name: "Quantity for line 1" })
    .fill("3");
  await dialog.getByLabel("Batch number").fill(tag + " PO Batch");
  await dialog
    .getByLabel("Expiry date")
    .fill(new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10));
  await dialog
    .getByRole("button", { name: "Create purchase order", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await page
    .getByRole("textbox", { name: "Search purchase orders…" })
    .fill(tag + " PO");
  await page.getByRole("button", { name: "Receive", exact: true }).click();
  await page.getByRole("button", { name: "Confirm receive purchase" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const after = await bootstrap(page);
  expect(
    after.resources.medicines.find((m: any) => m.id === med.id).currentStock,
  ).toBe(3);
  const purchase = after.resources.purchases.find(
    (p: any) => p.reference === tag + " PO",
  );
  expect(purchase.status).toBe("received");
  created.add(purchase.id);
});
test("cashier sees own register but cannot access team or modify inventory", async ({
  page,
}) => {
  await login(page, "cashier");
  await page.getByRole("link", { name: "Finance", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Cash register", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Manage shift" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Team & access", exact: true }),
  ).toHaveCount(0);
  await page.goto("/inventory/medicines");
  await expect(
    page.getByRole("button", { name: "Add medicine", exact: true }),
  ).toHaveCount(0);
  await page.goto("/staff/members");
  await expect(
    page.getByRole("heading", { name: "This area is restricted" }),
  ).toBeVisible();
  await page.goto("/customers/all");
  await expect(page.getByRole("button", { name: /Delete / })).toHaveCount(0);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(
    page.getByRole("heading", { name: "Your day starts here." }),
  ).toBeVisible();
});
test("responsive layouts, accessible dialogs and automated WCAG checks", async ({
  page,
}) => {
  await login(page);
  for (const width of [1440, 768, 375]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: /Good / })).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `docs/screenshots/dashboard-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
  }
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  await page.getByRole("link", { name: "Inventory", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Medicines", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const route of [
    "/dashboard",
    "/inventory/medicines",
    "/sales/pos",
    "/settings/general",
  ]) {
    await page.goto(route);
    await page.locator("h1").waitFor();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      results.violations,
      JSON.stringify(
        results.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => ({
            target: n.target,
            message: n.failureSummary,
          })),
        })),
        null,
        2,
      ),
    ).toEqual([]);
  }
  await page.goto("/customers/all?new=1");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Name", { exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
});
