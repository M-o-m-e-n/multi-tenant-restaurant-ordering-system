# Project State — Archive
## Restaurant Ordering System (ROS)

Superseded snapshots of [PROJECT_STATE.md](PROJECT_STATE.md), newest first. Paste the entire old
snapshot under a dated heading when the phase or milestone changes; do not edit entries afterwards.

**Archiving rule**
1. Copy the full current `PROJECT_STATE.md` body below the divider, under
   `## Snapshot — YYYY-MM-DD — <phase / milestone>`.
2. Add a one-line **Closed because:** note (e.g. "M0 demo passed").
3. Then rewrite `PROJECT_STATE.md` for the new phase.

---

## Snapshot — 2026-09-25 — Design v1.1 (before the token-model revision)

**Closed because:** the v1.1 design assumed a single 24 h JWT with no refresh tokens; this was
reversed in the v1.2 revision (ADR-012), which added nine M3 slices.

| | |
|---|---|
| **Phase** | Design review complete |
| **Docs** | SRS 1.1 · HLD 1.1 · LLD 1.1 · ERD 1.0 · API-CONTRACT 1.0 · CODING-STANDARDS 1.0 · MILESTONES 1.0 |
| **Plan** | 14 milestones, 162 slices, ~175 working days; M3 at 11 slices / ~10d |
| **Code / git** | None / not initialised |
| **Open decisions** | Money column type (ERD §11); design direction (M0-S10) |

---

## Snapshot — 2026-09-25 — Design v1.0 (initial draft)

**Closed because:** the design review produced v1.1, which changed the refund model, state machine,
pricing units, order numbering and reporting (see CHANGELOG 0.2.0).

| | |
|---|---|
| **Phase** | Initial design drafted |
| **Docs** | SRS 1.0 · HLD 1.0 · LLD 1.0 |
| **Design exploration** | 31 frontend directions in `designs/` |
| **Known problems (found in review)** | `REFUNDED` as an order status; source-keyed role gate; rates not yet in basis points; `UNIQUE(orderNumber)` collision on day two; order counter in `Setting`; reports bucketed on UTC and summing `Order.total`; mutating QR GET |
