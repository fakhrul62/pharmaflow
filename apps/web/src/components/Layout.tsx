import { useState, useEffect } from "react";
import {
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
  Link,
} from "react-router-dom";
import {
  Plus,
  Search,
  Bell,
  ChevronDown,
  ChevronRight,
  Menu,
  LogOut,
  Command,
  ArrowUpRight,
  PanelLeftClose,
  Activity,
  Sun,
  Moon,
} from "lucide-react";
import { toast } from "sonner";
import { navigation, utilityNavigation, type NavItem } from "../lib/navigation";
import { useWorkspace } from "../lib/store";
import { post } from "../lib/api";
import { Modal } from "./ui";
export default function Layout({ onLogout }: { onLogout: () => void }) {
  const { data } = useWorkspace();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobile, setMobile] = useState(false);
  const [command, setCommand] = useState(false);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string[]>([]);
  const [dark, setDark] = useState(
    () => localStorage.getItem("pharmaflow-theme") === "dark",
  );
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("pharmaflow-theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => {
    setMobile(false);
    const item = navigation.find((n) =>
      n.children?.some((c) => c.path === location.pathname),
    );
    if (item)
      setExpanded((current) =>
        current.includes(item.label) ? current : [...current, item.label],
      );
    document.title = `${[...navigation.flatMap((n) => n.children || [n]), ...utilityNavigation].find((n) => n.path === location.pathname)?.label || "Workspace"} · PharmaFlow`;
  }, [location.pathname]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setCommand((v) => !v);
      }
      if (e.key === "Escape") setMobile(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  const allowed = (item: NavItem) =>
    !item.roles || item.roles.includes(data.user.role);
  const unread = (data.resources.notifications || []).filter(
    (n) => !n.isRead,
  ).length;
  const parent = navigation.find(
    (n) =>
      n.path ===
        (location.pathname === "/" ? "/dashboard" : location.pathname) ||
      n.children?.some((c) => c.path === location.pathname),
  );
  const child = parent?.children?.find((c) => c.path === location.pathname);
  const renderItem = (item: NavItem) => {
    const Icon = item.icon;
    const active = parent?.label === item.label;
    return (
      <div key={item.label}>
        <div className={`nav-row ${active ? "active" : ""}`}>
          <NavLink to={item.path}>
            <Icon size={19} />
            <span>{item.label}</span>
          </NavLink>
          {item.children && (
            <button
              aria-label={`Toggle ${item.label} navigation`}
              aria-expanded={expanded.includes(item.label)}
              onClick={() =>
                setExpanded((v) =>
                  v.includes(item.label)
                    ? v.filter((x) => x !== item.label)
                    : [...v, item.label],
                )
              }
            >
              <ChevronDown
                size={15}
                className={expanded.includes(item.label) ? "rotated" : ""}
              />
            </button>
          )}
        </div>
        {item.children && expanded.includes(item.label) && (
          <div className="nav-children">
            {item.children.filter(allowed).map((c) => (
              <NavLink
                key={c.path}
                to={c.path}
                className={({ isActive }) => (isActive ? "selected" : "")}
              >
                <span className="nav-dot" />
                {c.label}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    );
  };
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      {mobile && (
        <button
          className="mobile-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? "mobile-open" : ""}`}>
        <Link to="/dashboard" className="brand">
          <span className="brand-icon">
            <Plus size={25} strokeWidth={3} />
          </span>
          <span>
            pharma<span className="brand-light">flow</span>
            <small>PHARMACY WORKSPACE</small>
          </span>
        </Link>
        <button
          className="workspace-switch"
          onClick={() => navigate("/settings/profile")}
        >
          <span className="workspace-avatar">
            {String(data.settings.pharmacyName || "PF")
              .slice(0, 2)
              .toUpperCase()}
          </span>
          <span>
            <strong>{data.settings.pharmacyName || "Central Pharmacy"}</strong>
            <small>Main workspace</small>
          </span>
          <ChevronDown size={15} />
        </button>
        <div className="nav-caption">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {navigation.filter(allowed).map(renderItem)}
        </nav>
        <div className="sidebar-bottom">
          <div className="nav-caption">MANAGE</div>
          {utilityNavigation.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.path} to={item.path} className="utility-link">
                <Icon size={18} />
                <span>{item.label}</span>
                {item.label === "Notifications" && unread > 0 && (
                  <span className="nav-count">{unread}</span>
                )}
              </NavLink>
            );
          })}
          <div className="sidebar-health">
            <span className="live-dot" />
            <span>All systems operational</span>
            <Activity size={14} />
          </div>
          <div className="sidebar-profile">
            <span className="avatar">
              {data.user.name
                .split(" ")
                .map((s) => s[0])
                .slice(0, 2)
                .join("")}
            </span>
            <div>
              <strong>{data.user.name}</strong>
              <small>{data.user.role}</small>
            </div>
            <button
              aria-label="Sign out"
              title="Sign out"
              onClick={async () => {
                try {
                  await post("/auth/logout", {});
                  onLogout();
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-btn mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobile((v) => !v)}
            >
              <Menu size={21} />
            </button>
            <PanelLeftClose size={19} className="desktop-sidebar-icon" />
            <span className="breadcrumb-divider" />
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{parent?.label || "Settings"}</strong>
            {child && (
              <>
                <ChevronRight size={14} />
                <strong className="breadcrumb-child">{child.label}</strong>
              </>
            )}
          </div>
          <div className="topbar-actions">
            <button className="global-search" onClick={() => setCommand(true)}>
              <Search size={16} />
              <span>Search workspace…</span>
              <kbd>
                <Command size={10} /> K
              </kbd>
            </button>
            <button
              className="icon-btn"
              aria-label={
                dark ? "Switch to light theme" : "Switch to dark theme"
              }
              onClick={() => setDark((v) => !v)}
            >
              {dark ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <Link
              to="/notifications"
              className="icon-btn notification-button"
              aria-label={`${unread} unread notifications`}
            >
              <Bell size={20} />
              {unread > 0 && <span />}
            </Link>
            <span className="avatar top-avatar">{data.user.name[0]}</span>
          </div>
        </header>
        <main id="main" className="main-content" tabIndex={-1}>
          {data.user.demo && (
            <aside className="demo-banner" role="status">
              Portfolio preview · Fictional data · Read only.{" "}
              <a href="/case-study/">See the case study and workflow video</a>.
              Run the full app locally to create sales and receive stock.
            </aside>
          )}
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>© {new Date().getFullYear()} PharmaFlow</span>
          <span>
            Made for a healthier everyday.<span className="footer-dot">•</span>
            v1.0
          </span>
        </footer>
      </div>
      <Link to="/sales/pos" className="floating-pos">
        <Plus size={18} />
        New sale
        <ArrowUpRight size={15} />
      </Link>
      <Modal
        open={command}
        onClose={() => setCommand(false)}
        title="Search your workspace"
        description="Jump to a page or find a medicine."
      >
        <div className="search-field command-search">
          <Search size={20} />
          <input
            autoFocus
            placeholder="Search pages, medicines…"
            aria-label="Search workspace"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="command-results">
          {[
            ...navigation
              .filter(allowed)
              .flatMap((n) => n.children?.filter(allowed) || [n]),
            ...utilityNavigation,
          ]
            .filter((n) => n.label.toLowerCase().includes(search.toLowerCase()))
            .map((n) => (
              <button
                key={n.path}
                onClick={() => {
                  navigate(n.path);
                  setCommand(false);
                  setSearch("");
                }}
              >
                <n.icon size={18} />
                <span>{n.label}</span>
                <ArrowUpRight size={15} />
              </button>
            ))}
          {search &&
            data.resources.medicines
              ?.filter((m) =>
                `${m.name} ${m.sku} ${m.barcode}`
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .slice(0, 8)
              .map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    navigate(
                      `/inventory/medicines?q=${encodeURIComponent(m.name)}`,
                    );
                    setCommand(false);
                    setSearch("");
                  }}
                >
                  <Plus size={18} />
                  <span>
                    {m.name}
                    <small>{m.sku}</small>
                  </span>
                  <ArrowUpRight size={15} />
                </button>
              ))}
        </div>
      </Modal>
    </div>
  );
}
