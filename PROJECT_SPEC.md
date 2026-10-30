# Travel / Tourism Experience — Project Build Spec (Agent-Ready)

> Stack: Next.js + Redux + RQ + RHF/zod + framer-motion + **gsap, lenis, leaflet/react-leaflet, date-fns, react-day-picker**. NestJS + Prisma + JWT. **`ai/` FastAPI**: AI **trip planner / itinerary generator** (OpenAI + LangChain + Chroma). Optional: `embla-carousel-react`, `@radix-ui/react-dialog`.

---

## 1. Vision & Audience

**Vision:** Immersive destination experience platform **“Wanderline”** — cinematic storytelling + practical booking of curated trips. Blend Sao Tome scroll-map magic, Cook Islands exploration depth, and a modern AI itinerary co-pilot.

**Audience:** Experience travelers 28–55 planning 3–14 day trips; couples & small groups.

**Promise:** “Don’t book a trip. Compose a journey.”

---

## 2. References

| Site | Steal | Link |
|------|-------|------|
| Cook Islands Tourism 360° | Multi-island immersive explore | https://www.awwwards.com/sites/cook-islands-tourism-360deg-virtual-tour |
| Away We Go (Carnival) | Choose-your-adventure 360 | https://www.awwwards.com/sites/instant-caribbean-vacation |
| Making Your Dreams Travel | Cinematic social-lens storytelling — SOTD | https://www.awwwards.com/sites/making-your-dreams-travel |
| Sao Tome e Principe Turismo | Scroll-triggered map zoom, immersive photos | https://www.awwwards.com/sites/sao-tome-e-principe-turismo |
| Tourisme Sumène Artense | Immersive destination scroll + menu | https://www.awwwards.com/sites/tourisme-sumene-artense |

---

## 3. Design System

### Color
| Token | Hex |
|-------|-----|
| `--sky` | `#E8F4F8` |
| `--deep` | `#0B1F2A` |
| `--sea` | `#1F6F8B` |
| `--sand` | `#E6D5B8` |
| `--coral` | `#E07A5F` |
| `--foliage` | `#3D5A45` |
| `--paper` | `#F7F4EF` |
| `--muted` | `#5C6B73` |

### Typography
- Display: `Libre Baskerville` or `Playfair Display`
- UI: `Manrope` / `Inter`
- Numerals for days: large tabular via `Space Grotesk`

### Motion
- Lenis + GSAP ScrollTrigger map zoom (Sao Tome pattern)
- Destination cards parallax
- Itinerary day stack expand 300ms
- Leaflet markers fade-in staggered

---

## 4. Sitemap

### `/`
Hero video/poster; “Plan with AI” CTA; featured destinations Embla; seasonal collections; trust (travelers count); journal.

### `/destinations` · `/destinations/[slug]`
Editorial + photo essays; POI map (Leaflet); experiences list; best season; sample itineraries; book CTA.

### `/experiences/[slug]`
Activity detail, duration, difficulty, price, gallery.

### `/trips` curated packages · `/trips/[slug]`
Multi-day package with day-by-day; date picker; guests; book.

### `/plan` **AI Trip Planner**
Wizard: destination vibe chips, dates, budget, pace, interests → streaming itinerary → save/edit → convert to booking draft.

### `/map` Explore mode (fullscreen Leaflet + filters)
### `/journal`
### `/bookings` account
### Admin: destinations, POIs, packages, bookings

**Signature:** Scroll-linked map zoom into region; AI itinerary cards with map pins; soft cinematic transitions.

---

## 5. Features

### MVP
- Destinations + POIs + experiences CRUD
- Package trips + booking request
- Leaflet maps
- AI plan: generate itinerary JSON from RAG (destination docs) + LLM
- Save plans (auth)
- Search/filter destinations

### Stretch
- Real payment
- Offline PDF itinerary export
- Collaborative trip sharing
- Weather API overlay
- 360 panorama embeds

---

## 6. Frontend Architecture

```
components/map/ (MapCanvas, PoiMarker, TripRoute)
components/planner/ (Wizard, ItineraryTimeline, DayCard)
features/planner/plannerSlice.ts  # wizard answers
features/cart-like: savedPlansSlice or RQ only
```

**Redux:** planner draft answers + UI; auth.
**React Query:** destinations, trips, bookings; AI mutation `useGenerateItinerary`.

