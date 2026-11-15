import { z } from "zod";
const text = z.string().trim().min(1).max(500);
const optional = z.string().max(2000).optional().default("");
const money = z.number().int().min(0).max(1000000000);
const qty = z.number().int().min(1).max(1000000);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
    "Invalid date",
  );
const id = text;
const status = z.enum(["active", "inactive"]).default("active");
export const method = z.enum(["cash", "card", "mobile", "bank-transfer"]);
const item = z
  .object({ medicineId: id, quantity: qty, unitPrice: money })
  .strict();
export const schemas: Record<string, z.ZodObject<any>> = {
  medicines: z
    .object({
      name: text,
      genericName: optional,
      sku: text,
      barcode: optional,
      categoryId: id,
      brandId: id,
      strength: optional,
      dosageForm: text,
      unit: text,
      purchasePrice: money,
      sellingPrice: money,
      reorderLevel: money,
      requiresPrescription: z.boolean().default(false),
      isControlled: z.boolean().default(false),
      status,
      image: optional,
      location: optional,
    })
    .strict(),
  batches: z
    .object({
      medicineId: id,
      batchNumber: text,
      expiryDate: date,
      manufacturingDate: date.optional(),
      quantity: money,
      purchasePrice: money,
      sellingPrice: money,
      location: text,
      status: z.enum(["active", "quarantined", "expired"]).default("active"),
      supplierId: id.nullable().optional(),
    })
    .strict(),
  categories: z.object({ name: text, description: optional }).strict(),
  brands: z
    .object({ name: text, manufacturer: optional, description: optional })
    .strict(),
  units: z.object({ name: text, abbreviation: text }).strict(),
  suppliers: z
    .object({
      name: text,
      contactPerson: optional,
      email: z
        .union([z.string().email(), z.literal("")])
        .optional()
        .default(""),
      phone: optional,
      address: optional,
      paymentTerms: optional,
      status,
    })
    .strict(),
  customers: z
    .object({
      name: text,
      email: z
        .union([z.string().email(), z.literal("")])
        .optional()
        .default(""),
      phone: optional,
      address: optional,
      groupId: id.nullable().optional(),
      status,
    })
    .strict(),
  "customer-groups": z
    .object({
      name: text,
      discountPercentage: z.number().min(0).max(100),
      description: optional,
    })
    .strict(),
  quotations: z
    .object({
      reference: text.optional(),
      customerId: id.nullable().optional(),
      customerName: optional,
      items: z.array(item).min(1).max(100),
      status: z.enum(["draft", "sent", "accepted", "expired"]).default("draft"),
      validUntil: date,
      notes: optional,
    })
    .strict(),
  purchases: z
    .object({
      reference: text.optional(),
      supplierId: id,
      items: z
        .array(
          item
            .extend({ batchNumber: text, expiryDate: date, location: text })
            .strict(),
        )
        .min(1)
        .max(100),
      status: z.literal("ordered").default("ordered"),
      paymentStatus: z.enum(["unpaid", "paid"]).default("unpaid"),
      expectedDate: date,
      notes: optional,
    })
    .strict(),
  prescriptions: z
    .object({
      reference: text.optional(),
      customerId: id,
      prescriberName: text,
      prescriberLicense: text,
      date,
      expiryDate: date,
      items: z
        .array(
          z.object({ medicineId: id, quantity: qty, dosage: text }).strict(),
        )
        .min(1)
        .max(100),
      status: z.enum(["pending", "rejected"]).default("pending"),
      notes: optional,
    })
    .strict(),
  expenses: z
    .object({
      title: text,
      category: text,
      amount: money,
      date,
      paymentMethod: method,
      notes: optional,
    })
    .strict(),
  income: z
    .object({
      title: text,
      category: text,
      amount: money,
      date,
      paymentMethod: method,
      notes: optional,
    })
    .strict(),
  payments: z
    .object({
      reference: text.optional(),
      type: z.enum(["incoming", "outgoing"]),
      amount: qty,
      paymentMethod: method,
      status: z.literal("completed").default("completed"),
      relatedId: id.optional(),
      date,
      notes: optional,
    })
    .strict(),
  staff: z
    .object({
      name: text,
      email: z
        .string()
        .email()
        .transform((s) => s.toLowerCase()),
      role: z.enum(["admin", "pharmacist", "cashier"]),
      status,
      password: z.string().min(10).max(128).optional(),
    })
    .strict(),
  notifications: z
    .object({
      title: text,
      message: text,
      type: z.enum(["warning", "info", "success"]),
      isRead: z.boolean().default(false),
      link: optional,
    })
    .strict(),
};
export const settingsSchema = z
  .object({
    pharmacyName: text,
    address: optional,
    phone: optional,
    email: z.union([z.string().email(), z.literal("")]),
    currency: z.string().length(3),
    timezone: text.refine((value) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }, "Invalid IANA timezone"),
    invoicePrefix: text,
    receiptFooter: optional,
    taxRate: z.number().min(0).max(100),
    lowStockAlerts: z.boolean(),
    expiryAlerts: z.boolean(),
    expiryWarningDays: z.number().int().min(1).max(730),
    theme: z.enum(["light", "dark", "system"]),
  })
  .strict();
