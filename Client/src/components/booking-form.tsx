"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { addDays, addYears, format, parseISO, startOfDay } from "date-fns";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  LoaderCircle,
} from "lucide-react";
import { api, json } from "@/lib/api";
import { money } from "@/lib/catalog";
import type { Booking } from "@/lib/types";
import { useApp } from "./providers";

export function DateField({
  value,
  onChange,
  label = "Departure date",
  error,
}: {
  value: string;
  onChange: (date: string) => void;
  label?: string;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const today = startOfDay(new Date());
  return (
    <div className="date-field">
      <span className="field-label">{label}</span>
      <button
        type="button"
        className="date-trigger"
        aria-expanded={open}
        aria-label={
          value ? `${label}: ${format(parseISO(value), "MMMM d, yyyy")}` : label
        }
        onClick={() => setOpen(!open)}
      >
        <CalendarDays size={16} />
        {value ? format(parseISO(value), "MMM d, yyyy") : "Choose a date"}
        <ChevronDown size={15} />
      </button>
      {open && (
        <div className="date-popover">
          <DayPicker
            mode="single"
            selected={value ? parseISO(value) : undefined}
            defaultMonth={value ? parseISO(value) : today}
            onSelect={(date) => {
              if (date) {
                onChange(format(date, "yyyy-MM-dd"));
                setOpen(false);
              }
            }}
            disabled={[{ before: today }, { after: addYears(today, 2) }]}
            startMonth={today}
            endMonth={addYears(today, 2)}
            captionLayout="dropdown"
          />
          <button
            type="button"
            className="text-link date-close"
            onClick={() => setOpen(false)}
          >
            Close calendar
          </button>
        </div>
      )}
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}

const schema = z.object({
  startDate: z.string().min(10, "Choose a departure date."),
  guests: z.number().int().min(1).max(12),
  email: z.email("Enter a valid email address."),
  notes: z.string().max(2000, "Keep your note under 2,000 characters."),
});
type Values = z.infer<typeof schema>;
export function BookingForm({
  packageId,
  planId,
  price,
  initialDate = "",
  initialGuests = 2,
  initialNotes = "",
}: {
  packageId?: string;
  planId?: string;
  price: number;
  initialDate?: string;
  initialGuests?: number;
  initialNotes?: string;
}) {
  const { user, openAuth, toast } = useApp();
  const client = useQueryClient();
  const [error, setError] = useState("");
  const [booking, setBooking] = useState<Booking | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      startDate: initialDate || format(addDays(new Date(), 14), "yyyy-MM-dd"),
      guests: initialGuests,
      email: user?.email || "",
      notes: initialNotes,
    },
  });
  useEffect(() => {
    if (user?.email && !form.getValues("email"))
      form.setValue("email", user.email);
  }, [user, form]);
  // Subscribe to values used by the live estimate and the calendar.
  // eslint-disable-next-line react-hooks/incompatible-library
  const guests = form.watch("guests");
  const date = form.watch("startDate");
  const submit = form.handleSubmit(async (values) => {
    if (!user) {
      openAuth();
      return;
    }
    setError("");
    try {
      const result = await api<Booking>(
        "bookings",
        json("POST", { ...values, packageId, planId }),
      );
      setBooking(result);
      await client.invalidateQueries({ queryKey: ["bookings"] });
      toast("Your inquiry is in. A new chapter is on its way.");
    } catch (reason) {
      setError((reason as Error).message);
    }
  });
  if (booking)
    return (
      <div className="booking-success" role="status">
        <span className="success-circle">
          <Check size={23} />
        </span>
        <h3>
          Your next chapter
          <br />
          starts here.
        </h3>
        <p>
          Your inquiry is saved. Once the team approves your dates and total,
          you can pay securely with Stripe from My journeys.
        </p>
        <div className="inquiry-reference">
          <small>INQUIRY REFERENCE</small>
          <strong>WL-{booking.id.slice(0, 8).toUpperCase()}</strong>
        </div>
        <Link href="/bookings" className="button button-dark">
          View my journeys
          <ArrowRight size={17} />
        </Link>
        <button className="text-link" onClick={() => setBooking(null)}>
          Send another inquiry
        </button>
      </div>
    );
  return (
    <form className="stack-form" onSubmit={submit} noValidate>
      <DateField
        value={date}
        onChange={(value) =>
          form.setValue("startDate", value, { shouldValidate: true })
        }
        error={form.formState.errors.startDate?.message}
      />
      <label>
        Travelers
        <select
          aria-label="Travelers"
          {...form.register("guests", { valueAsNumber: true })}
        >
          {Array.from({ length: 12 }, (_, i) => (
            <option value={i + 1} key={i + 1}>
              {i + 1} {i ? "travelers" : "traveler"}
            </option>
          ))}
        </select>
      </label>
      <label>
        Email address
        <input
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          {...form.register("email")}
        />
        {form.formState.errors.email && (
          <span className="field-error">
            {form.formState.errors.email.message}
          </span>
        )}
      </label>
      <label>
        Anything we should know?
        <small>
          Dietary needs, access requirements, or a little wish list.
        </small>
        <textarea
          placeholder="Make it a little more you…"
          {...form.register("notes")}
        />
        {form.formState.errors.notes && (
          <span className="field-error">
            {form.formState.errors.notes.message}
          </span>
        )}
      </label>
      <div className="booking-summary">
        <span>Estimated total · {guests || 1} guests</span>
        <strong>{money(price * (guests || 1))}</strong>
      </div>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        className="button button-dark"
        disabled={form.formState.isSubmitting}
      >
        {form.formState.isSubmitting ? (
          <LoaderCircle size={17} className="spin" />
        ) : (
          <ArrowRight size={17} />
        )}
        {user ? "Send a booking inquiry" : "Sign in to enquire"}
      </button>
      <p className="booking-note">
        No payment now. No commitment until we confirm.
        <br />
        Estimates exclude international flights.
      </p>
    </form>
  );
}
