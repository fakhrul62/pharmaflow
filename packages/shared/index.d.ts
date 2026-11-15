export type Role = "admin" | "pharmacist" | "cashier";
export interface User {
  demo?: boolean;
  id: string;
  name: string;
  email: string;
  role: Role;
  status?: "active" | "inactive";
}
/** Monetary amounts throughout the API are integer minor currency units. */
export type Cents = number;
export type Entity = { id: string; [key: string]: any };
export interface Settings {
  pharmacyName: string;
  address: string;
  phone: string;
  email: string;
  currency: string;
  timezone: string;
  invoicePrefix: string;
  receiptFooter: string;
  taxRate: number;
  lowStockAlerts: boolean;
  expiryAlerts: boolean;
  expiryWarningDays: number;
  theme: "light" | "dark" | "system";
}
export type ResourceName =
  | "medicines"
  | "batches"
  | "categories"
  | "brands"
  | "units"
  | "suppliers"
  | "customers"
  | "customer-groups"
  | "sales"
  | "sales-returns"
  | "quotations"
  | "purchases"
  | "purchase-returns"
  | "prescriptions"
  | "expenses"
  | "income"
  | "payments"
  | "cash-registers"
  | "staff"
  | "roles"
  | "notifications"
  | "movements"
  | "adjustments"
  | "transfers"
  | "audit";
export interface Snapshot {
  user: User;
  resources: Record<ResourceName, Entity[]>;
  settings: Settings;
}
export interface Medicine extends Entity {
  name: string;
  genericName: string;
  sku: string;
  barcode: string;
  categoryId: string;
  brandId: string;
  sellingPrice: Cents;
  purchasePrice: Cents;
  currentStock: number;
  reorderLevel: number;
  requiresPrescription: boolean;
  isControlled: boolean;
  status: "active" | "inactive";
  unit: string;
}
export interface Batch extends Entity {
  medicineId: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  purchasePrice: Cents;
  sellingPrice: Cents;
  location: string;
  status: "active" | "expired" | "quarantined";
}
export type PaymentMethod = "cash" | "card" | "mobile" | "bank-transfer";
export interface CheckoutRequest {
  items: { medicineId: string; quantity: number }[];
  customerId?: string;
  discount: Cents;
  paymentMethod: PaymentMethod;
  amountPaid: Cents;
  prescriptionId?: string;
  idempotencyKey: string;
}
export interface ReceiveRequest {
  purchaseId: string;
  idempotencyKey: string;
}
export interface StockAdjustmentRequest {
  medicineId: string;
  batchId: string;
  quantityChange: number;
  reason: string;
}
export interface StockTransferRequest {
  batchId: string;
  quantity: number;
  destination: string;
  reason: string;
}
export interface SalesReturnRequest {
  saleId: string;
  reason: string;
  restock: boolean;
  idempotencyKey: string;
}
export interface ResourcePage<T = Entity> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
