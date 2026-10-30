"use client";
import { useCallback, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Check,
  Compass,
  Edit3,
  Layers3,
  LoaderCircle,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { api, json } from "@/lib/api";
import { money } from "@/lib/catalog";
import type { Booking } from "@/lib/types";
import { Dialog, useApp, useCatalog } from "./providers";

type RecordData = Record<string, unknown> & { id?: string };
type Resource =
  "destinations" | "pois" | "experiences" | "packages" | "journal" | "bookings";
const resources = [
  { id: "destinations", label: "Destinations", icon: Compass },
  { id: "pois", label: "Places of interest", icon: MapPin },
  { id: "experiences", label: "Experiences", icon: Sparkles },
  { id: "packages", label: "Journeys", icon: Layers3 },
  { id: "journal", label: "Journal", icon: BookOpen },
  { id: "bookings", label: "Booking inquiries", icon: Users },
] as const;
const defaults: Record<Exclude<Resource, "bookings">, RecordData> = {
  destinations: {
    name: "",
    slug: "",
    country: "",
    region: "Asia",
    tagline: "",
    description: "",
    heroImage: "/images/bali.jpg",
    lat: 0,
    lng: 0,
    bestMonths: [4, 5, 6, 7, 8, 9],
    tags: ["Nature"],
    embedText: "",
    color: "#81977b",
    startingPrice: 0,
    reading: "",
    bestSeason: "",
    timezone: "UTC",
  },
  pois: {
    destinationId: "bali",
    name: "",
    kind: "Nature",
    description: "",
    lat: 0,
    lng: 0,
  },
  experiences: {
    destinationId: "bali",
    slug: "",
    title: "",
    summary: "",
    durationHours: 2,
    priceFrom: 50,
    difficulty: "Easy",
    imageUrl: "/images/bali.jpg",
  },
  packages: {
    destinationId: "bali",
    slug: "",
    title: "",
    days: 3,
    priceFrom: 500,
    heroImage: "/images/bali.jpg",
    label: "A THOUGHTFUL ESCAPE",
    itineraryJson: [1, 2, 3].map((day) => ({
      day,
      theme:
        day === 1
          ? "Arrive & exhale"
          : day === 3
            ? "Until next time"
            : "A day to discover",
      description: "",
    })),
  },
  journal: {
    slug: "",
    title: "",
    excerpt: "",
    category: "FIELD NOTES",
    body: "",
    coverImage: "/images/bali.jpg",
    readMinutes: 5,
    publishedAt: new Date().toISOString(),
  },
};
const labels: Record<string, string> = {
  name: "Name",
  slug: "Page address",
  country: "Country",
  region: "Region",
  tagline: "A one-line introduction",
  description: "The story",
  heroImage: "Cover photograph",
  lat: "Latitude",
  lng: "Longitude",
  bestMonths: "Recommended months",
  tags: "Travel interests",
  embedText: "Local knowledge for itinerary planning",
  color: "Accent color",
  startingPrice: "Starting price (USD / person)",
  reading: "Editorial headline",
  bestSeason: "Best season, in a few words",
  timezone: "Time zone",
  destinationId: "Destination",
  kind: "Kind of place",
  title: "Title",
  summary: "A short introduction",
  durationHours: "Duration in hours",
  priceFrom: "Starting price (USD / person)",
  difficulty: "Activity level",
  imageUrl: "Photograph",
  days: "Days",
  label: "Collection label",
  excerpt: "A short introduction",
  category: "Story category",
  body: "Your story",
  coverImage: "Cover photograph",
  readMinutes: "Reading time (minutes)",
  publishedAt: "Publication date",
};
const longFields = ["description", "summary", "excerpt", "body", "embedText"];
const numericFields = [
  "lat",
  "lng",
  "startingPrice",
  "durationHours",
  "priceFrom",
  "days",
  "readMinutes",
];
const imageFields = ["heroImage", "imageUrl", "coverImage"];
const titleOf = (record: RecordData) =>
  String(record.name || record.title || record.id);
const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function Admin() {
  const { user, authLoading, openAuth, toast } = useApp();
  const { data: catalog } = useCatalog();
  const client = useQueryClient();
  const [resource, setResource] = useState<Resource>("destinations");
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<RecordData | null>(null);
  const [deleting, setDeleting] = useState<RecordData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const list = useQuery({
    queryKey: ["admin", resource],
    queryFn: () => api<RecordData[]>(`admin/${resource}`),
    enabled: user?.role === "ADMIN",
    retry: false,
  });
  const bookings = useQuery({
    queryKey: ["admin", "bookings"],
    queryFn: () => api<Booking[]>("admin/bookings"),
    enabled: user?.role === "ADMIN",
    retry: false,
  });
  const close = useCallback(() => {
    if (!busy) {
      setEditor(null);
      setError("");
    }
  }, [busy]);
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["admin"] }),
      client.invalidateQueries({ queryKey: ["catalog"] }),
      client.invalidateQueries({ queryKey: ["bookings"] }),
    ]);
  };
  const change = (key: string, value: unknown) =>
    setEditor((previous) => {
      if (!previous) return previous;
      const result = { ...previous, [key]: value };
      if (
        ["name", "title"].includes(key) &&
        !previous.id &&
        previous.slug === slugify(String(previous[key] || ""))
      )
        result.slug = slugify(String(value));
      if (key === "days") {
        const old = previous.itineraryJson as {
          day: number;
          theme: string;
          description: string;
        }[];
        result.itineraryJson = Array.from(
          { length: Math.max(1, Math.min(14, Number(value))) },
          (_, i) =>
            old[i] || {
              day: i + 1,
              theme: "A day to discover",
              description: "",
            },
        );
      }
      return result;
    });
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editor) return;
    setBusy(true);
    setError("");
    try {
      const { id, ...body } = editor;
      await api(
        `admin/${resource}${id ? `/${id}` : ""}`,
        json(id ? "PATCH" : "POST", body),
      );
      await refresh();
      setEditor(null);
      toast(id ? "A thoughtful update, saved." : "A new possibility, added.");
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!deleting?.id) return;
    setBusy(true);
    try {
      await api(`admin/${resource}/${deleting.id}`, json("DELETE"));
      await refresh();
      setDeleting(null);
      toast("The item has been removed.");
    } catch (reason) {
      toast((reason as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const status = async (id: string, value: string) => {
    setBusy(true);
    try {
      await api(`admin/bookings/${id}`, json("PATCH", { status: value }));
      await refresh();
      toast("Inquiry status updated.");
    } catch (reason) {
      toast((reason as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (authLoading)
    return (
      <div className="container section">
        <div className="skeleton" style={{ height: 400 }} />
      </div>
    );
  if (user?.role !== "ADMIN")
    return (
      <div className="container section">
        <div className="empty-state">
          <ShieldCheck size={42} />
          <h1>The studio.</h1>
          <p>
            {user
              ? "This space is for the Wanderline editorial and travel team."
              : "Sign in with your administrator account to open the Wanderline studio."}
          </p>
          {user ? (
            <Link href="/bookings" className="button button-dark">
              Back to my journeys
              <ArrowRightIcon />
            </Link>
          ) : (
            <button className="button button-dark" onClick={openAuth}>
              Sign in to the studio
            </button>
          )}
        </div>
      </div>
    );
  const shown =
    list.data?.filter((row) =>
      `${titleOf(row)} ${row.email || ""} ${row.country || ""}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    ) || [];
  const current = resources.find((item) => item.id === resource)!;
  return (
    <div className="container admin-page">
      <header className="admin-header">
        <div>
          <p className="eyebrow">
            <ShieldCheck size={15} /> THE WANDERLINE STUDIO
          </p>
          <h1>
            Good things,
            <br />
            <em>thoughtfully managed.</em>
          </h1>
        </div>
        <Link className="button button-dark" href="/admin/payments">
          <Users size={17} />
          Bookings & payments
        </Link>
        <Link className="text-link" href="/bookings">
          <ArrowLeft size={15} />
          My journeys
        </Link>
      </header>
      <div className="admin-stats">
        <div>
          <span>PLACES TO DISCOVER</span>
          <strong>
            {catalog.destinations.length.toString().padStart(2, "0")}
          </strong>
          <small>Destinations, thoughtfully chosen</small>
        </div>
        <div>
          <span>JOURNEYS TO COMPOSE</span>
          <strong>{catalog.packages.length.toString().padStart(2, "0")}</strong>
          <small>Small groups, great possibilities</small>
        </div>
        <div>
          <span>NEW CHAPTERS WAITING</span>
          <strong>
            {(bookings.data?.filter((b) => b.status === "INQUIRY").length || 0)
              .toString()
              .padStart(2, "0")}
          </strong>
          <small>Inquiries ready for a personal response</small>
        </div>
      </div>
      <div className="admin-workspace">
        <nav className="admin-nav" aria-label="Studio sections">
          {resources.map((item) => (
            <button
              className={resource === item.id ? "selected" : ""}
              key={item.id}
              onClick={() => {
                setResource(item.id);
                setQuery("");
              }}
            >
              <item.icon size={17} />
              {item.label}
            </button>
          ))}
        </nav>
        <section className="admin-content">
          <div className="admin-content-heading">
            <div>
              <p className="eyebrow">A LITTLE CARE GOES A LONG WAY</p>
              <h2>{current.label}.</h2>
            </div>
            {resource !== "bookings" && (
              <button
                className="button button-dark button-small"
                onClick={() => {
                  const value = structuredClone(defaults[resource]);
                  if (value.destinationId && catalog.destinations[0])
                    value.destinationId = catalog.destinations[0].id;
                  setEditor(value);
                  setError("");
                }}
              >
                <Plus size={15} />
                Add{" "}
                {resource === "pois"
                  ? "a place"
                  : resource === "packages"
                    ? "a journey"
                    : resource === "journal"
                      ? "a story"
                      : resource === "experiences"
                        ? "an experience"
                        : "a destination"}
              </button>
            )}
          </div>
          <div className="search-input">
            <Search size={17} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label={`Search ${current.label.toLowerCase()}`}
              placeholder={`Find ${current.label.toLowerCase()}…`}
            />
          </div>
          {list.isPending ? (
            <div className="skeleton" style={{ height: 220 }} />
          ) : list.error ? (
            <p className="error-message" role="alert">
              {list.error.message}
              <button
                className="text-link"
                onClick={() => list.refetch()}
                style={{ marginLeft: 15 }}
              >
                Try again
              </button>
            </p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>
                      {resource === "bookings"
                        ? "Journey / traveler"
                        : "Name / title"}
                    </th>
                    <th>
                      {resource === "bookings"
                        ? "Dates & travelers"
                        : "Details"}
                    </th>
                    <th>{resource === "bookings" ? "Status" : "Manage"}</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <strong>{titleOf(row)}</strong>
                        <small>
                          {resource === "bookings"
                            ? String(row.email)
                            : row.slug
                              ? `/${row.slug}`
                              : catalog.destinations.find(
                                  (d) => d.id === row.destinationId,
                                )?.name}
                        </small>
                        {resource === "bookings" && row.notes ? (
                          <details className="booking-admin-notes">
                            <summary>Traveler’s note</summary>
                            <p>{String(row.notes)}</p>
                          </details>
                        ) : null}
                      </td>
                      <td>
                        {resource === "bookings" ? (
                          <>
                            <span>{String(row.startDate).slice(0, 10)}</span>
                            <small>
                              {String(row.guests)} travelers ·{" "}
                              {money(Number(row.totalEstimate))}
                            </small>
                          </>
                        ) : resource === "destinations" ? (
                          <>
                            <span>{String(row.country)}</span>
                            <small>{String(row.region)}</small>
                          </>
                        ) : resource === "packages" ? (
                          <>
                            <span>{String(row.days)} days</span>
                            <small>
                              {money(Number(row.priceFrom))} / person
                            </small>
                          </>
                        ) : resource === "experiences" ? (
                          <>
                            <span>{String(row.durationHours)} hours</span>
                            <small>
                              {money(Number(row.priceFrom))} / person
                            </small>
                          </>
                        ) : resource === "pois" ? (
                          <span>{String(row.kind)}</span>
                        ) : (
                          <span>{String(row.category).toLowerCase()}</span>
                        )}
                      </td>
                      <td>
                        {resource === "bookings" ? (
                          <select
                            aria-label={`Status for ${titleOf(row)}`}
                            className={`status-select status-${String(row.status).toLowerCase()}`}
                            value={String(row.status)}
                            onChange={(e) =>
                              status(String(row.id), e.target.value)
                            }
                            disabled={busy}
                          >
                            {["INQUIRY", "CONFIRMED", "CANCELLED"].map(
                              (value) => (
                                <option key={value} value={value}>
                                  {value === "INQUIRY"
                                    ? "Inquiry received"
                                    : value === "CONFIRMED"
                                      ? "Confirmed"
                                      : "Cancelled"}
                                </option>
                              ),
                            )}
                          </select>
                        ) : (
                          <div className="admin-row-actions">
                            <button
                              className="icon-button"
                              aria-label={`Edit ${titleOf(row)}`}
                              onClick={() => {
                                setEditor(structuredClone(row));
                                setError("");
                              }}
                            >
                              <Edit3 size={16} />
                            </button>
                            <button
                              className="icon-button"
                              aria-label={`Delete ${titleOf(row)}`}
                              onClick={() => setDeleting(row)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!shown.length && (
                <div className="empty-state">
                  <Compass size={30} />
                  <h3>A little room for possibility.</h3>
                  <p>
                    {query
                      ? "No matches. Try a different search."
                      : "No items here yet."}
                  </p>
                </div>
              )}
            </div>
          )}
          <p className="admin-list-note">
            {shown.length} {shown.length === 1 ? "item" : "items"} · Changes are
            saved and reflected in the travel experience.
          </p>
        </section>
      </div>
      <AnimatePresence>
        {editor && resource !== "bookings" && (
          <Dialog
            wide
            title={`${editor.id ? "Edit" : "Add"} ${current.label.toLowerCase()}`}
            onClose={close}
          >
            <p className="eyebrow">A LITTLE EDITORIAL CARE</p>
            <h2>
              {editor.id
                ? `A fresh look at ${titleOf(editor)}.`
                : `Add to ${current.label.toLowerCase()}.`}
            </h2>
            <form className="admin-editor" onSubmit={save}>
              <div className="admin-form-grid">
                {Object.keys(defaults[resource])
                  .filter((key) => key !== "itineraryJson")
                  .map((key) => (
                    <label
                      className={
                        longFields.includes(key) ||
                        key === "tags" ||
                        key === "bestMonths"
                          ? "full-width"
                          : ""
                      }
                      key={key}
                    >
                      {labels[key]}
                      {key === "slug" && (
                        <small>
                          The final part of this page’s URL. Use lowercase
                          letters and hyphens.
                        </small>
                      )}
                      {longFields.includes(key) ? (
                        <textarea
                          required
                          value={String(editor[key] || "")}
                          rows={key === "body" ? 12 : 4}
                          maxLength={20000}
                          onChange={(e) => change(key, e.target.value)}
                        />
                      ) : key === "destinationId" ? (
                        <select
                          required
                          value={String(editor[key])}
                          onChange={(e) => change(key, e.target.value)}
                        >
                          {catalog.destinations.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}, {d.country}
                            </option>
                          ))}
                        </select>
                      ) : imageFields.includes(key) ? (
                        <select
                          value={String(editor[key])}
                          onChange={(e) => change(key, e.target.value)}
                        >
                          {[
                            ...new Set(
                              catalog.destinations.map((d) => d.heroImage),
                            ),
                          ].map((image) => (
                            <option key={image} value={image}>
                              {
                                catalog.destinations.find(
                                  (d) => d.heroImage === image,
                                )?.name
                              }{" "}
                              photograph
                            </option>
                          ))}
                        </select>
                      ) : key === "region" ||
                        key === "difficulty" ||
                        key === "kind" ? (
                        <select
                          value={String(editor[key])}
                          onChange={(e) => change(key, e.target.value)}
                        >
                          {(key === "region"
                            ? [
                                "Asia",
                                "Europe",
                                "Africa",
                                "North America",
                                "South America",
                                "Oceania",
                              ]
                            : key === "difficulty"
                              ? ["Easy", "Moderate", "Challenging"]
                              : ["Nature", "Culture", "Food", "Coast", "Hike"]
                          ).map((value) => (
                            <option key={value}>{value}</option>
                          ))}
                        </select>
                      ) : key === "bestMonths" ? (
                        <div className="month-picker">
                          {[
                            "Jan",
                            "Feb",
                            "Mar",
                            "Apr",
                            "May",
                            "Jun",
                            "Jul",
                            "Aug",
                            "Sep",
                            "Oct",
                            "Nov",
                            "Dec",
                          ].map((month, index) => {
                            const months = editor.bestMonths as number[];
                            return (
                              <button
                                type="button"
                                key={month}
                                className={
                                  months.includes(index + 1) ? "selected" : ""
                                }
                                aria-pressed={months.includes(index + 1)}
                                onClick={() =>
                                  change(
                                    key,
                                    months.includes(index + 1)
                                      ? months.filter((n) => n !== index + 1)
                                      : [...months, index + 1].sort(
                                          (a, b) => a - b,
                                        ),
                                  )
                                }
                              >
                                {month}
                              </button>
                            );
                          })}
                        </div>
                      ) : key === "tags" ? (
                        <input
                          value={(editor.tags as string[]).join(", ")}
                          onChange={(e) =>
                            change(
                              key,
                              e.target.value.split(",").map((v) => v.trim()),
                            )
                          }
                          placeholder="Nature, Culture, Slow travel"
                        />
                      ) : key === "publishedAt" ? (
                        <input
                          type="date"
                          required
                          value={String(editor[key]).slice(0, 10)}
                          onChange={(e) =>
                            change(
                              key,
                              e.target.value
                                ? new Date(
                                    `${e.target.value}T00:00:00Z`,
                                  ).toISOString()
                                : "",
                            )
                          }
                        />
                      ) : (
                        <input
                          required
                          type={
                            key === "color"
                              ? "color"
                              : numericFields.includes(key)
                                ? "number"
                                : "text"
                          }
                          min={
                            key === "lat"
                              ? -90
                              : key === "lng"
                                ? -180
                                : key === "days" || key === "readMinutes"
                                  ? 1
                                  : numericFields.includes(key)
                                    ? 0
                                    : undefined
                          }
                          max={
                            key === "lat"
                              ? 90
                              : key === "lng"
                                ? 180
                                : key === "days"
                                  ? 14
                                  : undefined
                          }
                          step={
                            key === "days" || key === "readMinutes"
                              ? 1
                              : numericFields.includes(key)
                                ? "any"
                                : undefined
                          }
                          value={String(editor[key] ?? "")}
                          onChange={(e) =>
                            change(
                              key,
                              numericFields.includes(key)
                                ? Number(e.target.value)
                                : e.target.value,
                            )
                          }
                        />
                      )}
                    </label>
                  ))}
              </div>
              {resource === "packages" && (
                <div className="admin-itinerary-editor">
                  <h3>The days ahead.</h3>
                  {(
                    editor.itineraryJson as {
                      day: number;
                      theme: string;
                      description: string;
                    }[]
                  ).map((day, index, all) => (
                    <div key={day.day}>
                      <p className="eyebrow">DAY {day.day}</p>
                      <label>
                        Day headline
                        <input
                          required
                          value={day.theme}
                          onChange={(e) =>
                            change(
                              "itineraryJson",
                              all.map((item, n) =>
                                n === index
                                  ? { ...item, theme: e.target.value }
                                  : item,
                              ),
                            )
                          }
                        />
                      </label>
                      <label>
                        The day’s story
                        <textarea
                          required
                          value={day.description}
                          onChange={(e) =>
                            change(
                              "itineraryJson",
                              all.map((item, n) =>
                                n === index
                                  ? { ...item, description: e.target.value }
                                  : item,
                              ),
                            )
                          }
                        />
                      </label>
                    </div>
                  ))}
                </div>
              )}
              {error && (
                <p className="error-message" role="alert">
                  {error}
                </p>
              )}
              <div className="admin-editor-footer">
                <button
                  type="button"
                  className="button button-outline"
                  onClick={close}
                  disabled={busy}
                >
                  Cancel
                </button>
                <button className="button button-dark" disabled={busy}>
                  {busy ? (
                    <LoaderCircle size={16} className="spin" />
                  ) : (
                    <Check size={16} />
                  )}
                  Save changes
                </button>
              </div>
            </form>
          </Dialog>
        )}
        {deleting && (
          <Dialog
            title="Remove this item"
            onClose={() => {
              if (!busy) setDeleting(null);
            }}
          >
            <p className="eyebrow">A LITTLE CHANGE</p>
            <h2>Remove {titleOf(deleting)}?</h2>
            <p className="muted">
              {resource === "destinations"
                ? "This also removes its places, experiences and curated journeys. Existing booking inquiries are retained."
                : "This item will be removed from the travel experience. Existing booking inquiries are retained."}
            </p>
            <div className="confirm-actions">
              <button
                className="button button-outline"
                onClick={() => setDeleting(null)}
                disabled={busy}
              >
                Keep it
              </button>
              <button
                className="button button-dark"
                onClick={remove}
                disabled={busy}
              >
                {busy && <LoaderCircle size={16} className="spin" />}Remove item
              </button>
            </div>
          </Dialog>
        )}
      </AnimatePresence>
    </div>
  );
}
function ArrowRightIcon() {
  return <ArrowUpRight size={16} />;
}
