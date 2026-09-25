# Fork & Flame — Restaurant Ordering System

A full-stack ordering system for a single restaurant. Guests scan a table QR code, order from the
menu and track their order live. The kitchen works from a realtime display, staff run tables and
take payments, and the owner gets reports they can trust.

**What works (M0–M13):**
- **Guests:** scan a table QR code or order takeaway or delivery; build a cart with modifiers, tips
  and promo codes, priced identically on client and server; pay by card (Stripe, test mode) or
  with staff; follow the order and its delivery live; add a second round; print a receipt; book a
  table.
- **Kitchen:** runs from a realtime display.
- **Staff:** take cash and split payments at the POS, assign drivers, and seat bookings.
- **Owner:** manages the menu, including 86ing a dish, and reads reports built on one revenue
  definition.

Every acceptance criterion is recorded in [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md).

The design lives in [`docs/`](docs/KICKOFF.md): requirements (SRS), architecture (HLD), detailed
design (LLD), ERD, API contract, coding standards and the milestone plan.

## Quick start

Requirements: **Node 20.17+**, **npm 10**, **Docker** (for Postgres).

```bash
# 1. Install every workspace
npm install

# 2. Configure the API (then edit JWT_ACCESS_SECRET)
cp server/.env.example server/.env

# 3. Start Postgres (creates the ros and ros_test databases)
docker compose up -d

# 4. Create the schema and load demo data (prints each table's QR link)
npm run db:migrate
npm run db:seed

# 5. Run the API (:4000) and the web app (:5173) together
npm run dev
```

Open <http://localhost:5173>. The API health check is at <http://localhost:4000/health>. Staff
screens: `/kitchen` (KDS), `/pos/tables` (table map), `/admin/menu`.

## Demo data

The seed creates 30 business days of trading history, the Fork & Flame menu, 14 tables and two
promo codes (`SAVE10`, `WELCOME5`). It also writes `server/prisma/seed-fixture.json`, the figures
that the report tests check against. The password for every account is `password123`.

| Role | Email |
|---|---|
| Admin | `admin@forkandflame.test` |
| Staff | `staff@forkandflame.test` |
| Customer | `guest@forkandflame.test` |

## Workspaces

| Workspace | Package | What it holds |
|---|---|---|
| `shared/` | `@ros/shared` | Pure domain logic (pricing, order state machine, discounts) and the Zod schemas both sides validate with. No IO; `zod` is its only dependency. |
| `server/` | `@ros/server` | Express 4 API, Prisma + PostgreSQL, Socket.IO, jobs. Modules follow `routes → service → repo`. |
| `client/` | `@ros/client` | React 18 SPA (Vite, React Router, TanStack Query, Zustand, Tailwind) in the Fork & Flame design. |

## Scripts

Run from the repository root.

| Command | Does |
|---|---|
| `npm run dev` | API and web app with reload |
| `npm run check` | format check, lint, typecheck and every test — the gate before a commit |
| `npm test` | all unit and integration tests (Postgres must be running; server tests use `TEST_DATABASE_URL`) |
| `npm run lint` / `npm run typecheck` | the individual gates |
| `npm run build` | production build of server and client |
| `npm run db:migrate` | apply Prisma migrations to the dev database |
| `npm run db:seed` | wipe and reload the demo data |
| `npm run db:studio` | browse the database in Prisma Studio |
| `npm run e2e` | build, reseed, and run the 15 Playwright tests (scenarios, acceptance, axe) on the production builds |
| `npm run perf` | 100 concurrent `GET /menu` for 30 s against the built API (needs `npm run build`) |
| `npm run openapi -w server` | regenerate `docs/openapi.json` from the Zod schemas |
| `scripts/backup.sh` / `scripts/restore.sh` | nightly `pg_dump` with 30-day retention, and restore into an empty database |

## Configuration

Every variable is documented in [`server/.env.example`](server/.env.example). The server refuses to
start with a missing or malformed value and names the problem. Runtime settings (tax, service
charge, timezone, KDS thresholds) live in the database and are edited by an admin.

## Quality and operations

| Document | What it records |
|---|---|
| [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md) | Every SRS acceptance criterion (AC-1…22) with its result and the test that proves it |
| [docs/SECURITY.md](docs/SECURITY.md) | NFR-S1…S10 mapped to code and tests, findings fixed, and accepted risks |
| [docs/OPERATIONS.md](docs/OPERATIONS.md) | Backups and the restore drill, scaling past one instance, the deploy checklist, and the Stripe webhook round trip |
| [docs/openapi.json](docs/openapi.json) | OpenAPI 3 for every endpoint, generated from the shared Zod schemas |

## Money

All amounts are integer cents and all rates are integer basis points (`875` = 8.75%). Integer cents
is a fixed-point decimal, so there's no floating-point rounding. See
[ADR-004](docs/DECISIONS.md#adr-004--money-column-type-int-vs-bigint).

## Photography

The food, venue and guest photos in `client/public/images/` come from
[Unsplash](https://unsplash.com) under the [Unsplash License](https://unsplash.com/license)
(free to use, no attribution required; credited here anyway). They are served by the client as
static files, and the seed points each dish's `imageUrl` at `/images/dishes/<dish>.jpg`. Each file
name is its Unsplash photo id:

| File | Unsplash photo |
|---|---|
| `dishes/truffle-arancini.jpg` | `photo-1688458296759-91020b4ff2ba` |
| `dishes/winter-caesar.jpg` | `photo-1550304943-4f24f54ddde9` |
| `dishes/wagyu-burger.jpg` | `photo-1568901346375-23c9450c58cd` |
| `dishes/margherita.jpg` | `photo-1574071318508-1cdbab80d002` |
| `dishes/roast-halibut.jpg` | `photo-1519708227418-c8fd9a32b7a2` |
| `dishes/lava-fondant.jpg` | `photo-1606313564200-e75d5e30476c` |
| `dishes/tiramisu.jpg` | `photo-1571877227200-a0d98ea607e9` |
| `dishes/iced-matcha.jpg` | `photo-1515823064-d6e0c04616a7` |
| `dishes/yuzu-lemonade.jpg` | `photo-1523371054106-bbf80586c38c` |
| `hero-plate.jpg` | `photo-1540189549336-e6e99c3679fe` |
| `spread.jpg` | `photo-1504674900247-0877df9cc836` |
| `dining.jpg` | `photo-1414235077428-338989a2e8c0` |
| `chef.jpg` | `photo-1577219491135-ce391730fb2c` |
| `interior.jpg` | `photo-1517248135467-4c7edcad34c4` |
| `bar.jpg` | `photo-1514933651103-005eec06c04b` |
| `tomatoes.jpg` | `photo-1592924357228-91a4daadcfea` |
| `grill.jpg` | `photo-1555939594-58d7cb561ad1` |
| `guests/1–4.jpg` | `photo-1494790108377-be9c29b29330`, `photo-1507003211169-0a1dd7228f2d`, `photo-1438761681033-6461ffad8d80`, `photo-1500648767791-00dcc994a43e` |
