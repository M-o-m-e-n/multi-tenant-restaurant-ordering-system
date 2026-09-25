# CLAUDE.md

Restaurant Ordering System (ROS) is a full-stack TypeScript restaurant ordering app for a single
restaurant. It covers dine-in by QR code, takeaway, delivery, reservations, a realtime kitchen display
(KDS), Stripe payments (test mode), and owner reports. It is a portfolio project built to be *correct*
about money, state and time.

**Status:** design is complete and the build hasn't started. There is no code, `package.json` or git
repo yet. Read `docs/PROJECT_STATE.md` first in every session.

## Documents: which one wins

`docs/` holds the spec. Before implementing anything, read the section a slice cites.

| Doc | Authority |
|---|---|
| `SRS.md` | Requirements, business rules (BR-*), acceptance criteria (AC-1…22) |
| `HLD.md` | Architecture, stack, risks |
| `LLD.md` | **Source of truth** for schema, algorithms, endpoints, error codes, tests |
| `ERD.md` / `API-CONTRACT.md` | Derived from the LLD. If one disagrees with the LLD, the LLD wins and the derived doc has the bug |
| `CODING-STANDARDS.md` | How code is written. Read it before writing any |
| `MILESTONES.md` | Build order. 14 milestones and 169 slices, each with a *Done when* check |
| `DECISIONS.md` | ADRs. Check it for **Proposed** ones before designing around them |

Never invent behaviour the docs don't specify. If the spec is silent or contradictory, say so and ask,
or propose an ADR.

## Stack (planned, HLD §5)

npm workspaces `shared` / `server` / `client`, all TypeScript `strict`.
- **server:** Express 4, Zod, Prisma + PostgreSQL 15, Socket.IO, jose (JWT) + bcrypt, Stripe
- **client:** React 18, Vite, React Router v6, TanStack Query, Zustand, Tailwind, Recharts
- **tests:** Vitest (all workspaces), Playwright (E2E)
- **dev infra:** Docker Compose. Redis only when running more than one instance

Commands, once M0 creates them: `npm install`, `npm run dev`, `npm run lint`, `npm run typecheck`,
`npm test`, `npm test -w shared`, `docker compose up -d`, `npx prisma migrate dev`, `npm run seed`.
Update this section when they exist.

## Rules that are not optional

Breaking any of these corrupts data silently. See `CODING-STANDARDS.md` §19 for the full list of
forbidden practices.

- **Money is integer cents** (`1234` = $12.34) in Postgres `integer` / Prisma `Int` columns (ADR-004).
  It's fixed-point, the BigDecimal equivalent. Don't add decimal.js, `Prisma.Decimal` or `NUMERIC`.
  **Rates are integer basis points.** No floats in the totals chain. Round only
  through `bps()` (half away from zero), never `Math.round`.
- **Pricing and state rules live only in `shared/domain`** as pure functions. The client and server
  both call `computeTotals`. The server is authoritative.
- **`Order.status` is written only by `transitionStatus`**, inside one transaction with its `OrderEvent`.
  **`Order.paymentStatus` is written only by `syncPaymentStatus`.** **`Discount.usedCount` is
  changed only by the conditional UPDATE.**
- **There is no `REFUNDED` value in `OrderStatus`.** Refunds are payment state.
- **Business date** is taken from `settings.timezone` when the order is placed. Never bucket by UTC or
  `date_trunc('day', placedAt)`.
- **Snapshot** menu name, price and modifiers onto `OrderItem`. Receipts and reports read snapshots.
- **Validate every route with a `.strict()` Zod schema from `shared/schemas`.** Every mutating route
  declares a role, and the service re-checks ownership.
- **Prisma models never cross the API boundary.** Map them with `toDto()`.
- **Emit realtime events only after commit**, through `events.publish`. Events are hints; REST is the
  truth.
- **`tableId` comes from the resolved QR token**, never from the request body. A GET never mutates.
- **Access token is kept in memory only. The refresh token is an httpOnly cookie.** Never use
  `localStorage` for tokens.
- **Secrets never go in git.** Update `.env.example` whenever you add an env var.

## Working a slice

1. Find the next slice in `docs/PROJECT_STATE.md`. Read its `Spec` references in the docs.
2. Implement only that slice. Keep changes small, and don't add scope from later milestones.
3. Prove its *Done when* check. Meet the Definition of Done (`MILESTONES.md` §3): typecheck, lint,
   tests, Zod, roles, DTOs, integer money, post-commit events, no secrets.
4. Update the tracking files:
   - tick the slice in `MILESTONES.md`
   - add an entry to `docs/IMPLEMENTATION_LOG.md` (newest first)
   - update `docs/PROJECT_STATE.md`. When the milestone changes, first move the old snapshot to
     `PROJECT_STATE_ARCHIVED.md`
   - add notable changes to `docs/CHANGELOG.md` under *Unreleased*
   - add an ADR to `docs/DECISIONS.md` for any design choice
5. If the build changes a design, update the owning doc (LLD first) and bump its version and revision
   table.
6. Commit or push only when asked. Commit messages follow `CODING-STANDARDS.md` §18.

## Skills

| Skill | When |
|---|---|
| **`fork-flame-ui`** (project, `.claude/skills/fork-flame-ui/`) | **Before any client UI work:** components, pages, Tailwind config, colours, charts, KDS/POS/admin screens. It defines the design-31 tokens, components and contrast rules, and points to the reference image `designs/reference/31-reference-landing.png`. |
| `code-review` | After finishing a slice or milestone, before committing |
| `security-review` | On auth, payments, webhooks, QR/table and any RBAC change; required at M13-S4 |
| `simplify` | When a slice's diff feels heavier than the slice |
| `run` | To launch the app and see a change working in the browser |
| `dataviz` | Together with `fork-flame-ui` when building the M11 report charts |

## Frontend direction

**Design 31, "Fork & Flame"** (ADR-019): dark charcoal, a single red accent, round plated-food photos,
a display serif with a clean sans, red pill CTAs with a soft glow. The visual target is the
reference screenshot. `designs/31-fork-flame-landing.html` is the working prototype. The other 30
files in `designs/` are rejected alternatives. Don't borrow from them.

## Environment

Windows 11. PowerShell is the primary shell and Git Bash is available. The folder name is currently
misspelled (`restaurnat-…`). M0-S1 renames it to `restaurant-ordering-system` before `git init`.
