"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  Compass,
  Feather,
  Globe2,
  HeartHandshake,
  Leaf,
  MapPin,
  Sparkles,
  Sun,
} from "lucide-react";
import { useCatalog } from "./providers";
import { DestinationCard, JournalCard, TripCard } from "./cards";
import { Reveal } from "./motion";

const feelings = [
  "A little of everything",
  "Into the wild",
  "By the water",
  "Culture & connection",
  "The slow life",
];
const feelingTags: Record<string, string[]> = {
  "Into the wild": ["Nature", "Adventure"],
  "By the water": ["Coast"],
  "Culture & connection": ["Culture", "Food"],
  "The slow life": ["Slow travel", "Wellness"],
};
export function Home() {
  const { data } = useCatalog();
  const [feeling, setFeeling] = useState(feelings[0]);
  const rail = useRef<HTMLDivElement>(null);
  const hero = useRef<HTMLElement>(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let cleanup: (() => void) | undefined;
    let disposed = false;
    Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(
      ([{ gsap }, { ScrollTrigger }]) => {
        if (disposed) return;
        gsap.registerPlugin(ScrollTrigger);
        const context = gsap.context(() => {
          gsap.to(".hero-photo", {
            yPercent: 16,
            scale: 1.08,
            ease: "none",
            scrollTrigger: {
              trigger: hero.current,
              start: "top top",
              end: "bottom top",
              scrub: 1,
            },
          });
          gsap.fromTo(
            ".explore-orbit",
            { rotate: -8, scale: 0.92 },
            {
              rotate: 3,
              scale: 1,
              ease: "none",
              scrollTrigger: {
                trigger: ".map-story",
                start: "top bottom",
                end: "bottom top",
                scrub: 1,
              },
            },
          );
        }, hero.current?.parentElement || undefined);
        cleanup = () => context.revert();
      },
    );
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);
  const shown = data.destinations.filter(
    (d) =>
      feeling === feelings[0] ||
      d.tags.some((tag) => feelingTags[feeling]?.includes(tag)),
  );
  return (
    <>
      <section ref={hero} className="hero">
        <Image
          className="hero-photo"
          src="/images/bali.jpg"
          alt="A lakeside Balinese temple reflected in still water"
          fill
          priority
          sizes="100vw"
          quality={90}
        />
        <div className="hero-shade" />
        <div className="hero-grain" />
        <div className="container hero-content">
          <div className="hero-kicker">
            <span /> LESS ORDINARY. MORE YOU.
          </div>
          <h1>
            Some places
            <br />
            change your
            <br />
            <em>perspective.</em>
          </h1>
          <p>
            Go beyond the itinerary. Find the places,
            <br className="desktop-break" /> people, and moments that stay with
            you.
          </p>
          <div className="hero-buttons">
            <Link href="/destinations" className="button button-paper">
              Find your somewhere
              <ArrowUpRight size={19} />
            </Link>
            <Link href="/plan" className="hero-planner">
              <Sparkles size={17} />
              Or, dream it up with AI
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
        <div className="hero-bottom container">
          <a href="#destinations" className="scroll-hint">
            <span className="scroll-circle">
              <ArrowDown size={17} />
            </span>
            SCROLL TO WANDER
          </a>
          <Link href="/destinations/bali" className="hero-location">
            <MapPin size={16} />
            <span>
              Somewhere in Bali, Indonesia<small>8.5069° S · 115.2625° E</small>
            </span>
            <ArrowUpRight size={19} />
          </Link>
          <span className="hero-pagination">
            <b>01</b>
            <span />
            <span />
            <span />
            06
          </span>
        </div>
      </section>
      <div className="promise-bar">
        <div className="container">
          <span>
            <Compass size={19} />
            Thoughtfully curated
          </span>
          <i />
          <span>
            <HeartHandshake size={19} />
            Locally connected
          </span>
          <i />
          <span>
            <Leaf size={19} />
            Light on the planet
          </span>
          <i />
          <span>
            <Feather size={19} />
            Entirely your own
          </span>
        </div>
      </div>
      <section
        id="destinations"
        className="section container destinations-section"
      >
        <Reveal className="section-heading">
          <div>
            <p className="eyebrow">
              <span className="small-line" /> THE WORLD IS STILL FULL OF WONDER
            </p>
            <h2>
              Where do you
              <br />
              want to <em>feel alive?</em>
            </h2>
          </div>
          <div className="section-heading-aside">
            <p>
              Somewhere new. Something different.
              <br />A place that feels a little more like you.
            </p>
            <Link href="/destinations" className="text-link">
              Explore all destinations
              <ArrowUpRight size={17} />
            </Link>
          </div>
        </Reveal>
        <Reveal>
          <div className="destination-controls">
            <div
              className="feeling-tabs"
              aria-label="Filter destinations by feeling"
            >
              {feelings.map((item, i) => (
                <button
                  key={item}
                  className={feeling === item ? "selected" : ""}
                  onClick={() => {
                    setFeeling(item);
                    rail.current?.scrollTo({ left: 0, behavior: "smooth" });
                  }}
                >
                  {i === 0 && <Globe2 size={15} />}
                  {item}
                </button>
              ))}
            </div>
            <div className="carousel-controls">
              <button
                className="icon-button bordered"
                aria-label="Previous destinations"
                onClick={() =>
                  rail.current?.scrollBy({
                    left: -(rail.current.clientWidth * 0.8),
                    behavior: "smooth",
                  })
                }
              >
                <ArrowLeft size={18} />
              </button>
              <button
                className="icon-button bordered"
                aria-label="Next destinations"
                onClick={() =>
                  rail.current?.scrollBy({
                    left: rail.current.clientWidth * 0.8,
                    behavior: "smooth",
                  })
                }
              >
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </Reveal>
        <div className="destination-rail" ref={rail}>
          {shown.map((d, i) => (
            <DestinationCard destination={d} index={i} key={d.id} />
          ))}
        </div>
        <div className="rail-caption">
          <span>GOOD PLACES. GREAT POSSIBILITIES.</span>
          <span>
            Scroll a little. Dream a little. <ArrowRight size={14} />
          </span>
        </div>
      </section>
      <section className="planner-story container">
        <Reveal className="planner-copy">
          <span className="eyebrow">
            <Sparkles size={15} /> A LITTLE INTELLIGENCE. A LOT OF POSSIBILITY.
          </span>
          <h2>
            Your kind of trip.
            <br />
            <em>One of a kind.</em>
          </h2>
          <p>
            Tell us what moves you. Our AI trip planner connects the dots—so you
            can follow your curiosity, at your own pace.
          </p>
          <div className="planner-benefits">
            <span>
              <Check size={15} />
              Built around your interests
            </span>
            <span>
              <Check size={15} />
              Grounded in local knowledge
            </span>
            <span>
              <Check size={15} />
              Yours to change along the way
            </span>
          </div>
          <Link className="button button-dark" href="/plan">
            Let’s dream up your journey
            <Sparkles size={17} />
          </Link>
          <small>No perfect plans required. Just a little curiosity.</small>
        </Reveal>
        <Reveal className="planner-visual" delay={0.1}>
          <div className="planner-visual-background">
            <Image
              src="/images/bali.jpg"
              alt="Green landscapes around Ubud"
              fill
              sizes="50vw"
            />
          </div>
          <div className="floating-chip">
            <span className="green-dot" /> MADE FOR YOUR KIND OF WANDERING
          </div>
          <div className="sample-plan">
            <div className="sample-plan-heading">
              <span>
                <Sparkles size={17} /> YOUR NEXT CHAPTER
              </span>
              <span>5 DAYS · BALI</span>
            </div>
            <h3>
              A little wild.
              <br />A little wonderful.
            </h3>
            <div className="sample-plan-tags">
              <span>Nature</span>
              <span>Local food</span>
              <span>Slow mornings</span>
            </div>
            {[
              {
                n: "01",
                title: "Arrive. Exhale. You’re here.",
                sub: "Ubud · Settle into island time",
                icon: Sun,
              },
              {
                n: "02",
                title: "Take the greener path.",
                sub: "Rice terraces · A local table",
                icon: Leaf,
              },
              {
                n: "03",
                title: "Find your quiet moment.",
                sub: "Temple trails · Time to wander",
                icon: Compass,
              },
            ].map((day) => (
              <div className="sample-day" key={day.n}>
                <span className="sample-day-number">{day.n}</span>
                <div>
                  <strong>{day.title}</strong>
                  <small>{day.sub}</small>
                </div>
                <day.icon size={17} />
              </div>
            ))}
            <Link href="/plan" className="sample-plan-link">
              Make it yours
              <ArrowUpRight size={17} />
            </Link>
          </div>
          <span className="visual-note">A starting point. Never a script.</span>
        </Reveal>
      </section>
      <section className="section container">
        <Reveal className="section-heading">
          <div>
            <p className="eyebrow">
              <span className="small-line" /> GOOD THINGS COME TO THOSE WHO
              WANDER
            </p>
            <h2>
              Less planning.
              <br />
              <em>More living.</em>
            </h2>
          </div>
          <div className="section-heading-aside">
            <p>
              Our favorite journeys, thoughtfully put together.
              <br />
              All that’s missing is you.
            </p>
            <Link className="text-link" href="/trips">
              Discover our journeys
              <ArrowUpRight size={17} />
            </Link>
          </div>
        </Reveal>
        <div className="three-grid">
          {data.packages.slice(0, 3).map((trip, i) => (
            <Reveal key={trip.id} delay={i * 0.08}>
              <TripCard
                trip={trip}
                destination={data.destinations.find(
                  (d) => d.id === trip.destinationId,
                )}
              />
            </Reveal>
          ))}
        </div>
      </section>
      <section id="our-way" className="our-way">
        <div className="container season-note">
          <div>
            <Sun size={24} strokeWidth={1.3} />
            <p>
              <strong>The softer side of September.</strong>
              <br />
              Warm coastlines, long lunches, and a little more room to wander. A
              shoulder-season collection.
            </p>
          </div>
          <Link href="/destinations?tag=Coast&month=9" className="text-link">
            Find your coastal escape
            <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="container our-way-grid">
          <Reveal className="our-way-photo">
            <Image
              src="/images/srilanka-ella.jpg"
              alt="Green hill country in Sri Lanka"
              fill
              sizes="(max-width: 760px) 90vw, 45vw"
            />
            <span className="image-note">
              TAKE THE LONG WAY. IT’S USUALLY THE GOOD ONE.
            </span>
          </Reveal>
          <Reveal className="our-way-copy">
            <p className="eyebrow">A DIFFERENT WAY TO GO</p>
            <h2>
              Collect moments.
              <br />
              <em>Not checklists.</em>
            </h2>
            <p>
              We believe the best journeys bring you closer. To a place. To its
              people. To a version of yourself you haven’t met yet.
            </p>
            <p>
              That’s why we choose small, stay local, and leave room for the
              unexpected. Because how you travel matters as much as where you
              go.
            </p>
            <Link href="/journal/the-art-of-slow-travel" className="text-link">
              Get to know our way
              <ArrowUpRight size={18} />
            </Link>
            <div className="our-way-signature">
              <Compass size={38} strokeWidth={1} />
              <span>
                A little more thoughtful.
                <br />A lot more meaningful.
              </span>
            </div>
          </Reveal>
        </div>
      </section>
      <section className="map-story container">
        <Reveal>
          <p className="eyebrow">
            <MapPin size={15} /> LET CURIOSITY BE YOUR COMPASS
          </p>
          <h2>
            Your next chapter
            <br />
            is <em>out there.</em>
          </h2>
          <p>
            Follow a coastline. Find a hidden corner.
            <br />
            See where a little exploring takes you.
          </p>
          <Link href="/map" className="button button-dark">
            Explore the map
            <ArrowUpRight size={18} />
          </Link>
        </Reveal>
        <div
          className="explore-orbit"
          aria-label="Destinations across Asia and Europe"
        >
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="orbit orbit-three" />
          <div className="orbit-center">
            <Globe2 size={96} strokeWidth={0.65} />
          </div>
          {data.destinations.map((d, i) => (
            <Link
              href={`/destinations/${d.slug}`}
              key={d.id}
              className={`map-bubble bubble-${i}`}
            >
              <Image src={d.heroImage} alt="" width={56} height={56} />
              <span>
                {d.name}
                <small>{d.country}</small>
              </span>
              <ArrowUpRight size={13} />
            </Link>
          ))}
        </div>
      </section>
      <section className="section container journal-section">
        <Reveal className="section-heading">
          <div>
            <p className="eyebrow">
              <span className="small-line" /> LETTERS FROM ELSEWHERE
            </p>
            <h2>
              A little inspiration
              <br />
              for the <em>open road.</em>
            </h2>
          </div>
          <Link className="text-link" href="/journal">
            All stories
            <ArrowUpRight size={17} />
          </Link>
        </Reveal>
        <div className="three-grid">
          {data.journal.map((post, i) => (
            <Reveal key={post.id} delay={i * 0.08}>
              <JournalCard post={post} />
            </Reveal>
          ))}
        </div>
      </section>
      <section className="closing-invitation">
        <div className="container">
          <Reveal>
            <p className="eyebrow">DON’T BOOK A TRIP. COMPOSE A JOURNEY.</p>
            <h2>
              Go somewhere.
              <br />
              <em>Come back different.</em>
            </h2>
            <Link className="button button-paper" href="/plan">
              Start your next chapter
              <ArrowUpRight size={20} />
            </Link>
          </Reveal>
          <span className="closing-coordinate">
            THE WORLD IS WAITING. TAKE YOUR TIME.
          </span>
        </div>
        <Compass className="closing-compass" size={380} strokeWidth={0.3} />
      </section>
    </>
  );
}
