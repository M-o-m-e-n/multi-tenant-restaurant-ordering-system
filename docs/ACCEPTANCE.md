# Acceptance Sheet
## Restaurant Ordering System (ROS)

| | |
|---|---|
| **Document ID** | ROS-ACC-001 |
| **Version** | 1.0 |
| **Date** | 2026-09-25 |
| **Scope** | M13-S13: SRS §9 AC-1 … AC-22, walked against the system as built |
| **Environment** | Local production builds (`node server/dist/server.js` + `vite preview`), Postgres 15.8 in Docker, the deterministic demo seed. **Not staging:** no public host exists (see [OPERATIONS.md](OPERATIONS.md) §3) |

**Result: 21 pass. AC-5 passes with a named exception:** the webhook path is proven with real Stripe
signatures, but a live Stripe test-mode round trip needs test keys and a public URL.

How to reproduce:
- `npm run check`: format, lint, typecheck, and every unit/integration test (shared 58, server 268,
  client 25)
- `npm run e2e`: builds, reseeds, and runs 15 browser tests
- `npm run perf`: the load test

| AC | Criterion (short) | Result | Evidence |
|---|---|---|---|
| AC-1 | QR → modifiers → cart matches a hand calculation → log in → on the KDS within 500 ms | ✅ Pass | `e2e/acceptance.spec.ts` AC-1. Wagyu Burger Large, dine-in: subtotal $22.50, service $2.25, tax $1.97 (196.875 rounded half away from zero), total $26.72 in the UI and the API. The ticket was visible on an open KDS **63 ms** after the order committed (smoke scenario 2: 76 ms) |
| AC-2 | The kitchen walks PLACED → … → COMPLETED; the tracker updates live at each step | ✅ Pass | `e2e/acceptance.spec.ts` AC-2 (five steps, no reload, each within 3 s); `realtime.test.ts` "lets only the owner watch an order…" |
| AC-3 | An illegal transition is refused with 409 and logged | ✅ Pass | `orders.test.ts` "I6 / AC-3" (409 `ILLEGAL_TRANSITION`; the service logs `illegal transition refused` at warn) |
| AC-4 | SAVE10 then tax on the reduced amount; client and server agree | ✅ Pass | `pricing-preview.test.ts` M6-S9 matrix (client `computeTotals` = server preview to the cent), shared `pricing.worked-example.test.ts` |
| AC-5 | Test card → webhook flips PAID even if the browser closes | ✅ Pass, with exception | `payments.test.ts` I8: a signed `payment_intent.succeeded` marks the order PAID with no browser involved, and the reconcile job heals a missed webhook. **Exception:** no Stripe test keys in this environment, so no live 4242 round trip. The steps are in OPERATIONS.md §4 |
| AC-6 | A duplicate Stripe event is recorded once | ✅ Pass | `payments.test.ts` I9 (the replay returns 200 and writes nothing) |
| AC-7 | 86'ing hides the item live; history is untouched | ✅ Pass | `e2e/smoke.spec.ts` scenario 3 (an open guest menu shows "Sold out" within 5 s, no reload); `realtime.test.ts` I25; snapshots keep past orders intact (`amendments-receipts.test.ts` I27) |
| AC-8 | Staff cash records the cashier; a customer gets 403 | ✅ Pass | `payments.test.ts` I10; `security.test.ts` sweep |
| AC-9 | Reports match the seed's own figures | ✅ Pass | `reports.test.ts` I13 and the by-day and top-items tests compare against the fixture the seed emits; `e2e` scenario 4 checks the report page equals the API |
| AC-10 | Lint and typecheck clean; pricing and state-machine tests green | ✅ Pass | `npm run check`: 0 lint errors, 0 type errors, all tests green |
| AC-11 | A SEATED table with open orders can't be freed | ✅ Pass | `tables.test.ts` I12 (409 `TABLE_HAS_OPEN_ORDERS`) |
| AC-12 | Table A's QR can never create an order on Table B | ✅ Pass | `orders.test.ts` I11 (a smuggled `tableId` gives 400); `schemas.test.ts`; `tables.test.ts` I26 (the resolve is read-only) |
| AC-13 | Pay by card, cancel, admin refund → REFUNDED and still CANCELLED | ✅ Pass | `payments.test.ts` I19 |
| AC-14 | Appending to a PAID order → PARTIALLY_PAID; the balance is collectable | ✅ Pass | `amendments-receipts.test.ts` I17; `e2e` scenario 6 (browser: Paid → a second round → "Partly paid" → settled at the POS in cash → PAID) |
| AC-15 | A tip is in the total but not in tax or discount, and is its own line | ✅ Pass | `amendments-receipts.test.ts` AC-15; `e2e` scenario 5 (the total rises by exactly the tip, tax unchanged, the receipt itemises it) |
| AC-16 | 00:30 local in UTC+3 is dated and numbered by the local business date | ✅ Pass | `orders.test.ts` I22; `reports.test.ts` peak hours in local time |
| AC-17 | Bad modifier choices are refused server-side | ✅ Pass | `orders.test.ts` I15; `pricing-preview.test.ts`; `amendments-receipts.test.ts` (appends are checked the same way) |
| AC-18 | A disabled account fails on its next request | ✅ Pass | `auth-rbac.test.ts` I24 |
| AC-19 | A receipt shows the price charged even after a menu price change | ✅ Pass | `amendments-receipts.test.ts` I27 |
| AC-20 | A KDS left for 48 h never prompts for login | ✅ Pass | `auth-refresh.test.ts` I32 (48 h of 15-minute refreshes with a simulated clock) |
| AC-21 | A replayed rotated refresh token revokes the family | ✅ Pass | `auth-refresh.test.ts` I29 |
| AC-22 | The refresh token isn't readable by script; no access token in storage after reload | ✅ Pass | `e2e/acceptance.spec.ts` AC-22 (after a reload the session survives; `document.cookie`, `localStorage` and `sessionStorage` hold no JWT and no refresh value; the cookie is `HttpOnly`, `SameSite=Strict`, path `/api/v1/auth`) |

## Non-functional checks run alongside

| Check | Result |
|---|---|
| NFR-P1: 100 concurrent `GET /menu` for 30 s | p95 ≈ 69 ms (target < 300 ms), 2,450 req/s, 0 errors (`npm run perf`) |
| NFR-U2/U3: axe WCAG 2.1 A/AA | 0 violations on 17 screens across all four roles (`e2e/a11y.spec.ts`). Two found and fixed: the KDS board and the cancellations list were not keyboard-scrollable |
| Keyboard and touch | The landing CTA is reachable and activated by keyboard; KDS bump buttons are ≥ 44 px |
| Layout | No horizontal overflow at 360, 390, 768 or 1280 px on the customer screens |
| Security | [SECURITY.md](SECURITY.md): NFR-S1…S10 each mapped to code and tests |
| Backups | Restore drill run and recorded in [OPERATIONS.md](OPERATIONS.md) §1 |
