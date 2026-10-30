"use client";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Compass,
  Map,
  Search,
  X,
} from "lucide-react";
import { useCatalog } from "./providers";
import { DestinationCard, JournalCard, TripCard } from "./cards";
import { Reveal } from "./motion";
import { MapView } from "./map/map-view";

export function DestinationListing() {
  const params = useSearchParams();
  const { data } = useCatalog();
  const [query, setQuery] = useState(params.get("q") || "");
  const [region, setRegion] = useState("All regions");
  const [tag, setTag] = useState(params.get("tag") || "All experiences");
  const [month, setMonth] = useState(params.get("month") || "Any month");
  const [sort, setSort] = useState("Our favorites");
  const found = data.destinations
    .filter(
      (d) =>
        `${d.name} ${d.country} ${d.tags.join(" ")}`
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (region === "All regions" || d.region === region) &&
        (tag === "All experiences" || d.tags.includes(tag)) &&
        (month === "Any month" || d.bestMonths.includes(Number(month))),
    )
    .sort((a, b) =>
      sort === "Price: low to high"
        ? a.startingPrice - b.startingPrice
        : sort === "Name: A to Z"
          ? a.name.localeCompare(b.name)
          : 0,
    );
  return (
    <div className="container">
      <Reveal className="page-intro">
        <p className="eyebrow">
          <Compass size={15} /> FOLLOW YOUR CURIOSITY
        </p>
        <h1>
          Find your
          <br />
          <em>somewhere.</em>
        </h1>
        <p>
          For the places you’ve been dreaming of. And the ones you haven’t
          discovered yet. Start with a feeling. See where it takes you.
        </p>
      </Reveal>
      <div className="page-toolbar">
        <div className="search-input">
          <Search size={18} />
          <input
            aria-label="Search destinations"
            placeholder="A place, a country, a feeling…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              className="icon-button"
              aria-label="Clear search"
              onClick={() => setQuery("")}
            >
              <X size={16} />
            </button>
          )}
        </div>
        <div className="filters">
          <select
            aria-label="Filter by region"
            className="filter-select"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
          >
            {[
              "All regions",
              ...new Set(data.destinations.map((d) => d.region)),
            ].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
          <select
            aria-label="Filter by experience"
            className="filter-select"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
          >
            {[
              "All experiences",
              ...new Set(data.destinations.flatMap((d) => d.tags)),
            ].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
          <select
            aria-label="Filter by travel month"
            className="filter-select"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          >
            <option value="Any month">Any month</option>
            {[
              "January",
              "February",
              "March",
              "April",
              "May",
              "June",
              "July",
              "August",
              "September",
              "October",
              "November",
              "December",
            ].map((name, index) => (
              <option key={name} value={index + 1}>
                {name}
              </option>
            ))}
          </select>
          <Link className="button button-outline button-small" href="/map">
            <Map size={15} />
            Map view
          </Link>
        </div>
      </div>
      <div className="results-label">
        <span>{found.length} places to feel a little more alive</span>
        <select
          aria-label="Sort destinations"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="sort-select"
        >
          {["Our favorites", "Price: low to high", "Name: A to Z"].map(
            (value) => (
              <option key={value}>{value}</option>
            ),
          )}
        </select>
      </div>
      <div className="three-grid listing-grid">
        {found.map((destination, index) => (
          <DestinationCard
            key={destination.id}
            destination={destination}
            index={index}
          />
        ))}
        {!found.length && (
          <div className="empty-state">
            <Compass size={36} />
            <h2>A little further afield?</h2>
            <p>
              We couldn’t find a match. Try another feeling or clear your
              filters.
            </p>
            <button
              className="button button-dark"
              onClick={() => {
                setQuery("");
                setRegion("All regions");
                setTag("All experiences");
                setMonth("Any month");
              }}
            >
              Clear filters
              <ArrowRight size={17} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function TripListing() {
  const { data } = useCatalog();
  const [region, setRegion] = useState("All journeys");
  const [length, setLength] = useState("Any length");
  const trips = data.packages.filter(
    (trip) =>
      (region === "All journeys" ||
        data.destinations.find((d) => d.id === trip.destinationId)?.region ===
          region) &&
      (length === "Any length" ||
        (length === "5 days or less" ? trip.days <= 5 : trip.days > 5)),
  );
  return (
    <div className="container">
      <Reveal className="page-intro">
        <p className="eyebrow">THOUGHTFULLY PUT TOGETHER</p>
        <h1>
          Good journeys.
          <br />
          <em>Great stories.</em>
        </h1>
        <p>
          Small groups, local hosts, and room for the unexpected. Our curated
          escapes take care of the details so you can be a little more present.
        </p>
      </Reveal>
      <div className="page-toolbar">
        <div className="filters">
          {["All journeys", "Asia", "Europe"].map((value) => (
            <button
              className={`filter-chip ${region === value ? "selected" : ""}`}
              onClick={() => setRegion(value)}
              key={value}
            >
              {value}
            </button>
          ))}
        </div>
        <select
          className="filter-select"
          aria-label="Trip length"
          value={length}
          onChange={(e) => setLength(e.target.value)}
        >
          {["Any length", "5 days or less", "6 days or more"].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </div>
      <p className="results-label">
        {trips.length} thoughtfully curated journeys · Prices in USD, per person
      </p>
      <div className="three-grid listing-grid">
        {trips.map((trip) => (
          <TripCard
            key={trip.id}
            trip={trip}
            destination={data.destinations.find(
              (d) => d.id === trip.destinationId,
            )}
          />
        ))}
        {!trips.length && (
          <div className="empty-state">
            <h2>Try a different path.</h2>
            <p>No journeys match these filters.</p>
            <button
              className="button button-dark"
              onClick={() => {
                setRegion("All journeys");
                setLength("Any length");
              }}
            >
              Show all journeys
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function JournalListing() {
  const { data } = useCatalog();
  const [category, setCategory] = useState("All stories");
  const posts = data.journal.filter(
    (post) => category === "All stories" || post.category === category,
  );
  return (
    <div className="container">
      <Reveal className="page-intro">
        <p className="eyebrow">LETTERS FROM ELSEWHERE</p>
        <h1>
          Stories for the
          <br />
          <em>curious at heart.</em>
        </h1>
        <p>
          A few field notes, a little inspiration, and a different way of
          looking at the world. Pull up a chair. Stay a while.
        </p>
      </Reveal>
      <div className="page-toolbar">
        <div className="filters">
          {[
            "All stories",
            ...new Set(data.journal.map((post) => post.category)),
          ].map((value) => (
            <button
              className={`filter-chip ${category === value ? "selected" : ""}`}
              key={value}
              onClick={() => setCategory(value)}
            >
              {value === "All stories" ? value : value.toLowerCase()}
            </button>
          ))}
        </div>
      </div>
      <div className="three-grid listing-grid">
        {posts.map((post) => (
          <JournalCard key={post.id} post={post} />
        ))}
      </div>
    </div>
  );
}

export function ExploreMap() {
  const { data } = useCatalog();
  const [tag, setTag] = useState("All places");
  const [selected, setSelected] = useState("");
  const destinations = data.destinations.filter(
    (d) => tag === "All places" || d.tags.includes(tag),
  );
  const destination = data.destinations.find((d) => d.id === selected);
  const points = destination
    ? [
        {
          ...destination,
          description: destination.tagline,
          href: `/destinations/${destination.slug}`,
        },
        ...data.pois.filter((p) => p.destinationId === selected),
      ]
    : destinations.map((d) => ({
        ...d,
        description: d.tagline,
        href: `/destinations/${d.slug}`,
      }));
  return (
    <div className="map-explore">
      <aside className="map-sidebar">
        <p className="eyebrow">
          <Compass size={15} /> A WORLD OF POSSIBILITY
        </p>
        <h1>
          Follow your
          <br />
          <em>curiosity.</em>
        </h1>
        <p>Pick a place. Find your bearings. Let the map lead the way.</p>
        <div className="filters">
          {["All places", "Nature", "Coast", "Culture"].map((value) => (
            <button
              className={`filter-chip ${tag === value ? "selected" : ""}`}
              key={value}
              onClick={() => {
                setTag(value);
                setSelected("");
              }}
            >
              {value}
            </button>
          ))}
        </div>
        {selected && (
          <button
            className="text-link map-reset"
            onClick={() => setSelected("")}
          >
            Show all places
            <X size={14} />
          </button>
        )}
        {destinations.map((d) => (
          <div key={d.id}>
            <button
              className={`map-place ${selected === d.id ? "selected" : ""}`}
              onClick={() => setSelected(d.id)}
            >
              <Image src={d.heroImage} alt="" width={75} height={75} />
              <div>
                <h3>{d.name}</h3>
                <small>
                  {d.country} · {d.tags[0]}
                </small>
              </div>
              <ArrowUpRight size={18} />
            </button>
            {selected === d.id && (
              <Link
                href={`/destinations/${d.slug}`}
                className="map-selected-link"
              >
                Explore {d.name} and{" "}
                {data.pois.filter((p) => p.destinationId === d.id).length} local
                places →
              </Link>
            )}
          </div>
        ))}
      </aside>
      <MapView
        points={points}
        selectedId={selected}
        onSelect={(id) => {
          if (data.destinations.some((d) => d.id === id)) setSelected(id);
        }}
      />
    </div>
  );
}
