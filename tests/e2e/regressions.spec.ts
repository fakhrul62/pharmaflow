import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";

const tag = `Final regression ${Date.now()}`;
const created = new Set<string>();
let authCookies: Awaited<
  ReturnType<import("@playwright/test").BrowserContext["cookies"]>
> = [];
test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await page.goto("/dashboard");
  await page.getByLabel("Email address").fill("admin@pharmaflow.local");
  await page.getByLabel("Password", { exact: true }).fill("PharmaFlow!2026");
  await page.getByRole("button", { name: "Sign in to workspace" }).click();
  await expect(page.getByRole("heading", { name: /Good / })).toBeVisible();
  authCookies = await page.context().cookies();
  await page.close();
});
async function login(page: Page) {
  await page.context().addCookies(authCookies);
  const result = await page.request.get("/api/bootstrap");
  expect(result.ok(), await result.text()).toBeTruthy();
  return result.json();
}
async function post(page: Page, path: string, body: unknown) {
  const result = await page.request.post(`/api/${path}`, {
    data: body,
    headers: { Origin: "http://localhost:5173" },
  });
  expect(result.ok(), await result.text()).toBeTruthy();
  const record = await result.json();
  if (record.id) created.add(record.id);
  return record;
}
async function mockSnapshot(page: Page, snapshot: any) {
  await page.route("**/api/bootstrap", (route) =>
    route.fulfill({ json: snapshot }),
  );
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

test("FR1: receiving-created batch preserves absent optional date and permits metadata edit", async ({
  page,
}) => {
  const snapshot = await login(page);
  const medicine = snapshot.resources.medicines.find(
    (m: any) => m.status === "active",
  );
  const supplier = snapshot.resources.suppliers[0];
  const purchase = await post(page, "resources/purchases", {
    supplierId: supplier.id,
    expectedDate: "2027-01-01",
    notes: tag,
    items: [
      {
        medicineId: medicine.id,
        quantity: 2,
        unitPrice: medicine.purchasePrice,
        batchNumber: tag,
        expiryDate: "2028-12-31",
        location: tag,
      },
    ],
  });
  await post(page, "operations/receive", {
    purchaseId: purchase.id,
    idempotencyKey: crypto.randomUUID(),
  });
  const fresh = await (await page.request.get("/api/bootstrap")).json();
  const batch = fresh.resources.batches.find((b: any) => b.batchNumber === tag);
  expect(batch.manufacturingDate).toBeUndefined();
  created.add(batch.id);
  await page.goto(`/inventory/batches?q=${encodeURIComponent(tag)}`);
  await page.getByRole("button", { name: "Edit record", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Manufacturing date")).toHaveValue("");
  await expect(dialog.getByLabel("Manufacturing date")).toBeDisabled();
  await expect(dialog.getByLabel("Expiry date")).toBeDisabled();
  await dialog
    .getByLabel("Status", { exact: true })
    .selectOption("quarantined");
  const request = page.waitForRequest(
    (r) => r.method() === "PATCH" && r.url().endsWith(`/batches/${batch.id}`),
  );
  await dialog.getByRole("button", { name: /Save/ }).click();
  const body = (await request).postDataJSON();
  for (const key of [
    "manufacturingDate",
    "expiryDate",
    "medicineId",
    "batchNumber",
    "location",
    "quantity",
  ])
    expect(body).not.toHaveProperty(key);
  await expect(dialog).not.toBeVisible();
  const saved = await (await page.request.get("/api/bootstrap")).json();
  const edited = saved.resources.batches.find((b: any) => b.id === batch.id);
  expect(edited.status).toBe("quarantined");
  expect(edited.manufacturingDate).toBeUndefined();
});

test("FR2: held RX draft survives a second customer checkout with payment and discount context", async ({
  page,
}) => {
  const snapshot = await login(page);
  const m = {
    ...snapshot.resources.medicines.find((m: any) => m.status === "active"),
    id: "draft-med",
    name: "Held RX medicine",
    sellingPrice: 10000,
    requiresPrescription: true,
    isControlled: false,
  };
  snapshot.resources.medicines = [
    m,
    {
      ...m,
      id: "otc-med",
      name: "Second OTC medicine",
      requiresPrescription: false,
    },
  ];
  snapshot.resources.batches = snapshot.resources.medicines.map((med: any) => ({
    id: `batch-${med.id}`,
    medicineId: med.id,
    quantity: 20,
    status: "active",
    expiryDate: "2030-01-01",
  }));
  snapshot.resources.customers = [
    { id: "customer-a", name: "Customer Alpha", status: "active" },
    { id: "customer-b", name: "Customer Beta", status: "active" },
  ];
  snapshot.resources.prescriptions = [
    {
      id: "rx-a",
      reference: "Held RX Alpha",
      customerId: "customer-a",
      status: "verified",
      expiryDate: "2030-01-01",
      items: [{ medicineId: m.id, quantity: 2 }],
    },
  ];
  snapshot.settings.taxRate = 0;
  await mockSnapshot(page, snapshot);
  const requests: any[] = [];
  await page.route("**/api/operations/checkout", async (route) => {
    const body = route.request().postDataJSON();
    requests.push(body);
    await route.fulfill({
      json: {
        id: `sale-${requests.length}`,
        ...body,
        total: 9000,
        subtotal: 10000,
        tax: 0,
        status: "completed",
        createdAt: new Date().toISOString(),
        items: [],
      },
    });
  });
  await page.goto("/sales/pos");
  await page.getByRole("button", { name: /Held RX medicine/ }).click();
  await page.getByLabel("Select verified prescription").selectOption("rx-a");
  await page.getByLabel("Discount amount").fill("10");
  await page.getByRole("button", { name: "Continue to payment" }).click();
  await page.getByRole("button", { name: "Card", exact: true }).click();
  await page.getByLabel(/Amount received/).fill("120");
  await page.getByRole("button", { name: "Back to cart" }).click();
  await page.getByRole("button", { name: "Hold sale" }).click();
  await expect(page.locator(".cart-customer select")).toHaveValue("");
  await expect(page.getByLabel("Discount amount")).toHaveValue("0");
  await expect(page.getByLabel("Select verified prescription")).toHaveCount(0);
  await page.getByRole("button", { name: /Second OTC medicine/ }).click();
  await page.locator(".cart-customer select").selectOption("customer-b");
  await page.getByLabel("Discount amount").fill("5");
  await page.getByRole("button", { name: "Continue to payment" }).click();
  await expect(
    page.getByRole("button", { name: "Cash", exact: true }),
  ).toHaveClass("selected");
  await expect(page.getByLabel(/Amount received/)).toHaveValue("95.00");
  await page
    .getByRole("button", { name: "Complete sale", exact: true })
    .click();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(page.locator(".cart-customer select")).toHaveValue("");
  await expect(page.getByLabel("Discount amount")).toHaveValue("0");
  await page.getByRole("button", { name: "Resume (1)" }).click();
  await expect(page.locator(".cart-customer select")).toHaveValue("customer-a");
  await expect(page.getByLabel("Select verified prescription")).toHaveValue(
    "rx-a",
  );
  await expect(page.getByLabel("Discount amount")).toHaveValue("10");
  await expect(
    page.getByRole("button", { name: "Increase Held RX medicine" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue to payment" }).click();
  await expect(
    page.getByRole("button", { name: "Card", exact: true }),
  ).toHaveClass("selected");
  await expect(page.getByLabel(/Amount received/)).toHaveValue("120");
  await page
    .getByRole("button", { name: "Complete sale", exact: true })
    .click();
  await expect.poll(() => requests.length).toBe(2);
  expect(requests[0]).toMatchObject({
    customerId: "customer-b",
    discount: 500,
    paymentMethod: "cash",
  });
  expect(requests[0].prescriptionId).toBeUndefined();
  expect(requests[1]).toMatchObject({
    customerId: "customer-a",
    prescriptionId: "rx-a",
    discount: 1000,
    paymentMethod: "card",
    items: [{ medicineId: "draft-med", quantity: 1 }],
  });
  expect(requests[0].idempotencyKey).not.toBe(requests[1].idempotencyKey);
});

test("FR3: discounted taxed sale excludes tax from both profit displays and keeps gross sales", async ({
  page,
}) => {
  const snapshot = await login(page);
  snapshot.resources.sales = [
    {
      id: "tax-sale",
      invoiceNumber: "Tax test",
      createdAt: new Date().toISOString(),
      status: "completed",
      subtotal: 10000,
      discount: 1000,
      tax: 900,
      total: 9900,
      items: [{ quantity: 1, costPrice: 6000 }],
    },
  ];
  snapshot.resources.income = [];
  snapshot.resources.expenses = [];
  await mockSnapshot(page, snapshot);
  await page.goto("/reports/profit-loss");
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: "Sales revenue (after discount, excluding tax)" }),
  ).toContainText("$90.00");
  await expect(
    page.getByRole("row").filter({ hasText: "Gross profit" }),
  ).toContainText("$30.00");
  await expect(
    page.getByRole("row").filter({ hasText: "Net profit" }),
  ).toContainText("$30.00");
  await expect(
    page.locator(".summary-card").filter({ hasText: "Net profit" }),
  ).toContainText("$30.00");
  await page
    .locator(".report-tabs")
    .getByRole("link", { name: "Sales", exact: true })
    .click();
  await expect(
    page
      .locator(".summary-card")
      .filter({ hasText: "Gross sales (including tax)" }),
  ).toContainText("$99.00");
  await page
    .locator(".report-tabs")
    .getByRole("link", { name: "Tax", exact: true })
    .click();
  await expect(
    page.locator(".summary-card").filter({ hasText: "Tax collected" }),
  ).toContainText("$9.00");
});

for (const refund of [10000, 4000]) {
  test(`FR4: reopened returned receipt shows ${refund === 10000 ? "full" : "partial credit"} refund and cancelled balance`, async ({
    page,
  }) => {
    const snapshot = await login(page);
    snapshot.resources.sales = [
      {
        id: "return-sale",
        invoiceNumber: "RETURN-TEST",
        customerName: "Return customer",
        createdAt: new Date().toISOString(),
        status: "returned",
        paymentStatus: "refunded",
        subtotal: 10000,
        discount: 0,
        tax: 0,
        total: 10000,
        amountPaid: 0,
        refundedAmount: refund,
        paymentMethod: "cash",
        items: [],
      },
    ];
    await mockSnapshot(page, snapshot);
    await page.goto("/sales/invoices");
    await page
      .getByRole("button", { name: "View record", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "Sale returned" }),
    ).toBeVisible();
    await expect(dialog.locator(".receipt-meta")).toContainText(
      "RETURNED · Balance due: $0.00",
    );
    await expect(
      dialog.locator(".receipt-totals p").filter({ hasText: "Refunded" }),
    ).toContainText(refund === 10000 ? "$100.00" : "$40.00");
    await expect(
      dialog
        .locator(".receipt-totals p")
        .filter({ hasText: "Cancelled balance" }),
    ).toContainText(refund === 10000 ? "$0.00" : "$60.00");
    await expect(dialog.locator(".receipt-totals")).not.toContainText(
      "Balance due",
    );
    await page.emulateMedia({ media: "print" });
    await expect(dialog.locator(".receipt-meta")).toContainText(
      "Balance due: $0.00",
    );
  });
}
