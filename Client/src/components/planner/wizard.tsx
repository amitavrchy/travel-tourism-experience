"use client";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  CalendarDays,
  Check,
  Compass,
  FileDown,
  Footprints,
  Leaf,
  LoaderCircle,
  MapPin,
  Minus,
  Plus,
  Sparkles,
  Sunrise,
  Users,
  X,
  Zap,
} from "lucide-react";
import { api, json } from "@/lib/api";
import { money } from "@/lib/catalog";
import type { Itinerary, PlannerInput, SavedPlan } from "@/lib/types";
import {
  updateDraft,
  type AppDispatch,
  type RootState,
} from "@/features/planner/plannerSlice";
import { useGenerateItinerary } from "@/features/planner/useGenerateItinerary";
import { useApp, useCatalog, Dialog } from "../providers";
import { MapView } from "../map/map-view";
import { DayCard } from "./day-card";
import { PrintablePlan } from "./printable-plan";
import { BookingForm, DateField } from "../booking-form";
import { exportPlan } from "../account";

const steps = ["Your somewhere", "Your rhythm", "The little details"];
const vibes = [
  "Nature",
  "Coast",
  "Culture",
  "Adventure",
  "Wellness",
  "Slow travel",
  "Romance",
  "Food",
];
const interests = [
  "Local food",
  "Hidden gems",
  "Art & architecture",
  "Walking trails",
  "Photography",
  "Local traditions",
  "Time to unwind",
];
const paces = [
  {
    id: "RELAXED",
    title: "Easy does it",
    description: "One main moment a day. Plenty of room to breathe.",
    icon: Sunrise,
  },
  {
    id: "BALANCED",
    title: "A little of both",
    description: "A couple of discoveries, with time in between.",
    icon: Footprints,
  },
  {
    id: "PACKED",
    title: "Follow the feeling",
    description: "Full days, new perspectives, a little more adventure.",
    icon: Zap,
  },
] as const;