export const defaults = {
  pharmacyName: "PharmaFlow Demo Pharmacy",
  address: "24 Wellness Avenue, Dhaka (fictional)",
  phone: "+880 1700 000000",
  email: "hello@pharmaflow.local",
  currency: "USD",
  timezone: "Asia/Dhaka",
  invoicePrefix: "INV",
  receiptFooter: "Thank you for choosing PharmaFlow.",
  taxRate: 0,
  lowStockAlerts: true,
  expiryAlerts: true,
  expiryWarningDays: 90,
  theme: "light",
};
export const operations: Record<string, z.ZodObject<any>> = {
  checkout: z
    .object({
      items: z
        .array(z.object({ medicineId: id, quantity: qty }).strict())
        .min(1)
        .max(100),
      customerId: id.nullable().optional(),
      discount: money,
      paymentMethod: method,
      amountPaid: money,
      prescriptionId: id.optional(),
      idempotencyKey: text,
    })
    .strict(),
  receive: z.object({ purchaseId: id, idempotencyKey: text }).strict(),
  adjust: z
    .object({
      medicineId: id,
      batchId: id,
      quantityChange: z
        .number()
        .int()
        .min(-1000000)
        .max(1000000)
        .refine((v) => v !== 0),
      reason: text,
    })
    .strict(),
  transfer: z
    .object({ batchId: id, quantity: qty, destination: text, reason: text })
    .strict(),
  "sales-return": z
    .object({
      saleId: id,
      reason: text,
      restock: z.boolean(),
      idempotencyKey: text,
    })
    .strict(),
  "purchase-return": z
    .object({ purchaseId: id, reason: text, idempotencyKey: text })
    .strict(),
  "verify-prescription": z.object({ prescriptionId: id }).strict(),
  "mark-notification": z.object({ id }).strict(),
  "cash-register": z
    .object({ action: z.enum(["open", "close"]), amount: money })
    .strict(),
};
export const resourceNames = [
  ...Object.keys(schemas),
  "sales",
  "sales-returns",
  "purchase-returns",
  "cash-registers",
  "roles",
  "movements",
  "adjustments",
  "transfers",
  "audit",
];
export const cashierReads = [
  "medicines",
  "categories",
  "brands",
  "units",
  "batches",
  "customers",
  "customer-groups",
  "sales",
  "quotations",
  "prescriptions",
  "cash-registers",
  "notifications",
];
export const readonlyResources = [
  "sales",
  "sales-returns",
  "purchase-returns",
  "cash-registers",
  "roles",
  "movements",
  "adjustments",
  "transfers",
  "audit",
];
