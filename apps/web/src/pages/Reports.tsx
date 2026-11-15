import { useMemo, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import {
  Download,
  Printer,
  CalendarDays,
  ArrowUpRight,
  TrendingUp,
  Wallet,
  ShoppingBag,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { ColumnDef } from "@tanstack/react-table";
import { useWorkspace } from "../lib/store";
import {
  money,
  date,
  daysUntil,
  today,
  dayKey,
  sum,
  type Entity,
} from "../lib/api";
import { PageHeading, DataTable, Badge, exportCsv } from "../components/ui";
export default function Reports() {
  const { data } = useWorkspace();
  const { pathname } = useLocation();
  const type = pathname.split("/").pop() || "sales";
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(today());
  const r = data.resources;
  const currency = data.settings.currency;
  const inRange = (e: Entity) => {
    const key = e.date ? String(e.date) : dayKey(e.createdAt);
    return key >= from && key <= to;
  };
  const sales = (r.sales || []).filter(
    (e) => inRange(e) && e.status !== "returned" && e.status !== "cancelled",
  );
  const grossSales = sum(sales, "total");
  const revenue = grossSales - sum(sales, "tax");
  const cost = sales.reduce(
    (a, s) =>
      a +
      (s.items || []).reduce(
        (n: number, i: any) =>
          n +
          Number(i.quantity) *
            Number(
              i.costPrice ??
                r.batches?.find((b) => b.id === i.batchId)?.purchasePrice ??
                r.medicines?.find((m) => m.id === i.medicineId)
                  ?.purchasePrice ??
                0,
            ),
        0,
      ),
    0,
  );
  const expenses = sum((r.expenses || []).filter(inRange), "amount");
  const income = sum((r.income || []).filter(inRange), "amount");
  let title = "Sales report";
  let rows: Entity[] = sales;
  let keys = [
    "invoiceNumber",
    "customerName",
    "createdAt",
    "subtotal",
    "tax",
    "total",
    "paymentStatus",
  ];
  if (type === "inventory") {
    title = "Inventory report";
    rows = (r.medicines || []).map((m) => ({
      ...m,
      stockValue: (r.batches || [])
        .filter((b) => b.medicineId === m.id)
        .reduce((a, b) => a + b.quantity * b.purchasePrice, 0),
    }));
    keys = ["name", "sku", "currentStock", "reorderLevel", "stockValue"];
  }
  if (type === "expiry") {
    title = "Expiry report";
    rows = (r.batches || [])
      .filter(
        (b) =>
          b.quantity > 0 &&
          daysUntil(b.expiryDate) <=
            Number(data.settings.expiryWarningDays || 90),
      )
      .map((b) => ({
        ...b,
        medicineName: r.medicines?.find((m) => m.id === b.medicineId)?.name,
        daysRemaining: daysUntil(b.expiryDate),
        stockValue: b.quantity * b.purchasePrice,
      }));
    keys = [
      "medicineName",
      "batchNumber",
      "expiryDate",
      "quantity",
      "daysRemaining",
      "stockValue",
    ];
  }
  if (type === "customers") {
    title = "Customer report";
    rows = r.customers || [];
    keys = ["name", "phone", "totalPurchases", "outstandingBalance", "status"];
  }
  if (type === "profit-loss") {
    title = "Profit & loss";
    rows = [
      {
        id: "revenue",
        line: "Sales revenue (after discount, excluding tax)",
        amount: revenue,
      },
      { id: "cost", line: "Cost of goods sold", amount: -cost },
      { id: "gross", line: "Gross profit", amount: revenue - cost },
      { id: "income", line: "Other income", amount: income },
      { id: "expenses", line: "Operating expenses", amount: -expenses },
      {
        id: "net",
        line: "Net profit",
        amount: revenue - cost + income - expenses,
      },
    ];
    keys = ["line", "amount"];
  }
  if (type === "tax") {
    title = "Tax summary";
    keys = [
      "invoiceNumber",
      "createdAt",
      "subtotal",
      "discount",
      "tax",
      "total",
    ];
  }
  const chart = useMemo(() => {
    const points: Record<string, any> = {};
    for (const s of sales) {
      const key = dayKey(s.createdAt);
      points[key] ??= { day: key, value: 0 };
      points[key].value += s.total / 100;
    }
    return Object.values(points).sort((a, b) => a.day.localeCompare(b.day));
  }, [sales]);
  const monetary = [
    "subtotal",
    "total",
    "tax",
    "discount",
    "stockValue",
    "totalPurchases",
    "outstandingBalance",
    "amount",
  ];
  const columns: ColumnDef<Entity, any>[] = keys.map((k) => ({
    accessorKey: k,
    header:
      (
        {
          invoiceNumber: "Invoice",
          customerName: "Customer",
          createdAt: "Date",
          currentStock: "Available stock",
          stockValue: "Stock value",
          medicineName: "Medicine",
          batchNumber: "Batch",
          expiryDate: "Expiry",
          daysRemaining: "Days left",
          reorderLevel: "Reorder at",
          totalPurchases: "Total purchases",
          outstandingBalance: "Balance due",
        } as Record<string, string>
      )[k] || k[0].toUpperCase() + k.slice(1),
    cell: ({ getValue }) =>
      monetary.includes(k) ? (
        <strong>{money(getValue(), currency)}</strong>
      ) : k === "createdAt" || k === "expiryDate" ? (
        date(getValue())
      ) : k.toLowerCase().includes("status") ? (
        <Badge>{getValue()}</Badge>
      ) : (
        String(getValue() ?? "—")
      ),
  }));
  if (data.user.role === "cashier")
    return (
      <div className="page">
        <PageHeading
          title="Reports are restricted"
          description="Contact your administrator for reporting access."
        />
        <Link className="btn primary" to="/dashboard">
          Back to overview
        </Link>
      </div>
    );
  return (
    <div className="page">
      <PageHeading
        eyebrow="TURN DATA INTO CLARITY"
        title={title}
        description="A thoughtful view of how your pharmacy is doing."
      >
        <button className="btn secondary" onClick={() => window.print()}>
          <Printer size={16} />
          Print
        </button>
        <button
          className="btn primary"
          disabled={!rows.length}
          onClick={() => exportCsv(rows, type + "-report")}
        >
          <Download size={16} />
          Export report
        </button>
      </PageHeading>
      <div className="report-tabs">
        {[
          ["sales", "Sales"],
          ["inventory", "Inventory"],
          ["expiry", "Expiry"],
          ["profit-loss", "Profit & loss"],
          ["customers", "Customers"],
          ["tax", "Tax"],
        ].map(([key, label]) => (
          <Link
            key={key}
            to={`/reports/${key}`}
            className={key === type ? "selected" : ""}
          >
            {label}
          </Link>
        ))}
      </div>
      {!["inventory", "expiry", "customers"].includes(type) && (
        <div className="report-period">
          <CalendarDays size={18} />
          <label>
            From
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <span>—</span>
          <label>
            To
            <input
              type="date"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <span className="muted">Showing completed, non-returned sales</span>
        </div>
      )}
      <div className="summary-grid three">
        <div className="summary-card">
          <span className="stat-icon teal">
            <TrendingUp size={21} />
          </span>
          <div>
            <span>
              {type === "inventory"
                ? "Inventory value"
                : type === "expiry"
                  ? "Stock value at risk"
                  : type === "profit-loss"
                    ? "Sales revenue (excluding tax)"
                    : "Gross sales (including tax)"}
            </span>
            <strong>
              {money(
                ["inventory", "expiry"].includes(type)
                  ? sum(rows, "stockValue")
                  : type === "profit-loss"
                    ? revenue
                    : grossSales,
                currency,
              )}
            </strong>
          </div>
        </div>
        <div className="summary-card">
          <span className="stat-icon blue">
            <ShoppingBag size={20} />
          </span>
          <div>
            <span>
              {["inventory", "expiry", "customers"].includes(type)
                ? "Total records"
                : "Completed sales"}
            </span>
            <strong>
              {["inventory", "expiry", "customers"].includes(type)
                ? rows.length
                : sales.length}
            </strong>
          </div>
        </div>
        <div className="summary-card">
          <span className="stat-icon orange">
            <Wallet size={20} />
          </span>
          <div>
            <span>
              {type === "tax"
                ? "Tax collected"
                : type === "customers"
                  ? "Outstanding balance"
                  : type === "inventory"
                    ? "Low stock medicines"
                    : type === "expiry"
                      ? "Expired batches"
                      : "Net profit"}
            </span>
            <strong>
              {type === "inventory"
                ? rows.filter((m) => m.currentStock <= m.reorderLevel).length
                : type === "expiry"
                  ? rows.filter((b) => b.daysRemaining <= 0).length
                  : money(
                      type === "tax"
                        ? sum(sales, "tax")
                        : type === "customers"
                          ? sum(rows, "outstandingBalance")
                          : revenue - cost + income - expenses,
                      currency,
                    )}
            </strong>
          </div>
        </div>
      </div>
      {type === "sales" && (
        <section className="card report-chart">
          <div className="card-heading">
            <h2>Daily gross sales (including tax)</h2>
            <span className="muted">
              {from} – {to}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={chart} margin={{ left: 10, right: 30, bottom: 10 }}>
              <CartesianGrid
                stroke="var(--border)"
                vertical={false}
                strokeDasharray="3 3"
              />
              <XAxis
                dataKey="day"
                tickFormatter={(v) =>
                  new Date(v).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                  })
                }
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                formatter={(value) => [
                  money(Number(value) * 100, currency),
                  "Gross sales (including tax)",
                ]}
                contentStyle={{
                  background: "var(--surface)",
                  borderRadius: 10,
                }}
              />
              <Bar
                dataKey="value"
                fill="#168c7b"
                radius={[5, 5, 0, 0]}
                maxBarSize={38}
              />
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}
      <DataTable
        key={type}
        columns={columns}
        rows={rows}
        name={type + "-report"}
      />
      {type === "profit-loss" && (
        <p className="table-note">
          Sales revenue is after discounts and excludes collected sales tax.
          Cost of goods uses the cost captured on sale lines where available,
          otherwise the source batch cost. This is an operational summary, not a
          full accounting statement.
        </p>
      )}
    </div>
  );
}
