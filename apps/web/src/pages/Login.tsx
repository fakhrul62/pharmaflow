import { useState } from "react";
import {
  Plus,
  ArrowRight,
  Eye,
  EyeOff,
  ShieldCheck,
  Boxes,
  BarChart3,
  Activity,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { post, type User } from "../lib/api";
import { Busy } from "../components/ui";
const schema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});
export default function Login({ onLogin }: { onLogin: (user: User) => void }) {
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const [demoBusy, setDemoBusy] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });
  return (
    <div
      className={`login-page ${import.meta.env.VITE_PORTFOLIO_DEMO === "true" ? "portfolio-login" : ""}`}
    >
      <section className="login-story">
        <a href="/" className="brand">
          <span className="brand-icon">
            <Plus size={26} strokeWidth={3} />
          </span>
          <span>
            pharma<span className="brand-light">flow</span>
          </span>
        </a>
        <span className="login-pill">
          <span className="live-dot" />
          Your pharmacy, in perfect sync.
        </span>
        <h1>
          Less busywork.
          <br />
          More care.
        </h1>
        <p>
          One thoughtful workspace for your inventory,
          <br />
          your team, and the people who count on you.
        </p>
        <div className="login-illustration">
          <div className="mini-card">
            <span className="mini-icon">
              <Boxes size={23} />
            </span>
            <div>
              <small>Inventory health</small>
              <strong>Everything in view.</strong>
            </div>
            <Activity size={26} />
          </div>
          <div className="mini-chart">
            {[30, 54, 42, 74, 62, 91, 82, 100, 78, 116, 103, 138].map(
              (v, i) => (
                <span key={i} style={{ height: v }} />
              ),
            )}
          </div>
          <div className="mini-note">
            <ShieldCheck size={18} />
            <span>Stay stocked. Stay a step ahead.</span>
          </div>
        </div>
        <small className="login-copyright">
          A healthier way to run your pharmacy.
        </small>
      </section>
      <section className="login-form-section">
        <div className="login-form">
          <span className="login-form-icon">
            <BarChart3 size={25} />
          </span>
          <p className="eyebrow">WELCOME TO PHARMAFLOW</p>
          <h2>Your day starts here.</h2>
          <p className="muted">Sign in to your pharmacy workspace.</p>
          <form
            onSubmit={handleSubmit(async (values) => {
              setError("");
              try {
                const response = await post<User | { user: User }>(
                  "/auth/login",
                  values,
                );
                onLogin("user" in response ? response.user : response);
              } catch (e) {
                setError((e as Error).message);
              }
            })}
          >
            <label>
              Email address
              <input
                {...register("email")}
                type="email"
                autoComplete="username"
                placeholder="you@pharmacy.com"
              />
              {errors.email && (
                <small className="field-error">{errors.email.message}</small>
              )}
            </label>
            <label>
              Password
              <div className="password-input">
                <input
                  {...register("password")}
                  type={visible ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={visible ? "Hide password" : "Show password"}
                  onClick={() => setVisible((v) => !v)}
                >
                  {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && (
                <small className="field-error">{errors.password.message}</small>
              )}
            </label>
            {error && (
              <div role="alert" className="error-banner">
                {error}
              </div>
            )}
            <button
              className="btn primary login-submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Busy label="Signing in…" />
              ) : (
                <>
                  Sign in to workspace
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
          <div className="demo-login">
            <strong>Explore PharmaFlow</strong>
            <p>
              {import.meta.env.VITE_PORTFOLIO_DEMO === "true"
                ? "Fictional data. Read-only preview · 30 minute sessions."
                : "Fictional data. Changes are saved to your local database."}
            </p>
            <button
              type="button"
              disabled={demoBusy || isSubmitting}
              onClick={async () => {
                setValue("email", "admin@pharmaflow.local");
                setValue("password", "PharmaFlow!2026");
                setDemoBusy(true);
                setError("");
                try {
                  const u = await post<User | { user: User }>(
                    import.meta.env.VITE_PORTFOLIO_DEMO === "true"
                      ? "/auth/demo"
                      : "/auth/login",
                    {
                      email: "admin@pharmaflow.local",
                      password: "PharmaFlow!2026",
                    },
                  );
                  onLogin("user" in u ? u.user : u);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setDemoBusy(false);
                }
              }}
            >
              {demoBusy ? (
                <Busy label="Opening demo…" />
              ) : (
                <>
                  Enter demo workspace <ArrowRight size={15} />
                </>
              )}
            </button>
          </div>
          <p className="login-security">
            <ShieldCheck size={15} />
            Secure sessions · Role-based access
          </p>
        </div>
      </section>
    </div>
  );
}
