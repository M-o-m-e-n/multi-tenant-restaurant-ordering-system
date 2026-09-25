# Fork & Flame — Restaurant Ordering System

A full-stack ordering system for a single restaurant. Guests scan a table QR code, order from the
menu and track their order live. The kitchen works from a realtime display, staff run tables and
take payments, and the owner gets reports they can trust.

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

Open <http://localhost:5173>. The API health check is at <http://localhost:4000/health>.

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
| `npm test` | all unit and integration tests (Postgres must be running) |
| `npm run lint` / `npm run typecheck` | the individual gates |
| `npm run build` | production build of server and client |
| `npm run db:migrate` | apply Prisma migrations to the dev database |
| `npm run db:seed` | wipe and reload the demo data |
| `npm run db:studio` | browse the database in Prisma Studio |

## Configuration

Every variable is documented in [`server/.env.example`](server/.env.example). The server refuses to
start with a missing or malformed value and names the problem. Runtime settings (tax, service
charge, timezone, KDS thresholds) live in the database and are edited by an admin.

## Money

All amounts are integer cents and all rates are integer basis points (`875` = 8.75%). Integer cents
is a fixed-point decimal, so there's no floating-point rounding. See
[ADR-004](docs/DECISIONS.md#adr-004--money-column-type-int-vs-bigint).
