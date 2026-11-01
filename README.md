# Wanderline

**[Live site](https://wanderlux-trips-510.netlify.app)** · **[API](https://wanderline-api.onrender.com)** · **[API health](https://wanderline-api.onrender.com/health)**

Don’t book a trip. Compose a journey.

Wanderline is a travel studio for the places that stay with you. The public site is a cinematic guide to a hand-edited catalog. The API behind it keeps the catalog, accounts, itineraries, and money honest: a traveler can save a plan and request a booking, and an administrator approves the total before Stripe ever opens.

## Overview

The repository is two applications that deploy on their own.

`Client/` is a Next.js site. It renders destinations, journeys, a journal, and a map, and it talks to the API through a same-origin `/api` proxy so the browser never holds a session secret. `Server/` is a NestJS API. It serves the catalog, signs travelers in, plans days from inventory that actually exists, and runs Stripe Checkout and refunds. An optional FastAPI service in `Server/ai/` can phrase an itinerary with a model. If that service is down, the API still plans from the local catalog and labels the result as curated.

The seeded catalog is Bali, Kyoto, the Amalfi Coast, Sri Lanka, the Algarve, and Iceland, with places, experiences, multi-day journeys, and journal stories in `Server/data/catalog.json`.

## Features

- Destination search and editorial pages, with photography stored in the site
- Curated multi-day journeys and a journal
- An interactive Leaflet map of the catalog
- A planner that streams a day-by-day itinerary, then lets you edit, swap, save, download, or print it
- Accounts, saved plans, and booking inquiries tied to a trip or a saved plan
- Stripe-hosted Checkout that uses the approved total stored on the server, never a price typed in the browser
- An admin studio for destinations, places, experiences, journeys, and stories
- A payments desk for approvals, receipts, refund review, and CSV export
- Local file storage for a single machine, or PostgreSQL when more than one instance should share the data

## Tech stack

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-12-E0234E?logo=nestjs&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Stripe](https://img.shields.io/badge/Stripe-635BFF?logo=stripe&logoColor=white)

| Part | Stack |
| --- | --- |
| Site | Next.js 16, React 19, TypeScript, Tailwind CSS 4, Redux Toolkit, TanStack Query, GSAP, Framer Motion, Lenis, Leaflet, React Hook Form, Zod |
| API | NestJS 12, Prisma 6, PostgreSQL 16, Passport JWT, Stripe, Vitest, oxlint. Node.js 22 |
| Planner (optional) | FastAPI, Pydantic, LangChain, Chroma, OpenAI |
| Hosting | Netlify for the site. Render runs the API from `Server/Dockerfile.render`, with Postgres inside that container |

## Project structure

```text
.
├── Client/                  Next.js site
│   ├── src/app/             Routes: home, destinations, trips, map, journal, plan, bookings, admin
│   ├── src/components/      UI, including the planner and payments screens
│   ├── src/features/        Planner client state
│   ├── src/lib/             API client, catalog helpers, shared types
│   └── public/images/       Destination photography
├── Server/                  NestJS API
│   ├── src/                 Auth, catalog, bookings, planner, payments
│   ├── prisma/              Schema and migrations
│   ├── data/catalog.json    Seed catalog
│   ├── ai/                  Optional FastAPI planner
│   ├── Dockerfile           API image for local containers
│   └── Dockerfile.render    Render image: API plus bundled Postgres
├── netlify.toml             Netlify build. Base directory is Client
├── render.yaml              Render blueprint. Builds Server from the repo root
└── .github/workflows/       Scheduled health pings so the free API stays awake
```

Deeper notes live in [Client/README.md](Client/README.md) and [Server/README.md](Server/README.md).

## Getting started

Install Node.js 22 and npm. Each app installs and runs from its own folder. There is no root `package.json`.

### Site

```sh
cd Client
npm ci
cp .env.example .env.local
npm run dev
```

Set `API_URL` to [https://wanderline-api.onrender.com](https://wanderline-api.onrender.com) and `SITE_URL` to [https://wanderlux-trips-510.netlify.app](https://wanderlux-trips-510.netlify.app). The browser calls `/api` on the site; that route proxies to `API_URL`. Do not put a Stripe secret in the client environment. The running site is [https://wanderlux-trips-510.netlify.app](https://wanderlux-trips-510.netlify.app).

`npm run lint` and `npm run build` check the site. `npm run test:e2e` needs the built API, Playwright, and Chrome.

### API

```sh
cd Server
npm install
cp .env.example .env
npm run start:dev
```

Set `PORT`, `HOST`, `CLIENT_ORIGIN`, `JWT_SECRET`, and `JWT_REFRESH_SECRET` in `.env`. `CLIENT_ORIGIN` is [https://wanderlux-trips-510.netlify.app](https://wanderlux-trips-510.netlify.app). The live health check is [https://wanderline-api.onrender.com/health](https://wanderline-api.onrender.com/health).

`npm install` is what the Render image runs. `npm ci` on npm 10 rejects this lockfile: an optional peer (`magicast`) was recorded by npm 11.

**File store.** For a laptop with one API process, set `STORAGE_MODE=file` in `.env`. Users, plans, inquiries, and payments persist in `Server/.data/store.json`. The catalog is seeded from `data/catalog.json` on first boot. Anything other than `postgres` uses this store.

**PostgreSQL.** From `Server/`:

```sh
docker compose up -d
```

Leave `STORAGE_MODE=postgres` and point `DATABASE_URL` at that database (the example file already does). Then:

```sh
npx prisma migrate deploy
npm run seed
npm run start:dev
```

The API refuses a `JWT_SECRET` shorter than 32 characters when `NODE_ENV` is production, and it refuses the placeholder from `.env.example`. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` (12 characters or more) to create the startup admin account. The public studio is [https://wanderlux-trips-510.netlify.app](https://wanderlux-trips-510.netlify.app).

`npm run build` compiles the API. `npm run lint` runs oxlint. `npm test` runs the unit tests.

### Both at once

After dependencies are installed in both folders, from `Server/`:

```sh
npm run dev:all
```

That starts the site and the API together and points `API_URL` and `CLIENT_ORIGIN` at those processes. `npm run setup:all` installs both. `npm run build:all` builds both. For the published pair, `API_URL` is [https://wanderline-api.onrender.com](https://wanderline-api.onrender.com) and `CLIENT_ORIGIN` is [https://wanderlux-trips-510.netlify.app](https://wanderlux-trips-510.netlify.app).

### Optional planner service

The API does not need this to plan a trip. To run it anyway:

```sh
cd Server/ai
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app.main:app
```

Set `AI_SERVICE_URL` on the API to that service, and set the same `AI_SERVICE_KEY` on both sides if the service should require a key. The published API does not depend on this process. Tests: `python -m unittest test_planner -v`.

## Deployment

The live site and API are already deployed. These files are what those hosts read. Nothing in this layout asks for a new root directory or Dockerfile path.

| Host | What it uses |
| --- | --- |
| Netlify | Root `netlify.toml`. Base directory `Client`. Build `npm ci && npm run build`. Publish `.next`, with `@netlify/plugin-nextjs`. `API_URL` is [https://wanderline-api.onrender.com](https://wanderline-api.onrender.com). `SITE_URL` is [https://wanderlux-trips-510.netlify.app](https://wanderlux-trips-510.netlify.app). |
| Render | Root `render.yaml`. Root directory empty. Dockerfile `./Server/Dockerfile.render`, context `./Server`. Health check is [https://wanderline-api.onrender.com/health](https://wanderline-api.onrender.com/health). The image starts Postgres, migrates, and reseeds the catalog on a cold start. `CLIENT_ORIGIN` is [https://wanderlux-trips-510.netlify.app](https://wanderlux-trips-510.netlify.app), plus `JWT_SECRET`, `JWT_REFRESH_SECRET`, Stripe, and admin secrets. |

Stripe webhooks should target `https://wanderline-api.onrender.com/payments/webhook`. The signing secret is `STRIPE_WEBHOOK_SECRET`, separate from the API key.

## Author

Amitav Roy Chowdhury — [github.com/amitavrchy](https://github.com/amitavrchy)
