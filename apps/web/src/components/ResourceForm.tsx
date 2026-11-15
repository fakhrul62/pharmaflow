import { useState } from "react";
import { useForm } from "react-hook-form";
import { Plus, Trash2, Package, Info } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "../lib/store";
import { post, patch, money, today, type Entity } from "../lib/api";
import { type ResourceConfig, type Field } from "../lib/resources";
import { Busy } from "./ui";
export default function ResourceForm({
  config,
  entity,
  onSaved,
  onCancel,
}: {
  config: ResourceConfig;
  entity?: Entity;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { data, refresh } = useWorkspace();
  const [error, setError] = useState("");
  const [lines, setLines] = useState<any[]>(entity?.items || []);
  const [medicineId, setMedicineId] = useState("");
  const defaults = Object.fromEntries(
    config.fields.map((f) => [
      f.key,
      entity?.[f.key] !== undefined
        ? f.type === "money"
          ? entity[f.key] / 100
          : entity[f.key]
        : (f.default ??
          (f.type === "date" && f.required && !entity
            ? today()
            : f.type === "checkbox"
              ? false
              : "")),
    ]),
  );
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm({ defaultValues: defaults });
  const addLine = () => {
    const medicine = data.resources.medicines.find((m) => m.id === medicineId);
    if (!medicine) return;
    if (lines.some((l) => l.medicineId === medicineId)) {
      toast.error(
        "This medicine is already in the list. Update its quantity below.",
      );
      return;
    }
    setLines([
      ...lines,
      {
        medicineId,
        quantity: 1,
        unitPrice:
          config.items === "purchase"
            ? medicine.purchasePrice
            : medicine.sellingPrice,
        batchNumber: "",
        expiryDate: "",
        location: medicine.location || "Main shelf",
        dosage: "",
      },
    ]);
    setMedicineId("");
  };
  const batchIdentity = [
    "medicineId",
    "batchNumber",
    "expiryDate",
    "manufacturingDate",
    "location",
    "quantity",
  ];
  const locked = (f: Field) =>
    !!entity && config.resource === "batches" && batchIdentity.includes(f.key);
  const input = (f: Field) => {
    if (f.type === "checkbox")
      return (
        <label key={f.key} className="checkbox-field">
          <input type="checkbox" {...register(f.key)} />
          <span>{f.label}</span>
        </label>
      );
    const props = {
      ...register(f.key, { required: f.required }),
      "aria-label": f.label,
      required: f.required,
      disabled: locked(f),
    };
    const choices =
      f.resource === "payment-documents"
        ? [
            ...(data.resources.sales || []).filter(
              (s) => s.status !== "returned" && s.amountPaid < s.total,
            ),
            ...(data.resources.purchases || []).filter(
              (p) => p.status !== "returned" && p.paymentStatus !== "paid",
            ),
          ]
        : f.resource
          ? data.resources[f.resource] || []
          : [];
    return (
      <label key={f.key} className={f.type === "textarea" ? "full-width" : ""}>
        {f.label}
        {f.required && (
          <span className="required" aria-hidden="true">
            *
          </span>
        )}
        {f.type === "select" ? (
          <select {...props}>
            <option value="">Select {f.label.toLowerCase()}</option>
            {f.options?.map((o) => (
              <option key={o} value={o}>
                {o.replaceAll("-", " ")}
              </option>
            ))}
            {choices.map((c) => (
              <option key={c.id} value={f.key === "unit" ? c.name : c.id}>
                {c.name || c.reference || c.invoiceNumber || c.batchNumber}
              </option>
            ))}
          </select>
        ) : f.type === "textarea" ? (
          <textarea {...props} rows={3} />
        ) : (
          <input
            {...props}
            type={
              f.type === "money" || f.type === "number"
                ? "number"
                : f.type || "text"
            }
            step={f.type === "money" ? "0.01" : "1"}
            min={
              f.type === "money"
                ? 0
                : (f.min ?? (f.type === "number" ? 0 : undefined))
            }
            max={f.key === "discountPercentage" ? 100 : undefined}
            minLength={f.type === "password" ? 10 : undefined}
            autoComplete={f.type === "password" ? "new-password" : undefined}
            disabled={locked(f)}
          />
        )}
        {f.hint && <small className="field-hint">{f.hint}</small>}
      </label>
    );
  };
  return (
    <form
      onSubmit={handleSubmit(async (values) => {
        setError("");
        try {
          const body: Record<string, any> = {};
          for (const f of config.fields) {
            if (locked(f)) continue;
            let v = values[f.key];
            if (f.type === "money") v = Math.round(Number(v) * 100);
            else if (f.type === "number") v = Number(v);
            if (v !== undefined) {
              if (v === "") {
                if (f.type === "password") continue;
                if (f.resource) {
                  if (entity && !f.required) body[f.key] = null;
                  continue;
                }
                if (f.type === "date") continue;
              }
              body[f.key] = v;
            }
          }
          if (entity && config.resource === "batches") delete body.quantity;
          if (config.resource === "staff" && !entity && !body.password)
            throw new Error("Enter a password for the new team member.");
          if (config.items) {
            if (!lines.length) throw new Error("Add at least one medicine.");
            body.items = lines.map((l) =>
              config.items === "prescription"
                ? {
                    medicineId: l.medicineId,
                    quantity: Number(l.quantity),
                    dosage: l.dosage || "",
                  }
                : config.items === "purchase"
                  ? {
                      medicineId: l.medicineId,
                      quantity: Number(l.quantity),
                      unitPrice: Number(l.unitPrice),
                      batchNumber: l.batchNumber,
                      expiryDate: l.expiryDate,
                      location: l.location,
                    }
                  : {
                      medicineId: l.medicineId,
                      quantity: Number(l.quantity),
                      unitPrice: Number(l.unitPrice),
                    },
            );
            if (config.items === "prescription" && !entity)
              body.status = "pending";
            if (config.items === "purchase" && !entity) body.status = "ordered";
            if (config.items === "quotation" && body.customerId)
              body.customerName = data.resources.customers.find(
                (c) => c.id === body.customerId,
              )?.name;
          }
          if (entity)
            await patch(`/resources/${config.resource}/${entity.id}`, body);
          else await post(`/resources/${config.resource}`, body);
          await refresh();
          toast.success(
            `${config.singular[0].toUpperCase() + config.singular.slice(1)} ${entity ? "updated" : "created"}`,
          );
          onSaved();
        } catch (e) {
          setError((e as Error).message);
        }
      })}
    >
      <div className="form-body">
        <div className="form-grid">{config.fields.map(input)}</div>
        {config.items && (
          <section className="line-editor">
            <h3>
              <Package size={17} />
              Medicines
            </h3>
            <div className="add-line">
              <select
                aria-label="Choose medicine"
                value={medicineId}
                onChange={(e) => setMedicineId(e.target.value)}
              >
                <option value="">Choose a medicine…</option>
                {(data.resources.medicines || []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn secondary"
                onClick={addLine}
                disabled={!medicineId}
              >
                <Plus size={16} />
                Add
              </button>
            </div>
            {lines.map((line, index) => (
              <div className="order-line" key={line.medicineId}>
                <div className="order-line-heading">
                  <strong>
                    {
                      data.resources.medicines.find(
                        (m) => m.id === line.medicineId,
                      )?.name
                    }
                  </strong>
                  <button
                    type="button"
                    className="icon-btn danger-text"
                    aria-label="Remove medicine"
                    onClick={() =>
                      setLines(lines.filter((_, i) => i !== index))
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="form-grid">
                  <label>
                    Quantity
                    <input
                      aria-label={`Quantity for line ${index + 1}`}
                      type="number"
                      min="1"
                      step="1"
                      required
                      value={line.quantity}
                      onChange={(e) =>
                        setLines(
                          lines.map((l, i) =>
                            i === index
                              ? { ...l, quantity: Number(e.target.value) }
                              : l,
                          ),
                        )
                      }
                    />
                  </label>
                  {config.items !== "prescription" ? (
                    <label>
                      Unit price
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={line.unitPrice / 100}
                        onChange={(e) =>
                          setLines(
                            lines.map((l, i) =>
                              i === index
                                ? {
                                    ...l,
                                    unitPrice: Math.round(
                                      Number(e.target.value) * 100,
                                    ),
                                  }
                                : l,
                            ),
                          )
                        }
                      />
                    </label>
                  ) : (
                    <label>
                      Dosage instructions
                      <input
                        required
                        value={line.dosage}
                        onChange={(e) =>
                          setLines(
                            lines.map((l, i) =>
                              i === index
                                ? { ...l, dosage: e.target.value }
                                : l,
                            ),
                          )
                        }
                      />
                    </label>
                  )}
                  {config.items === "purchase" && (
                    <>
                      <label>
                        Batch number
                        <input
                          required
                          value={line.batchNumber}
                          onChange={(e) =>
                            setLines(
                              lines.map((l, i) =>
                                i === index
                                  ? { ...l, batchNumber: e.target.value }
                                  : l,
                              ),
                            )
                          }
                        />
                      </label>
                      <label>
                        Expiry date
                        <input
                          type="date"
                          min={today()}
                          required
                          value={line.expiryDate}
                          onChange={(e) =>
                            setLines(
                              lines.map((l, i) =>
                                i === index
                                  ? { ...l, expiryDate: e.target.value }
                                  : l,
                              ),
                            )
                          }
                        />
                      </label>
                      <label className="full-width">
                        Location
                        <input
                          required
                          value={line.location}
                          onChange={(e) =>
                            setLines(
                              lines.map((l, i) =>
                                i === index
                                  ? { ...l, location: e.target.value }
                                  : l,
                              ),
                            )
                          }
                        />
                      </label>
                    </>
                  )}
                </div>
              </div>
            ))}
            {config.items !== "prescription" && (
              <div className="line-total">
                Order total
                <strong>
                  {money(
                    lines.reduce((a, l) => a + l.quantity * l.unitPrice, 0),
                    data.settings.currency,
                  )}
                </strong>
              </div>
            )}
          </section>
        )}
        {config.resource === "medicines" && !entity && (
          <p className="info-note">
            <Info size={16} />
            After adding the medicine, create a batch or receive a purchase to
            add stock.
          </p>
        )}
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
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button type="submit" className="btn primary" disabled={isSubmitting}>
          {isSubmitting ? (
            <Busy />
          ) : (
            `${entity ? "Save changes" : "Create " + config.singular}`
          )}
        </button>
      </div>
    </form>
  );
}
