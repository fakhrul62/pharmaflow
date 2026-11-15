export type Field = {
  key: string;
  label: string;
  type?:
    | "text"
    | "email"
    | "number"
    | "money"
    | "date"
    | "textarea"
    | "checkbox"
    | "select"
    | "password";
  required?: boolean;
  resource?: string;
  options?: string[];
  default?: any;
  min?: number;
  hint?: string;
};
export type ResourceConfig = {
  resource: string;
  title: string;
  description: string;
  singular: string;
  columns: string[];
  fields: Field[];
  readonly?: boolean;
  items?: "purchase" | "prescription" | "quotation";
  roles?: string[];
};
const name: Field = { key: "name", label: "Name", required: true };
const status: Field = {
  key: "status",
  label: "Status",
  type: "select",
  options: ["active", "inactive"],
  default: "active",
};
const desc: Field = {
  key: "description",
  label: "Description",
  type: "textarea",
};
const phone: Field = { key: "phone", label: "Phone" };
const email: Field = { key: "email", label: "Email address", type: "email" };
const address: Field = { key: "address", label: "Address", type: "textarea" };
const ref = (
  key: string,
  label: string,
  resource: string,
  required = true,
): Field => ({ key, label, resource, type: "select", required });
const field = (
  key: string,
  label: string,
  type: Field["type"] = "text",
  required = false,
): Field => ({ key, label, type, required });
const admin = ["admin"];
const pharmacy = ["admin", "pharmacist"];
export const configs: Record<string, ResourceConfig> = {
  medicines: {
    resource: "medicines",
    title: "Medicines",
    description: "A well-organized inventory. Better care at every counter.",
    singular: "medicine",
    columns: [
      "name",
      "sku",
      "categoryId",
      "currentStock",
      "sellingPrice",
      "status",
    ],
    fields: [
      { ...name, label: "Medicine name" },
      field("genericName", "Generic name", "text", true),
      field("sku", "SKU", "text", true),
      field("barcode", "Barcode", "text", true),
      ref("categoryId", "Category", "categories"),
      ref("brandId", "Brand", "brands"),
      field("strength", "Strength"),
      {
        key: "dosageForm",
        label: "Dosage form",
        type: "select",
        options: [
          "Tablet",
          "Capsule",
          "Syrup",
          "Injection",
          "Cream",
          "Inhaler",
          "Drops",
          "Other",
        ],
        default: "Tablet",
      },
      ref("unit", "Unit", "units", true),
      field("purchasePrice", "Purchase price", "money", true),
      field("sellingPrice", "Selling price", "money", true),
      {
        key: "reorderLevel",
        label: "Reorder level",
        type: "number",
        default: 20,
      },
      field("location", "Default shelf / location"),
      {
        key: "requiresPrescription",
        label: "Requires a verified prescription",
        type: "checkbox",
      },
      { key: "isControlled", label: "Controlled medicine", type: "checkbox" },
      status,
    ],
    roles: pharmacy,
  },
  categories: {
    resource: "categories",
    title: "Categories",
    description: "Keep your medicines organized by therapeutic category.",
    singular: "category",
    columns: ["name", "description"],
    fields: [name, desc],
    roles: pharmacy,
  },
  brands: {
    resource: "brands",
    title: "Brands & manufacturers",
    description: "The trusted names behind your inventory.",
    singular: "brand",
    columns: ["name", "manufacturer", "description"],
    fields: [name, field("manufacturer", "Manufacturer"), desc],
    roles: pharmacy,
  },
  units: {
    resource: "units",
    title: "Units of measure",
    description: "Consistent quantities, from a single tablet to a full pack.",
    singular: "unit",
    columns: ["name", "abbreviation"],
    fields: [name, field("abbreviation", "Abbreviation", "text", true)],
    roles: pharmacy,
  },
  batches: {
    resource: "batches",
    title: "Batches & lots",
    description: "Trace every medicine from delivery to dispensing.",
    singular: "batch",
    columns: [
      "batchNumber",
      "medicineId",
      "quantity",
      "expiryDate",
      "location",
      "status",
    ],
    fields: [
      ref("medicineId", "Medicine", "medicines"),
      field("batchNumber", "Batch number", "text", true),
      field("manufacturingDate", "Manufacturing date", "date"),
      field("expiryDate", "Expiry date", "date", true),
      {
        key: "quantity",
        label: "Opening quantity",
        type: "number",
        required: true,
        min: 1,
        default: 1,
        hint: "Use a stock adjustment to change quantity after creation.",
      },
      field("purchasePrice", "Purchase price", "money", true),
      field("sellingPrice", "Selling price", "money", true),
      field("location", "Shelf / location", "text", true),
      ref("supplierId", "Supplier", "suppliers", false),
      {
        key: "status",
        label: "Status",
        type: "select",
        options: ["active", "quarantined", "expired"],
        default: "active",
      },
    ],
    roles: pharmacy,
  },
  suppliers: {
    resource: "suppliers",
    title: "Suppliers",
    description: "Your partners in keeping the pharmacy stocked.",
    singular: "supplier",
    columns: [
      "name",
      "contactPerson",
      "phone",
      "email",
      "paymentTerms",
      "status",
    ],
    fields: [
      name,
      field("contactPerson", "Contact person"),
      email,
      phone,
      address,
      field("paymentTerms", "Payment terms"),
      status,
    ],
    roles: pharmacy,
  },
  customers: {
    resource: "customers",
    title: "Customers",
    description: "The people at the heart of your pharmacy.",
    singular: "customer",
    columns: [
      "name",
      "phone",
      "email",
      "groupId",
      "totalPurchases",
      "outstandingBalance",
      "status",
    ],
    fields: [
      name,
      phone,
      email,
      address,
      ref("groupId", "Customer group", "customer-groups", false),
      status,
    ],
  },
  "customer-groups": {
    resource: "customer-groups",
    title: "Customer groups",
    description: "Organize customer relationships and discount preferences.",
    singular: "customer group",
    columns: ["name", "discountPercentage", "description"],
    fields: [
      name,
      {
        key: "discountPercentage",
        label: "Discount percentage",
        type: "number",
        min: 0,
        default: 0,
        hint: "Group discount is a preference; apply an explicit discount at checkout.",
      },
      desc,
    ],
    roles: pharmacy,
  },
  sales: {
    resource: "sales",
    title: "All sales",
    description: "Every transaction, neatly accounted for.",
    singular: "sale",
    columns: [
      "invoiceNumber",
      "customerName",
      "createdAt",
      "total",
      "paymentMethod",
      "paymentStatus",
      "status",
    ],
    fields: [],
    readonly: true,
  },
  "sales-returns": {
    resource: "sales-returns",
    title: "Sales returns",
    description: "Manage refunds and put eligible stock back on the shelf.",
    singular: "sales return",
    columns: ["reference", "saleId", "reason", "total", "createdAt", "status"],
    fields: [],
    readonly: true,
  },
  quotations: {
    resource: "quotations",
    title: "Quotations",
    description: "Prepare an estimate before the next purchase.",
    singular: "quotation",
    columns: ["reference", "customerName", "total", "validUntil", "status"],
    fields: [
      field("reference", "Reference", "text", true),
      ref("customerId", "Customer", "customers", false),
      field("validUntil", "Valid until", "date", true),
      {
        key: "status",
        label: "Status",
        type: "select",
        options: ["draft", "sent", "accepted", "expired"],
        default: "draft",
      },
      field("notes", "Notes", "textarea"),
    ],
    items: "quotation",
  },
  purchases: {
    resource: "purchases",
    title: "Purchase orders",
    description: "Plan your next delivery and keep stock flowing.",
    singular: "purchase order",
    columns: [
      "reference",
      "supplierId",
      "expectedDate",
      "total",
      "paymentStatus",
      "status",
    ],
    fields: [
      field("reference", "Order reference", "text", true),
      ref("supplierId", "Supplier", "suppliers"),
      field("expectedDate", "Expected delivery", "date", true),
      {
        key: "paymentStatus",
        label: "Payment status",
        type: "select",
        options: ["unpaid", "paid"],
        default: "unpaid",
      },
      field("notes", "Notes", "textarea"),
    ],
    items: "purchase",
    roles: pharmacy,
  },
  "purchase-returns": {
    resource: "purchase-returns",
    title: "Purchase returns",
    description: "Track stock returned to suppliers.",
    singular: "purchase return",
    columns: [
      "reference",
      "purchaseId",
      "reason",
      "total",
      "createdAt",
      "status",
    ],
    fields: [],
    readonly: true,
  },
  prescriptions: {
    resource: "prescriptions",
    title: "Prescriptions",
    description: "Review, verify, and dispense with a clear record.",
    singular: "prescription",
    columns: [
      "reference",
      "customerId",
      "prescriberName",
      "date",
      "expiryDate",
      "status",
    ],
    fields: [
      field("reference", "Prescription reference", "text", true),
      ref("customerId", "Customer", "customers"),
      field("prescriberName", "Prescriber name", "text", true),
      field("prescriberLicense", "Prescriber license", "text", true),
      field("date", "Prescription date", "date", true),
      field("expiryDate", "Valid until", "date", true),
      field("notes", "Notes", "textarea"),
    ],
    items: "prescription",
    roles: pharmacy,
  },
  expenses: {
    resource: "expenses",
    title: "Expenses",
    description: "Know where your money goes, down to the last detail.",
    singular: "expense",
    columns: ["title", "category", "date", "amount", "paymentMethod"],
    fields: [
      field("title", "Expense title", "text", true),
      field("category", "Category", "text", true),
      field("amount", "Amount", "money", true),
      field("date", "Date", "date", true),
      {
        key: "paymentMethod",
        label: "Payment method",
        type: "select",
        options: ["cash", "card", "mobile", "bank-transfer"],
        default: "cash",
      },
      field("notes", "Notes", "textarea"),
    ],
    roles: admin,
  },
  income: {
    resource: "income",
    title: "Other income",
    description: "Record non-sales income separately from checkout revenue.",
    singular: "income",
    columns: ["title", "category", "date", "amount", "paymentMethod"],
    fields: [
      field("title", "Income title", "text", true),
      field("category", "Category", "text", true),
      field("amount", "Amount", "money", true),
      field("date", "Date", "date", true),
      {
        key: "paymentMethod",
        label: "Payment method",
        type: "select",
        options: ["cash", "card", "mobile", "bank-transfer"],
        default: "cash",
      },
      field("notes", "Notes", "textarea"),
    ],
    roles: admin,
  },
  payments: {
    resource: "payments",
    title: "Payments",
    description: "Incoming and outgoing payments in one clear view.",
    singular: "payment",
    columns: ["reference", "type", "date", "amount", "paymentMethod", "status"],
    fields: [
      field("reference", "Reference", "text", true),
      {
        key: "type",
        label: "Direction",
        type: "select",
        options: ["incoming", "outgoing"],
        default: "incoming",
      },
      ref(
        "relatedId",
        "Invoice or purchase to settle (optional)",
        "payment-documents",
        false,
      ),
      field("amount", "Amount", "money", true),
      field("date", "Date", "date", true),
      {
        key: "paymentMethod",
        label: "Payment method",
        type: "select",
        options: ["cash", "card", "mobile", "bank-transfer"],
        default: "cash",
      },
      field("notes", "Notes", "textarea"),
    ],
    roles: admin,
  },
  staff: {
    resource: "staff",
    title: "Your pharmacy team",
    description: "The right people, with the right access.",
    singular: "team member",
    columns: ["name", "email", "role", "status"],
    fields: [
      name,
      { ...email, required: true },
      {
        key: "role",
        label: "Role",
        type: "select",
        options: ["admin", "pharmacist", "cashier"],
        default: "cashier",
      },
      status,
      {
        key: "password",
        label: "Password",
        type: "password",
        hint: "At least 10 characters. Required for new members; leave blank to keep an existing password.",
      },
    ],
    roles: admin,
  },
  roles: {
    resource: "roles",
    title: "Roles & permissions",
    description: "Clear responsibilities. Server-enforced access.",
    singular: "role",
    columns: ["name", "description", "permissions"],
    fields: [],
    readonly: true,
  },
  audit: {
    resource: "audit",
    title: "Audit trail",
    description: "A clear history of who changed what and when.",
    singular: "audit record",
    columns: ["action", "resource", "recordId", "userName", "createdAt"],
    fields: [],
    readonly: true,
  },
  movements: {
    resource: "movements",
    title: "Stock movement history",
    description: "Every stock change, with a traceable reference.",
    singular: "movement",
    columns: [
      "medicineId",
      "type",
      "quantity",
      "reason",
      "reference",
      "createdAt",
    ],
    fields: [],
    readonly: true,
  },
  adjustments: {
    resource: "adjustments",
    title: "Stock adjustments",
    description: "Keep your physical and recorded stock in agreement.",
    singular: "adjustment",
    columns: ["medicineId", "batchId", "quantityChange", "reason", "createdAt"],
    fields: [],
    readonly: true,
  },
  transfers: {
    resource: "transfers",
    title: "Stock transfers",
    description: "Move stock between shelves and locations with a record.",
    singular: "transfer",
    columns: [
      "medicineId",
      "quantity",
      "source",
      "destination",
      "reason",
      "createdAt",
    ],
    fields: [],
    readonly: true,
  },
  "cash-registers": {
    resource: "cash-registers",
    title: "Cash register",
    description: "Open your shift and reconcile cash at the end of the day.",
    singular: "register",
    columns: [
      "cashierName",
      "openingBalance",
      "expectedBalance",
      "closingBalance",
      "status",
      "openedAt",
    ],
    fields: [],
    readonly: true,
  },
};
export function routeConfig(path: string): ResourceConfig {
  const [section, page] = path.split("/").filter(Boolean);
  const key =
    section === "inventory"
      ? { stock: "medicines", expiry: "batches", barcodes: "medicines" }[
          page
        ] ||
        page ||
        "medicines"
      : section === "sales"
        ? { returns: "sales-returns", quotations: "quotations" }[page] ||
          "sales"
        : section === "purchases"
          ? { suppliers: "suppliers", returns: "purchase-returns" }[page] ||
            "purchases"
          : section === "customers"
            ? page === "groups"
              ? "customer-groups"
              : page === "transactions"
                ? "sales"
                : "customers"
            : section === "prescriptions"
              ? "prescriptions"
              : section === "finance"
                ? {
                    "cash-register": "cash-registers",
                    transactions: "payments",
                  }[page] ||
                  page ||
                  "payments"
                : section === "staff"
                  ? { members: "staff", permissions: "roles" }[page] ||
                    page ||
                    "staff"
                  : "medicines";
  return configs[key] || configs.medicines;
}
export const labels: Record<string, string> = {
  name: "Medicine",
  genericName: "Generic name",
  sku: "SKU",
  categoryId: "Category",
  brandId: "Brand",
  currentStock: "Available stock",
  sellingPrice: "Selling price",
  purchasePrice: "Purchase price",
  batchNumber: "Batch",
  medicineId: "Medicine",
  expiryDate: "Expiry date",
  location: "Location",
  quantity: "Quantity",
  createdAt: "Date",
  customerName: "Customer",
  invoiceNumber: "Invoice",
  paymentMethod: "Method",
  paymentStatus: "Payment",
  totalPurchases: "Total purchases",
  outstandingBalance: "Balance due",
  groupId: "Group",
  supplierId: "Supplier",
  expectedDate: "Expected",
  saleId: "Sale",
  purchaseId: "Purchase",
  prescriberName: "Prescriber",
  customerId: "Customer",
  validUntil: "Valid until",
  discountPercentage: "Discount %",
  contactPerson: "Contact person",
  paymentTerms: "Terms",
  quantityChange: "Change",
  batchId: "Batch",
  recordId: "Record",
  userName: "Team member",
  openingBalance: "Opening",
  expectedBalance: "Expected cash",
  closingBalance: "Counted cash",
  openedAt: "Opened",
  cashierName: "Cashier",
};
export const moneyFields = new Set([
  "purchasePrice",
  "sellingPrice",
  "total",
  "amount",
  "subtotal",
  "tax",
  "discount",
  "openingBalance",
  "closingBalance",
  "expectedBalance",
  "outstandingBalance",
  "totalPurchases",
]);
export const references: Record<string, string> = {
  medicineId: "medicines",
  categoryId: "categories",
  brandId: "brands",
  supplierId: "suppliers",
  customerId: "customers",
  groupId: "customer-groups",
  batchId: "batches",
  saleId: "sales",
  purchaseId: "purchases",
};