export function Wizard() {
  const params = useSearchParams();
  const savedParam = params.get("saved");
  const { data } = useCatalog();
  const { user, authLoading, openAuth, toast } = useApp();
  const client = useQueryClient();
  const draft = useSelector((state: RootState) => state.planner);
  const dispatch = useDispatch<AppDispatch>();
  const [step, setStep] = useState(0);
  const [plan, setPlan] = useState<Itinerary | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [savedDirty, setSavedDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [streamedDays, setStreamedDays] = useState<Itinerary["days"]>([]);
  const [mapDay, setMapDay] = useState(1);
  const restored = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const draftRef = useRef(draft);
  const titleRef = useRef<HTMLDivElement>(null);
  const loadedSaved = useRef<string | null>(null);
  const generation = useGenerateItinerary();
  const hasPlan = !!plan;
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [hasPlan]);
  const savedQuery = useQuery({
    queryKey: ["plans", user?.id],
    queryFn: () => api<SavedPlan[]>("plans"),
    enabled: !!savedParam && !!user,
    retry: false,
  });
  useEffect(() => {
    try {
      const stored = localStorage.getItem("wanderline-planner-v1");
      if (stored) {
        const value = JSON.parse(stored);
        if (
          typeof value.destinationSlug === "string" &&
          Number.isInteger(value.days) &&
          value.days >= 3 &&
          value.days <= 14 &&
          Array.isArray(value.vibes) &&
          Array.isArray(value.interests) &&
          ["RELAXED", "BALANCED", "PACKED"].includes(value.pace) &&
          value.travelers >= 1 &&
          value.travelers <= 12 &&
          value.budget >= 40 &&
          value.budget <= 1500
        )
          dispatch(updateDraft(value));
      }
    } catch {
      /* Storage may be disabled by the browser. */
    }
    const destination = params.get("destination");
    if (destination && data.destinations.some((d) => d.slug === destination))
      dispatch(updateDraft({ destinationSlug: destination }));
    restored.current = true;
    // Run once on mount; subsequent preferences live in Redux.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    draftRef.current = draft;
    if (restored.current) {
      try {
        localStorage.setItem("wanderline-planner-v1", JSON.stringify(draft));
      } catch {
        /* Optional draft persistence. */
      }
    }
  }, [draft]);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    const saved = savedQuery.data?.find((p) => p.id === savedParam);
    if (saved && loadedSaved.current !== saved.id) {
      loadedSaved.current = saved.id;
      setPlan({ ...saved.planJson, title: saved.title });
      setSavedId(saved.id);
      dispatch(updateDraft(saved.inputJson));
    }
  }, [savedQuery.data, savedParam, dispatch]);
  const destination =
    data.destinations.find((d) => d.slug === draft.destinationSlug) ||
    data.destinations[0];
  const update = (value: Partial<PlannerInput>) => dispatch(updateDraft(value));
  const toggle = (key: "vibes" | "interests", value: string) =>
    update({
      [key]: draft[key].includes(value)
        ? draft[key].filter((v) => v !== value)
        : [...draft[key], value],
    });
  const scrollTop = () =>
    titleRef.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "start",
    });
  const generate = async () => {
    setError("");
    setProgress("Finding your kind of places…");
    setStreamedDays([]);
    setSavedId(null);
    setSavedDirty(false);
    const abort = new AbortController();
    controller.current?.abort();
    controller.current = abort;
    try {
      const input = { ...draftRef.current, destinationSlug: destination.slug };
      if (input.destinationSlug !== draftRef.current.destinationSlug)
        update({ destinationSlug: destination.slug });
      const result = await generation.mutateAsync({
        input,
        signal: abort.signal,
        onProgress: setProgress,
        onDay: (day) => setStreamedDays((days) => [...days, day]),
      });
      if (!abort.signal.aborted) {
        setPlan(result);
        setMapDay(1);
      }
    } catch (reason) {
      if (!abort.signal.aborted) setError((reason as Error).message);
    }
  };
  const save = async (): Promise<string | null> => {
    if (!plan) return null;
    if (!user) {
      openAuth();
      return null;
    }
    if (savedId && !savedDirty) return savedId;
    setSaving(true);
    try {
      const result = await api<SavedPlan>(
        "plans",
        json("POST", { inputJson: draft, planJson: plan }),
      );
      setSavedId(result.id);
      setSavedDirty(false);
      await client.invalidateQueries({ queryKey: ["plans"] });
      toast("A little possibility, saved for later.");
      return result.id;
    } catch (reason) {
      toast((reason as Error).message);
      return null;
    } finally {
      setSaving(false);
    }
  };
  const book = async () => {
    const id = await save();
    if (id) setBooking(true);
  };
  const download = () => {
    if (plan)
      exportPlan({
        id: savedId || "draft",
        title: plan.title,
        inputJson: draft,
        planJson: plan,
        createdAt: new Date().toISOString(),
      });
  };
  const selectedDay = plan?.days.find((day) => day.day === mapDay);
  const points = (selectedDay?.items || [])
    .filter((item) => item.type === "poi" || item.type === "experience")
    .map((item, index) => ({
      id: `${index}-${item.sourceId}`,
      name: item.title,
      lat: item.lat,
      lng: item.lng,
      description: item.notes,
    }));
  const pending = generation.isPending;
  if (!destination && !plan)
    return (
      <div className="container section">
        <div className="empty-state">
          <Compass size={38} />
          <h1>A little room for discovery.</h1>
          <p>
            Our local team is gathering new destination knowledge. Please check
            back for the next collection of journeys.
          </p>
          <Link className="button button-dark" href="/journal">
            A little inspiration from the road
          </Link>
        </div>
      </div>
    );
  if (savedParam && !plan) {
    return (
      <div className="container section">
        <div className="empty-state">
          <Bookmark size={36} />
          <h2>Your saved next chapter.</h2>
          <p>
            {authLoading || savedQuery.isFetching
              ? "Finding your itinerary…"
              : !user
                ? "Sign in to open your personal itinerary."
                : savedQuery.error
                  ? savedQuery.error.message
                  : "We couldn’t find this plan in your saved collection."}
          </p>
          {!user && !authLoading ? (
            <button className="button button-dark" onClick={openAuth}>
              Sign in
              <ArrowRight size={17} />
            </button>
          ) : user && !savedQuery.isFetching ? (
            <Link href="/bookings" className="button button-dark">
              Back to my journeys
            </Link>
          ) : (
            <LoaderCircle
              className="spin"
              size={25}
              style={{ margin: "auto" }}
            />
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="container planner-page" ref={titleRef}>
      {plan ? (
        <>
          <header className="planner-result-header">
            <div>
              <p className="eyebrow">
                <Sparkles size={15} /> YOUR NEXT CHAPTER, COMPOSED
              </p>
              <h1>{plan.title}</h1>
              <p>
                {draft.days} days · {draft.travelers} travelers ·{" "}
                {draft.pace.toLowerCase()} pace
                {draft.startDate ? ` · From ${draft.startDate}` : ""}
              </p>
            </div>
            <div className="result-actions no-print">
              <button
                className="button button-outline button-small"
                onClick={download}
              >
                <FileDown size={15} />
                Download
              </button>
              <button
                className="button button-dark button-small"
                onClick={() => save()}
                disabled={saving}
              >
                {saving ? (
                  <LoaderCircle size={15} className="spin" />
                ) : savedId && !savedDirty ? (
                  <Check size={15} />
                ) : (
                  <Bookmark size={15} />
                )}
                {savedId && !savedDirty
                  ? "Saved"
                  : savedId && savedDirty
                    ? "Save a new version"
                    : "Save my plan"}
              </button>
            </div>
          </header>
          <div className={`planner-mode mode-${plan.mode}`}>
            <span className="green-dot" />
            <p>
              {plan.mode === "ai"
                ? "AI-composed from verified destination notes. A thoughtful starting point, ready for your personal touch."
                : "Curated from our destination notes. AI is currently unavailable, so this itinerary uses a grounded local planning guide."}
            </p>
          </div>
          <div className="planner-result-grid">
            <div>
              <div className="timeline">
                {plan.days.map((day) => (
                  <DayCard
                    day={day}
                    key={day.day}
                    pois={data.pois.filter(
                      (p) => p.destinationId === destination?.id,
                    )}
                    onChange={(updated) => {
                      setPlan({
                        ...plan,
                        days: plan.days.map((d) =>
                          d.day === day.day ? updated : d,
                        ),
                      });
                      setSavedDirty(true);
                    }}
                  />
                ))}
              </div>
              <div className="planner-tips">
                <p className="eyebrow">
                  <Compass size={16} /> A FEW THINGS TO KEEP IN MIND
                </p>
                {plan.tips.map((tip, index) => (
                  <p key={index}>
                    <Check size={14} />
                    {tip}
                  </p>
                ))}
              </div>
              <details className="planner-sources">
                <summary>
                  Grounded in local knowledge · {plan.sources.length} source
                  notes
                </summary>
                {plan.sources.map((source) => (
                  <div key={source.id}>
                    <strong>{source.title}</strong>
                    <p>{source.text}</p>
                  </div>
                ))}
              </details>
              <div className="restart-actions no-print">
                <button
                  className="text-link"
                  onClick={() => {
                    setPlan(null);
                    setStep(0);
                    setSavedId(null);
                    scrollTop();
                  }}
                >
                  <ArrowLeft size={15} />
                  Change my preferences
                </button>
                <button className="text-link" onClick={() => window.print()}>
                  <FileDown size={15} />
                  Print / PDF
                </button>
              </div>
            </div>
            <aside className="planner-aside">
              <div className="itinerary-map">
                <div className="itinerary-map-heading">
                  <span className="eyebrow">
                    <MapPin size={13} /> YOUR DAYS, ON THE MAP
                  </span>
                  <select
                    aria-label="Show itinerary day on map"
                    value={mapDay}
                    onChange={(e) => setMapDay(Number(e.target.value))}
                  >
                    {plan.days.map((day) => (
                      <option key={day.day} value={day.day}>
                        Day {day.day}
                      </option>
                    ))}
                  </select>
                </div>
                <MapView points={points} route />
                <p className="map-disclaimer">
                  Pins follow your chosen day. Lines connect highlights, not
                  driving directions.
                </p>
              </div>
              <div className="plan-budget">
                <p className="eyebrow">A LITTLE PRACTICAL MAGIC</p>
                <h3>
                  {money(plan.estimatedBudget.min)}
                  <span> – {money(plan.estimatedBudget.max)}</span>
                </h3>
                <p>
                  USD estimate for {draft.travelers} travelers · {draft.days}{" "}
                  days
                  <br />
                  Stays, meals & local travel. Flights additional.
                </p>
                <button
                  className="button button-dark"
                  onClick={book}
                  disabled={saving}
                >
                  Make this journey happen
                  <ArrowUpRight size={16} />
                </button>
                <small>
                  An inquiry, not a commitment. We’ll confirm the details.
                </small>
              </div>
            </aside>
          </div>
          <PrintablePlan plan={plan} input={draft} />
          <AnimatePresence>
            {booking && savedId && (
              <Dialog
                title="Enquire about your journey"
                onClose={() => setBooking(false)}
              >
                <p className="eyebrow">FROM POSSIBLE TO PERSONAL</p>
                <h2>{plan.title}</h2>
                <BookingForm
                  planId={savedId}
                  price={plan.estimatedBudget.min / draft.travelers}
                  initialDate={draft.startDate}
                  initialGuests={draft.travelers}
                />
              </Dialog>
            )}
          </AnimatePresence>
        </>
      ) : (
        <>
          <header className="planner-intro">
            <p className="eyebrow">
              <Sparkles size={15} /> A LITTLE INTELLIGENCE. A LOT OF YOU.
            </p>
            <h1>
              Let’s compose
              <br />
              <em>your kind of journey.</em>
            </h1>
            <p>
              A few little details. A world of possibility. Tell us what moves
              you—we’ll find a thoughtful way to connect the dots.
            </p>
          </header>
          <div className="wizard-layout">
            <section className="wizard-card">
              <div className="wizard-steps" aria-label="Planner progress">
                {steps.map((label, index) => (
                  <button
                    key={label}
                    className={`${step === index ? "current" : ""} ${step > index ? "complete" : ""}`}
                    disabled={pending || index > step}
                    onClick={() => setStep(index)}
                  >
                    <span>
                      {step > index ? <Check size={13} /> : `0${index + 1}`}
                    </span>
                    <small>{label}</small>
                  </button>
                ))}
              </div>
              {pending ? (
                <div className="planner-generating" aria-live="polite">
                  <div className="generating-orbit">
                    <Compass size={45} className="spin" strokeWidth={1} />
                    <Sparkles size={18} />
                  </div>
                  <p className="eyebrow">A LITTLE WANDER IS IN THE WORKS</p>
                  <h2>Connecting your dots.</h2>
                  <p>{progress}</p>
                  {streamedDays.length ? (
                    <p>{streamedDays.length} days composed…</p>
                  ) : (
                    <div className="generation-skeletons">
                      {[1, 2, 3].map((i) => (
                        <div
                          className="skeleton"
                          key={i}
                          style={{ height: 45, width: `${100 - i * 7}%` }}
                        />
                      ))}
                    </div>
                  )}
                  <button
                    className="text-link"
                    onClick={() => {
                      controller.current?.abort();
                      generation.reset();
                    }}
                  >
                    <X size={15} />
                    Cancel planning
                  </button>
                </div>
              ) : (
                <>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={step}
                      className="wizard-step-content"
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -12 }}
                      transition={{ duration: 0.25 }}
                    >
                      {step === 0 ? (
                        <>
                          <p className="eyebrow">01 / YOUR SOMEWHERE</p>
                          <h2>Where’s calling you?</h2>
                          <p>
                            Start with a place. We’ll make the rest feel like
                            you.
                          </p>
                          <div className="destination-picker">
                            {data.destinations.map((d) => (
                              <button
                                className={
                                  draft.destinationSlug === d.slug
                                    ? "selected"
                                    : ""
                                }
                                key={d.id}
                                onClick={() =>
                                  update({ destinationSlug: d.slug })
                                }
                                aria-pressed={draft.destinationSlug === d.slug}
                              >
                                <Image
                                  src={d.heroImage}
                                  alt=""
                                  width={65}
                                  height={65}
                                />
                                <span>
                                  {d.name}
                                  <small>{d.country}</small>
                                </span>
                                {draft.destinationSlug === d.slug && (
                                  <span className="picker-check">
                                    <Check size={13} />
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                          <div className="wizard-question">
                            <h3>And what are you in the mood for?</h3>
                            <p>
                              A little of this, a little of that. Choose what
                              feels right.
                            </p>
                            <div className="choice-chips">
                              {vibes.map((vibe) => (
                                <button
                                  key={vibe}
                                  onClick={() => toggle("vibes", vibe)}
                                  className={
                                    draft.vibes.includes(vibe) ? "selected" : ""
                                  }
                                  aria-pressed={draft.vibes.includes(vibe)}
                                >
                                  {draft.vibes.includes(vibe) && (
                                    <Check size={12} />
                                  )}
                                  {vibe}
                                </button>
                              ))}
                            </div>
                          </div>
                        </>
                      ) : step === 1 ? (
                        <>
                          <p className="eyebrow">02 / YOUR RHYTHM</p>
                          <h2>Go at your own pace.</h2>
                          <p>There’s no right way to wander. Just your way.</p>
                          <div className="pace-options">
                            {paces.map((pace) => (
                              <button
                                key={pace.id}
                                onClick={() => update({ pace: pace.id })}
                                aria-pressed={draft.pace === pace.id}
                                className={
                                  draft.pace === pace.id ? "selected" : ""
                                }
                              >
                                <pace.icon size={25} strokeWidth={1.3} />
                                <span>
                                  <strong>{pace.title}</strong>
                                  <small>{pace.description}</small>
                                </span>
                                <span className="radio-indicator">
                                  {draft.pace === pace.id && <span />}
                                </span>
                              </button>
                            ))}
                          </div>
                          <div className="wizard-question">
                            <h3>What makes a day a good one?</h3>
                            <p>
                              Choose a few things you’d love to make time for.
                            </p>
                            <div className="choice-chips">
                              {interests.map((interest) => (
                                <button
                                  key={interest}
                                  onClick={() => toggle("interests", interest)}
                                  className={
                                    draft.interests.includes(interest)
                                      ? "selected"
                                      : ""
                                  }
                                  aria-pressed={draft.interests.includes(
                                    interest,
                                  )}
                                >
                                  {draft.interests.includes(interest) && (
                                    <Check size={12} />
                                  )}
                                  {interest}
                                </button>
                              ))}
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="eyebrow">03 / THE LITTLE DETAILS</p>
                          <h2>Make a little room.</h2>
                          <p>
                            How much time, who’s coming, and what feels
                            comfortable?
                          </p>
                          <div className="wizard-counters">
                            <div>
                              <span>
                                <CalendarDays size={19} />
                                Days to wander
                              </span>
                              <div className="stepper">
                                <button
                                  aria-label="Fewer days"
                                  disabled={draft.days <= 3}
                                  onClick={() =>
                                    update({ days: draft.days - 1 })
                                  }
                                >
                                  <Minus size={15} />
                                </button>
                                <strong>{draft.days}</strong>
                                <button
                                  aria-label="More days"
                                  disabled={draft.days >= 14}
                                  onClick={() =>
                                    update({ days: draft.days + 1 })
                                  }
                                >
                                  <Plus size={15} />
                                </button>
                              </div>
                            </div>
                            <div>
                              <span>
                                <Users size={19} />
                                Good company
                              </span>
                              <div className="stepper">
                                <button
                                  aria-label="Fewer travelers"
                                  disabled={draft.travelers <= 1}
                                  onClick={() =>
                                    update({ travelers: draft.travelers - 1 })
                                  }
                                >
                                  <Minus size={15} />
                                </button>
                                <strong>{draft.travelers}</strong>
                                <button
                                  aria-label="More travelers"
                                  disabled={draft.travelers >= 12}
                                  onClick={() =>
                                    update({ travelers: draft.travelers + 1 })
                                  }
                                >
                                  <Plus size={15} />
                                </button>
                              </div>
                            </div>
                          </div>
                          <DateField
                            label="When will your chapter begin? (optional)"
                            value={draft.startDate}
                            onChange={(value) => update({ startDate: value })}
                          />
                          <div className="budget-picker">
                            <label htmlFor="daily-budget">
                              A comfortable daily budget
                              <span>
                                {money(draft.budget)} <small>/ person</small>
                              </span>
                            </label>
                            <input
                              id="daily-budget"
                              type="range"
                              min={40}
                              max={1500}
                              step={10}
                              value={draft.budget}
                              onChange={(e) =>
                                update({ budget: Number(e.target.value) })
                              }
                            />
                            <div>
                              <span>A little simpler · $40</span>
                              <span>A little more room · $1,500</span>
                            </div>
                            <p>
                              USD per person, per day. Think stays, local
                              travel, and good food. International flights are
                              additional.
                            </p>
                          </div>
                          <div className="wizard-summary">
                            <Sparkles size={18} />
                            <p>
                              <strong>
                                {draft.days} days in {destination.name}
                              </strong>
                              , for {draft.travelers} curious{" "}
                              {draft.travelers === 1 ? "traveler" : "travelers"}
                              . A {draft.pace.toLowerCase()} rhythm, with{" "}
                              {draft.interests
                                .slice(0, 2)
                                .join(" and ")
                                .toLowerCase() || "room for discovery"}{" "}
                              along the way.
                            </p>
                          </div>
                        </>
                      )}
                    </motion.div>
                  </AnimatePresence>
                  {error && (
                    <p className="error-message" role="alert">
                      {error}
                    </p>
                  )}
                  <div className="wizard-bottom">
                    <button
                      className="text-link"
                      onClick={() => setStep(Math.max(0, step - 1))}
                      style={{ visibility: step === 0 ? "hidden" : "visible" }}
                    >
                      <ArrowLeft size={15} />A step back
                    </button>
                    <button
                      className="button button-dark"
                      onClick={() => {
                        if (step < 2) setStep(step + 1);
                        else generate();
                      }}
                    >
                      {step < 2 ? (
                        <>
                          A little more about you
                          <ArrowRight size={17} />
                        </>
                      ) : (
                        <>
                          Compose my journey
                          <Sparkles size={17} />
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </section>
            <aside className="wizard-preview">
              <div className="wizard-preview-image">
                <Image
                  src={destination.heroImage}
                  alt={destination.name}
                  fill
                  sizes="(max-width: 680px) 90vw, 35vw"
                />
                <span className="photo-tag">
                  <MapPin size={11} />
                  {destination.country}
                </span>
                <div>
                  <p className="eyebrow">YOUR NEXT CHAPTER COULD BE</p>
                  <h2>{destination.name}.</h2>
                  <p>{destination.tagline}</p>
                </div>
              </div>
              <div className="wizard-preview-details">
                <p>
                  <Leaf size={17} />
                  Grounded in real destination knowledge.
                </p>
                <p>
                  <Compass size={17} />A starting point, shaped by you.
                </p>
                <p>
                  <Bookmark size={17} />
                  Save it. Change it. Make it happen.
                </p>
              </div>
              <p className="wizard-privacy">
                Your preferences are kept on this device until you save a plan.
                Travel dates and availability are always subject to
                confirmation.
              </p>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
