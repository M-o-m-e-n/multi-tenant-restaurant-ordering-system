# Project State — Archive
## Restaurant Ordering System (ROS)

Superseded snapshots of [PROJECT_STATE.md](PROJECT_STATE.md), newest first. Paste the entire old
snapshot under a dated heading when the phase or milestone changes; do not edit entries afterwards.

**Archiving rule**
1. Copy the full current `PROJECT_STATE.md` body below the divider, under
   `## Snapshot — 2026-09-25 — Design complete, build not started

**Closed because:** the build ran M0 through M8 in one session; the M8 demo passed (an order from a phone reached the KDS in 105 ms and the tracker followed every bump).

| | |
|---|---|
| **Phase** | Design complete · build not started |
| **Current milestone** | M0 — Foundation (0 / 12 slices) |
| **Next slice** | **M0-S1** — rename folder to `restaurant-ordering-system`, `git init`, first commit |
| **Overall progress** | 0 / 169 slices |

### 1. Milestone progress

| # | Milestone | Status | Slices done |
|---|---|---|---|
| M0 | Foundation | ▶ Next | 0 / 12 |
| M1 | Shared domain core | Not started | 0 / 9 |
| M2 | Database & seed | Not started | 0 / 12 |
| M3 | Auth & RBAC | Not started | 0 / 18 |
| M4 | Menu | Not started | 0 / 12 |
| M5 | Tables & QR sessions | Not started | 0 / 10 |
| M6 | Cart & server pricing | Not started | 0 / 9 |
| M7 | Order placement & lifecycle | Not started | 0 / 13 |
| M8 | Realtime & KDS | Not started | 0 / 13 |
| M9 | Payments | Not started | 0 / 13 |
| M10 | Amendments, tips & receipts | Not started | 0 / 13 |
| M11 | Reports & dashboard | Not started | 0 / 14 |
| M12 | Delivery, takeaway & reservations | Not started | 0 / 7 |
| M13 | Hardening & deploy | Not started | 0 / 14 |

### 2. What exists

| Area | State |
|---|---|
| `docs/` | SRS 1.2.1 · HLD 1.2.1 · LLD 1.2.1 · ERD 1.2 · API-CONTRACT 1.1 · CODING-STANDARDS 1.2 · MILESTONES 1.2 · tracking files |
| `designs/` | 31 static HTML design directions + `index.html`; **design 31 chosen** (ADR-019), reference image in `designs/reference/` |
| Claude setup | `CLAUDE.md` at the root; project skill `fork-flame-ui` for all UI work |
| Code | None — no `package.json`, no workspaces |
| Git | Not initialised |
| Infra | No Docker, CI, or environments |

### 3. Open decisions

None. All ADRs in [DECISIONS.md](DECISIONS.md) are accepted. Money is integer cents in
`integer` columns (ADR-004), and the UI is design 31 (ADR-019).

### 4. Blockers

None. M0 can start immediately.

### 5. Known issues and doc debt

- **LLD revision table** order: 1.1.1 appears after 1.2.
- **Folder name** is misspelled (`restaurnat`) — fixed by M0-S1.

### 6. Next three actions

1. **M0-S1** — close editors/IDE, rename the folder, `git init`, commit `docs/` + `designs/`.
   (The `.idea/` module file and Claude project memory are keyed to the old path; expect to
   re-open the project afterwards.)
2. **M0-S2 → S5** — workspaces, strict tsconfig, ESLint/Prettier, Vitest.
3. **M0-S6 → S8** — Docker Postgres, fail-fast env parsing, Express app + `/health`.

### 7. Risks to watch now

- **R4 Scope creep** — the plan is ~184 working days; resist adding features before M8's demo.
- **R6 Money rounding** — M1-S2 (`bps()` half-away-from-zero) is the slice most likely to be skipped.

---
## Snapshot — YYYY-MM-DD — <phase / milestone>`.
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
