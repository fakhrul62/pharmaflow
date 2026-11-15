import { Link } from "react-router-dom";
import {
  Bell,
  CheckCheck,
  ArrowUpRight,
  LifeBuoy,
  Search,
  Boxes,
  ShoppingBag,
  Truck,
  ShieldCheck,
  BookOpen,
  ChevronDown,
  ArrowRight,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "../lib/store";
import { date, post } from "../lib/api";
import { PageHeading, Empty, Badge } from "../components/ui";
export default function Utility({
  mode,
}: {
  mode: "notifications" | "help" | "not-found";
}) {
  const { data, refresh } = useWorkspace();
  const notifications = data.resources.notifications || [];
  if (mode === "not-found")
    return (
      <div className="page">
        <Empty
          title="This page isn’t on the shelf"
          description="The address may have changed. Your workspace is one click away."
          action={
            <Link to="/dashboard" className="btn primary">
              Back to overview
              <ArrowRight size={16} />
            </Link>
          }
        />
      </div>
    );
  if (mode === "notifications")
    return (
      <div className="page">
        <PageHeading
          eyebrow="STAY IN THE KNOW"
          title="Notifications"
          description="A little heads-up to help your day run smoothly."
        >
          <button
            className="btn secondary"
            disabled={!notifications.some((n) => !n.isRead)}
            onClick={async () => {
              try {
                for (const n of notifications.filter((n) => !n.isRead))
                  await post("/operations/mark-notification", { id: n.id });
                await refresh();
                toast.success("All notifications marked as read");
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            <CheckCheck size={16} />
            Mark all as read
          </button>
        </PageHeading>
        <div className="card notification-list">
          {notifications.map((n) => (
            <article key={n.id} className={n.isRead ? "" : "unread"}>
              <span
                className={`notification-icon ${n.type === "warning" ? "orange" : "teal"}`}
              >
                {n.type === "warning" ? (
                  <TriangleAlert size={22} />
                ) : (
                  <Bell size={22} />
                )}
              </span>
              <div>
                <h3>
                  {n.title}
                  {!n.isRead && <span className="unread-dot" />}
                </h3>
                <p>{n.message}</p>
                <small>{date(n.createdAt)}</small>
              </div>
              <div className="notification-actions">
                {n.link && n.link.startsWith("/") && (
                  <Link className="btn subtle" to={n.link}>
                    Review
                    <ArrowUpRight size={15} />
                  </Link>
                )}
                {!n.isRead && (
                  <button
                    className="icon-btn"
                    aria-label={`Mark ${n.title} as read`}
                    onClick={async () => {
                      try {
                        await post("/operations/mark-notification", {
                          id: n.id,
                        });
                        await refresh();
                      } catch (e) {
                        toast.error((e as Error).message);
                      }
                    }}
                  >
                    <CheckCheck size={18} />
                  </button>
                )}
              </div>
            </article>
          ))}
          {!notifications.length && (
            <Empty
              title="You’re all caught up"
              description="Stock and expiry updates will appear here."
            />
          )}
        </div>
      </div>
    );
  const guides = [
    {
      icon: Boxes,
      title: "Keep your shelves in sync",
      text: "Create medicines first, then add stock through batches or received purchase orders.",
      link: "/inventory/medicines",
    },
    {
      icon: ShoppingBag,
      title: "Make your first sale",
      text: "Search or scan a medicine, add a customer, and record the payment. Stock updates automatically.",
      link: "/sales/pos",
    },
    {
      icon: Truck,
      title: "Receive a delivery",
      text: "Create a purchase order with batch numbers and expiry dates, then receive it once goods arrive.",
      link: "/purchases/orders",
    },
    {
      icon: ShieldCheck,
      title: "Work with the right access",
      text: "Admins manage everything, pharmacists manage care and stock, and cashiers manage sales and customers.",
      link: "/settings/security",
    },
  ];
  return (
    <div className="page">
      <PageHeading
        eyebrow="A HELPING HAND"
        title="How can we help?"
        description="Practical guides for a smoother day at your pharmacy."
      />
      <div className="help-hero">
        <span>
          <LifeBuoy size={36} />
        </span>
        <div>
          <h2>A little guidance goes a long way.</h2>
          <p>
            Learn the essentials and get back to what matters: your customers.
          </p>
        </div>
        <Badge tone="green">Workspace guide</Badge>
      </div>
      <div className="help-guide-grid">
        {guides
          .filter(
            (g) =>
              data.user.role !== "cashier" || !g.link.startsWith("/purchases"),
          )
          .map((g) => (
            <Link to={g.link} key={g.title} className="card help-guide">
              <g.icon size={24} />
              <h3>{g.title}</h3>
              <p>{g.text}</p>
              <span>
                Open workspace
                <ArrowUpRight size={15} />
              </span>
            </Link>
          ))}
      </div>
      <section className="card faq">
        <div className="card-heading">
          <h2>Good to know</h2>
          <BookOpen size={20} />
        </div>
        {[
          {
            q: "Why can’t I sell a medicine that appears in inventory?",
            a: "Only active, unexpired batches are available at checkout. Quarantined, expired, and out-of-stock batches cannot be dispensed.",
          },
          {
            q: "How do prescriptions work?",
            a: "A pharmacist or admin records and verifies the prescription. Select it at checkout for medicines requiring a prescription. Dispensing cannot exceed the remaining prescribed quantity.",
          },
          {
            q: "Can I use a barcode scanner?",
            a: "Yes. A USB scanner that types into a text field works in the POS search box. Scan the barcode and press Enter to add the matching medicine.",
          },
          {
            q: "Where are my changes saved?",
            a: "Records are saved to the PostgreSQL database running with this application. Reloading the browser keeps your records. Back up the database regularly.",
          },
          {
            q: "Does this charge a card or send emails?",
            a: "Payments are recorded after you process them separately. Email delivery and payment provider integrations are not connected.",
          },
          {
            q: "Which shortcuts can I use?",
            a: "Ctrl or Cmd + K opens workspace search. Ctrl + F focuses product search in POS. F8 opens checkout. Escape closes dialogs.",
          },
        ].map((item) => (
          <details key={item.q}>
            <summary>
              {item.q}
              <ChevronDown size={16} />
            </summary>
            <p>{item.a}</p>
          </details>
        ))}
      </section>
    </div>
  );
}
