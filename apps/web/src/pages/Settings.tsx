import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Save,
  Building2,
  SlidersHorizontal,
  ReceiptText,
  Bell,
  ShieldCheck,
  Palette,
  Globe,
  Wallet,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "../lib/store";
import { patch } from "../lib/api";
import { PageHeading, Busy } from "../components/ui";
const tabs = [
  { id: "general", label: "General", icon: SlidersHorizontal },
  { id: "profile", label: "Pharmacy profile", icon: Building2 },
  { id: "business", label: "Business", icon: Globe },
  { id: "tax", label: "Tax", icon: ReceiptText },
  { id: "payment", label: "Payments", icon: Wallet },
  { id: "invoice", label: "Invoice & receipt", icon: ReceiptText },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: ShieldCheck },
  { id: "appearance", label: "Appearance", icon: Palette },
];
export default function Settings() {
  const { data, refresh } = useWorkspace();
  const location = useLocation();
  const tab = location.pathname.split("/").pop() || "general";
  const current = tabs.find((t) => t.id === tab) || tabs[0];
  const [values, setValues] = useState(data.settings);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const admin = data.user.role === "admin";
  const update = (k: string, v: any) => setValues((p) => ({ ...p, [k]: v }));
  const input = (key: string, label: string, type = "text") => (
    <label key={key}>
      {label}
      <input
        type={type}
        value={values[key] ?? ""}
        onChange={(e) =>
          update(
            key,
            type === "number" ? Number(e.target.value) : e.target.value,
          )
        }
        required
        disabled={!admin}
        min={type === "number" ? 0 : undefined}
        step={key === "taxRate" ? "0.01" : undefined}
      />
    </label>
  );
  const toggle = (key: string, label: string, description: string) => (
    <label className="setting-toggle" key={key}>
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <input
        type="checkbox"
        checked={!!values[key]}
        onChange={(e) => update(key, e.target.checked)}
        disabled={!admin}
      />
    </label>
  );
  return (
    <div className="page">
      <PageHeading
        eyebrow="MAKE IT YOURS"
        title="Settings"
        description="The details that make this workspace your pharmacy."
      />
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          {tabs.map((t) => (
            <NavLink to={`/settings/${t.id}`} key={t.id}>
              <t.icon size={17} />
              {t.label}
            </NavLink>
          ))}
        </nav>
        <section className="card settings-card">
          <div className="card-heading">
            <div>
              <h2>{current.label}</h2>
              <p>
                {tab === "security"
                  ? "Manage your password and account access."
                  : "Your workspace preferences, all in one place."}
              </p>
            </div>
            <current.icon size={22} />
          </div>
          {tab === "security" ? (
            <PasswordForm />
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                try {
                  await patch("/settings", values);
                  await refresh();
                  if (tab === "appearance") {
                    document.documentElement.dataset.theme =
                      values.theme === "system"
                        ? matchMedia("(prefers-color-scheme: dark)").matches
                          ? "dark"
                          : "light"
                        : values.theme;
                    localStorage.setItem(
                      "pharmaflow-theme",
                      document.documentElement.dataset.theme!,
                    );
                  }
                  toast.success("Settings saved");
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <div className="form-body">
                {!admin && (
                  <p className="info-note">
                    Workspace settings are managed by your administrator.
                  </p>
                )}
                <div className="form-grid">
                  {tab === "general" && (
                    <>
                      {input("pharmacyName", "Workspace name")}
                      <label>
                        Currency
                        <select
                          value={values.currency}
                          onChange={(e) => update("currency", e.target.value)}
                          disabled={!admin}
                        >
                          {["USD", "BDT", "EUR", "GBP", "INR", "AED"].map(
                            (c) => (
                              <option key={c}>{c}</option>
                            ),
                          )}
                        </select>
                      </label>
                      <label>
                        Timezone
                        <select
                          value={values.timezone}
                          onChange={(e) => update("timezone", e.target.value)}
                          disabled={!admin}
                        >
                          {[
                            "Asia/Dhaka",
                            "Asia/Kolkata",
                            "Asia/Dubai",
                            "Europe/London",
                            "America/New_York",
                            "UTC",
                          ].map((t) => (
                            <option key={t}>{t}</option>
                          ))}
                        </select>
                      </label>
                      <p className="info-note full-width">
                        Changing currency updates the display currency. Existing
                        recorded amounts are not converted.
                      </p>
                    </>
                  )}
                  {tab === "profile" && (
                    <>
                      {input("pharmacyName", "Pharmacy name")}
                      {input("phone", "Phone")}
                      {input("email", "Email address", "email")}
                      <label className="full-width">
                        Address
                        <textarea
                          value={values.address}
                          onChange={(e) => update("address", e.target.value)}
                          disabled={!admin}
                          rows={3}
                        />
                      </label>
                    </>
                  )}
                  {tab === "business" && (
                    <>
                      <div className="full-width account-card">
                        <Building2 size={32} />
                        <div>
                          <strong>{data.settings.pharmacyName}</strong>
                          <small>
                            Single pharmacy · Multiple stock locations
                          </small>
                        </div>
                      </div>
                      <p className="info-note full-width">
                        Stock locations are managed through batches and stock
                        transfers. Add medicines, receive stock, and track each
                        location from Inventory.
                      </p>
                      {input("pharmacyName", "Business name")}
                      {input("timezone", "Business timezone")}
                    </>
                  )}
                  {tab === "tax" && (
                    <>
                      {input("taxRate", "Default sales tax rate (%)", "number")}
                      <p className="info-note full-width">
                        Tax is calculated on the discounted subtotal at
                        checkout. Configure the rate appropriate to your
                        business. This setting does not determine which legal
                        tax rules apply.
                      </p>
                    </>
                  )}
                  {tab === "payment" && (
                    <div className="full-width">
                      <h3>Supported payment records</h3>
                      {["Cash", "Card", "Mobile payment", "Bank transfer"].map(
                        (m) => (
                          <div className="payment-setting" key={m}>
                            <span>{m}</span>
                            <span className="badge green">Available</span>
                          </div>
                        ),
                      )}
                      <p className="info-note">
                        PharmaFlow records payments received. Card terminals,
                        bank transfers, and mobile providers are operated
                        separately.
                      </p>
                    </div>
                  )}
                  {tab === "invoice" && (
                    <>
                      {input("invoicePrefix", "Invoice prefix")}
                      <label className="full-width">
                        Receipt footer
                        <textarea
                          value={values.receiptFooter}
                          onChange={(e) =>
                            update("receiptFooter", e.target.value)
                          }
                          rows={3}
                          disabled={!admin}
                        />
                      </label>
                      <p className="info-note full-width">
                        Invoices use your pharmacy profile and a unique
                        reference. Print receipts from Point of Sale or Sales →
                        Invoices.
                      </p>
                    </>
                  )}
                  {tab === "notifications" && (
                    <div className="full-width">
                      {toggle(
                        "lowStockAlerts",
                        "Low stock alerts",
                        "Highlight medicines below the reorder level.",
                      )}
                      {toggle(
                        "expiryAlerts",
                        "Expiry alerts",
                        "Keep approaching batch expiry dates in view.",
                      )}
                      {input(
                        "expiryWarningDays",
                        "Expiry warning window (days)",
                        "number",
                      )}
                    </div>
                  )}
                  {tab === "appearance" && (
                    <div className="full-width">
                      <h3>Choose your appearance</h3>
                      <div className="theme-options">
                        {["light", "dark", "system"].map((theme) => (
                          <button
                            key={theme}
                            disabled={!admin}
                            type="button"
                            className={values.theme === theme ? "selected" : ""}
                            onClick={() => update("theme", theme)}
                          >
                            <div className={`theme-preview ${theme}`}>
                              <span />
                              <div>
                                <i />
                                <i />
                                <i />
                              </div>
                            </div>
                            <strong>
                              {theme[0].toUpperCase() + theme.slice(1)}
                            </strong>
                          </button>
                        ))}
                      </div>
                      <p className="info-note">
                        Use the moon or sun in the top bar for a quick local
                        theme change.
                      </p>
                    </div>
                  )}
                </div>
                {error && (
                  <div role="alert" className="error-banner">
                    {error}
                  </div>
                )}
              </div>
              {admin && tab !== "payment" && (
                <div className="dialog-footer">
                  <button className="btn primary" disabled={busy}>
                    {busy ? (
                      <Busy />
                    ) : (
                      <>
                        <Save size={16} />
                        Save changes
                      </>
                    )}
                  </button>
                </div>
              )}
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
function PasswordForm() {
  const { data } = useWorkspace();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const values = Object.fromEntries(new FormData(e.currentTarget));
        if (values.newPassword !== values.confirm) {
          setError("New passwords do not match.");
          return;
        }
        setBusy(true);
        setError("");
        try {
          await patch("/auth/password", {
            currentPassword: values.currentPassword,
            newPassword: values.newPassword,
          });
          toast.success("Password changed. Please sign in again.");
          window.dispatchEvent(new Event("session-expired"));
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="form-body">
        <div className="account-card">
          <UserRound size={30} />
          <div>
            <strong>{data.user.name}</strong>
            <small>
              {data.user.email} · {data.user.role}
            </small>
          </div>
        </div>
        <div className="form-grid">
          <label className="full-width">
            Current password
            <input
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <label>
            New password
            <input
              name="newPassword"
              type="password"
              autoComplete="new-password"
              minLength={10}
              required
            />
          </label>
          <label>
            Confirm new password
            <input
              name="confirm"
              type="password"
              autoComplete="new-password"
              minLength={10}
              required
            />
          </label>
        </div>
        <p className="info-note">
          Use at least 10 characters. Changing your password signs out all
          active sessions.
        </p>
        {error && (
          <div role="alert" className="error-banner">
            {error}
          </div>
        )}
      </div>
      <div className="dialog-footer">
        <button className="btn primary" disabled={busy}>
          {busy ? (
            <Busy />
          ) : (
            <>
              <ShieldCheck size={16} />
              Update password
            </>
          )}
        </button>
      </div>
    </form>
  );
}
