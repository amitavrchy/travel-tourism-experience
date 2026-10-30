"use client";
import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  CreditCard,
  Download,
  LoaderCircle,
  RotateCcw,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { api, json } from "@/lib/api";
import { money } from "@/lib/catalog";
import type { Booking, Payment, User } from "@/lib/types";
import { Dialog, useApp } from "./providers";
import { paymentLabels } from "./payments";

type Operations = {
  bookings: Booking[];
  payments: Payment[];
  travelers: (User & { bookings: number })[];
  config: { enabled: boolean; testMode: boolean; webhookConfigured: boolean };
};
const tabs = [
  "Needs approval",
  "Awaiting payment",
  "Paid",
  "Refund review",
  "All bookings",
  "Travelers",
];
export function OperationsPanel() {
  const { user, authLoading, openAuth, toast } = useApp();
  const cache = useQueryClient();
  const result = useQuery({
    queryKey: ["operations", user?.id],
    queryFn: () => api<Operations>("admin/operations"),
    enabled: user?.role === "ADMIN",
    retry: 1,
  });
  const [tab, setTab] = useState(tabs[0]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<{
    action: "approve" | "cancel" | "refund";
    booking: Booking;
  } | null>(null);
  if (authLoading)
    return (
      <div className="container section">
        <div className="skeleton" style={{ height: 350 }} />
      </div>
    );
  if (user?.role !== "ADMIN")
    return (
      <div className="container section">
        <div className="empty-state">
          <ShieldCheck size={40} />
          <h1>The travel desk.</h1>
          <p>
            Administrator access is required to manage approvals and payments.
          </p>
          {!user ? (
            <button className="button button-dark" onClick={openAuth}>
              Sign in to the studio
            </button>
          ) : (
            <Link className="button button-dark" href="/bookings">
              My journeys
            </Link>
          )}
        </div>
      </div>
    );
  const data = result.data;
  const approve = async () => {
    if (!confirmation) return;
    setBusy(true);
    try {
      if (confirmation.action === "refund")
        await api(
          `admin/operations/payments/${confirmation.booking.payment!.id}/refund`,
          json("POST"),
        );
      else
        await api(
          `admin/bookings/${confirmation.booking.id}`,
          json("PATCH", {
            status:
              confirmation.action === "approve" ? "CONFIRMED" : "CANCELLED",
          }),
        );
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["operations"] }),
        cache.invalidateQueries({ queryKey: ["bookings"] }),
        cache.invalidateQueries({ queryKey: ["admin"] }),
      ]);
      toast(
        confirmation.action === "refund"
          ? "Refund submitted to Stripe. Its verified status is shown here."
          : confirmation.action === "approve"
            ? "Dates and total approved. The traveler can now pay securely."
            : "Booking cancelled. Received payments remain recorded until refunded.",
      );
      setConfirmation(null);
    } catch (error) {
      toast((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const shown = (data?.bookings || []).filter((booking) => {
    const match = `${booking.title} ${booking.email} ${booking.id}`
      .toLowerCase()
      .includes(query.toLowerCase());
    if (!match) return false;
    if (tab === "Needs approval") return booking.status === "INQUIRY";
    if (tab === "Awaiting payment")
      return (
        booking.status === "CONFIRMED" &&
        (!booking.payment ||
          ["PENDING", "PROCESSING", "FAILED", "EXPIRED"].includes(
            booking.payment.status,
          ))
      );
    if (tab === "Paid") return booking.payment?.status === "PAID";
    if (tab === "Refund review")
      return (
        booking.payment?.status === "REFUND_PENDING" ||
        (booking.status === "CANCELLED" && booking.payment?.status === "PAID")
      );
    return true;
  });
  const received =
    data?.payments.reduce(
      (sum, payment) =>
        sum +
        (["PAID", "REFUND_PENDING", "REFUNDED"].includes(payment.status)
          ? payment.amountCents - payment.refundedAmountCents
          : 0),
      0,
    ) || 0;
  const csv = () => {
    const rows = [
      [
        "Reference",
        "Journey",
        "Email",
        "Departure",
        "Travelers",
        "Booking status",
        "Payment status",
        "Approved USD",
        "Refunded USD",
      ],
      ...shown.map((b) => [
        `WL-${b.id.slice(0, 8).toUpperCase()}`,
        b.title,
        b.email,
        b.startDate.slice(0, 10),
        String(b.guests),
        b.status,
        b.payment?.status || "UNPAID",
        String(b.totalEstimate),
        String((b.payment?.refundedAmountCents || 0) / 100),
      ]),
    ];
    const safe = (value: string) =>
      `"${(/^[=+\-@\t\r]/.test(value) ? "'" : "") + value.replaceAll('"', '""')}"`;
    const url = URL.createObjectURL(
      new Blob([rows.map((row) => row.map(safe).join(",")).join("\r\n")], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "wanderline-bookings.csv";
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="container admin-page">
      <header className="admin-header">
        <div>
          <p className="eyebrow">
            <ShieldCheck size={16} /> THE WANDERLINE TRAVEL DESK
          </p>
          <h1>
            From inquiry
            <br />
            <em>to on your way.</em>
          </h1>
        </div>
        <Link className="text-link" href="/admin">
          <ArrowLeft size={16} />
          Content studio
        </Link>
      </header>
      {data && (
        <div className="operations-mode">
          <CreditCard size={20} />
          <p>
            {!data.config.enabled
              ? "Stripe is not configured. Approvals remain available; checkout needs the server payment credentials."
              : data.config.testMode
                ? "Stripe test mode. Test payments and refunds do not move real money."
                : "Stripe live mode. Approved checkout payments and refunds move real money."}
            {!data.config.webhookConfigured &&
              " Configure STRIPE_WEBHOOK_SECRET and the deployed webhook endpoint before accepting production payments."}
          </p>
        </div>
      )}
      <div className="admin-stats">
        <div>
          <span>
            {data?.config.testMode
              ? "NET TEST PAYMENTS"
              : "NET PAYMENTS RECEIVED"}
          </span>
          <strong>{money(received / 100)}</strong>
          <small>Verified payments less completed refunds</small>
        </div>
        <div>
          <span>WAITING FOR APPROVAL</span>
          <strong>
            {data?.bookings.filter((b) => b.status === "INQUIRY").length || 0}
          </strong>
          <small>Dates and total to review</small>
        </div>
        <div>
          <span>TRAVELERS</span>
          <strong>
            {data?.travelers.filter((u) => u.role === "TRAVELER").length || 0}
          </strong>
          <small>Registered travelers in your care</small>
        </div>
      </div>
      <section className="admin-content">
        <div className="operations-toolbar">
          <div className="filters">
            {tabs.map((item) => (
              <button
                className={`filter-chip ${tab === item ? "selected" : ""}`}
                key={item}
                onClick={() => setTab(item)}
              >
                {item === "Travelers" && <Users size={15} />}
                {item}
              </button>
            ))}
          </div>
          <button
            className="button button-outline button-small"
            onClick={csv}
            disabled={!shown.length}
          >
            <Download size={16} />
            Export bookings
          </button>
        </div>
        <div className="search-input">
          <Search size={18} />
          <input
            aria-label="Search travel desk"
            placeholder="A journey, reference, or email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {result.error && (
          <p className="error-message" role="alert">
            {result.error.message}
            <button className="text-link" onClick={() => result.refetch()}>
              Try again
            </button>
          </p>
        )}
        {result.isPending ? (
          <div className="skeleton" style={{ height: 260 }} />
        ) : tab === "Travelers" ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Traveler</th>
                  <th>Email</th>
                  <th>Bookings / access</th>
                </tr>
              </thead>
              <tbody>
                {data?.travelers
                  .filter((u) =>
                    `${u.name} ${u.email}`
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                  )
                  .map((u) => (
                    <tr key={u.id}>
                      <td>
                        <strong>{u.name}</strong>
                      </td>
                      <td>{u.email}</td>
                      <td>
                        {u.bookings} bookings · {u.role.toLowerCase()}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="operations-bookings">
            {shown.length ? (
              shown.map((booking) => (
                <div className="operations-booking" key={booking.id}>
                  <div className="inquiry-card-top">
                    <p className="eyebrow">
                      WL-{booking.id.slice(0, 8).toUpperCase()}
                    </p>
                    <span
                      className={`status-badge status-${booking.status.toLowerCase()}`}
                    >
                      {booking.status === "INQUIRY"
                        ? "Needs approval"
                        : booking.status === "CONFIRMED"
                          ? "Approved"
                          : "Cancelled"}
                    </span>
                  </div>
                  <h2>{booking.title}</h2>
                  <p>
                    {booking.email} · {booking.startDate.slice(0, 10)} ·{" "}
                    {booking.guests} travelers
                  </p>
                  <div className="operations-amount">
                    <strong>{money(booking.totalEstimate)}</strong>
                    <span
                      className={`status-badge payment-${booking.payment?.status.toLowerCase() || "unpaid"}`}
                    >
                      {booking.payment
                        ? paymentLabels[booking.payment.status]
                        : "Unpaid"}
                    </span>
                  </div>
                  {booking.notes && (
                    <p className="inquiry-notes">{booking.notes}</p>
                  )}
                  {booking.payment && (
                    <p className="operations-payment-reference">
                      Stripe reference: {booking.payment.id}
                      {booking.payment.refundId
                        ? ` · Refund: ${booking.payment.refundId}`
                        : ""}
                    </p>
                  )}
                  <div className="operations-actions">
                    {booking.status === "INQUIRY" && (
                      <button
                        className="button button-dark button-small"
                        onClick={() =>
                          setConfirmation({ action: "approve", booking })
                        }
                      >
                        <Check size={16} />
                        Approve dates & total
                      </button>
                    )}
                    {booking.status !== "CANCELLED" && (
                      <button
                        className="button button-outline button-small"
                        onClick={() =>
                          setConfirmation({ action: "cancel", booking })
                        }
                      >
                        <X size={16} />
                        Cancel booking
                      </button>
                    )}
                    {booking.payment?.status === "PAID" && (
                      <button
                        className="button button-outline button-small"
                        onClick={() =>
                          setConfirmation({ action: "refund", booking })
                        }
                      >
                        <RotateCcw size={16} />
                        Refund full payment
                      </button>
                    )}
                    {booking.payment?.receiptUrl && (
                      <a
                        href={booking.payment.receiptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-link"
                      >
                        Receipt
                        <ArrowUpRight size={16} />
                      </a>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <ShieldCheck size={35} />
                <h2>All clear for now.</h2>
                <p>No bookings match this view.</p>
              </div>
            )}
          </div>
        )}
      </section>
      <AnimatePresence>
        {confirmation && (
          <Dialog
            title={`${confirmation.action} booking`}
            onClose={() => {
              if (!busy) setConfirmation(null);
            }}
          >
            <p className="eyebrow">A THOUGHTFUL NEXT STEP</p>
            <h2>
              {confirmation.action === "refund"
                ? `Refund ${money(confirmation.booking.payment!.amountCents / 100)}?`
                : confirmation.action === "approve"
                  ? "Approve this journey?"
                  : "Cancel this booking?"}
            </h2>
            <p>{confirmation.booking.title}</p>
            <p style={{ marginTop: 18 }}>
              {confirmation.action === "refund"
                ? "Stripe will return the full payment to the original payment method and the booking will be cancelled. This cannot be undone in the studio."
                : confirmation.action === "approve"
                  ? `Confirm you have reviewed availability and the total of ${money(confirmation.booking.totalEstimate)}. The traveler will then be able to pay through Stripe.`
                  : "Open checkout links will be expired. If already paid, the payment stays recorded and requires a separate refund decision."}
            </p>
            <div className="confirm-actions">
              <button
                className="button button-outline"
                disabled={busy}
                onClick={() => setConfirmation(null)}
              >
                Go back
              </button>
              <button
                className="button button-dark"
                onClick={approve}
                disabled={busy}
              >
                {busy && <LoaderCircle size={16} className="spin" />}
                {confirmation.action === "refund"
                  ? "Confirm full refund"
                  : confirmation.action === "approve"
                    ? "Approve booking"
                    : "Confirm cancellation"}
              </button>
            </div>
          </Dialog>
        )}
      </AnimatePresence>
    </div>
  );
}
