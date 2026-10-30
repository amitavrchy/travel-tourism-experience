# Wanderline

“Don’t book a trip. Compose a journey.” A complete travel platform built from [PROJECT_SPEC.md](PROJECT_SPEC.md), with a cinematic editorial experience and practical planning and inquiry flows.

## Run locally

Requires Node.js 22+ and npm. Python 3.11+ is needed only for the optional AI service.

```sh
npm run setup
npm run dev
```

The root development command launches Next.js and NestJS together, finds free ports near 3000 and 4000, and prints the exact addresses. It connects the frontend proxy to the correct API automatically. Ctrl+C stops both processes.

The application runs immediately in **file storage + curated planner mode**, without a database or paid API key. Records persist in `Server/.data/store.json`. The local store is for one API process at a time; use PostgreSQL for multiple instances. Do not commit this directory or real environment values.

Optional configuration: copy `Server/.env.example` to `Server/.env`. Set a stable random `JWT_SECRET` to retain sessions across restarts. If you run the services separately, use `npm run start:dev` inside `Server`, `npm run dev` inside `Client`, and configure `Client/.env.local` using `Client/.env.example` when the API address differs from port 4000.

## What is included

- Cinematic homepage, local photography, responsive navigation, working global search, destination carousel and seasonal collection.
- Six seeded destinations, eighteen POIs, six local experiences, six multi-day packages and three complete journal stories.
- Destination search, region/interest/month filters, sorting, detail pages and Place JSON-LD.
- Lazy Leaflet maps with destination/POI markers, itinerary-day pins, routes for orientation and map-tile failure feedback.
- Three-step planner: destination, vibes, interests, pace, dates, days, travelers and budget. Redux retains the draft; local storage restores it.
- SSE planning progress and validated day events, cancellation, editable daily themes/notes, and swaps between verified POIs.
- Saved itineraries, rename/delete, text download, and browser Print / Save as PDF containing **all** days, including collapsed ones.
- Package and saved-plan inquiries, date picker, server-computed estimates, reference IDs, inquiry status and cancellation.
- Registration/login with bcrypt and signed JWTs in HTTP-only, SameSite cookies through a same-origin Next.js proxy.
- Admin studio for destinations, POIs, experiences, packages, journal stories and booking statuses. All management endpoints enforce administrator access.
- Shared font-size tokens, self-hosted Manrope/Playfair Display/Space Grotesk, GSAP scroll motion, Lenis on desktop home, 300ms day expansion, and reduced-motion support.

**Booking inquiries are persisted requests, not paid reservations.** There is no real payment processing, supplier inventory integration or outbound email service. The studio provides the operational workflow for confirming inquiries. Weather overlays, 360° panoramas and collaborative sharing remain the spec’s stretch items.

## Administrator setup

Set `ADMIN_EMAIL` and a password of at least 12 characters in `Server/.env`, then restart the API. Startup creates that account only if its email is not already registered. Sign in at `/admin`. There are no built-in administrator credentials, and an existing traveler account is never silently promoted. Editing content invalidates the public catalog cache.

## PostgreSQL

```sh
cd Server
docker compose up -d
```

Set `STORAGE_MODE=postgres` and `DATABASE_URL` in `Server/.env`, then:

```sh
npx prisma generate
npx prisma migrate deploy
npm run seed
```

The checked-in initial migration contains all product tables and relations. Initial startup seeds the catalog without overwriting existing records, then stores a durable initialization marker. Subsequent restarts preserve editorial edits and deletions. To intentionally reset an environment, manage the database separately; the app never resets it automatically.

The local JSON flow and Prisma schema/migration generation have been validated. Applying migrations against a live PostgreSQL server requires your database environment; Docker/PostgreSQL was unavailable during this build.

## Optional AI service

```sh
cd ai
python -m venv .venv
# Windows PowerShell: .venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
# Copy .env.example to .env and set OPENAI_API_KEY to enable the model.
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

FastAPI indexes the seed destination notes, POIs and experiences into the `wanderline` Chroma collection. LangChain builds the context prompt; OpenAI Responses structured output is validated with Pydantic and checked against known POI names/coordinates and retrieved source IDs. Chroma uses a deterministic local feature-hash embedding to avoid downloading a model or requiring a second paid service. This is lexical retrieval, not a pretrained semantic embedding.

Nest sends current destination context for each plan, so administrator edits are included. The service rejects unknown destinations and empty place context. No model key, failed model output or unavailable service falls back to an explicitly labeled curated itinerary. The UI never presents that fallback as AI-generated. In curated mode a longer itinerary intentionally revisits a small verified set of places; it does not invent more inventory.

SSE sends progress while composing, then individual validated days and the final plan. Model output is checked before days are exposed. Client cancellation closes the stream and aborts the upstream request.

Endpoints: `GET /health`, `POST /ingest`, `POST /plan`, `POST /refine`. The refine endpoint supports explicit slower/more-active pace requests; the app’s day editor handles direct changes. Set a matching `AI_SERVICE_KEY` in both services for network access. Bind to loopback for local development. OpenAI credentials remain exclusively in the AI service. A live paid model request was not run without a user-provided key.

Official structured-output reference: [OpenAI documentation](https://developers.openai.com/api/docs/guides/structured-outputs).

## Verification

```sh
npm test
```

This runs API build, unit/integration tests, frontend lint, production build, then Playwright against isolated ports 3100/4100 and a temporary store. The browser suite covers both 1440px desktop and 390px mobile: discovery, maps, auth, inquiry persistence/cancellation, itinerary editing/saving/reopening, downloads, complete print export, planner cancellation and admin CRUD. Axe checks WCAG A/AA rules on primary pages and generated itineraries. Browser tests use installed Google Chrome.

```sh
cd ai
# With the virtual environment activated:
python -m unittest test_planner -v
```

Python tests check response shape, nonempty context, grounded source references, relaxed pace, refinement, invalid input and stable local embeddings. `GET http://127.0.0.1:8000/health` reports the actual retrieval mode and indexed document count.

## Production

- `npm run build` builds both Node services. Start Nest with `node dist/main.js` from `Server`, and Next with `npm start` from `Client`.
- Set `NODE_ENV=production`, a strong `JWT_SECRET`, `API_URL` on Next and a PostgreSQL URL on Nest. Serve the frontend over HTTPS so secure session cookies work. Preserve the public Host header at your reverse proxy.
- Bind Nest with `HOST=0.0.0.0` inside a container. Build its container from the **repo root**: `docker build -f Server/Dockerfile -t wanderline-api .`. Pass secrets at runtime; none are copied into the image.
- Apply database migrations before release, provision durable PostgreSQL/storage and supervise the services. Configure a real operations/email/payment provider before promising those capabilities to travelers.
- Photographs are stored locally; map tiles still need network access. Font files are downloaded at Next build time and then self-hosted.

Photography credits are in [ASSET_CREDITS.md](ASSET_CREDITS.md). The original spec remains the acceptance reference.
