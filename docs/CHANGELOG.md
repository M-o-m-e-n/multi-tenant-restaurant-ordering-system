# Changelog
## Restaurant Ordering System (ROS)

All notable changes to this repository. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/) once code ships. Until then, entries track the design
document set.

Sections per release: **Added · Changed · Deprecated · Removed · Fixed · Security**.

---

## [Unreleased]

### Added
- Project-tracking files: `KICKOFF.md`, `PROJECT_STATE.md`, `PROJECT_STATE_ARCHIVED.md`,
  `DECISIONS.md` (ADR-001…019), `IMPLEMENTATION_LOG.md`, `CHANGELOG.md`.
- `CLAUDE.md`: project guide for Claude Code, covering doc precedence, the non-negotiable rules, the
  per-slice workflow and which skill to use when.
- Project skill `.claude/skills/fork-flame-ui`: the design-31 design system (tokens, type, components,
  contrast rules, and how it applies to KDS/POS/admin).
- `designs/reference/31-reference-landing.png`: the owner's reference screenshot for the frontend.

### Changed
- ADR-019 accepted: the frontend direction is **design 31, "Fork & Flame"**.
- ADR-004 accepted: money is **integer cents in Postgres `integer` columns** (Prisma `Int`), not
  `BIGINT` and not a decimal type. SRS 1.2.1, HLD 1.2.1 and LLD 1.2.1 (`BIGINT` → `INTEGER`), ERD 1.2
  (diagrams, Prisma skeleton and §11), CODING-STANDARDS 1.2 (why no BigDecimal; display-only
  formatting).

### Fixed
- MILESTONES v1.2: slice counts recounted from the tables. M3 is 18 slices / ~19d (was listed as
  11 / ~10d in §2 and 20 / ~17d in the v1.1 note); total is 169 slices / ~184 working days (was
  162 / ~175); first end-to-end demo at ~day 110 (was ~100). "Derived from" now cites v1.2 docs.
- ERD v1.1.1: Mermaid parse errors in diagrams 1 and 2 — multiple attribute keys must be
  comma-separated (`FK, UK`, `PK, FK`).

---

## [0.3.0] — 2026-09-25 — Access/refresh token model

### Added
- SRS v1.2: AUTH-10…14 (refresh exchange, rotation with reuse detection, httpOnly cookie delivery,
  session listing, purge); AC-20…22.
- HLD v1.2: token architecture in §5, §10.1, §10.2; risks R14 (KDS logs out mid-service) and R15
  (refresh token theft).
- LLD v1.2: `RefreshToken` model; refresh algorithm (§4.2); `/auth/refresh`, `/auth/logout`,
  `/auth/logout-all`, `/auth/sessions`; session error codes; CSRF and CORS-credentials rules;
  purge job; tests I28–I32.
- ERD v1.1: `RefreshToken` across all diagrams and tables; its `CASCADE` delete documented as the
  one exception to the SET NULL rule.
- API-CONTRACT v1.1 and CODING-STANDARDS v1.1: token handling rules.
- MILESTONES v1.1: seven new M3 slices (S2b…S2g, S10b) for the token model.

### Changed
- SRS AUTH-02 and AUTH-06 rewritten; NFR-S3 and NFR-S8 updated. Auth is no longer a single
  24 h JWT — see [ADR-012](DECISIONS.md#adr-012--short-access-jwt--rotating-opaque-refresh-token).

### Fixed
- LLD v1.1.1: added `REFUND_NOT_AVAILABLE` (422) and `TABLE_NUMBER_TAKEN` (409), which the API
  contract required and the LLD lacked.

### Security
- Access tokens now live 15 min and in memory only; refresh tokens are hashed at rest, rotated on
  use, and revoke their family on replay.

---

## [0.2.0] — 2026-09-25 — Design review

### Added
- Scope: tips (SRS §3.13), order amendments (ORD-12…14), receipts and kitchen tickets (§3.14).
- `PaymentStatus.PARTIALLY_PAID`; `PaymentState` for payment records.
- Business date and restaurant timezone as first-class concepts (ORD-15, BR-15).
- `OrderSequence` and `IdempotencyKey` models; server-side modifier validation; `appendItems`,
  `getReceipt`, `syncPaymentStatus`.
- `payment:changed` realtime event; Redis for N>1 instances.
- Tests P9–P12, S1–S8, I15–I27; acceptance criteria AC-13…19; risks R10–R13.
- ERD, API contract, coding standards and milestone plan (v1.0 of each).

### Changed
- Refunds re-modelled as payment state only; refund allowed on cancelled orders
  ([ADR-005](DECISIONS.md#adr-005--refunds-are-payment-state-not-order-state)).
- State machine gated per edge with an explicit `FORWARD_TRANSITION`; BR-12 made a strict one-step
  sequence.
- Pricing moved to integer basis points with a symmetric `bps()` helper, explicit tax base, tip
  step, and a `serviceChargeTaxable` setting.
- Reports rewritten around one revenue definition, business-date bucketing, `menuItemId` grouping
  and quoted identifiers.
- Table sessions split into read / open / close / clean; session open is a POST.
- `order:updated` renamed `order:status`; anonymous sockets admitted to `menu`.
- Per-request `isActive` and role re-check.
- NFR-S5 now rejects unknown fields; NFR-U3 bars colour-only signalling.

### Removed
- `REFUNDED` from `OrderStatus`.
- The `Setting`-based daily order counter.

### Fixed
- `UNIQUE(orderNumber)` collision on day two → `UNIQUE(businessDate, orderNumber)`.
- Pricing test P2; AC-9 de-circularised (asserts against a seed fixture).
- HLD title typo; SRS index list, unique constraints and Appendix A; Appendices B and C completed.

---

## [0.1.0] — 2026-09-25 — Initial design

### Added
- SRS v1.0, HLD v1.0, LLD v1.0.
- 31 frontend design directions in `designs/` with an index page.
