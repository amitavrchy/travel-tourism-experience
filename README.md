# Wanderline

A travel platform with curated destinations, local experiences, booking inquiries, an interactive map, and a grounded itinerary planner.

## Development

Requires Node.js 22+ and Python 3.11+ for the optional AI service.

1. `cd Server` → `npm install` → copy `.env.example` to `.env` and configure it → `npm run start:dev` (port 4000).
2. In another terminal: `cd Client` → `npm install` → `npm run dev` (port 3000).
3. Optional AI: `cd ai` → `python -m venv .venv` → activate it → `pip install -r requirements.txt` → `uvicorn app.main:app --reload --port 8000`.

The default local storage mode persists records in `Server/.data/`. PostgreSQL uses the Prisma schema; setup is documented in `Server/.env.example`. Run a single server instance when using the local JSON store.

`PROJECT_SPEC.md` is the product specification. Real payment, weather, collaboration and 360° tours are stretch features.
