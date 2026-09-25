# Project State
## Restaurant Ordering System (ROS)

> Read this first each session. When the phase or milestone changes, move this whole snapshot into
> [PROJECT_STATE_ARCHIVED.md](PROJECT_STATE_ARCHIVED.md) before rewriting it.

| | |
|---|---|
| **Last updated** | 2026-09-25 |
| **Phase** | Design complete · build not started |
| **Current milestone** | M0 — Foundation (0 / 12 slices) |
| **Next slice** | **M0-S1** — rename folder to `restaurant-ordering-system`, `git init`, first commit |
| **Overall progress** | 0 / 169 slices |
| **Health** | 🟢 on track — nothing built, nothing late |

---

## 1. Milestone progress

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

## 2. What exists

| Area | State |
|---|---|
| `docs/` | SRS 1.2.1 · HLD 1.2.1 · LLD 1.2.1 · ERD 1.2 · API-CONTRACT 1.1 · CODING-STANDARDS 1.2 · MILESTONES 1.2 · tracking files |
| `designs/` | 31 static HTML design directions + `index.html`; **design 31 chosen** (ADR-019), reference image in `designs/reference/` |
| Claude setup | `CLAUDE.md` at the root; project skill `fork-flame-ui` for all UI work |
| Code | None — no `package.json`, no workspaces |
| Git | Not initialised |
| Infra | No Docker, CI, or environments |

## 3. Open decisions

None. All ADRs in [DECISIONS.md](DECISIONS.md) are accepted. Money is integer cents in
`integer` columns (ADR-004), and the UI is design 31 (ADR-019).

## 4. Blockers

None. M0 can start immediately.

## 5. Known issues and doc debt

- **LLD revision table** order: 1.1.1 appears after 1.2.
- **Folder name** is misspelled (`restaurnat`) — fixed by M0-S1.

## 6. Next three actions

1. **M0-S1** — close editors/IDE, rename the folder, `git init`, commit `docs/` + `designs/`.
   (The `.idea/` module file and Claude project memory are keyed to the old path; expect to
   re-open the project afterwards.)
2. **M0-S2 → S5** — workspaces, strict tsconfig, ESLint/Prettier, Vitest.
3. **M0-S6 → S8** — Docker Postgres, fail-fast env parsing, Express app + `/health`.

## 7. Risks to watch now

- **R4 Scope creep** — the plan is ~184 working days; resist adding features before M8's demo.
- **R6 Money rounding** — M1-S2 (`bps()` half-away-from-zero) is the slice most likely to be skipped.
