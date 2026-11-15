import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";
import { PharmacyService, prisma, Actor } from "../src/pharmacy.service";
const date = (days: number) =>
  new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
async function seed() {
  if (process.env.NODE_ENV === "production")
    throw new Error("Demo seed is disabled in production");
  const hash = await argon2.hash("PharmaFlow!2026");
  for (const role of ["admin", "pharmacist", "cashier"])
    await prisma.user.upsert({
      where: { email: `${role}@pharmaflow.local` },
      create: {
        name:
          role === "admin"
            ? "Alex Morgan"
            : role === "pharmacist"
              ? "Dr. Maya Rahman"
              : "Jordan Lee",
        email: `${role}@pharmaflow.local`,
        role,
        status: "active",
        passwordHash: hash,
      },
      update: {},
    });
  if (await prisma.record.count()) return;
  const admin = await prisma.user.findUniqueOrThrow({
    where: { email: "admin@pharmaflow.local" },
  });
  const u: Actor = admin;
  const api = new PharmacyService();
  const add = (r: string, b: any) => api.mutate(u, r, b);
  const categories = [];
  for (const name of [
    "Pain Relief",
    "Antibiotics",
    "Vitamins & Supplements",
    "Digestive Health",
    "Allergy & Respiratory",
    "Diabetes Care",
  ])
    categories.push(
      await add("categories", {
        name,
        description: `Fictional demo ${name.toLowerCase()} assortment`,
      }),
    );
  const brands = [];
  for (const name of [
    "Wellness Labs",
    "CarePlus",
    "Nova Pharma",
    "VitalHealth",
  ])
    brands.push(
      await add("brands", {
        name,
        manufacturer: `${name} Demo Manufacturing`,
        description: "Fictional demonstration brand",
      }),
    );
  for (const [name, abbreviation] of [
    ["Tablet", "tab"],
    ["Capsule", "cap"],
    ["Bottle", "btl"],
    ["Box", "box"],
  ])
    await add("units", { name, abbreviation });
  const suppliers = [];
  for (const [name, contact] of [
    ["MedSupply Distribution", "Rina Das"],
    ["HealthBridge Wholesale", "Omar Ahmed"],
    ["Nova Care Logistics", "Sam Chen"],
  ])
    suppliers.push(
      await add("suppliers", {
        name,
        contactPerson: contact,
        email: `orders${suppliers.length}@example.com`,
        phone: "+880 1700 000100",
        address: "Fictional Supply District, Dhaka",
        paymentTerms: "Net 30",
        status: "active",
      }),
    );
  const group = await add("customer-groups", {
    name: "Loyalty Members",
    discountPercentage: 5,
    description: "Demo loyalty programme",
  });
  await add("customer-groups", {
    name: "Standard",
    discountPercentage: 0,
    description: "Regular customers",
  });
  const customers = [];
  for (const name of [
    "Sarah Ahmed",
    "Michael Chen",
    "Nadia Islam",
    "David Wilson",
    "Aisha Rahman",
    "Robert Brown",
  ])
    customers.push(
      await add("customers", {
        name,
        email: `customer${customers.length}@example.com`,
        phone: "+880 1700 000200",
        address: "Fictional Wellness Avenue, Dhaka",
        groupId: group.id,
        status: "active",
      }),
    );
  const fixtures = [
    ["Paracetamol 500mg", "Acetaminophen", 0, 120, 250, 150, false],
    ["Amoxicillin 250mg", "Amoxicillin", 1, 320, 600, 80, true],
    ["Vitamin C 1000mg", "Ascorbic acid", 2, 800, 1400, 65, false],
    ["Omeprazole 20mg", "Omeprazole", 3, 420, 800, 42, false],
    ["Cetirizine 10mg", "Cetirizine", 4, 100, 250, 18, false],
    ["Metformin 500mg", "Metformin", 5, 220, 450, 95, true],
    ["Ibuprofen 400mg", "Ibuprofen", 0, 180, 350, 120, false],
    ["Vitamin D3 2000 IU", "Cholecalciferol", 2, 550, 1000, 12, false],
    ["Azithromycin 500mg", "Azithromycin", 1, 1200, 1800, 35, true],
    ["Saline Nasal Spray", "Sodium chloride", 4, 1100, 1800, 28, false],
    ["Antacid Suspension", "Aluminium hydroxide", 3, 900, 1500, 8, false],
    ["Zinc 20mg", "Zinc sulfate", 2, 150, 300, 110, false],
    ["Oral Rehydration Salts", "Electrolytes", 3, 90, 180, 200, false],
    ["Loratadine 10mg", "Loratadine", 4, 150, 300, 48, false],
    ["Controlled Demo Tablet", "Demonstration only", 0, 500, 900, 20, true],
  ];
  const meds = [];
  for (let i = 0; i < fixtures.length; i++) {
    const [
      name,
      genericName,
      cat,
      purchasePrice,
      sellingPrice,
      stock,
      requiresPrescription,
    ] = fixtures[i];
    const med = await add("medicines", {
      name,
      genericName,
      sku: `MED-${String(i + 1).padStart(4, "0")}`,
      barcode: `89010000${String(i + 1).padStart(5, "0")}`,
      categoryId: categories[cat as number].id,
      brandId: brands[i % brands.length].id,
      strength: String(name).match(/\d+[^ ]*/)?.[0] ?? "",
      dosageForm: i === 9 ? "Spray" : i === 10 ? "Suspension" : "Tablet",
      unit: "Tablet",
      purchasePrice,
      sellingPrice,
      reorderLevel: 20,
      requiresPrescription,
      isControlled: i === 14,
      status: "active",
      location: `Shelf ${String.fromCharCode(65 + (i % 5))}`,
    });
    meds.push(med);
    await add("batches", {
      medicineId: med.id,
      batchNumber: `B-${2026}-${String(i + 1).padStart(3, "0")}`,
      expiryDate: date(i === 4 ? 20 : i === 7 ? 45 : 180 + i * 15),
      manufacturingDate: date(-180),
      quantity: stock,
      purchasePrice,
      sellingPrice,
      location: med.location,
      status: "active",
      supplierId: suppliers[i % 3].id,
    });
  }
  await add("batches", {
    medicineId: meds[0].id,
    batchNumber: "EXP-DEMO-01",
    expiryDate: date(-20),
    quantity: 15,
    purchasePrice: 120,
    sellingPrice: 250,
    location: "Expired hold",
    status: "expired",
    supplierId: suppliers[0].id,
  });
  await add("batches", {
    medicineId: meds[2].id,
    batchNumber: "QA-DEMO-01",
    expiryDate: date(300),
    quantity: 10,
    purchasePrice: 800,
    sellingPrice: 1400,
    location: "Quarantine",
    status: "quarantined",
    supplierId: suppliers[0].id,
  });
  for (let i = 0; i < 3; i++)
    await add("purchases", {
      supplierId: suppliers[i].id,
      items: [
        {
          medicineId: meds[i].id,
          quantity: 50,
          unitPrice: meds[i].purchasePrice,
          batchNumber: `PO-DEMO-${i}`,
          expiryDate: date(365),
          location: meds[i].location,
        },
      ],
      status: "ordered",
      paymentStatus: "unpaid",
      expectedDate: date(i + 2),
      notes: "Fictional replenishment order",
    });
  const rx = await add("prescriptions", {
    customerId: customers[0].id,
    prescriberName: "Dr. Taylor Morgan (fictional)",
    prescriberLicense: "DEMO-MD-1001",
    date: date(-1),
    expiryDate: date(29),
    items: [
      {
        medicineId: meds[1].id,
        quantity: 14,
        dosage: "One tablet twice daily (demo only)",
      },
      {
        medicineId: meds[5].id,
        quantity: 30,
        dosage: "As prescribed (demo only)",
      },
    ],
    notes: "Fictional prescription for workflow demonstration",
    status: "pending",
  });
  await api.operation(u, "verify-prescription", { prescriptionId: rx.id });
  await add("prescriptions", {
    customerId: customers[2].id,
    prescriberName: "Dr. Casey Lee (fictional)",
    prescriberLicense: "DEMO-MD-1002",
    date: date(0),
    expiryDate: date(30),
    items: [
      {
        medicineId: meds[8].id,
        quantity: 3,
        dosage: "As prescribed (demo only)",
      },
    ],
    status: "pending",
    notes: "Awaiting pharmacist verification",
  });
  for (let i = 0; i < 12; i++) {
    const med = meds[[0, 2, 3, 4, 6, 7, 9, 10, 11, 12, 13, 0][i]];
    await api.operation(u, "checkout", {
      items: [{ medicineId: med.id, quantity: (i % 3) + 1 }],
      customerId: customers[i % customers.length].id,
      discount: 0,
      paymentMethod: i % 2 ? "card" : "cash",
      amountPaid: med.sellingPrice * ((i % 3) + 1),
      idempotencyKey: `seed-sale-${i}`,
    });
  }
  for (const [title, category, amount] of [
    ["Monthly rent", "Rent", 120000],
    ["Electricity bill", "Utilities", 18000],
    ["Staff supplies", "Office", 7500],
    ["Delivery costs", "Logistics", 3200],
  ])
    await add("expenses", {
      title,
      category,
      amount,
      date: date(-3),
      paymentMethod: "bank-transfer",
      notes: "Fictional demo operating expense",
    });
  await add("income", {
    title: "Health screening workshop",
    category: "Services",
    amount: 25000,
    date: date(-1),
    paymentMethod: "cash",
    notes: "Fictional non-sales service income",
  });
  await add("quotations", {
    customerId: customers[3].id,
    customerName: customers[3].name,
    items: [
      { medicineId: meds[2].id, quantity: 10, unitPrice: meds[2].sellingPrice },
    ],
    status: "sent",
    validUntil: date(7),
    notes: "Fictional bulk enquiry",
  });
  for (const [title, message, type, link] of [
    [
      "Low stock warning",
      "Antacid Suspension is below its reorder level.",
      "warning",
      "/inventory",
    ],
    [
      "Expiry attention",
      "Cetirizine batch expires within 30 days.",
      "warning",
      "/inventory",
    ],
    [
      "Welcome to PharmaFlow",
      "All records in this workspace are fictional demonstration data.",
      "info",
      "/help",
    ],
  ])
    await add("notifications", { title, message, type, isRead: false, link });
  console.log(
    "Seeded fictional pharmacy. Local accounts: admin/pharmacist/cashier@pharmaflow.local; password PharmaFlow!2026",
  );
}
seed()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
