import { useState, useEffect, useMemo } from "react";
import { useLocation, useSearchParams, Link } from "react-router-dom";
import {
  Plus,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  ArrowUpRight,
  Package,
  CalendarClock,
  Boxes,
  TriangleAlert,
  Check,
  Truck,
  RotateCcw,
  Printer,
  ArrowRightLeft,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { useWorkspace } from "../lib/store";
import {
  api,
  post,
  money,
  date,
  daysUntil,
  today,
  sum,
  type Entity,
} from "../lib/api";
import { routeConfig, labels, moneyFields, references } from "../lib/resources";
import {
  PageHeading,
  DataTable,
  Modal,
  Badge,
  Busy,
  Empty,
} from "../components/ui";
import ResourceForm from "../components/ResourceForm";
import Receipt from "../components/Receipt";
import ProductImage from "../components/ProductImage";
type Operation = { kind: string; title: string; record?: Entity };
export default function ResourcePage() {
  const location = useLocation();
  return <ResourceView key={location.pathname} path={location.pathname} />;
}
function ResourceView({ path }: { path: string }) {
  const { data, refresh } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const config = routeConfig(path);
  const r = data.resources;
  const role = data.user.role;
  const canWrite =
    !config.readonly &&
    (!config.roles || config.roles.includes(role)) &&
    (role !== "cashier" || config.resource === "customers");
  const isStock = path.endsWith("/stock");
  const isExpiry = path.endsWith("/expiry");
  const isBarcode = path.endsWith("/barcodes");
  const isInvoices = path.endsWith("/invoices");
  const isReceived = path.endsWith("/goods-received");
  const isHistory = path === "/prescriptions/history";
  const registerPage = config.resource === "cash-registers";
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Entity | undefined>();
  const [detail, setDetail] = useState<Entity | undefined>();
  const [deleting, setDeleting] = useState<Entity | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [operation, setOperation] = useState<Operation | undefined>();
  const [statusFilter, setStatusFilter] = useState(
    params.get("status") || "all",
  );
  const [category, setCategory] = useState("all");
  useEffect(() => {
    if (params.get("new") === "1" && canWrite) {
      setCreating(true);
      const next = new URLSearchParams(params);
      next.delete("new");
      setParams(next, { replace: true });
    }
  }, []);
  const title = isStock
    ? "Stock levels"
    : isExpiry
      ? "Expiry watch"
      : isBarcode
        ? "Barcode management"
        : isInvoices
          ? "Invoices"
          : isReceived
            ? "Goods received"
            : isHistory
              ? "Dispensing history"
              : path === "/customers/transactions"
                ? "Customer transactions"
                : path === "/finance/transactions"
                  ? "Financial transactions"
                  : config.title;
  const rows = (r[config.resource] || []).filter((row) => {
    if (isReceived && row.status !== "received" && row.status !== "returned")
      return false;
    if (isHistory && !["dispensed", "partially-dispensed"].includes(row.status))
      return false;
    if (category !== "all" && row.categoryId !== category) return false;
    if (isExpiry) {
      const days = daysUntil(row.expiryDate);
      if (statusFilter === "expired") return days <= 0 && row.quantity > 0;
      if (statusFilter === "30")
        return days > 0 && days <= 30 && row.quantity > 0;
      if (statusFilter === "90" || statusFilter === "all")
        return (
          days <= Number(data.settings.expiryWarningDays || 90) &&
          row.quantity > 0
        );
    }
    if (statusFilter === "low") return row.currentStock <= row.reorderLevel;
    if (statusFilter === "out") return row.currentStock === 0;
    return (
      statusFilter === "all" ||
      row.status === statusFilter ||
      row.paymentStatus === statusFilter
    );
  });
  const label = (key: string, value: unknown) => {
    const linked = r[references[key]]?.find((e) => e.id === value);
    return (
      linked?.name ||
      linked?.batchNumber ||
      linked?.invoiceNumber ||
      linked?.reference ||
      value ||
      "—"
    );
  };
  const canEditRecord = (row: Entity) =>
    canWrite &&
    config.resource !== "payments" &&
    !(
      config.resource === "purchases" &&
      (row.status !== "ordered" || row.paymentStatus === "paid")
    ) &&
    !(
      config.resource === "prescriptions" &&
      ["verified", "dispensed"].includes(row.status)
    );
  const canDeleteRecord = (row: Entity) =>
    canEditRecord(row) &&
    role !== "cashier" &&
    !["expenses", "income"].includes(config.resource);
  const format = (key: string, value: any): any => {
    if (value === undefined || value === null || value === "") return "—";
    if (moneyFields.has(key)) return money(value, data.settings.currency);
    if (references[key]) return label(key, value);
    if (/Date$|At$|^date$|Until$/.test(key)) return date(value);
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (Array.isArray(value)) return value.join(", ");
    return String(value);
  };
  const cols = isStock
    ? ["name", "sku", "currentStock", "reorderLevel", "sellingPrice", "status"]
    : isBarcode
      ? ["name", "sku", "barcode", "status"]
      : config.columns;
  const columns: ColumnDef<Entity, any>[] = cols.map((key) => ({
    id: key,
    accessorFn: (row) => (references[key] ? label(key, row[key]) : row[key]),
    header:
      (key === "name" && config.resource !== "medicines"
        ? "Name"
        : labels[key]) ||
      key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()),
    cell: ({ row, getValue }) => {
      if (key === "name")
        return (
          <div className="cell-with-icon">
            {config.resource === "medicines" ? (
              <ProductImage medicine={row.original} />
            ) : (
              <span className="table-avatar">
                {String(getValue() || "?")
                  .slice(0, 2)
                  .toUpperCase()}
              </span>
            )}
            <div>
              <button
                className="cell-title"
                onClick={() => setDetail(row.original)}
              >
                {getValue()}
              </button>
              <small>
                {row.original.genericName ||
                  row.original.email ||
                  row.original.description?.slice(0, 45)}
              </small>
            </div>
          </div>
        );
      if (["status", "paymentStatus", "type", "role"].includes(key))
        return (
          <Badge>
            {isStock && key === "status"
              ? row.original.currentStock === 0
                ? "out of stock"
                : row.original.currentStock <= row.original.reorderLevel
                  ? "low stock"
                  : "healthy"
              : getValue()}
          </Badge>
        );
      if (key === "currentStock")
        return (
          <span
            className={
              row.original.currentStock <= row.original.reorderLevel
                ? "stock-low"
                : "stock-normal"
            }
          >
            <span />
            {getValue()}
            <small className="unit-inline">
              {row.original.unit || "units"}
            </small>
          </span>
        );
      if (key === "expiryDate")
        return (
          <div>
            <span>{date(getValue())}</span>
            {daysUntil(getValue()) <= 0 ? (
              <small className="danger-text">Expired</small>
            ) : daysUntil(getValue()) <= 90 ? (
              <small className="warning-text">
                {daysUntil(getValue())} days left
              </small>
            ) : null}
          </div>
        );
      if (key === "barcode")
        return (
          <button
            className="barcode-button"
            onClick={() => setDetail(row.original)}
          >
            <span className="barcode-visual" aria-hidden="true" />
            {getValue()}
          </button>
        );
      if (moneyFields.has(key))
        return <span className="amount-cell">{format(key, getValue())}</span>;
      return <span>{format(key, getValue())}</span>;
    },
  }));
  columns.push({
    id: "actions",
    header: "",
    enableSorting: false,
    cell: ({ row }) => (
      <div className="row-actions">
        <button
          className="icon-btn"
          aria-label={`View ${row.original.name || row.original.reference || "record"}`}
          onClick={() => setDetail(row.original)}
        >
          <Eye size={16} />
        </button>
        {canEditRecord(row.original) && !isStock && !isBarcode && !isExpiry && (
          <>
            <button
              className="icon-btn"
              aria-label={`Edit ${row.original.name || row.original.reference || "record"}`}
              onClick={() => setEditing(row.original)}
            >
              <Pencil size={15} />
            </button>
            {canDeleteRecord(row.original) && (
              <button
                className="icon-btn danger-text"
                aria-label={`Delete ${row.original.name || row.original.reference || "record"}`}
                onClick={() => setDeleting(row.original)}
              >
                <Trash2 size={15} />
              </button>
            )}
          </>
        )}
        {config.resource === "purchases" &&
          role !== "cashier" &&
          row.original.status === "ordered" && (
            <button
              className="btn small secondary"
              onClick={() =>
                setOperation({
                  kind: "receive",
                  title: "Receive purchase",
                  record: row.original,
                })
              }
            >
              <Truck size={14} />
              Receive
            </button>
          )}
        {config.resource === "prescriptions" &&
          role !== "cashier" &&
          row.original.status === "pending" && (
            <button
              className="btn small secondary"
              onClick={() =>
                setOperation({
                  kind: "verify-prescription",
                  title: "Verify prescription",
                  record: row.original,
                })
              }
            >
              <ShieldCheck size={14} />
              Verify
            </button>
          )}
      </div>
    ),
  });
  const startOperation = (kind: string, title: string, record?: Entity) => {
    setError("");
    setOperation({ kind, title, record });
  };
  if (
    !r[config.resource] &&
    [
      "staff",
      "roles",
      "audit",
      "purchases",
      "suppliers",
      "expenses",
      "income",
      "payments",
    ].includes(config.resource)
  )
    return (
      <div className="page">
        <PageHeading
          title="This area is restricted"
          description="Your role does not have access to these records."
        />
        <Link to="/dashboard" className="btn primary">
          Back to overview
        </Link>
      </div>
    );
  return (
    <div className="page">
      <PageHeading
        eyebrow={path.split("/")[1].toUpperCase()}
        title={title}
        description={
          isStock
            ? "Know what’s on the shelf, and what needs reordering."
            : isExpiry
              ? "Stay ahead of expiry dates and reduce preventable waste."
              : config.description
        }
      >
        <button className="btn secondary" onClick={() => window.print()}>
          <Printer size={16} />
          Print
        </button>
        {config.resource === "sales" ? (
          <Link to="/sales/pos" className="btn primary">
            <Plus size={17} />
            New sale
          </Link>
        ) : config.resource === "adjustments" && role !== "cashier" ? (
          <button
            className="btn primary"
            onClick={() => startOperation("adjust", "Adjust stock")}
          >
            <Plus size={17} />
            New adjustment
          </button>
        ) : config.resource === "transfers" && role !== "cashier" ? (
          <button
            className="btn primary"
            onClick={() => startOperation("transfer", "Transfer stock")}
          >
            <ArrowRightLeft size={17} />
            Transfer stock
          </button>
        ) : registerPage ? (
          <button
            className="btn primary"
            onClick={() =>
              startOperation(
                "cash-register",
                (r["cash-registers"] || []).some(
                  (reg) =>
                    reg.status === "open" &&
                    (role === "admin" || reg.cashierName === data.user.name),
                )
                  ? "Close cash register"
                  : "Open cash register",
              )
            }
          >
            <Plus size={17} />
            Manage shift
          </button>
        ) : (
          canWrite &&
          !isStock &&
          !isExpiry &&
          !isBarcode &&
          !isReceived &&
          !isHistory && (
            <button className="btn primary" onClick={() => setCreating(true)}>
              <Plus size={17} />
              Add {config.singular}
            </button>
          )
        )}
      </PageHeading>
      {config.resource === "medicines" && (
        <div className="summary-grid">
          <Summary
            label="Total medicines"
            value={String(r.medicines?.length || 0)}
            icon="box"
          />
          <Summary
            label="Healthy stock"
            value={String(
              (r.medicines || []).filter((m) => m.currentStock > m.reorderLevel)
                .length,
            )}
            icon="good"
          />
          <Summary
            label="Running low"
            value={String(
              (r.medicines || []).filter(
                (m) => m.currentStock > 0 && m.currentStock <= m.reorderLevel,
              ).length,
            )}
            icon="warn"
          />
          <Summary
            label="Out of stock"
            value={String(
              (r.medicines || []).filter((m) => m.currentStock <= 0).length,
            )}
            icon="warn"
          />
        </div>
      )}
      {isExpiry && (
        <div className="summary-grid">
          <Summary
            label="Expired batches"
            value={String(
              (r.batches || []).filter(
                (b) => daysUntil(b.expiryDate) <= 0 && b.quantity > 0,
              ).length,
            )}
            icon="warn"
          />
          <Summary
            label="Within 30 days"
            value={String(
              (r.batches || []).filter(
                (b) =>
                  daysUntil(b.expiryDate) > 0 &&
                  daysUntil(b.expiryDate) <= 30 &&
                  b.quantity > 0,
              ).length,
            )}
            icon="warn"
          />
          <Summary
            label="Within 90 days"
            value={String(
              (r.batches || []).filter(
                (b) =>
                  daysUntil(b.expiryDate) > 0 &&
                  daysUntil(b.expiryDate) <= 90 &&
                  b.quantity > 0,
              ).length,
            )}
            icon="box"
          />
          <Summary
            label="Value at risk"
            value={money(
              (r.batches || [])
                .filter((b) => daysUntil(b.expiryDate) <= 90)
                .reduce((a, b) => a + b.quantity * b.purchasePrice, 0),
              data.settings.currency,
            )}
            icon="box"
          />
        </div>
      )}
      {["sales", "purchases", "payments", "expenses", "income"].includes(
        config.resource,
      ) && (
        <div className="summary-grid three">
          <Summary
            label="Total records"
            value={String(rows.length)}
            icon="box"
          />
          <Summary
            label={config.resource === "sales" ? "Sales value" : "Total value"}
            value={money(
              sum(
                rows.filter((row) => row.status !== "returned"),
                config.resource === "payments" ||
                  config.resource === "expenses" ||
                  config.resource === "income"
                  ? "amount"
                  : "total",
              ),
              data.settings.currency,
            )}
            icon="good"
          />
          <Summary
            label="Pending / unpaid"
            value={String(
              rows.filter(
                (row) =>
                  row.paymentStatus === "unpaid" ||
                  row.paymentStatus === "partial" ||
                  row.status === "pending" ||
                  row.status === "ordered",
              ).length,
            )}
            icon="warn"
          />
        </div>
      )}
      <DataTable
        key={path + params.get("q")}
        rows={rows}
        columns={columns}
        name={title.toLowerCase().replaceAll(" ", "-")}
        initialSearch={params.get("q") || ""}
        placeholder={`Search ${title.toLowerCase()}…`}
        extra={
          <>
            {config.resource === "medicines" && (
              <select
                aria-label="Filter category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="all">All categories</option>
                {r.categories?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
            {(config.columns.includes("status") || isStock || isExpiry) && (
              <select
                aria-label="Filter status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">
                  {isExpiry ? "Needs attention" : "All statuses"}
                </option>
                {(isExpiry
                  ? ["expired", "30", "90"]
                  : isStock
                    ? ["low", "out"]
                    : config.resource === "sales"
                      ? ["completed", "returned", "paid", "partial", "unpaid"]
                      : config.resource === "purchases"
                        ? ["ordered", "received", "returned"]
                        : ["active", "inactive"]
                ).map((s) => (
                  <option key={s} value={s}>
                    {s === "30"
                      ? "Next 30 days"
                      : s === "90"
                        ? "Next 90 days"
                        : s === "low"
                          ? "Low stock"
                          : s === "out"
                            ? "Out of stock"
                            : s[0].toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            )}
          </>
        }
      />
      {config.resource === "medicines" && (
        <p className="table-note">
          <Boxes size={15} />
          Stock is calculated from batch quantities. Use receiving or
          adjustments to make changes.
        </p>
      )}
      <Modal
        open={creating || !!editing}
        onClose={() => {
          setCreating(false);
          setEditing(undefined);
        }}
        title={`${editing ? "Edit" : "Add"} ${config.singular}`}
        description={config.description}
        wide
      >
        <ResourceForm
          key={editing?.id || String(creating)}
          config={config}
          entity={editing}
          onSaved={() => {
            setCreating(false);
            setEditing(undefined);
          }}
          onCancel={() => {
            setCreating(false);
            setEditing(undefined);
          }}
        />
      </Modal>
      <Modal
        open={!!detail}
        onClose={() => setDetail(undefined)}
        title={
          detail?.name ||
          detail?.invoiceNumber ||
          detail?.reference ||
          `${config.singular} details`
        }
        wide
      >
        {detail &&
          (config.resource === "sales" ? (
            <Receipt sale={detail} />
          ) : (
            <div className="form-body">
              <div className="detail-grid">
                {Object.entries(detail)
                  .filter(
                    ([k, v]) =>
                      ![
                        "items",
                        "id",
                        "password",
                        "passwordHash",
                        "image",
                      ].includes(k) &&
                      v !== null &&
                      typeof v !== "object",
                  )
                  .map(([key, value]) => (
                    <div key={key}>
                      <small>
                        {labels[key] || key.replace(/([A-Z])/g, " $1")}
                      </small>
                      <strong>{format(key, value)}</strong>
                    </div>
                  ))}
              </div>
              {detail.items && (
                <div className="detail-lines">
                  <h3>Medicines</h3>
                  {detail.items.map((i: any, index: number) => (
                    <div key={index}>
                      <span>
                        {label("medicineId", i.medicineId)}
                        <small>{i.batchNumber || i.dosage}</small>
                      </span>
                      <span>× {i.quantity}</span>
                      {i.unitPrice !== undefined && (
                        <strong>
                          {money(
                            i.total ?? i.quantity * i.unitPrice,
                            data.settings.currency,
                          )}
                        </strong>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {config.resource === "roles" && (
                <div className="permission-list">
                  {(detail.permissions || []).map((p: string) => (
                    <Badge key={p}>{p}</Badge>
                  ))}
                </div>
              )}
              {isBarcode && (
                <div className="barcode-detail">
                  <Barcode value={detail.barcode} />
                  <p>{detail.barcode}</p>
                  <button
                    className="btn secondary"
                    onClick={() => window.print()}
                  >
                    <Printer size={16} />
                    Print label
                  </button>
                </div>
              )}
            </div>
          ))}
        {detail && (
          <div className="dialog-footer">
            {canEditRecord(detail) && !isStock && !isExpiry && !isBarcode && (
              <button
                className="btn secondary"
                onClick={() => {
                  setEditing(detail);
                  setDetail(undefined);
                }}
              >
                <Pencil size={15} />
                Edit record
              </button>
            )}
            {config.resource === "sales" &&
              detail.status !== "returned" &&
              role !== "cashier" && (
                <button
                  className="btn secondary"
                  onClick={() =>
                    startOperation("sales-return", "Return sale", detail)
                  }
                >
                  <RotateCcw size={15} />
                  Return sale
                </button>
              )}
            {config.resource === "purchases" &&
              detail.status === "received" && (
                <button
                  className="btn secondary"
                  onClick={() =>
                    startOperation("purchase-return", "Return purchase", detail)
                  }
                >
                  <RotateCcw size={15} />
                  Return purchase
                </button>
              )}
            {config.resource === "prescriptions" &&
              detail.status === "verified" && (
                <Link
                  className="btn primary"
                  to={`/sales/pos?prescription=${detail.id}`}
                  onClick={() => setDetail(undefined)}
                >
                  Dispense in POS
                  <ArrowUpRight size={16} />
                </Link>
              )}
          </div>
        )}
      </Modal>
      <Modal
        open={!!deleting}
        onClose={() => {
          if (!busy) setDeleting(undefined);
        }}
        title={`Delete ${config.singular}?`}
        description="Linked transaction records are protected from deletion."
      >
        <div className="form-body">
          <p>
            Delete{" "}
            <strong>
              {deleting?.name || deleting?.reference || "this record"}
            </strong>
            ? This removes it from your workspace.
          </p>
          {error && (
            <div role="alert" className="error-banner">
              {error}
            </div>
          )}
        </div>
        <div className="dialog-footer">
          <button
            className="btn secondary"
            onClick={() => setDeleting(undefined)}
            disabled={busy}
          >
            Keep record
          </button>
          <button
            className="btn danger"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await api(`/resources/${config.resource}/${deleting!.id}`, {
                  method: "DELETE",
                });
                await refresh();
                toast.success("Record deleted");
                setDeleting(undefined);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? <Busy /> : "Delete record"}
          </button>
        </div>
      </Modal>
      <Modal
        open={!!operation}
        onClose={() => {
          if (!busy) {
            setOperation(undefined);
            setError("");
          }
        }}
        title={operation?.title || "Update record"}
        description="This action updates connected stock and financial records."
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!operation) return;
            const values = Object.fromEntries(new FormData(e.currentTarget));
            const body: Record<string, any> = { ...values };
            if (["receive", "purchase-return"].includes(operation.kind))
              body.purchaseId = operation.record!.id;
            if (operation.kind === "sales-return") {
              body.saleId = operation.record!.id;
              body.restock = values.restock === "on";
            }
            if (operation.kind === "verify-prescription")
              body.prescriptionId = operation.record!.id;
            if (
              ["receive", "sales-return", "purchase-return"].includes(
                operation.kind,
              )
            )
              body.idempotencyKey = crypto.randomUUID();
            if (body.quantityChange !== undefined)
              body.quantityChange = Number(body.quantityChange);
            if (body.quantity !== undefined)
              body.quantity = Number(body.quantity);
            if (body.amount !== undefined)
              body.amount = Math.round(Number(body.amount) * 100);
            if (operation.kind === "adjust") {
              const b = r.batches.find((b) => b.id === body.batchId);
              body.medicineId = b?.medicineId;
            }
            setBusy(true);
            setError("");
            try {
              await post(`/operations/${operation.kind}`, body);
              await refresh();
              toast.success(`${operation.title} completed`);
              setOperation(undefined);
              setDetail(undefined);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="form-body">
            <div className="form-grid">
              {["adjust", "transfer"].includes(operation?.kind || "") && (
                <>
                  <label className="full-width">
                    Source batch
                    <select name="batchId" required>
                      <option value="">Select a batch…</option>
                      {r.batches?.map((b) => (
                        <option key={b.id} value={b.id}>
                          {label("medicineId", b.medicineId)} · {b.batchNumber}{" "}
                          · {b.quantity} units · {b.location}
                        </option>
                      ))}
                    </select>
                  </label>
                  {operation?.kind === "adjust" ? (
                    <label className="full-width">
                      Quantity change
                      <input
                        name="quantityChange"
                        type="number"
                        step="1"
                        required
                        placeholder="e.g. -5 for damaged stock, 5 for a correction"
                      />
                    </label>
                  ) : (
                    <>
                      <label>
                        Quantity
                        <input
                          name="quantity"
                          type="number"
                          min="1"
                          step="1"
                          required
                        />
                      </label>
                      <label>
                        Destination location
                        <input
                          name="destination"
                          required
                          placeholder="e.g. Shelf B-2"
                        />
                      </label>
                    </>
                  )}
                </>
              )}
              {operation?.kind === "cash-register" && (
                <>
                  <label>
                    Action
                    <select name="action">
                      <option value="open">Open shift</option>
                      <option value="close">Close shift</option>
                    </select>
                  </label>
                  <label>
                    Cash amount
                    <input
                      name="amount"
                      type="number"
                      min="0"
                      step="0.01"
                      required
                    />
                  </label>
                  <p className="info-note full-width">
                    Opening: enter the float. Closing: enter the cash counted.
                  </p>
                </>
              )}
              {[
                "sales-return",
                "purchase-return",
                "adjust",
                "transfer",
              ].includes(operation?.kind || "") && (
                <label className="full-width">
                  Reason
                  <textarea
                    name="reason"
                    required
                    minLength={3}
                    placeholder="Explain the reason for this change"
                  />
                </label>
              )}
              {operation?.kind === "sales-return" && (
                <label className="checkbox-field full-width">
                  <input name="restock" type="checkbox" />
                  <span>
                    Restock eligible returned items (confirm physical condition
                    first)
                  </span>
                </label>
              )}
              {operation?.kind === "receive" && (
                <p className="info-note full-width">
                  <Truck size={18} />
                  Receive all items in {operation.record?.reference}. Stock is
                  added once to the specified batches.
                </p>
              )}
              {operation?.kind === "verify-prescription" && (
                <p className="info-note full-width">
                  <ShieldCheck size={18} />
                  Confirm that you have reviewed this prescription’s details,
                  prescriber, dates, and medicines before verifying.
                </p>
              )}
            </div>
            {error && (
              <div role="alert" className="error-banner">
                {error}
              </div>
            )}
          </div>
          <div className="dialog-footer">
            <button
              type="button"
              className="btn secondary"
              disabled={busy}
              onClick={() => setOperation(undefined)}
            >
              Cancel
            </button>
            <button className="btn primary" disabled={busy}>
              {busy ? (
                <Busy />
              ) : (
                "Confirm " + (operation?.title.toLowerCase() || "action")
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
function Summary({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: string;
}) {
  const Icon =
    icon === "warn" ? TriangleAlert : icon === "good" ? Check : Package;
  return (
    <div className="summary-card">
      <span className={`stat-icon ${icon === "warn" ? "orange" : "teal"}`}>
        <Icon size={19} />
      </span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}
function Barcode({ value }: { value: string }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    import("jsbarcode").then(({ default: JsBarcode }) => {
      const el = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      try {
        JsBarcode(el, value, {
          format: "CODE128",
          width: 2,
          height: 65,
          displayValue: false,
          margin: 15,
        });
        setSvg(el.outerHTML);
      } catch {
        setSvg("");
      }
    });
  }, [value]);
  return svg ? (
    <div className="actual-barcode" dangerouslySetInnerHTML={{ __html: svg }} />
  ) : (
    <p>Unable to generate this barcode.</p>
  );
}
