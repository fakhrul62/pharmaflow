import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  Search,
  ScanBarcode,
  Plus,
  Minus,
  Trash2,
  ShoppingBag,
  ArrowLeft,
  ArrowRight,
  Pause,
  Play,
  CheckCircle2,
  ShieldCheck,
  CreditCard,
  Banknote,
  Smartphone,
  Building,
  Package,
  FileHeart,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "../lib/store";
import { money, post, daysUntil, type Entity } from "../lib/api";
import { PageHeading, Modal, Busy, Empty, Badge } from "../components/ui";
import ProductImage from "../components/ProductImage";
import Receipt from "../components/Receipt";
type CartLine = { medicineId: string; quantity: number };
type SaleDraft = {
  cart: CartLine[];
  customerId: string;
  prescriptionId: string;
  discount: string;
  paymentMethod: string;
  received: string;
};
export default function POS() {
  const { data, refresh } = useWorkspace();
  const r = data.resources;
  const [params] = useSearchParams();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [prescriptionId, setPrescriptionId] = useState(
    params.get("prescription") || "",
  );
  const [discount, setDiscount] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [received, setReceived] = useState("");
  const [checkout, setCheckout] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<Entity>();
  const [held, setHeld] = useState<SaleDraft | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const requestKey = useRef(crypto.randomUUID());
  const medicines = (r.medicines || []).filter((m) => m.status === "active");
  const eligibleStock = (id: string) =>
    (r.batches || [])
      .filter(
        (b) =>
          b.medicineId === id &&
          b.status === "active" &&
          daysUntil(b.expiryDate) > 0,
      )
      .reduce((a, b) => a + Number(b.quantity), 0);
  const lines = cart
    .map((c) => ({
      ...c,
      medicine: medicines.find((m) => m.id === c.medicineId)!,
    }))
    .filter((c) => c.medicine);
  const subtotal = lines.reduce(
    (a, c) => a + c.quantity * c.medicine.sellingPrice,
    0,
  );
  const discountCents = Math.round(Number(discount || 0) * 100);
  const tax = Math.round(
    (Math.max(0, subtotal - discountCents) *
      Number(data.settings.taxRate || 0)) /
      100,
  );
  const total = Math.max(0, subtotal - discountCents) + tax;
  const rxNeeded = lines.some(
    (c) => c.medicine.requiresPrescription || c.medicine.isControlled,
  );
  const selectedRx = r.prescriptions?.find((p) => p.id === prescriptionId);
  const change = (updater: (prev: CartLine[]) => CartLine[]) => {
    requestKey.current = crypto.randomUUID();
    setCart(updater);
    setError("");
  };
  const restoreDraft = (draft?: SaleDraft) => {
    change(() => draft?.cart.map((line) => ({ ...line })) || []);
    setCustomerId(draft?.customerId || "");
    setPrescriptionId(draft?.prescriptionId || "");
    setDiscount(draft?.discount ?? "0");
    setPaymentMethod(draft?.paymentMethod || "cash");
    setReceived(draft?.received || "");
    setCheckout(false);
  };
  const add = (m: Entity) => {
    if (eligibleStock(m.id) <= 0) {
      toast.error("This medicine has no saleable stock.");
      return;
    }
    change((prev) => {
      const existing = prev.find((c) => c.medicineId === m.id);
      if (existing && existing.quantity >= eligibleStock(m.id)) {
        toast.error("All available units are already in your cart.");
        return prev;
      }
      return existing
        ? prev.map((c) =>
            c.medicineId === m.id ? { ...c, quantity: c.quantity + 1 } : c,
          )
        : [...prev, { medicineId: m.id, quantity: 1 }];
    });
  };
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "F8") {
        e.preventDefault();
        if (cart.length) setCheckout(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [cart]);
  useEffect(() => {
    const rx = r.prescriptions?.find(
      (p) => p.id === params.get("prescription"),
    );
    if (rx && ["verified", "partially-dispensed"].includes(rx.status)) {
      setCustomerId(rx.customerId);
      setCart(
        rx.items
          .filter((i: any) => i.quantity > (i.dispensedQuantity || 0))
          .map((i: any) => ({
            medicineId: i.medicineId,
            quantity: i.quantity - (i.dispensedQuantity || 0),
          })),
      );
    }
  }, []);
  const filtered = medicines.filter(
    (m) =>
      (category === "all" || m.categoryId === category) &&
      `${m.name} ${m.genericName} ${m.barcode} ${m.sku}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <div className="page pos-page">
      <PageHeading
        eyebrow="THE PHARMACY COUNTER"
        title="Point of sale"
        description="A smooth checkout. More time for your customers."
      >
        <Link className="btn secondary" to="/sales/all">
          <ArrowLeft size={16} />
          Sales history
        </Link>
        <span className="pos-shortcut">
          <kbd>F8</kbd> Checkout
        </span>
      </PageHeading>
      <div className="pos-layout">
        <section className="pos-catalog">
          <div className="pos-search search-field">
            <ScanBarcode size={20} />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search medicine, generic name, or scan barcode…"
              aria-label="Search medicines for sale"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const exact = medicines.find(
                    (m) => m.barcode === search || m.sku === search,
                  );
                  if (exact) {
                    add(exact);
                    setSearch("");
                  }
                }
              }}
            />
            <kbd>Ctrl F</kbd>
          </div>
          <div className="category-tabs">
            <button
              className={category === "all" ? "selected" : ""}
              onClick={() => setCategory("all")}
            >
              All medicines<span>{medicines.length}</span>
            </button>
            {r.categories?.map((c) => (
              <button
                className={category === c.id ? "selected" : ""}
                key={c.id}
                onClick={() => setCategory(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>
          <div className="catalog-header">
            <span>{filtered.length} medicines available</span>
            <span>
              <span className="live-dot" />
              Batch-aware stock
            </span>
          </div>
          <div className="product-grid">
            {filtered.map((m) => {
              const stock = eligibleStock(m.id);
              return (
                <button
                  key={m.id}
                  className={`product-card ${stock <= 0 ? "unavailable" : ""}`}
                  onClick={() => add(m)}
                  disabled={stock <= 0}
                >
                  <div className="product-card-top">
                    {m.requiresPrescription || m.isControlled ? (
                      <span className="rx-label">Rx</span>
                    ) : (
                      <span className="otc-label">OTC</span>
                    )}
                    <span
                      className={
                        stock <= m.reorderLevel ? "stock-low" : "stock-normal"
                      }
                    >
                      <span />
                      {stock} in stock
                    </span>
                  </div>
                  <div className="product-hero">
                    <ProductImage medicine={m} />
                  </div>
                  <div className="product-copy">
                    <small>
                      {r.categories?.find((c) => c.id === m.categoryId)?.name}
                    </small>
                    <strong>{m.name}</strong>
                    <span>
                      {m.genericName} · {m.unit || m.dosageForm}
                    </span>
                  </div>
                  <div className="product-card-bottom">
                    <strong>
                      {money(m.sellingPrice, data.settings.currency)}
                      <small>/ unit</small>
                    </strong>
                    <span className="product-add">
                      <Plus size={18} />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          {!filtered.length && (
            <Empty
              title="No medicines match your search"
              description="Try a generic name, SKU, or a different category."
            />
          )}
        </section>
        <aside className="cart-panel">
          <div className="cart-header">
            <h2>
              <ShoppingBag size={20} />
              Current sale
              <span>{cart.reduce((a, c) => a + c.quantity, 0)}</span>
            </h2>
            <button
              className="icon-btn"
              aria-label="Clear cart"
              disabled={!cart.length}
              onClick={() => restoreDraft()}
            >
              <Trash2 size={17} />
            </button>
          </div>
          <div className="cart-customer">
            <label>
              Customer
              <select
                value={customerId}
                onChange={(e) => {
                  setCustomerId(e.target.value);
                  requestKey.current = crypto.randomUUID();
                }}
              >
                <option value="">Walk-in customer</option>
                {r.customers
                  ?.filter((c) => c.status === "active")
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `· ${c.phone}` : ""}
                    </option>
                  ))}
              </select>
            </label>
            <Link
              to="/customers/all?new=1"
              aria-label="Add a customer"
              className="icon-btn"
            >
              <Plus size={19} />
            </Link>
          </div>
          <div className="cart-lines">
            {lines.map((c) => (
              <div className="cart-line" key={c.medicineId}>
                <ProductImage medicine={c.medicine} />
                <div className="cart-line-copy">
                  <strong>{c.medicine.name}</strong>
                  <small>
                    {money(c.medicine.sellingPrice, data.settings.currency)} /
                    unit
                  </small>
                  <div className="quantity-control">
                    <button
                      aria-label={`Decrease ${c.medicine.name}`}
                      onClick={() =>
                        change((prev) =>
                          prev
                            .map((l) =>
                              l.medicineId === c.medicineId
                                ? { ...l, quantity: l.quantity - 1 }
                                : l,
                            )
                            .filter((l) => l.quantity > 0),
                        )
                      }
                    >
                      <Minus size={13} />
                    </button>
                    <span>{c.quantity}</span>
                    <button
                      aria-label={`Increase ${c.medicine.name}`}
                      disabled={c.quantity >= eligibleStock(c.medicineId)}
                      onClick={() => add(c.medicine)}
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
                <div className="cart-line-end">
                  <strong>
                    {money(
                      c.quantity * c.medicine.sellingPrice,
                      data.settings.currency,
                    )}
                  </strong>
                  <button
                    className="icon-btn"
                    aria-label={`Remove ${c.medicine.name}`}
                    onClick={() =>
                      change((prev) =>
                        prev.filter((l) => l.medicineId !== c.medicineId),
                      )
                    }
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
            {!lines.length && (
              <Empty
                title="Ready for your next customer"
                description="Choose a medicine or scan a barcode to start a sale."
              />
            )}
          </div>
          {(rxNeeded || prescriptionId) && (
            <div className="cart-prescription">
              <label>
                <FileHeart size={15} />
                Verified prescription
                <select
                  aria-label="Select verified prescription"
                  value={prescriptionId}
                  onChange={(e) => {
                    const rx = r.prescriptions.find(
                      (p) => p.id === e.target.value,
                    );
                    setPrescriptionId(e.target.value);
                    if (rx) setCustomerId(rx.customerId);
                    requestKey.current = crypto.randomUUID();
                  }}
                >
                  <option value="">Select prescription…</option>
                  {r.prescriptions
                    ?.filter(
                      (p) =>
                        p.status === "verified" ||
                        p.status === "partially-dispensed",
                    )
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.reference} ·{" "}
                        {r.customers?.find((c) => c.id === p.customerId)?.name}
                      </option>
                    ))}
                </select>
              </label>
              {selectedRx && (
                <small>
                  {selectedRx.prescriberName} · valid to {selectedRx.expiryDate}
                </small>
              )}
            </div>
          )}
          <div className="cart-summary">
            <p>
              <span>Subtotal</span>
              <strong>{money(subtotal, data.settings.currency)}</strong>
            </p>
            <label className="discount-row">
              <span>Discount ({data.settings.currency})</span>
              <input
                aria-label="Discount amount"
                type="number"
                min="0"
                step="0.01"
                max={subtotal / 100}
                value={discount}
                onChange={(e) => {
                  setDiscount(e.target.value);
                  requestKey.current = crypto.randomUUID();
                }}
              />
            </label>
            <p>
              <span>Tax ({data.settings.taxRate || 0}%)</span>
              <strong>{money(tax, data.settings.currency)}</strong>
            </p>
            <div className="cart-grand-total">
              <span>Total due</span>
              <strong>{money(total, data.settings.currency)}</strong>
            </div>
            <button
              className="btn primary checkout-button"
              disabled={
                !lines.length ||
                discountCents > subtotal ||
                discountCents < 0 ||
                (rxNeeded && !prescriptionId)
              }
              onClick={() => {
                if (!received) setReceived((total / 100).toFixed(2));
                setError("");
                setCheckout(true);
              }}
            >
              Continue to payment
              <ArrowRight size={18} />
            </button>
            <div className="hold-controls">
              <button
                className="btn subtle"
                disabled={!cart.length || !!held}
                onClick={() => {
                  setHeld({
                    cart: cart.map((line) => ({ ...line })),
                    customerId,
                    prescriptionId,
                    discount,
                    paymentMethod,
                    received,
                  });
                  restoreDraft();
                  toast.success("Sale held for this session");
                }}
              >
                <Pause size={15} />
                Hold sale
              </button>
              <button
                className="btn subtle"
                disabled={!held || !!cart.length}
                onClick={() => {
                  if (held) restoreDraft(held);
                  setHeld(null);
                }}
              >
                <Play size={15} />
                Resume{held ? " (1)" : ""}
              </button>
            </div>
            <p className="checkout-note">
              <ShieldCheck size={13} />
              Stock verified securely at checkout
            </p>
          </div>
        </aside>
      </div>
      <Modal
        open={checkout}
        onClose={() => {
          if (!busy) setCheckout(false);
        }}
        title="Complete the sale"
        description="Record the payment and confirm this transaction."
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const cashReceived = Math.round(Number(received) * 100);
              if (cashReceived < total)
                throw new Error("Enter an amount that covers the total due.");
              const sale = await post<Entity>("/operations/checkout", {
                items: cart,
                customerId: customerId || undefined,
                prescriptionId: prescriptionId || undefined,
                discount: discountCents,
                paymentMethod,
                amountPaid: total,
                idempotencyKey: requestKey.current,
              });
              await refresh();
              setReceipt({ ...sale, amountReceived: cashReceived });
              setCheckout(false);
              restoreDraft();
              toast.success("Sale completed. Stock updated.");
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="form-body">
            <div className="payment-total">
              <span>Total due</span>
              <strong>{money(total, data.settings.currency)}</strong>
            </div>
            <div className="payment-methods">
              {[
                { key: "cash", label: "Cash", icon: Banknote },
                { key: "card", label: "Card", icon: CreditCard },
                { key: "mobile", label: "Mobile", icon: Smartphone },
                { key: "bank-transfer", label: "Bank", icon: Building },
              ].map((method) => (
                <button
                  type="button"
                  key={method.key}
                  className={paymentMethod === method.key ? "selected" : ""}
                  onClick={() => {
                    setPaymentMethod(method.key);
                    requestKey.current = crypto.randomUUID();
                  }}
                >
                  <method.icon size={22} />
                  {method.label}
                </button>
              ))}
            </div>
            <label>
              Amount received ({data.settings.currency})
              <input
                type="number"
                min={total / 100}
                step="0.01"
                required
                value={received}
                onChange={(e) => setReceived(e.target.value)}
              />
            </label>
            {Number(received) * 100 > total && (
              <div className="change-due">
                <span>Change to return</span>
                <strong>
                  {money(
                    Math.round(Number(received) * 100) - total,
                    data.settings.currency,
                  )}
                </strong>
              </div>
            )}
            <p className="info-note">
              This records a payment. Process card, bank, or mobile payments on
              your payment terminal before confirming.
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
              type="button"
              disabled={busy}
              onClick={() => setCheckout(false)}
            >
              Back to cart
            </button>
            <button className="btn primary" disabled={busy}>
              {busy ? (
                <Busy label="Completing sale…" />
              ) : (
                <>
                  <CheckCircle2 size={17} />
                  Complete sale
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>
      <Modal
        open={!!receipt}
        onClose={() => setReceipt(undefined)}
        title="Your receipt is ready"
        description="Print or save the receipt for your customer."
      >
        {receipt && <Receipt sale={receipt} />}
      </Modal>
    </div>
  );
}
