"use client";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Clock3, MapPin } from "lucide-react";
import { money } from "@/lib/catalog";
import type { Destination, Experience, JournalPost, Trip } from "@/lib/types";

export function DestinationCard({
  destination: d,
  index = 0,
}: {
  destination: Destination;
  index?: number;
}) {
  return (
    <Link className="destination-card" href={`/destinations/${d.slug}`}>
      <div className="destination-image">
        <Image
          src={d.heroImage}
          alt={`${d.name}, ${d.country}`}
          fill
          sizes="(max-width: 640px) 85vw, (max-width: 1000px) 45vw, 30vw"
        />
        <span className="photo-tag">{d.tags[0]}</span>
        <span className="card-index">0{index + 1}</span>
        <span className="round-arrow">
          <ArrowUpRight size={21} />
        </span>
        <div className="destination-caption">
          <span className="eyebrow">{d.country}</span>
          <h3>{d.name}</h3>
        </div>
      </div>
      <div className="destination-meta">
        <p>{d.tagline}</p>
        <span>
          From {money(d.startingPrice)}
          <small> / person</small>
        </span>
      </div>
    </Link>
  );
}
export function TripCard({
  trip,
  destination,
}: {
  trip: Trip;
  destination?: Destination;
}) {
  return (
    <Link href={`/trips/${trip.slug}`} className="trip-card">
      <div className="trip-image">
        <Image
          src={trip.heroImage}
          alt={trip.title}
          fill
          sizes="(max-width: 640px) 90vw, 33vw"
        />
        <span className="photo-tag">{trip.days} days, well spent</span>
        <span className="round-arrow">
          <ArrowUpRight size={20} />
        </span>
      </div>
      <p className="eyebrow">{trip.label}</p>
      <h3>{trip.title}</h3>
      <p className="muted card-location">
        <MapPin size={14} />
        {destination?.country || "A thoughtfully curated escape"}
      </p>
      <div className="trip-meta">
        <span>Small groups. Deeper connections.</span>
        <strong>
          {money(trip.priceFrom)}
          <small> / person</small>
        </strong>
      </div>
    </Link>
  );
}
export function JournalCard({ post }: { post: JournalPost }) {
  return (
    <Link className="journal-card" href={`/journal/${post.slug}`}>
      <div className="journal-image">
        <Image
          src={post.coverImage}
          alt={post.title}
          fill
          sizes="(max-width: 640px) 90vw, 33vw"
        />
        <span className="round-arrow">
          <ArrowUpRight size={20} />
        </span>
      </div>
      <div className="journal-category">
        <span className="eyebrow">{post.category}</span>
        <span>{post.readMinutes} MIN READ</span>
      </div>
      <h3>{post.title}</h3>
      <p>{post.excerpt}</p>
      <span className="text-link">
        Read the story <ArrowRight size={16} />
      </span>
    </Link>
  );
}
export function ExperienceCard({ experience: e }: { experience: Experience }) {
  return (
    <Link className="experience-card" href={`/experiences/${e.slug}`}>
      <div className="trip-image">
        <Image
          src={e.imageUrl}
          alt={e.title}
          fill
          sizes="(max-width: 640px) 90vw, 33vw"
        />
        <span className="photo-tag">Locally led</span>
      </div>
      <h3>{e.title}</h3>
      <p className="muted">{e.summary}</p>
      <div className="trip-meta">
        <span className="inline-icon">
          <Clock3 size={15} />
          {e.durationHours} hours · {e.difficulty}
        </span>
        <strong>{money(e.priceFrom)}</strong>
      </div>
    </Link>
  );
}
