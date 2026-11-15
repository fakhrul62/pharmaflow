import { Printer, CheckCircle2, Plus } from "lucide-react";
import { money, date, type Entity } from "../lib/api";
import { useWorkspace } from "../lib/store";
export default function Receipt({ sale }: { sale: Entity }) {
  const { data } = useWorkspace();
  const s = data.settings;
  const returned = sale.status === "returned";
  const cancelled = returned || sale.status === "cancelled";
  return (
    <div className="receipt-wrapper">
      <div className="receipt-success no-print">
        <CheckCircle2 size={30} />
        <h3>
          {returned
            ? "Sale returned"
            : cancelled
              ? "Sale cancelled"
              : "Sale completed"}
        </h3>
        <p>
          {cancelled
            ? "This sale has no outstanding balance."
            : "Stock and payment records have been updated."}
        </p>
      </div>
      <article className="receipt printable">
        <div className="receipt-brand">
          <Plus size={25} />
          <h2>{s.pharmacyName}</h2>
          <p>{s.address}</p>
          <p>{s.phone}</p>
        </div>
        <div className="receipt-meta">
          <strong>{sale.invoiceNumber}</strong>
          {cancelled && (
            <strong>
              {returned ? "RETURNED" : "CANCELLED"} · Balance due:{" "}
              {money(0, s.currency)}
            </strong>
          )}
          <span>{date(sale.createdAt)}</span>
          <span>{sale.customerName || "Walk-in customer"}</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>ITEM</th>
              <th>QTY</th>
              <th>TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {sale.items?.map((i: any, index: number) => (
              <tr key={index}>
                <td>
                  {i.medicineName ||
                    data.resources.medicines.find((m) => m.id === i.medicineId)
                      ?.name}
                  <small>{i.batchNumber}</small>
                </td>
                <td>{i.quantity}</td>
                <td>
                  {money(i.total ?? i.quantity * i.unitPrice, s.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="receipt-totals">
          <p>
            <span>Subtotal</span>
            <span>{money(sale.subtotal, s.currency)}</span>
          </p>
          <p>
            <span>Discount</span>
            <span>−{money(sale.discount, s.currency)}</span>
          </p>
          <p>
            <span>Tax</span>
            <span>{money(sale.tax, s.currency)}</span>
          </p>
          <p className="receipt-grand-total">
            <strong>Total</strong>
            <strong>{money(sale.total, s.currency)}</strong>
          </p>
          <p>
            <span>Paid · {sale.paymentMethod}</span>
            <span>{money(sale.amountPaid, s.currency)}</span>
          </p>
          {cancelled && (
            <>
              <p>
                <span>Refunded</span>
                <span>{money(sale.refundedAmount || 0, s.currency)}</span>
              </p>
              <p>
                <span>Cancelled balance</span>
                <span>
                  {money(
                    Math.max(0, sale.total - (sale.refundedAmount || 0)),
                    s.currency,
                  )}
                </span>
              </p>
            </>
          )}
          {!cancelled &&
            (sale.amountReceived ?? sale.amountPaid) > sale.total && (
              <p>
                <span>Change</span>
                <span>
                  {money(
                    (sale.amountReceived ?? sale.amountPaid) - sale.total,
                    s.currency,
                  )}
                </span>
              </p>
            )}
          {!cancelled && sale.amountPaid < sale.total && (
            <p>
              <span>Balance due</span>
              <span>{money(sale.total - sale.amountPaid, s.currency)}</span>
            </p>
          )}
        </div>
        <p className="receipt-footer">
          {s.receiptFooter || "Thank you for choosing us. Take care."}
        </p>
      </article>
      <button className="btn primary no-print" onClick={() => window.print()}>
        <Printer size={17} />
        Print receipt
      </button>
    </div>
  );
}
