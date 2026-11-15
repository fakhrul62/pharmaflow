import ProductImage from "../components/ProductImage";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
  Plus,
  ShoppingBag,
  Package,
  CalendarDays,
  TriangleAlert,
  ReceiptText,
  Truck,
  FileHeart,
  ChevronRight,
  Clock3,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useWorkspace } from "../lib/store";
import {
  money,
  date,
  daysUntil,
  sum,
  today,
  dayKey,
  type Entity,
} from "../lib/api";
import { Badge, Empty, PageHeading } from "../components/ui";
export default function Dashboard() {
  const { data } = useWorkspace();
  const r = data.resources;
  const medicines = r.medicines || [];
  const sales = (r.sales || []).filter(
    (s) => s.status !== "returned" && s.status !== "cancelled",
  );
  const batches = r.batches || [];
  const [period, setPeriod] = useState("7");
  const currency = data.settings.currency;
  const low = medicines.filter(
    (m) => Number(m.currentStock) <= Number(m.reorderLevel),
  );
  const expiry = batches.filter(
    (b) =>
      b.quantity > 0 &&
      daysUntil(b.expiryDate) > 0 &&
      daysUntil(b.expiryDate) <= Number(data.settings.expiryWarningDays || 90),
  );
  const expired = batches.filter(
    (b) => b.quantity > 0 && daysUntil(b.expiryDate) <= 0,
  );
  const salesToday = sales.filter((s) => dayKey(s.createdAt) === today());
  const totalToday = sum(salesToday, "total");
  const inventoryValue = batches.reduce(
    (a, b) => a + Number(b.quantity || 0) * Number(b.purchasePrice || 0),
    0,
  );
  const chart = useMemo(
    () =>
      Array.from({ length: Number(period) }, (_, i) => {
        const day = new Date();
        day.setDate(day.getDate() - (Number(period) - 1 - i));
        const key = dayKey(day);
        const daySales = sales.filter((s) => dayKey(s.createdAt) === key);
        return {
          date: day.toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
          }),
          revenue: sum(daySales, "total") / 100,
          orders: daySales.length,
        };
      }),
    [sales, period],
  );
  const revenue = chart.reduce((a, b) => a + b.revenue * 100, 0);
  const top = Object.values(
    sales
      .flatMap((s) => s.items || [])
      .reduce((acc: Record<string, any>, i: any) => {
        if (!acc[i.medicineId])
          acc[i.medicineId] = {
            id: i.medicineId,
            name: i.medicineName,
            quantity: 0,
            revenue: 0,
          };
        acc[i.medicineId].quantity += Number(i.quantity);
        acc[i.medicineId].revenue += Number(i.total);
        return acc;
      }, {}),
  )
    .sort((a: any, b: any) => b.quantity - a.quantity)
    .slice(0, 4) as any[];
  const stockSegments = [
    {
      name: "Healthy stock",
      value: medicines.filter((m) => m.currentStock > m.reorderLevel).length,
      color: "#138879",
    },
    {
      name: "Running low",
      value: low.filter((m) => m.currentStock > 0).length,
      color: "#edb254",
    },
    {
      name: "Out of stock",
      value: medicines.filter((m) => m.currentStock <= 0).length,
      color: "#e58181",
    },
  ];
  const stats = [
    {
      label: "Today's sales",
      value: money(totalToday, currency),
      sub: `${salesToday.length} completed transactions`,
      icon: Wallet,
      color: "teal",
      link: "/sales/all",
    },
    {
      label: "Inventory value",
      value: money(inventoryValue, currency),
      sub: `Across ${medicines.length} medicines`,
      icon: Package,
      color: "blue",
      link: "/inventory/stock",
    },
    {
      label: "Low stock items",
      value: String(low.length).padStart(2, "0"),
      sub: "Below reorder level",
      icon: TriangleAlert,
      color: "orange",
      link: "/inventory/stock?status=low",
    },
    {
      label: "Expiring soon",
      value: String(expiry.length).padStart(2, "0"),
      sub: `Within ${data.settings.expiryWarningDays || 90} days`,
      icon: CalendarDays,
      color: "pink",
      link: "/inventory/expiry",
    },
  ];
  return (
    <div className="page dashboard-page">
      <PageHeading
        eyebrow="YOUR PHARMACY AT A GLANCE"
        title={`Good ${Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: data.settings.timezone }).format(new Date())) < 12 ? "morning" : Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: data.settings.timezone }).format(new Date())) < 17 ? "afternoon" : "evening"}, ${data.user.name.split(" ")[0]} ☀`}
        description="Here’s what’s happening at your pharmacy today."
      >
        <span className="date-button">
          <CalendarDays size={16} />
          {new Date().toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
            timeZone: data.settings.timezone,
          })}
        </span>
        <Link className="btn primary" to="/sales/pos">
          <Plus size={17} />
          New sale
        </Link>
      </PageHeading>
      {(low.length > 0 || expired.length > 0) && (
        <div className="attention-banner">
          <div className="attention-symbol">
            <TriangleAlert size={20} />
          </div>
          <div>
            <strong>A little attention goes a long way.</strong>
            <span>
              {low.length} medicines are running low
              {expired.length
                ? ` and ${expired.length} batches have expired`
                : ""}
              . Let’s keep your shelves ready.
            </span>
          </div>
          <Link to="/inventory/stock?status=low">
            Review inventory
            <ArrowRight size={16} />
          </Link>
        </div>
      )}
      <div className="stat-grid">
        {stats.map((stat) => (
          <Link to={stat.link} className="stat-card" key={stat.label}>
            <div className="stat-top">
              <span>{stat.label}</span>
              <span className={`stat-icon ${stat.color}`}>
                <stat.icon size={20} />
              </span>
            </div>
            <strong className="stat-value">{stat.value}</strong>
            <div className="stat-bottom">
              <span className={`stat-indicator ${stat.color}`}>
                <span />
              </span>
              <span>{stat.sub}</span>
              <ArrowUpRight size={15} />
            </div>
          </Link>
        ))}
      </div>
      <div className="dashboard-main-grid">
        <section className="card sales-performance">
          <div className="card-heading">
            <div>
              <h2>
                Sales performance<span className="mini-tag">LIVE</span>
              </h2>
              <p>A clearer picture of your daily business.</p>
            </div>
            <select
              aria-label="Sales chart period"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            >
              <option value="7">Last 7 days</option>
              <option value="14">Last 14 days</option>
              <option value="30">Last 30 days</option>
            </select>
          </div>
          <div className="chart-summary">
            <strong>{money(revenue, currency)}</strong>
            <span>
              <TrendingUp size={15} /> {chart.reduce((a, b) => a + b.orders, 0)}{" "}
              sales this period
            </span>
          </div>
          <div className="sales-chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chart}
                margin={{ top: 10, right: 6, left: -12, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#13a38c" stopOpacity={0.19} />
                    <stop offset="100%" stopColor="#13a38c" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  vertical={false}
                  stroke="var(--border)"
                  strokeDasharray="4 4"
                />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "#87959b" }}
                  dy={10}
                  minTickGap={25}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "#87959b" }}
                  tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : `${v}`)}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                    fontSize: 12,
                  }}
                  formatter={(value) => [
                    money(Number(value) * 100, currency),
                    "Sales",
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#168c7b"
                  strokeWidth={2.5}
                  fill="url(#revenueFill)"
                  activeDot={{ r: 5, strokeWidth: 3, stroke: "#fff" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-footer">
            <span>
              <span className="legend-dot" />
              Revenue
            </span>
            <Link to="/reports/sales">
              View sales report
              <ArrowUpRight size={14} />
            </Link>
          </div>
        </section>
        <section className="card inventory-health">
          <div className="card-heading">
            <div>
              <h2>Inventory health</h2>
              <p>Your shelves, at a glance.</p>
            </div>
            <Link
              to="/inventory/stock"
              className="icon-btn"
              aria-label="View stock levels"
            >
              <ArrowUpRight size={18} />
            </Link>
          </div>
          <div className="donut-chart">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stockSegments}
                  dataKey="value"
                  innerRadius="70%"
                  outerRadius="94%"
                  paddingAngle={medicines.length ? 5 : 0}
                  cornerRadius={5}
                  startAngle={90}
                  endAngle={-270}
                  stroke="none"
                >
                  {stockSegments.map((s) => (
                    <Cell key={s.name} fill={s.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 10, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-center">
              <strong>{medicines.length}</strong>
              <span>Total medicines</span>
            </div>
          </div>
          <div className="stock-legends">
            {stockSegments.map((s) => (
              <div key={s.name}>
                <span className="legend-dot" style={{ background: s.color }} />
                <span>{s.name}</span>
                <strong>{s.value}</strong>
                <small>
                  {medicines.length
                    ? Math.round((s.value / medicines.length) * 100)
                    : 0}
                  %
                </small>
              </div>
            ))}
          </div>
          <Link className="card-bottom-link" to="/inventory/medicines">
            Manage inventory
            <ArrowRight size={15} />
          </Link>
        </section>
      </div>
      <div className="quick-action-strip">
        <div>
          <span className="quick-icon">
            <Plus size={20} />
          </span>
          <div>
            <strong>Keep things moving</strong>
            <small>Your everyday shortcuts.</small>
          </div>
        </div>
        {data.user.role !== "cashier" && (
          <Link to="/inventory/medicines?new=1">
            <Plus size={16} />
            Add medicine
          </Link>
        )}
        {data.user.role !== "cashier" && (
          <Link to="/purchases/orders?new=1">
            <Truck size={17} />
            Create purchase
          </Link>
        )}
        <Link to="/customers/all?new=1">
          <Plus size={17} />
          Add customer
        </Link>
        <Link to="/prescriptions/all">
          <FileHeart size={17} />
          Prescriptions
        </Link>
      </div>
      <div className="dashboard-bottom-grid">
        <section className="card recent-sales">
          <div className="card-heading">
            <div>
              <h2>Recent sales</h2>
              <p>The latest activity at your counter.</p>
            </div>
            <Link className="text-link" to="/sales/all">
              View all
              <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>INVOICE / CUSTOMER</th>
                  <th>AMOUNT</th>
                  <th>PAYMENT</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {[...sales]
                  .sort((a, b) =>
                    String(b.createdAt).localeCompare(String(a.createdAt)),
                  )
                  .slice(0, 5)
                  .map((s) => (
                    <tr key={s.id}>
                      <td>
                        <div className="cell-with-icon">
                          <span className="table-icon">
                            <ReceiptText size={17} />
                          </span>
                          <div>
                            <strong>{s.invoiceNumber}</strong>
                            <small>
                              {s.customerName || "Walk-in customer"}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td className="amount-cell">
                        {money(s.total, currency)}
                      </td>
                      <td>
                        <Badge>{s.paymentStatus || "paid"}</Badge>
                      </td>
                      <td>
                        <Link
                          to="/sales/invoices"
                          className="icon-btn"
                          aria-label={`View invoice ${s.invoiceNumber}`}
                        >
                          <ChevronRight size={16} />
                        </Link>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {!sales.length && (
              <Empty
                title="Your next sale starts here"
                action={
                  <Link to="/sales/pos" className="btn primary">
                    Open point of sale
                  </Link>
                }
              />
            )}
          </div>
        </section>
        <section className="card top-selling">
          <div className="card-heading">
            <div>
              <h2>Top selling medicines</h2>
              <p>The favorites on your shelves.</p>
            </div>
            <span className="subtle-pill">All time</span>
          </div>
          <div className="top-products">
            {top.map((m, i) => {
              const med = medicines.find((x) => x.id === m.id);
              return (
                <div className="top-product" key={m.id}>
                  <span className="product-rank">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <ProductImage medicine={med || m} />
                  <div>
                    <strong>{m.name}</strong>
                    <small>{m.quantity} units sold</small>
                  </div>
                  <span>{money(m.revenue, currency)}</span>
                </div>
              );
            })}
            {!top.length && (
              <Empty
                title="Bestsellers are on the way"
                description="Your top medicines will appear after your first sale."
              />
            )}
          </div>
          <Link className="card-bottom-link" to="/reports/inventory">
            Explore inventory insights
            <ArrowRight size={15} />
          </Link>
        </section>
      </div>
      <section className="card expiry-preview">
        <div className="card-heading">
          <div>
            <h2>
              <Clock3 size={17} />
              Expiry watch
            </h2>
            <p>A timely check today means less waste tomorrow.</p>
          </div>
          <Link className="text-link" to="/inventory/expiry">
            View all batches
            <ArrowUpRight size={14} />
          </Link>
        </div>
        <div className="expiry-cards">
          {[...expiry]
            .sort((a, b) =>
              String(a.expiryDate).localeCompare(String(b.expiryDate)),
            )
            .slice(0, 3)
            .map((b) => (
              <Link to="/inventory/expiry" key={b.id} className="expiry-mini">
                <span className="expiry-mini-icon">
                  <CalendarDays size={19} />
                </span>
                <div>
                  <strong>
                    {medicines.find((m) => m.id === b.medicineId)?.name ||
                      b.medicineId}
                  </strong>
                  <small>
                    {b.batchNumber} · {b.quantity} units remaining
                  </small>
                </div>
                <Badge
                  tone={daysUntil(b.expiryDate) <= 30 ? "red" : "amber"}
                >{`${daysUntil(b.expiryDate)} days left`}</Badge>
              </Link>
            ))}
          {!expiry.length && (
            <p className="muted">
              No batches approaching expiry. Your inventory is looking good.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
