# Verification — 30 October 2026

Verified against the two-folder checkout:

| Check | Result |
| --- | --- |
| NestJS build and Prisma client generation | Passed |
| Prisma schema and incremental payment migration generation | Passed |
| API unit tests | 13 passed |
| API integration tests | 5 passed |
| Production Next.js build | Passed |
| Frontend ESLint | Passed |
| Desktop/mobile Playwright | 20 passed |
| Python planner tests after relocation to Server/ai | 2 passed |
| Real Stripe sandbox hosted checkout | Completed with a test card |
| Server verification of real sandbox payment/receipt | Passed |
| Real sandbox refund | Stripe returned REFUNDED |
| Secret scan of staged files | No supplied Stripe/admin/session secrets found |
| Tracked files outside Client/ and Server/ | None |

The browser suite tests vertical wheel scrolling over featured destinations with motion enabled, horizontal keyboard navigation, a minimum computed text size of 14px, responsive discovery/maps, authentication, booking persistence/cancellation, itinerary generation/editing/saving/printing, admin content CRUD, approval-to-checkout navigation, cancelled-checkout retry and primary-page WCAG checks.

Financial tests reject unauthorized access, unapproved bookings, altered totals/currency and forged signatures; check idempotent checkout/refunds and out-of-order events; and cover partial refunds, paid cancellations and a booking cancelled while checkout is being created.

These are **sandbox** payment results, not a live-money transaction. The supplied document contained test API keys, not a public deployment URL or webhook signing secret. Configure a public HTTPS `/payments/webhook` endpoint and `STRIPE_WEBHOOK_SECRET` at deployment. Live checkout is blocked until a signing secret is configured. A live PostgreSQL migration and Docker build have not been executed because those services were unavailable in the workspace.

Repeat ordinary checks with `npm run check` from Server. The opt-in `npm run smoke:stripe -- --complete` check requires the local ignored Stripe test credential, installed Chrome and a built sibling Client. It creates and refunds its own sandbox booking using isolated temporary storage.
