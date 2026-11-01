# Wanderline Server

NestJS API, PostgreSQL/Prisma models and migrations, Stripe payments, catalog data, deployment scripts, documentation and the optional Python AI service all live inside this folder. The repository contains only `Client/` and `Server/` (plus Git's hidden metadata).

## Local development

Requires Node.js 22+ and npm. From this folder:

```sh
npm ci
npm run start:dev
```

In a second terminal run `npm ci` and `npm run dev` inside `Client`. For a checkout containing both folders, this convenience command finds free ports and starts both:

```sh
npm run dev:all
```

`npm run setup:all` installs both sets of dependencies; `npm run build:all` builds both. These convenience scripts are optional; the Server builds and runs independently without Client files. Its catalog is in `data/catalog.json`.

Copy `.env.example` to `.env` for a fresh checkout. This workspace already has the supplied Stripe **test** credentials and generated local administrator/session credentials in the ignored `.env`. Open that file locally to find `ADMIN_EMAIL` and `ADMIN_PASSWORD`; secrets are not committed. Sign in at the frontend's `/admin`, then open **Bookings & payments** (`/admin/payments`).

Default development storage is a serialized, atomic local store at `.data/store.json`. It preserves users, saved plans, inquiries, payments, refunds and administrator edits across restarts. Run one API instance in file mode. Use PostgreSQL for production and multiple instances; ephemeral deployment disks must not hold financial records.

## Deployment

Deploy this folder as the backend root. No root-level package, shared folder or Client source is required.

| Setting | Value |
| --- | --- |
| Install | `npm ci --include=dev` |
| Build | `npm run build` |
| Release / migrations | `npx prisma migrate deploy` |
| Start | `npm run start:prod` |
| Health | `GET /health` |

Configure these runtime environment variables:

```dotenv
NODE_ENV=production
HOST=0.0.0.0
PORT=4000
CLIENT_ORIGIN=https://your-frontend.example
STORAGE_MODE=postgres
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
JWT_SECRET=YOUR_OWN_LONG_RANDOM_SECRET
ADMIN_EMAIL=YOUR_ADMIN_EMAIL
ADMIN_PASSWORD=YOUR_OWN_STRONG_ADMIN_PASSWORD
STRIPE_SECRET_KEY=YOUR_STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET=YOUR_ENDPOINT_SIGNING_SECRET
```

The hosting provider may supply `PORT` automatically. `CLIENT_ORIGIN` must be the frontend's exact public origin; Stripe uses it to build success/cancel redirects. JWT secrets must be at least 32 characters in production. Admin passwords must contain at least 12 characters. Startup creates the configured admin only if its email is not already registered; it never silently promotes a traveler or resets an existing password.

Prisma initializes the catalog once, using a durable marker so later restarts preserve edits **and deletions**. Existing installations apply the incremental `20261030010000_stripe_payments` migration; the initial migration has not been rewritten. New databases apply both. Back up a real production database before normal release maintenance.

For a local PostgreSQL instance, run `docker compose up -d`, configure `DATABASE_URL`, then `npx prisma migrate deploy` and `npm run seed`. A live PostgreSQL server/Docker daemon was unavailable in this workspace; schema validation and migration generation are checked, while integration tests use isolated durable file storage.

Build a backend container with this folder as its build context:

```sh
docker build -t wanderline-server .
```

Pass environment secrets at runtime. `.dockerignore` excludes secrets, local records, virtual environments and caches. Container build execution requires Docker and has not been run here.

## Booking and payment flow

1. A signed-in traveler requests a package or saved-plan journey. Dates, guests, ownership and totals are checked by the server.
2. At `/admin/payments`, an administrator reviews availability and the exact total, then approves it. Unapproved or cancelled bookings cannot start checkout.
3. The traveler opens **My journeys → Booking inquiries → Pay securely**. The server creates a Stripe-hosted Checkout Session using the stored approved total, never a submitted browser amount.
4. Stripe redirects to `/payments/return`. The API retrieves the session and PaymentIntent, checks ownership, booking reference, currency, amount received and mode, then records payment. Visiting a success URL alone cannot mark a booking paid.
5. A Stripe receipt link appears in the account and travel desk. Payment records are kept separately from booking lifecycle status.
6. An unpaid cancellation expires open checkout sessions. A paid cancellation enters the admin refund-review queue; it does **not** falsely claim an automatic refund.
7. An administrator reviews and confirms a full refund. Stripe returns funds to the original method. The UI distinguishes pending, completed and failed refunds and retains the financial record.

Checkout and refund calls use stable Stripe idempotency keys. Repeated clicks reuse an open session. Atomic status transitions prevent duplicate/out-of-order events from turning a paid/refunded payment back into an unpaid one. Partial refunds made in Stripe are included in the total when the remaining balance is refunded from the studio.

### Required Stripe webhook configuration

After the backend has a public HTTPS URL, create a Stripe webhook endpoint at:

```text
https://your-backend.example/payments/webhook
```

Subscribe to:

```text
checkout.session.completed
checkout.session.async_payment_succeeded
checkout.session.async_payment_failed
checkout.session.expired
charge.refunded
refund.updated
refund.failed
```

Copy that endpoint's signing secret into `STRIPE_WEBHOOK_SECRET`. It is a separate `whsec_…` secret, not the API secret key. The supplied document contained API keys but no webhook signing secret or deployment URL, so endpoint registration remains a deployment-time step. Live checkout is blocked without a signing secret. Test checkout can be reviewed locally using server-side reconciliation, but production fulfillment must use webhooks so payments are processed even if a traveler closes their browser.

Nest preserves the raw request body; the official Stripe SDK verifies signatures before events are handled. If routing the webhook through the frontend, `/api/payments/webhook` preserves the raw body and signature too, but the direct backend endpoint is preferable.

`STRIPE_PUBLISHABLE_KEY` is optional for this hosted integration; no Stripe secret is ever needed in Client. Keep test and live endpoint secrets separate. Payment receipts come from Stripe; the application itself does not have an outbound email provider configured.

Official references: [Hosted Checkout](https://docs.stripe.com/checkout/quickstart), [fulfillment](https://docs.stripe.com/checkout/fulfillment), [webhook signatures](https://docs.stripe.com/webhooks/signature).

## Admin capabilities

- Content studio: create/edit/delete destinations, POIs, experiences, multi-day journeys and journal stories.
- Travel desk: approve/cancel bookings, review approved totals and traveler notes, track payment/receipt/refund status, review paid cancellation requests and confirm refunds.
- Searchable customer directory, payment totals and CSV booking export. CSV cells are protected from spreadsheet formula injection.
- All admin endpoints enforce the signed-in user's stored administrator role. Payment status cannot be manually set to “paid”.

## Optional AI

The Python service lives in `ai/`; it is not needed for the API or payment flow. With no model/service, the planner uses an explicitly labeled itinerary grounded in the local destination catalog.

```sh
cd ai
python -m venv .venv
# Windows: .venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

For real model composition configure `OPENAI_API_KEY` in `ai/.env`; the optional service uses Chroma, local deterministic retrieval embeddings, LangChain prompting and validated OpenAI structured output. Point `AI_SERVICE_URL` at it; set matching `AI_SERVICE_KEY` values for network access. A moved virtual environment should be recreated rather than relying on old activation paths.

## Verification

```sh
npm test
npm run test:e2e
npm run check
```

`check` runs both builds, frontend lint, API tests and isolated desktop/mobile Playwright tests; it needs the sibling Client checkout and installed Chrome. The tests cover scrolling with normal motion, the 14px text floor, maps, authentication, planner persistence/editing, booking/cancellation, admin approval and secure checkout navigation. Financial tests cover ownership, amount/currency checks, signature verification, retries, idempotency and refund transitions.

An opt-in sandbox check uses the configured **test-mode** key and refuses live keys:

```sh
npm run smoke:stripe
npm run smoke:stripe -- --complete
```

The complete check starts isolated services, completes hosted Checkout with Stripe's documented test card, verifies the real sandbox PaymentIntent/receipt, then refunds that same sandbox payment. It passed in this workspace without moving real money. It requires the built Client, its Playwright dependency and installed Chrome. It does not provision a public webhook endpoint.

Python tests: from `ai`, run `python -m unittest test_planner -v` with the virtual environment active.