---

## 7. Backend Prisma

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql" url = env("DATABASE_URL") }

enum Role { TRAVELER ADMIN }
enum BookingStatus { INQUIRY CONFIRMED CANCELLED }
enum Pace { RELAXED BALANCED PACKED }

model User {
  id String @id @default(cuid())
  email String @unique
  passwordHash String
  name String
  role Role @default(TRAVELER)
  bookings Booking[]
  plans TripPlan[]
}

model Destination {
  id String @id @default(cuid())
  slug String @unique
  name String
  country String
  region String?
  tagline String
  description String
  heroImage String?
  lat Float
  lng Float
  bestMonths Int[]
  tags String[]
  embedText String
  pois Poi[]
  experiences Experience[]
  packages TripPackage[]
}

model Poi {
  id String @id @default(cuid())
  destinationId String
  destination Destination @relation(fields: [destinationId], references: [id], onDelete: Cascade)
  name String
  kind String
  description String?
  lat Float
  lng Float
  imageUrl String?
}

model Experience {
  id String @id @default(cuid())
  destinationId String
  destination Destination @relation(fields: [destinationId], references: [id], onDelete: Cascade)
  slug String @unique
  title String
  summary String
  durationHours Float
  priceFrom Decimal @db.Decimal(10,2)
  difficulty String?
  imageUrl String?
}

model TripPackage {
  id String @id @default(cuid())
  destinationId String
  destination Destination @relation(fields: [destinationId], references: [id], onDelete: Cascade)
  slug String @unique
  title String
  days Int
  priceFrom Decimal @db.Decimal(10,2)
  itineraryJson Json
  heroImage String?
}

model TripPlan {
  id String @id @default(cuid())
  userId String?
  user User? @relation(fields: [userId], references: [id])
  title String
  inputJson Json
  planJson Json
  createdAt DateTime @default(now())
}

model Booking {
  id String @id @default(cuid())
  userId String?
  user User? @relation(fields: [userId], references: [id])
  packageId String?
  email String
  startDate DateTime @db.Date
  guests Int
  status BookingStatus @default(INQUIRY)
  notes String?
  totalEstimate Decimal? @db.Decimal(10,2)
  createdAt DateTime @default(now())
}

model JournalPost {
  id String @id @default(cuid())
  slug String @unique
  title String
  body String
  coverImage String?
  publishedAt DateTime?
}
```

### Nest endpoints
Destinations/POIs/experiences/packages CRUD; `POST /bookings`; `POST /plans` save; auth; journal.

---

## 8. AI Service (`ai/`)

### Endpoints
| Method | Path | Notes |
|--------|------|-------|
| POST | `/ingest` | Index destination `embedText`, POIs, experience blurbs into Chroma `wanderline` |
| POST | `/plan` | Body: `{ destinationSlug?, vibes[], interests[], budget, pace, days, startDate?, travelers }` → retrieve context → LLM returns structured JSON itinerary |
| POST | `/refine` | `{ plan, instruction }` edit day |
| GET | `/health` | |

### Output schema (enforce via prompt + JSON mode)
```json
{
  "title": "",
  "days": [
    {
      "day": 1,
      "theme": "",
      "items": [
        {"time": "09:00", "title": "", "type": "poi|experience|meal|transit", "lat": 0, "lng": 0, "notes": ""}
      ]
    }
  ],
  "estimatedBudget": {"currency": "USD", "min": 0, "max": 0},
  "tips": []
}
```

### Prompt principles
Ground in retrieved docs; respect pace; include buffer time; never invent closed POIs; mark uncertain tips.

---

## 9. Perf / A11y / SEO

- Lazy Leaflet; static map image fallback
- AI responses show skeleton; cancel button
- Destination Place JSON-LD
- Reduced motion: skip map zoom scrub

---

## 10. Build Order

1. Seed destinations + POIs
2. Destination pages + Leaflet
3. Packages + booking
4. AI ingest + `/plan` + wizard UI
5. Save plans + map pins from itinerary
6. Home cinematic GSAP
7. Admin + SEO

## 11. Acceptance

- [ ] AI returns valid day-structured JSON for a seeded destination
- [ ] Map shows POIs and itinerary pins
- [ ] Booking inquiry stored
- [ ] Planner usable on mobile
- [ ] Citations/context grounded (no empty Chroma)
