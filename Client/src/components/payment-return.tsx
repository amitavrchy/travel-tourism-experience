"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  ArrowRight,
  Check,
  CreditCard,
  LoaderCircle,
  RotateCcw,
} from "lucide-react";
import { api } from "@/lib/api";
import { money } from "@/lib/catalog";
import type { Booking, Payment } from "@/lib/types";
import { useApp } from "./providers";

export function PaymentReturn() {
  const params = useSearchParams();
  const session = params.get("session_id");
  const cancelled = params.get("cancelled") === "1";
  const { user, authLoading, openAuth } = useApp();
  const client = useQueryClient();
  const result = useQuery({
    queryKey: ["checkout", session, user?.id],
    queryFn: () =>
      api<{ payment: Payment; booking: Booking }>(
        `payments/sessions/${encodeURIComponent(session!)}`,
      ),
    enabled: !!session && !!user && !cancelled,
    retry: 1,
    refetchInterval: (query) =>
      ["PENDING", "PROCESSING"].includes(query.state.data?.payment.status || "")
        ? 2500
        : false,
  });
  const status = result.data?.payment.status;
  useEffect(() => {
    if (status) {
      client.invalidateQueries({ queryKey: ["bookings"] });
      client.invalidateQueries({ queryKey: ["operations"] });
    }
  }, [status, client]);
  const paid = status === "PAID";
  const failed = status === "FAILED" || status === "EXPIRED";
  return (
    <div className="container section">
      <div className="payment-return-card">
        <span className="success-circle">
          {paid ? (
            <Check size={26} />
          ) : result.isFetching || authLoading ? (
            <LoaderCircle className="spin" size={26} />
          ) : (
            <CreditCard size={26} />
          )}
        </span>
        <p className="eyebrow">YOUR NEXT CHAPTER</p>
        <h1>
          {cancelled
            ? "Room to think it over."
            : paid
              ? "You’re on your way."
              : failed
                ? "Let’s try that again."
                : result.error
                  ? "A small payment detour."
                  : !user && !authLoading
                    ? "Welcome back to your journey."
                    : !session
                      ? "Find your next chapter."
                      : "Checking your payment."}
        </h1>
        <p>
          {cancelled
            ? "Checkout was cancelled. No payment has been confirmed, and your approved inquiry is still in your journeys."
            : paid
              ? `Stripe has verified your ${money(result.data!.payment.amountCents / 100)} payment. Your booking details and receipt are ready below.`
              : result.error
                ? result.error.message
                : failed
                  ? "Your payment was not completed. You can safely try secure checkout again from your journeys."
                  : !user && !authLoading
                    ? "Sign in to verify your checkout and view your booking securely."
                    : !session
                      ? "Open your journeys to see bookings and payment progress."
                      : "We’re verifying the payment directly with Stripe. Please keep this page open for the latest status."}
        </p>
        {paid && result.data && (
          <div className="payment-return-summary">
            <strong>{result.data.booking.title}</strong>
            <span>
              WL-{result.data.booking.id.slice(0, 8).toUpperCase()} ·{" "}
              {result.data.booking.guests} travelers
            </span>
            {!result.data.payment.livemode && (
              <span>Stripe test mode · no real money charged</span>
            )}
            {result.data.payment.receiptUrl && (
              <a
                className="text-link"
                href={result.data.payment.receiptUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Stripe receipt
                <ArrowRight size={15} />
              </a>
            )}
          </div>
        )}
        <div className="confirm-actions">
          {!user && !authLoading && !cancelled && session ? (
            <button className="button button-dark" onClick={openAuth}>
              Sign in to verify
              <ArrowRight size={17} />
            </button>
          ) : (
            <Link className="button button-dark" href="/bookings?tab=bookings">
              View my journeys
              <ArrowRight size={17} />
            </Link>
          )}
          {result.error && (
            <button
              className="button button-outline"
              onClick={() => result.refetch()}
            >
              <RotateCcw size={16} />
              Check again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
