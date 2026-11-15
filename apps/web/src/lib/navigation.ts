import {
  LayoutDashboard,
  Pill,
  ShoppingBag,
  Truck,
  Users,
  FileHeart,
  Wallet,
  ChartNoAxesCombined,
  ShieldCheck,
  Settings,
  LifeBuoy,
  Layers,
  Boxes,
  ScanBarcode,
  CalendarClock,
  ArrowRightLeft,
  Tags,
  Building2,
  Scale,
  ClipboardList,
  ReceiptText,
  RotateCcw,
  FileText,
  CircleDollarSign,
  HandCoins,
  Landmark,
  History,
  UserCog,
  Bell,
  type LucideIcon,
} from "lucide-react";
export type NavItem = {
  label: string;
  path: string;
  icon: LucideIcon;
  children?: NavItem[];
  roles?: string[];
};
const pharmacists = ["admin", "pharmacist"];
export const navigation: NavItem[] = [
  { label: "Overview", path: "/dashboard", icon: LayoutDashboard },
  {
    label: "Inventory",
    path: "/inventory/medicines",
    icon: Pill,
    children: [
      { label: "Medicines", path: "/inventory/medicines", icon: Pill },
      { label: "Batches & lots", path: "/inventory/batches", icon: Layers },
      { label: "Stock levels", path: "/inventory/stock", icon: Boxes },
      { label: "Expiry watch", path: "/inventory/expiry", icon: CalendarClock },
      { label: "Categories", path: "/inventory/categories", icon: Tags },
      { label: "Brands", path: "/inventory/brands", icon: Building2 },
      { label: "Units", path: "/inventory/units", icon: Scale },
      {
        label: "Adjustments",
        path: "/inventory/adjustments",
        icon: ClipboardList,
        roles: pharmacists,
      },
      {
        label: "Transfers",
        path: "/inventory/transfers",
        icon: ArrowRightLeft,
        roles: pharmacists,
      },
      { label: "Barcodes", path: "/inventory/barcodes", icon: ScanBarcode },
    ],
  },
  {
    label: "Sales",
    path: "/sales/all",
    icon: ShoppingBag,
    children: [
      { label: "All sales", path: "/sales/all", icon: ShoppingBag },
      { label: "Invoices", path: "/sales/invoices", icon: ReceiptText },
      { label: "Quotations", path: "/sales/quotations", icon: FileText },
      {
        label: "Returns",
        path: "/sales/returns",
        icon: RotateCcw,
        roles: pharmacists,
      },
    ],
  },
  {
    label: "Purchases",
    path: "/purchases/orders",
    icon: Truck,
    roles: pharmacists,
    children: [
      {
        label: "Purchase orders",
        path: "/purchases/orders",
        icon: ClipboardList,
      },
      { label: "All purchases", path: "/purchases/all", icon: ShoppingBag },
      {
        label: "Goods received",
        path: "/purchases/goods-received",
        icon: Boxes,
      },
      { label: "Suppliers", path: "/purchases/suppliers", icon: Truck },
      {
        label: "Purchase returns",
        path: "/purchases/returns",
        icon: RotateCcw,
      },
    ],
  },
  {
    label: "Customers",
    path: "/customers/all",
    icon: Users,
    children: [
      { label: "All customers", path: "/customers/all", icon: Users },
      { label: "Customer groups", path: "/customers/groups", icon: Tags },
      { label: "Transactions", path: "/customers/transactions", icon: History },
    ],
  },
  {
    label: "Prescriptions",
    path: "/prescriptions/all",
    icon: FileHeart,
    children: [
      {
        label: "All prescriptions",
        path: "/prescriptions/all",
        icon: FileHeart,
      },
      {
        label: "Dispensing history",
        path: "/prescriptions/history",
        icon: History,
      },
    ],
  },
  {
    label: "Finance",
    path: "/finance/cash-register",
    icon: Wallet,
    children: [
      {
        label: "Transactions",
        path: "/finance/transactions",
        icon: History,
        roles: pharmacists,
      },
      {
        label: "Payments",
        path: "/finance/payments",
        icon: CircleDollarSign,
        roles: pharmacists,
      },
      {
        label: "Expenses",
        path: "/finance/expenses",
        icon: HandCoins,
        roles: pharmacists,
      },
      {
        label: "Other income",
        path: "/finance/income",
        icon: Landmark,
        roles: pharmacists,
      },
      { label: "Cash register", path: "/finance/cash-register", icon: Wallet },
    ],
  },
  {
    label: "Reports",
    path: "/reports/sales",
    icon: ChartNoAxesCombined,
    roles: pharmacists,
    children: [
      "Sales",
      "Inventory",
      "Expiry",
      "Profit & loss",
      "Customers",
      "Tax",
    ].map((label, i) => ({
      label,
      path:
        "/reports/" +
        ["sales", "inventory", "expiry", "profit-loss", "customers", "tax"][i],
      icon: ChartNoAxesCombined,
    })),
  },
  {
    label: "Team & access",
    path: "/staff/members",
    icon: ShieldCheck,
    roles: ["admin"],
    children: [
      { label: "Team members", path: "/staff/members", icon: UserCog },
      { label: "Roles & permissions", path: "/staff/roles", icon: ShieldCheck },
      { label: "Audit trail", path: "/staff/audit", icon: History },
    ],
  },
];
export const utilityNavigation: NavItem[] = [
  { label: "Notifications", path: "/notifications", icon: Bell },
  { label: "Settings", path: "/settings/general", icon: Settings },
  { label: "Help & support", path: "/help", icon: LifeBuoy },
];
