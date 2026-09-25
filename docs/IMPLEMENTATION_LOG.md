# Implementation Log
## Restaurant Ordering System (ROS)

A dated record of each working session: what was done, what was verified, what surprised us, and
what comes next. Newest entry first. Keep entries factual — decisions go in
[DECISIONS.md](DECISIONS.md), repository-level changes in [CHANGELOG.md](CHANGELOG.md).

---

## Entry template

```markdown
### YYYY-MM-DD — <milestone / slice ids> — <short title>

**Slices:** M?-S? ☑, M?-S? ◐ (in progress)
**Done**
- <change> — <file or area>
**Verified**
- <the slice's "Done when" check, and how it was run>
**Issues / surprises**
- <what went wrong or took longer, and why>
**Decisions raised:** ADR-NNN (or none)
**Next:** <first slice for the next session>
**Time:** <hours> (estimate was <S/M/L>)
```

---

### 2026-09-25 — Pre-M0 — Money type settled (ADR-004)

**Slices:** none (design decision)
**Done**
- The owner asked why money isn't a decimal like Java's BigDecimal. Explained that integer cents is
  that same fixed-point representation with scale 2, and chose to keep it.
- Accepted ADR-004: Postgres `integer` / Prisma `Int` cents, with the rationale and rejected
  alternatives recorded (`BigInt`, `NUMERIC` in the DB only, decimal.js everywhere).
- Money columns changed from `BIGINT` to `INTEGER` in SRS §6.4, HLD §6.2, LLD §2.2 (15 columns),
  and the ERD diagrams and Prisma skeleton (15 fields each). ERD §11 now records the decision.
- CODING-STANDARDS §6 now covers why integers, display-only formatting (`formatMoney`) and a single
  `parseMoneyInput`.
**Verified**
- `bigint` remains only in rationale text and revision rows.
**Decisions raised:** ADR-004 → Accepted. No decisions remain open.
**Next:** M0-S1.

### 2026-09-25 — Pre-M0 — Design direction chosen; CLAUDE.md and UI skill

**Slices:** M0-S10 ◐. The direction is chosen; extracting the Tailwind tokens waits for the client
workspace (M0-S9).
**Done**
- Accepted ADR-019: design 31 "Fork & Flame", with the owner's screenshot as the visual target
  (copied to `designs/reference/31-reference-landing.png`).
- Wrote the `fork-flame-ui` project skill with tokens, type scale, component specs, contrast rules
  and per-screen guidance.
- Wrote the root `CLAUDE.md`.
**Issues / surprises**
- The prototype's red `#e5322d` fails AA for small text on `#141414` (3.5 : 1). Added a
  `flame-text` token `#ff5a52` (6.0 : 1) for prices and links.
- The screenshot's headline serif isn't identified. Philosopher is the closest free match, with
  Playfair Display as the fallback.
**Decisions raised:** ADR-019 → Accepted.
**Next:** M0-S1.

### 2026-09-25 — Pre-M0 — Milestone slice recount

**Slices:** none (doc maintenance)
**Done**
- Recounted every milestone table in `MILESTONES.md` and bumped it to v1.2.
- M3: 18 slices, ~19d. Total: 169 slices, ~184 working days. M0–M8 (first end-to-end demo)
  now sums to ~110 days.
- Updated the header's "Derived from" to SRS/HLD/LLD v1.2, and synced KICKOFF and PROJECT_STATE.
**Verified**
- Counted `| ☐ | **Mx-Sy** |` rows per milestone and summed sizes (S=0.5, M=1, L=2); every other
  milestone already matched §2.
**Next:** M0-S1.

### 2026-09-25 — Pre-M0 — Project-tracking files

**Slices:** none (scaffolding outside the milestone plan)
**Done**
- Added `KICKOFF.md`, `PROJECT_STATE.md`, `PROJECT_STATE_ARCHIVED.md`, `DECISIONS.md`,
  `IMPLEMENTATION_LOG.md`, `CHANGELOG.md` to `docs/`.
- Recorded 17 accepted and 2 proposed ADRs extracted from SRS/HLD/LLD/ERD.
**Issues / surprises** — found while reading the doc set:
- MILESTONES §2 still lists M3 at 11 slices / ~10d and the total at 162 slices, but M3 now has 18
  slices after the v1.1 token additions (and the revision note says 20 / ~17d). Totals need
  recounting.
- MILESTONES header says "Derived from … v1.1" while SRS, HLD and LLD are at v1.2.
- LLD revision table lists 1.1.1 after 1.2 — reorder for readability.
- ADR-004 (money column type) is still open and blocks M2-S3.
**Decisions raised:** ADR-004, ADR-019 remain Proposed.
**Next:** M0-S1 — rename the folder and `git init`.

### 2026-09-25 — Pre-M0 — Token model revision (v1.2)

**Done**
- SRS/HLD/LLD bumped to v1.2 with the access/refresh token model; ERD, API contract, coding
  standards and milestones bumped to v1.1 to match.
- LLD v1.1.1 patch: two missing error codes added.
**Why:** a 24 h JWT would log out always-on KDS devices mid-shift (see ADR-012).

### 2026-09-25 — Pre-M0 — Design review (v1.1) and supporting docs

**Done**
- Design review of SRS/HLD/LLD v1.0; all three moved to v1.1 (see CHANGELOG 0.2.0).
- Wrote ERD, API-CONTRACT, CODING-STANDARDS and MILESTONES at v1.0.

### 2026-09-25 — Pre-M0 — Initial design and UI exploration

**Done**
- SRS, HLD, LLD v1.0.
- 31 frontend design directions (`designs/01…31`) and `designs/index.html` to compare them.
