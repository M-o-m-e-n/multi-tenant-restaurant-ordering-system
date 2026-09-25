# Project Kickoff
## Restaurant Ordering System (ROS)

| | |
|---|---|
| **Document ID** | ROS-KICK-001 |
| **Version** | 1.0 |
| **Date** | 2026-09-25 |
| **Status** | Design complete · build not started |

---

## 1. What we are building

A full-stack restaurant ordering system for **one restaurant per deployment**, covering four
service channels — dine-in (QR at the table), takeaway, delivery, and reservations — plus the
kitchen display, payments, and owner reporting that sit behind them.

It is a portfolio-grade project: the goal is a system that is *correct* about money, state and
time, not just one that demos well. Correctness targets are stated as 22 acceptance criteria
(SRS §9, AC-1 … AC-22).

## 2. Who it is for

| User | What they need | Primary screen |
|---|---|---|
| Customer (guest or registered) | Browse, order, pay, track | Menu → cart → tracker |
| Staff (floor / kitchen / POS) | See and advance orders, take cash, run tables | KDS, POS, table map |
| Admin (owner) | Run the menu, see trustworthy numbers, manage staff | Dashboard, reports, menu manager |

## 3. Scope (v1)

**In:** auth with RBAC and refresh tokens · menu with modifiers and 86'ing · QR table sessions ·
cart with shared server/client pricing · order lifecycle with audit trail · realtime KDS ·
Stripe (test mode) card, cash, split, refund · order amendments · tips · receipts and kitchen
tickets · reports on one revenue definition · takeaway, delivery, reservations · staging deploy.

**Out:** multi-tenant, live payments, third-party delivery integrations, native apps, i18n beyond
a single currency (SRS §1.2, §2.5).

## 4. Stack at a glance

TypeScript (strict) · npm workspaces (`shared` / `server` / `client`) · React 18 + Vite + React
Router + TanStack Query + Zustand + Tailwind + Recharts · Express 4 · Zod · Prisma + PostgreSQL 15 ·
Socket.IO · jose + bcrypt · Stripe · Vitest + Playwright · Docker Compose. Redis only when running
more than one instance. Full rationale: HLD §5.

## 5. The document set

Read in this order. Each later document derives from the earlier ones; where they disagree, the
earlier-authority document wins as stated in its header.

| # | Doc | ID | Version | Role |
|---|---|---|---|---|
| 1 | [SRS.md](SRS.md) | ROS-SRS-001 | 1.2.1 | *What* — requirements, business rules, acceptance criteria |
| 2 | [HLD.md](HLD.md) | ROS-HLD-001 | 1.2.1 | *Shape* — architecture, stack, risks |
| 3 | [LLD.md](LLD.md) | ROS-LLD-001 | 1.2.1 | *Detail* — schema, algorithms, endpoints, tests |
| 4 | [ERD.md](ERD.md) | ROS-ERD-001 | 1.2 | Relational view of LLD §2 |
| 5 | [API-CONTRACT.md](API-CONTRACT.md) | ROS-API-001 | 1.1 | Wire contract for LLD §5–6 |
| 6 | [CODING-STANDARDS.md](CODING-STANDARDS.md) | ROS-STD-001 | 1.2 | How code is written |
| 7 | [MILESTONES.md](MILESTONES.md) | ROS-PLAN-001 | 1.2 | Build order — 14 milestones, sliced |

Project-tracking files (this set):

| Doc | Purpose |
|---|---|
| [KICKOFF.md](KICKOFF.md) | This file — orientation for anyone starting on the project |
| [PROJECT_STATE.md](PROJECT_STATE.md) | Where the project is *right now*; the file to read first each session |
| [PROJECT_STATE_ARCHIVED.md](PROJECT_STATE_ARCHIVED.md) | Past snapshots of PROJECT_STATE, moved here when superseded |
| [DECISIONS.md](DECISIONS.md) | Architecture decision records — what was chosen, and why |
| [IMPLEMENTATION_LOG.md](IMPLEMENTATION_LOG.md) | Dated, per-session work log |
| [CHANGELOG.md](CHANGELOG.md) | Notable changes to the repository, by version |

## 6. Ground rules

1. **Every milestone leaves a runnable system** and ends in a demo (HLD §1.3). If it cannot be
   demonstrated, it was cut wrong.
2. **The Definition of Done** in MILESTONES §3 applies to every slice — types, lint, tests, Zod
   validation, role checks, DTO mapping, integer money, post-commit events, no secrets in git.
3. **Money is integer cents; rates are basis points.** No float enters a total. Cents are our
   BigDecimal, a fixed-point decimal with scale 2. The decimal point is only added on screen (ADR-004).
4. **Nothing except `syncPaymentStatus` writes `Order.paymentStatus`.** Nothing except
   `transitionStatus` writes `Order.status`.
5. **Docs follow the code.** When the build changes a design, update the owning document and log
   the decision in DECISIONS.md.

## 7. Session workflow

At the start of a session:
1. Read `PROJECT_STATE.md` — current milestone, next slice, blockers.
2. Check `DECISIONS.md` for anything still **Proposed**.

At the end of a session:
1. Append an entry to `IMPLEMENTATION_LOG.md`.
2. Tick finished slices in `MILESTONES.md`.
3. Update `PROJECT_STATE.md`. If the milestone changed, move the old snapshot into
   `PROJECT_STATE_ARCHIVED.md` first.
4. Add user-visible or structural changes to `CHANGELOG.md` under *Unreleased*.

## 8. First steps

The build starts at **M0-S1**: rename the folder `restaurnat-ordering-system` →
`restaurant-ordering-system`, then `git init` and make the first commit containing `docs/` and
`designs/`. Do this before `node_modules` exists. No decisions are open: money is integer cents in
`integer` columns (ADR-004) and the design direction is design 31 (ADR-019).

## 9. Honest size

169 slices, about 184 working days for one developer (MILESTONES §2). The first end-to-end demo —
scan a QR, order, watch it land on the kitchen screen — arrives at the end of **M8, around day 110**.
If scope must be cut: M12 first, then CSV export (M11-S14), then kitchen-ticket printing.
Never cut M1 or M9's webhook handling.
