import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApp } from "../src/main";
import { createAdministrator } from "../scripts/create-admin";
import { prisma, today } from "../src/pharmacy.service";
const day = (days: number) =>
  new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
test("HTTP security, permissions, atomic stock, prescription, purchasing and refund integration", async () => {
  const app = await createApp();
  await app.listen(0, "127.0.0.1");
  const base = await app.getUrl();
  const ids = new Set<string>();
  const tag = `Integration-${randomUUID()}`;
  let checks = 0;
  let timezoneToRestore: string | undefined;
  const call = async (
    path: string,
    method = "GET",
    body?: any,
    cookie?: string,
    origin = "http://localhost:5173",
  ) => {
    const res = await fetch(`${base}/api${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        origin,
        ...(cookie ? { cookie } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = (await res.json()) as any;
    return {
      status: res.status,
      data,
      cookie: res.headers.get("set-cookie")?.split(";")[0],
    };
  };
  const check = (actual: any, expected: any) => {
    assert.equal(actual, expected);
    checks++;
  };
  try {
    check((await call("/bootstrap")).status, 401);
    check(
      (
        await call("/auth/login", "POST", {
          email: "admin@pharmaflow.local",
          password: "incorrect",
        })
      ).status,
      401,
    );
    check(
      (
        await call(
          "/auth/login",
          "POST",
          { email: "admin@pharmaflow.local", password: "PharmaFlow!2026" },
          undefined,
          "https://evil.example",
        )
      ).status,
      403,
    );
    const login = await call("/auth/login", "POST", {
      email: "admin@pharmaflow.local",
      password: "PharmaFlow!2026",
    });
    check(login.status, 201);
    const admin = login.cookie!;
    const c = await call("/auth/login", "POST", {
      email: "cashier@pharmaflow.local",
      password: "PharmaFlow!2026",
    });
    const cashier = c.cookie!;
    check(
      (await call("/resources/staff", "GET", undefined, cashier)).status,
      403,
    );
    check(
      (
        await call(
          "/operations/adjust",
          "POST",
          { medicineId: "x", batchId: "x", quantityChange: 1, reason: "bad" },
          cashier,
        )
      ).status,
      403,
    );
    const boot = await call("/bootstrap", "GET", undefined, admin);
    check(boot.status, 200);
    const cat = boot.data.resources.categories[0].id;
    const brand = boot.data.resources.brands[0].id;
    const supplier = boot.data.resources.suppliers[0].id;
    const customer = boot.data.resources.customers[0].id;
    const create = async (r: string, b: any) => {
      const res = await call(`/resources/${r}`, "POST", b, admin);
      assert.equal(res.status, 201, JSON.stringify(res.data));
      ids.add(res.data.id);
      return res.data;
    };
    const medicine = await create("medicines", {
      name: tag,
      genericName: "Test fixture",
      sku: tag,
      barcode: tag,
      categoryId: cat,
      brandId: brand,
      dosageForm: "Tablet",
      unit: "Tablet",
      purchasePrice: 50,
      sellingPrice: 100,
      reorderLevel: 1,
      requiresPrescription: false,
      isControlled: false,
      status: "active",
    });
    check(
      (
        await call(
          "/resources/batches",
          "POST",
          {
            medicineId: medicine.id,
            batchNumber: "BAD",
            expiryDate: day(100),
            quantity: -5,
            purchasePrice: 50,
            sellingPrice: 100,
            location: "Test",
            status: "active",
          },
          admin,
        )
      ).status,
      400,
    );
    check(
      (await call("/resources/medicines", "POST", { name: tag }, admin)).status,
      400,
    );
    check(
      (
        await call(
          "/resources/customers",
          "POST",
          { name: tag, groupId: "missing" },
          admin,
        )
      ).status,
      400,
    );
    const batch = await create("batches", {
      medicineId: medicine.id,
      batchNumber: tag,
      expiryDate: day(100),
      quantity: 5,
      purchasePrice: 50,
      sellingPrice: 100,
      location: "Test",
      status: "active",
    });
    const checkout = (n: number, key = randomUUID()) =>
      call(
        "/operations/checkout",
        "POST",
        {
          items: [{ medicineId: medicine.id, quantity: n }],
          discount: 0,
          paymentMethod: "cash",
          amountPaid: n * 100,
          idempotencyKey: key,
        },
        admin,
      );
    check((await checkout(-1)).status, 400);
    const concurrent = await Promise.all([checkout(3), checkout(3)]);
    check(concurrent.filter((r) => r.status === 201).length, 1);
    check(concurrent.filter((r) => r.status === 400).length, 1);
    const sale = concurrent.find((r) => r.status === 201)!.data;
    check(sale.items[0].costPrice, 50);
    ids.add(sale.id);
    const rows = await call("/resources/batches", "GET", undefined, admin);
    check(rows.data.items.find((r: any) => r.id === batch.id).quantity, 2);
    const returnBody = {
      saleId: sale.id,
      reason: tag,
      restock: true,
      idempotencyKey: randomUUID(),
    };
    const returned = await call(
      "/operations/sales-return",
      "POST",
      returnBody,
      admin,
    );
    check(returned.status, 201);
    ids.add(returned.data.id);
    check(returned.data.refundAmount, 300);
    check(
      (await call("/operations/sales-return", "POST", returnBody, admin)).data
        .id,
      returned.data.id,
    );
    check(
      (
        await call(
          "/operations/sales-return",
          "POST",
          { ...returnBody, idempotencyKey: randomUUID() },
          admin,
        )
      ).status,
      400,
    );
    const purchase = await create("purchases", {
      supplierId: supplier,
      items: [
        {
          medicineId: medicine.id,
          quantity: 7,
          unitPrice: 50,
          batchNumber: tag + "-PO",
          expiryDate: day(200),
          location: "Test",
        },
      ],
      paymentStatus: "unpaid",
      expectedDate: day(3),
    });
    const receive = await call(
      "/operations/receive",
      "POST",
      { purchaseId: purchase.id, idempotencyKey: randomUUID() },
      admin,
    );
    check(receive.status, 201);
    ids.add(receive.data.items[0].batchId);
    check(
      (
        await call(
          "/operations/receive",
          "POST",
          { purchaseId: purchase.id, idempotencyKey: randomUUID() },
          admin,
        )
      ).status,
      400,
    );
    const transfer = await call(
      "/operations/transfer",
      "POST",
      {
        batchId: receive.data.items[0].batchId,
        quantity: 7,
        destination: tag,
        reason: tag,
      },
      admin,
    );
    check(transfer.status, 201);
    ids.add(transfer.data.id);
    ids.add(transfer.data.destinationBatchId);
    const pr = await call(
      "/operations/purchase-return",
      "POST",
      { purchaseId: purchase.id, reason: tag, idempotencyKey: randomUUID() },
      admin,
    );
    check(pr.status, 201);
    ids.add(pr.data.id);
    check(
      (
        await call(
          "/operations/purchase-return",
          "POST",
          {
            purchaseId: purchase.id,
            reason: tag,
            idempotencyKey: randomUUID(),
          },
          admin,
        )
      ).status,
      400,
    );
    check(
      (
        await call(
          `/resources/batches/${batch.id}`,
          "PATCH",
          { quantity: 100 },
          admin,
        )
      ).status,
      400,
    );
    check(
      (
        await call(
          `/resources/batches/${batch.id}`,
          "PATCH",
          { expiryDate: day(400) },
          admin,
        )
      ).status,
      400,
    );
    check(
      (
        await call(
          "/operations/adjust",
          "POST",
          {
            medicineId: medicine.id,
            batchId: batch.id,
            quantityChange: -100,
            reason: tag,
          },
          admin,
        )
      ).status,
      400,
    );
    check(
      (
        await call(
          `/resources/medicines/${medicine.id}`,
          "DELETE",
          undefined,
          admin,
        )
      ).status,
      400,
    );
    const exhaustionKey = randomUUID();
    const exhausted = await checkout(5, exhaustionKey);
    check(exhausted.status, 201);
    ids.add(exhausted.data.id);
    check((await checkout(5, exhaustionKey)).data.id, exhausted.data.id);
    check((await checkout(1, exhaustionKey)).status, 400);
    await create("batches", {
      medicineId: medicine.id,
      batchNumber: tag + "-expired",
      expiryDate: day(-1),
      quantity: 100,
      purchasePrice: 50,
      sellingPrice: 100,
      location: "Test",
      status: "active",
    });
    await create("batches", {
      medicineId: medicine.id,
      batchNumber: tag + "-hold",
      expiryDate: day(100),
      quantity: 100,
      purchasePrice: 50,
      sellingPrice: 100,
      location: "Hold",
      status: "quarantined",
    });
    check((await checkout(1)).status, 400);
    const rxMed = await create("medicines", {
      name: tag + " RX",
      sku: tag + "RX",
      categoryId: cat,
      brandId: brand,
      dosageForm: "Tablet",
      unit: "Tablet",
      purchasePrice: 50,
      sellingPrice: 100,
      reorderLevel: 1,
      requiresPrescription: true,
      isControlled: true,
      status: "active",
    });
    const rxBatch = await create("batches", {
      medicineId: rxMed.id,
      batchNumber: tag + "-RX",
      expiryDate: day(100),
      quantity: 20,
      purchasePrice: 50,
      sellingPrice: 100,
      location: "Test",
      status: "active",
    });
    const rx = await create("prescriptions", {
      customerId: customer,
      prescriberName: "Test physician",
      prescriberLicense: "TEST",
      date: day(0),
      expiryDate: day(10),
      items: [{ medicineId: rxMed.id, quantity: 2, dosage: "Test" }],
      status: "pending",
    });
    const rxCheckout = {
      items: [{ medicineId: rxMed.id, quantity: 2 }],
      customerId: customer,
      discount: 0,
      paymentMethod: "card",
      amountPaid: 100,
      prescriptionId: rx.id,
      idempotencyKey: randomUUID(),
    };
    check(
      (await call("/operations/checkout", "POST", rxCheckout, admin)).status,
      400,
    );
    check(
      (
        await call(
          "/operations/verify-prescription",
          "POST",
          { prescriptionId: rx.id },
          cashier,
        )
      ).status,
      403,
    );
    check(
      (
        await call(
          "/operations/verify-prescription",
          "POST",
          { prescriptionId: rx.id },
          admin,
        )
      ).status,
      201,
    );
    check(
      (await call("/operations/checkout", "POST", rxCheckout, cashier)).status,
      403,
    );
    const rxSale = await call(
      "/operations/checkout",
      "POST",
      rxCheckout,
      admin,
    );
    check(rxSale.status, 201);
    ids.add(rxSale.data.id);
    check(rxSale.data.paymentStatus, "partial");
    check(
      (
        await call(
          "/operations/checkout",
          "POST",
          { ...rxCheckout, idempotencyKey: randomUUID() },
          admin,
        )
      ).status,
      400,
    );
    const settle = await create("payments", {
      type: "incoming",
      amount: 100,
      paymentMethod: "card",
      relatedId: rxSale.data.id,
      date: day(0),
      notes: tag,
    });
    check(settle.amount, 100);
    check(
      (
        await call(
          "/resources/payments",
          "POST",
          {
            type: "incoming",
            amount: 1,
            paymentMethod: "card",
            relatedId: rxSale.data.id,
            date: day(0),
            notes: tag,
          },
          admin,
        )
      ).status,
      400,
    );
    check(
      (
        await call(
          `/resources/batches/${rxBatch.id}`,
          "PATCH",
          { status: "quarantined" },
          admin,
        )
      ).status,
      200,
    );
    const rxReturn = await call(
      "/operations/sales-return",
      "POST",
      {
        saleId: rxSale.data.id,
        reason: tag,
        restock: true,
        idempotencyKey: randomUUID(),
      },
      admin,
    );
    check(rxReturn.status, 201);
    ids.add(rxReturn.data.id);
    check(rxReturn.data.refundAmount, 200);
    const holdRows = await call(
      "/resources/batches?limit=200",
      "GET",
      undefined,
      admin,
    );
    check(
      holdRows.data.items.some(
        (b: any) =>
          b.originalBatchId === rxBatch.id &&
          b.status === "quarantined" &&
          b.quantity === 2,
      ),
      true,
    );
    check(
      (
        await call(
          `/resources/staff/${login.data.id}`,
          "PATCH",
          { status: "inactive" },
          admin,
        )
      ).status,
      400,
    );
    check(
      (
        await call(
          `/resources/staff/${login.data.id}`,
          "DELETE",
          undefined,
          admin,
        )
      ).status,
      400,
    );
    const pharmacist = await call("/auth/login", "POST", {
      email: "pharmacist@pharmaflow.local",
      password: "PharmaFlow!2026",
    });
    check(
      (
        await call(
          "/resources/expenses",
          "POST",
          {
            title: tag,
            category: "Test",
            amount: 100,
            date: day(0),
            paymentMethod: "cash",
          },
          pharmacist.cookie,
        )
      ).status,
      403,
    );
    const opened = await call(
      "/operations/cash-register",
      "POST",
      { action: "open", amount: 1000 },
      cashier,
    );
    check(opened.status, 201);
    ids.add(opened.data.id);
    check(
      (
        await call(
          "/operations/cash-register",
          "POST",
          { action: "open", amount: 1000 },
          cashier,
        )
      ).status,
      400,
    );
    const closed = await call(
      "/operations/cash-register",
      "POST",
      { action: "close", amount: 1000 },
      cashier,
    );
    check(closed.data.expectedBalance, 1000);
    // Regression: supplied pending/rejected prescriptions cannot be promoted by OTC checkout.
    await create("batches", {
      medicineId: medicine.id,
      batchNumber: tag + "-regression",
      expiryDate: day(100),
      quantity: 20,
      purchasePrice: 50,
      sellingPrice: 100,
      location: "Regression",
      status: "active",
    });
    for (const status of ["pending", "rejected"]) {
      const pending = await create("prescriptions", {
        customerId: customer,
        prescriberName: "Regression prescriber",
        prescriberLicense: "TEST",
        date: day(0),
        expiryDate: day(10),
        items: [{ medicineId: rxMed.id, quantity: 2, dosage: "Test" }],
        status,
      });
      check(
        (
          await call(
            "/operations/checkout",
            "POST",
            {
              items: [{ medicineId: medicine.id, quantity: 1 }],
              customerId: customer,
              prescriptionId: pending.id,
              discount: 0,
              paymentMethod: "cash",
              amountPaid: 100,
              idempotencyKey: randomUUID(),
            },
            cashier,
          )
        ).status,
        400,
      );
      const prescriptions = await call(
        "/resources/prescriptions?limit=200",
        "GET",
        undefined,
        admin,
      );
      check(
        prescriptions.data.items.find((r: any) => r.id === pending.id).status,
        status,
      );
    }
    const newCustomer = await call(
      "/resources/customers",
      "POST",
      { name: tag },
      cashier,
    );
    check(newCustomer.status, 201);
    ids.add(newCustomer.data.id);
    const groupId = boot.data.resources["customer-groups"][0].id;
    check(
      (
        await call(
          `/resources/customers/${newCustomer.data.id}`,
          "PATCH",
          { groupId },
          cashier,
        )
      ).status,
      200,
    );
    const clearGroup = await call(
      `/resources/customers/${newCustomer.data.id}`,
      "PATCH",
      { groupId: null, phone: "" },
      cashier,
    );
    check(clearGroup.status, 200);
    check(clearGroup.data.groupId, null);
    check(clearGroup.data.status, "active");
    check(
      (
        await call(
          `/resources/batches/${batch.id}`,
          "PATCH",
          { supplierId: null },
          admin,
        )
      ).status,
      200,
    );

    check(
      (
        await call(
          `/resources/customers/${newCustomer.data.id}`,
          "DELETE",
          undefined,
          cashier,
        )
      ).status,
      403,
    );
    // Use a private administrator and drawers to avoid touching a user's active demo register.
    const financeUser = await create("staff", {
      name: tag,
      email: tag.toLowerCase() + "@integration.local",
      role: "admin",
      status: "active",
      password: "Integration!2026",
    });
    const financeLogin = await call("/auth/login", "POST", {
      email: financeUser.email,
      password: "Integration!2026",
    });
    const finance = financeLogin.cookie!;
    const drawerA = await call(
      "/operations/cash-register",
      "POST",
      { action: "open", amount: 1000 },
      finance,
    );
    ids.add(drawerA.data.id);
    const balance = async () => {
      const r = await call(
        "/resources/cash-registers?limit=200",
        "GET",
        undefined,
        finance,
      );
      return r.data.items.find(
        (x: any) => x.userId === financeUser.id && x.status === "open",
      ).expectedBalance;
    };
    const mixedSale = await call(
      "/operations/checkout",
      "POST",
      {
        items: [{ medicineId: medicine.id, quantity: 2 }],
        customerId: customer,
        discount: 0,
        paymentMethod: "card",
        amountPaid: 100,
        idempotencyKey: randomUUID(),
      },
      finance,
    );
    check(mixedSale.status, 201);
    ids.add(mixedSale.data.id);
    const settlement = await call(
      "/resources/payments",
      "POST",
      {
        type: "incoming",
        amount: 100,
        paymentMethod: "cash",
        relatedId: mixedSale.data.id,
        date: day(0),
        notes: tag,
      },
      finance,
    );
    check(settlement.status, 201);
    ids.add(settlement.data.id);
    check(settlement.data.cashRegisterId, drawerA.data.id);
    check(await balance(), 1100);
    const mixedReturn = await call(
      "/operations/sales-return",
      "POST",
      {
        saleId: mixedSale.data.id,
        reason: tag,
        restock: true,
        idempotencyKey: randomUUID(),
      },
      finance,
    );
    check(mixedReturn.status, 201);
    ids.add(mixedReturn.data.id);
    check(await balance(), 1000);
    const payments = await call(
      "/resources/payments?limit=200",
      "GET",
      undefined,
      finance,
    );
    const refunds = payments.data.items.filter(
      (p: any) => p.relatedId === mixedSale.data.id && p.type === "outgoing",
    );
    check(refunds.length, 2);
    check(refunds.find((p: any) => p.paymentMethod === "cash").amount, 100);
    check(refunds.find((p: any) => p.paymentMethod === "card").amount, 100);
    const cashPurchase = await create("purchases", {
      supplierId: supplier,
      items: [
        {
          medicineId: medicine.id,
          quantity: 2,
          unitPrice: 50,
          batchNumber: tag + "-cashPO",
          expiryDate: day(100),
          location: "Regression",
        },
      ],
      paymentStatus: "unpaid",
      expectedDate: day(1),
    });
    const cashReceived = await call(
      "/operations/receive",
      "POST",
      { purchaseId: cashPurchase.id, idempotencyKey: randomUUID() },
      finance,
    );
    ids.add(cashReceived.data.items[0].batchId);
    const paidPurchase = await call(
      "/resources/payments",
      "POST",
      {
        type: "outgoing",
        amount: 100,
        paymentMethod: "cash",
        relatedId: cashPurchase.id,
        date: day(0),
        notes: tag,
      },
      finance,
    );
    check(paidPurchase.status, 201);
    ids.add(paidPurchase.data.id);
    check(await balance(), 900);
    const purchaseRefund = await call(
      "/operations/purchase-return",
      "POST",
      {
        purchaseId: cashPurchase.id,
        reason: tag,
        idempotencyKey: randomUUID(),
      },
      finance,
    );
    check(purchaseRefund.status, 201);
    ids.add(purchaseRefund.data.id);
    check(await balance(), 1000);
    const expense = await call(
      "/resources/expenses",
      "POST",
      {
        title: tag,
        category: "Test",
        amount: 100,
        date: day(0),
        paymentMethod: "cash",
        notes: tag,
      },
      finance,
    );
    check(expense.status, 201);
    ids.add(expense.data.id);
    check(expense.data.cashRegisterId, drawerA.data.id);
    check(await balance(), 900);
    await call(
      "/operations/cash-register",
      "POST",
      { action: "close", amount: 900 },
      finance,
    );
    const drawerB = await call(
      "/operations/cash-register",
      "POST",
      { action: "open", amount: 1000 },
      finance,
    );
    ids.add(drawerB.data.id);
    check(
      (
        await call(
          `/resources/expenses/${expense.data.id}`,
          "PATCH",
          { notes: "Metadata correction" },
          finance,
        )
      ).status,
      200,
    );
    check(await balance(), 1000);
    check(
      (
        await call(
          `/resources/expenses/${expense.data.id}`,
          "PATCH",
          { paymentMethod: "card" },
          finance,
        )
      ).status,
      400,
    );
    check(
      (
        await call(
          `/resources/expenses/${expense.data.id}`,
          "PATCH",
          { amount: 200 },
          admin,
        )
      ).status,
      400,
    );
    check(await balance(), 1000);
    await call(
      "/operations/cash-register",
      "POST",
      { action: "close", amount: 1000 },
      finance,
    );
    check(
      today("Pacific/Kiritimati", new Date("2026-11-08T12:30:00Z")),
      "2026-11-09",
    );
    check(today("Etc/GMT+12", new Date("2026-11-08T12:30:00Z")), "2026-11-08");
    check(
      (
        await call(
          "/settings",
          "PATCH",
          { timezone: "Invalid/Timezone" },
          admin,
        )
      ).status,
      400,
    );
    const boundaryMed = await create("medicines", {
      name: "Business-date boundary",
      sku: randomUUID(),
      categoryId: cat,
      brandId: brand,
      dosageForm: "Tablet",
      unit: "Tablet",
      purchasePrice: 50,
      sellingPrice: 100,
      reorderLevel: 1,
      requiresPrescription: false,
      isControlled: false,
      status: "active",
    });
    const earlyTimezone = "Etc/GMT+12",
      lateTimezone = "Pacific/Kiritimati";
    const boundaryDate = today(lateTimezone);
    timezoneToRestore = boot.data.settings.timezone;
    check(
      (await call("/settings", "PATCH", { timezone: earlyTimezone }, admin))
        .status,
      200,
    );
    await create("batches", {
      medicineId: boundaryMed.id,
      batchNumber: tag + "-boundary",
      expiryDate: boundaryDate,
      quantity: 3,
      purchasePrice: 50,
      sellingPrice: 100,
      location: "Test",
      status: "active",
    });
    const boundaryCheckout = {
      items: [{ medicineId: boundaryMed.id, quantity: 1 }],
      discount: 0,
      paymentMethod: "cash",
      amountPaid: 100,
      idempotencyKey: randomUUID(),
    };
    const eligible = await call(
      "/operations/checkout",
      "POST",
      boundaryCheckout,
      admin,
    );
    check(eligible.status, 201);
    ids.add(eligible.data.id);
    check(
      (await call("/settings", "PATCH", { timezone: lateTimezone }, admin))
        .status,
      200,
    );
    check(
      (
        await call(
          "/operations/checkout",
          "POST",
          { ...boundaryCheckout, idempotencyKey: randomUUID() },
          admin,
        )
      ).status,
      400,
    );
    const boundaryRows = await call(
      "/resources/medicines?q=" + encodeURIComponent(boundaryMed.sku),
      "GET",
      undefined,
      admin,
    );
    check(boundaryRows.data.items[0].currentStock, 0);
    const boundaryPurchase = await create("purchases", {
      supplierId: supplier,
      items: [
        {
          medicineId: boundaryMed.id,
          quantity: 1,
          unitPrice: 50,
          batchNumber: tag + "-expiredReceive",
          expiryDate: boundaryDate,
          location: "Test",
        },
      ],
      paymentStatus: "unpaid",
      expectedDate: day(1),
    });
    check(
      (
        await call(
          "/operations/receive",
          "POST",
          { purchaseId: boundaryPurchase.id, idempotencyKey: randomUUID() },
          admin,
        )
      ).status,
      400,
    );
    await call("/settings", "PATCH", { timezone: timezoneToRestore }, admin);
    timezoneToRestore = undefined;
    await assert.rejects(() =>
      createAdministrator({
        email: "invalid",
        password: "short",
        name: "Test",
      }),
    );
    checks++;
    await assert.rejects(() =>
      createAdministrator({
        email: "admin@integration.local",
        password: "PharmaFlow!2026",
        name: "Test",
      }),
    );
    checks++;
    const setupEmail = "setup-" + tag.toLowerCase() + "@integration.local";
    const setup = await createAdministrator({
      email: setupEmail,
      password: "Setup!Secure2026",
      name: tag,
    });
    check(setup.role, "admin");
    const setupLogin = await call("/auth/login", "POST", {
      email: setupEmail,
      password: "Setup!Secure2026",
    });
    check(setupLogin.status, 201);
    await assert.rejects(() =>
      createAdministrator({
        email: setupEmail,
        password: "Other!Secure2026",
        name: "Overwrite",
      }),
    );
    checks++;
    const unchangedLogin = await call("/auth/login", "POST", {
      email: setupEmail,
      password: "Setup!Secure2026",
    });
    check(unchangedLogin.status, 201);
    const cashBoot = await call("/bootstrap", "GET", undefined, cashier);
    check(cashBoot.data.resources.staff, undefined);
    check(cashBoot.data.resources.payments, undefined);
    check(
      cashBoot.data.resources.sales.every((s: any) => s.userId === c.data.id),
      true,
    );
    const secondLogin = await call("/auth/login", "POST", {
      email: "admin@pharmaflow.local",
      password: "PharmaFlow!2026",
    });
    const persisted = await call(
      "/resources/medicines?q=" + encodeURIComponent(tag),
      "GET",
      undefined,
      secondLogin.cookie,
    );
    check(persisted.data.total, 2);
    console.log(`Passed ${checks} integration assertions`);
  } finally {
    if (timezoneToRestore) {
      const current = await prisma.setting.findUnique({
        where: { id: "default" },
      });
      if (current)
        await prisma.setting.update({
          where: { id: "default" },
          data: {
            data: { ...(current.data as any), timezone: timezoneToRestore },
          },
        });
    }

    const records = await prisma.record.findMany();
    const remove = records.filter(
      (r) =>
        ids.has(r.id) ||
        [...ids].some((id) => JSON.stringify(r.data).includes(id)) ||
        JSON.stringify(r.data).includes(tag),
    );
    await prisma.record.deleteMany({
      where: { id: { in: remove.map((r) => r.id) } },
    });
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            tag.toLowerCase() + "@integration.local",
            "setup-" + tag.toLowerCase() + "@integration.local",
          ],
        },
      },
    });
    await app.close();
    await prisma.$disconnect();
  }
});
