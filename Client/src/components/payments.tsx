"use client";
import { useState } from "react";
import {
  CreditCard,
  ExternalLink,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import { api, json } from "@/lib/api";
import { money } from "@/lib/catalog";
import type { Booking, Payment } from "@/lib/types";
import { useApp } from "./providers";

export const paymentLabels: Record<Payment["status"], string> = {
  PENDING: "Payment not completed",
  PROCESSING: "Payment processing",
  PAID: "Payment received",
  FAILED: "Payment failed",
  EXPIRED: "Checkout expired",
  REFUND_PENDING: "Refund processing",
  REFUNDED: "Refund completed",
};
export function PaymentButton({ booking }: { booking: Booking }) {
  const { toast } = useApp();
  const [busy, setBusy] = useState(false);
  const pay = async () => {
    setBusy(true);
    try {
      const result = await api<{ url: string }>(
        "payments/checkout",
        json("POST", { bookingId: booking.id }),
      );
      const target = new URL(result.url);
      if (
        target.protocol !== "https:" ||
        target.hostname !== "checkout.stripe.com"
      )
        throw new Error(
          "The secure checkout link is unavailable. Please try again.",
        );
      window.location.assign(target.href);
    } catch (error) {
      toast((error as Error).message);
      setBusy(false);
    }
  };
  return (
    <button
      className="button button-dark button-small"
      onClick={pay}
      disabled={busy}
    >
      {busy ? (
        <LoaderCircle size={17} className="spin" />
      ) : (
        <CreditCard size={17} />
      )}
      Pay securely · {money(booking.totalEstimate)}
    </button>
  );
}

export function PaymentDetails({ booking }: { booking: Booking }) {
  const payment = booking.payment;
  const canPay =
    booking.status === "CONFIRMED" &&
    (!payment || ["PENDING", "FAILED", "EXPIRED"].includes(payment.status));
  return (
    <div className="payment-details">
      <div>
        <span
          className={`status-badge payment-${payment?.status.toLowerCase() || "unpaid"}`}
        >
          <ShieldCheck size={15} />
          {payment
            ? paymentLabels[payment.status]
            : booking.status === "CONFIRMED"
              ? "Approved · Awaiting payment"
              : booking.status === "CANCELLED"
                ? "No payment collected"
                : "Waiting for team approval"}
        </span>
        {payment && !payment.livemode && (
          <span className="payment-test-label">
            Test payment · no real money
          </span>
        )}
      </div>
      {booking.status === "CANCELLED" && payment?.status === "PAID" && (
        <p>
          Your cancellation is received. The team will review and process your
          refund; your payment remains on record until then.
        </p>
      )}
      {payment?.status === "REFUND_PENDING" && (
        <p>
          Your refund has been submitted to Stripe. It will appear on the
          original payment method after processing.
        </p>
      )}
      {payment?.status === "REFUNDED" && (
        <p>
          {money(payment.refundedAmountCents / 100)} refunded to the original
          payment method.
        </p>
      )}
      {canPay && (
        <>
          <p>
            Your dates and total have been approved. Complete payment through
            Stripe to secure the booking.
          </p>
          <PaymentButton booking={booking} />
        </>
      )}
      {payment?.receiptUrl && (
        <a
          className="text-link"
          href={payment.receiptUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          View payment receipt
          <ExternalLink size={15} />
        </a>
      )}
    </div>
  );
}
