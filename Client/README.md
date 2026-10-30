# Wanderline Client

Cinematic travel discovery, itinerary planning, booking inquiries, Stripe checkout return handling and the administrator's content/payment studio. All frontend source, assets, seed fallback data, tests and configuration live inside `Client/`.

## Run locally

```sh
cd Client
npm ci
npm run dev
```

Run the backend in a second terminal with `cd Server`, `npm ci`, and `npm run start:dev`. Defaults: frontend `http://localhost:3000`, API `http://127.0.0.1:4000`.

When both folders are present, `cd Server` then `npm run dev:all` starts both and picks free ports automatically. There is intentionally no root package or third project folder.

Copy `.env.example` to `.env.local` when overriding the defaults:

```dotenv
API_URL=http://127.0.0.1:4000
SITE_URL=http://localhost:3000
```

`API_URL` is server-side only. Browser requests use the same-origin `/api` proxy and HTTP-only session cookie. Never add a Stripe secret key to frontend environment variables. Hosted Stripe Checkout does not need a browser publishable key.

## Deploy independently

Use **Client** as the hosting provider's project/root directory:

| Setting | Value |
| --- | --- |
| Install | `npm ci --include=dev` |
| Build | `npm run build` |
| Start | `npm start` |
| Server environment | `API_URL=https://your-backend.example` |
| Public metadata origin (build + runtime) | `SITE_URL=https://your-frontend.example` |

Use HTTPS and preserve the public Host header through a reverse proxy. On the backend set `CLIENT_ORIGIN` to the exact frontend origin so Stripe returns to the correct domain. The API proxy forwards signed webhook bodies if required, though Stripe should normally target the backend's `/payments/webhook` directly.

There are no imports outside this folder. `src/data/catalog.json` is a local editorial fallback for read-only pages; live catalog updates, bookings, plans and payments always come from the API. It cannot simulate successful mutations when the backend is unavailable. At development time, `Server/scripts/build-catalog.mjs` can regenerate both tracked catalog copies; deployment does not run or need that sibling script.

A container can be built with this folder as its context: `docker build --build-arg SITE_URL=https://your-frontend.example -t wanderline-client .`. Pass `API_URL` through the runtime environment, and set the same `SITE_URL` at build and runtime so pre-rendered metadata uses the correct public domain. Docker execution was unavailable during development; npm production builds and browser checks have been run.

## Experience

- Every product text size is at least **14px**; shared tokens use 14px captions, 16px UI/body and larger editorial headings. Inputs remain readable on mobile.
- Featured destinations preserve vertical mouse-wheel/trackpad scrolling, native horizontal touch scrolling, card-by-card arrows, keyboard navigation and focus visibility. Reduced-motion preferences are supported without hydration mismatches.
- Responsive destination/region/interest/month search, destination and experience details, curated journeys, Leaflet maps and complete journal articles.
- Three-step planner with cancellable streaming, source notes, day editing/swapping, account saves, text downloads and a complete Print / Save as PDF layout.
- Account registration/login, saved plans and booking history. After admin approval, **Pay securely** opens Stripe-hosted Checkout. The return screen verifies payment through the backend and supports cancellation, retry, processing and failure states; receipt/refund status remains in My journeys.
- `/admin`: destination/POI/experience/journey/journal management.
- `/admin/payments`: booking approvals, received payments, receipts, cancellation/refund review, full-refund confirmation, traveler directory and CSV export.

For the configured local administrator, open **Server/.env** locally and use `ADMIN_EMAIL` / `ADMIN_PASSWORD`; credentials are never tracked or printed into the UI. New deployments configure their own administrator in the backend environment.

## Checks

```sh
npm run lint
npm run build
npm run test:e2e
```

Browser tests require the built Server, installed Google Chrome and the sibling Server folder. They run isolated services on 3100/4100 with a temporary store. Tests include desktop/mobile scrolling, the text-size floor, accessibility, core travel flows and payment approval/navigation. Backend payment/security tests and the opt-in real Stripe sandbox checkout/refund check are documented in [Server/README.md](../Server/README.md).

Map tiles require internet access and no API key. Font files are downloaded at build time, then self-hosted. Photography is local; credits are in [ASSET_CREDITS.md](ASSET_CREDITS.md).

Production Stripe requires a public webhook URL and its separate signing secret. The provided credentials were test-mode API keys; live payment acceptance is not enabled by this build. Full backend deployment, migrations and payment setup are documented in [Server/README.md](../Server/README.md).
