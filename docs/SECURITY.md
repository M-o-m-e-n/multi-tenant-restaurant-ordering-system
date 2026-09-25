# Security Review
## Restaurant Ordering System (ROS)

| | |
|---|---|
| **Document ID** | ROS-SEC-001 |
| **Version** | 1.0 |
| **Date** | 2026-09-25 |
| **Scope** | M13-S4: every control in SRS NFR-S1…S10, checked against the code as built |

Each control names the code that implements it and the test that proves it. Where a control cannot
be proven locally, the reason is written down.

## 1. Control matrix

| NFR | Control | Implementation | Evidence |
|---|---|---|---|
| S1 | HTTPS/WSS and HSTS in production | `middleware/security-headers.ts` sends `Strict-Transport-Security: max-age=31536000; includeSubDomains` on every response | `hardening.test.ts` checks the header. TLS itself belongs to the deployment (reverse proxy); no staging exists yet (see §3) |
| S2 | bcrypt, cost ≥ 12, never logged or returned | `auth.password.ts` hashes with `BCRYPT_ROUNDS` (env, default 12; below 12 refused outside tests); constant-time dummy compare for unknown emails; DTOs never include `passwordHash`; log redaction covers `*.password` | `auth-register-login.test.ts` (same 401 for wrong email and password), `hardening.test.ts` (redaction) |
| S3 | Short HS256 access token; opaque, hashed, rotating refresh token | `jose` HS256, `JWT_ACCESS_SECRET` ≥ 32 chars, TTL ≤ 900 s (env schema); refresh = 32 random bytes, SHA-256 stored, rotated with family reuse detection, httpOnly `SameSite=Strict` cookie, `X-Refresh-Request` CSRF header | `auth-refresh.test.ts` I28–I32, `refresh-token-storage.test.ts`, `auth-sessions.test.ts` |
| S4 | Server-side role checks on every mutating endpoint | `authenticate` + `requireRole` per router or route; role and `isActive` re-read from the DB on every request; services re-check ownership | `security.test.ts` sweeps all 39 mutating endpoints (anonymous → 401, customer → 403, staff → 403 on admin routes); `auth-rbac.test.ts` (forged role claim, demotion, disabled account) |
| S5 | Zod at every boundary, unknown fields rejected | `validate()` middleware; every `z.object` in `shared/src/schemas` is `.strict()` (checked by a scan during this review) | `errors.test.ts` (unknown field → 400 with field details), `schemas.test.ts` |
| S6 | No string-built SQL | Prisma everywhere; the report queries use `Prisma.sql` tagged templates with bound values and quoted identifiers; no `$queryRawUnsafe` / `$executeRawUnsafe` in `server/src` | Code search during this review; `reports.test.ts` |
| S7 | Stripe signatures verified; replay-protected | Raw-body webhook mounted before the JSON parser and outside the limiter; `constructEvent` with the signing secret; `WebhookEvent` primary key dedupes inside the same transaction | `payments.test.ts` (bad signature → 400, duplicate event processed once) with real HMAC signatures |
| S8 | CORS allow-list with credentials; rate limits | `CLIENT_ORIGINS` allow-list (wildcard refused at env parse); limits: credentials 10/15 min/IP, refresh 60/15 min, QR 20/min, `POST /orders` 30/5 min/user, general 300/5 min; JSON bodies capped at 256 KB | `cors.test.ts`, `rate-limit.test.ts` (login), `security.test.ts` (orders), `hardening.test.ts` (413) |
| S9 | PII only to its owner and staff | `canSeeContact` gates name/phone/address in `OrderDTO`; the QR resolve returns `{id, number, seats, status}` only; reservations are listed to staff only; socket order payloads go to staff rooms, the owner's view to `customer:{orderId}`, which only the owner or staff can join | `security.test.ts` (QR summary keys, public settings, foreign order → 404), `orders.test.ts`, `realtime.test.ts` |
| S10 | No secrets in git | `server/.env` ignored; only `server/.env.example` is tracked; live Stripe keys refused at boot | `git ls-files` shows no `.env`; env schema test |

Also added in this pass: a JSON-API CSP (`default-src 'none'; frame-ancestors 'none'`),
`X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, no `X-Powered-By`, and one
structured log line per request, carrying the request id that error bodies return, with the query
string dropped so tokens in URLs never reach logs.

## 2. Findings fixed during the review

| Finding | Risk | Fix |
|---|---|---|
| `safeReturnTo` accepted `/\evil.example`, which browsers read as `//evil.example` | Open redirect after sign-in (react-router advisory CVE-2025-68470 class) | Any backslash, whitespace or control character now refuses the value; `returnTo.test.ts` |
| `bcrypt@5` pulled `@mapbox/node-pre-gyp` → vulnerable `tar` (install time) | Supply chain at install | Upgraded to `bcrypt@6`, which ships prebuilt binaries without `tar`; auth tests pass unchanged (hashes are compatible) |
| Refresh tokens were not in the log redaction list | Token in logs if ever logged | `*.refreshToken` and `*.authorization` added to `LOG_REDACT` |

## 3. Accepted risks and open items

| Item | Why it is accepted | Revisit |
|---|---|---|
| `npm audit`: `prisma` CLI → `@prisma/config` → `deepmerge-ts` (high) | Development/migration tooling only; it merges the project's own config file and is not in the runtime path. The "fix" npm offers is a downgrade | When Prisma ships a patched release |
| `npm audit`: `react-router-dom@6` (moderate) | The open-redirect vector is closed by `safeReturnTo`; other advisories concern framework/SSR mode, which this SPA does not use. The fix is a v7 major upgrade | Upgrade to React Router 7 after the portfolio release |
| No staging environment, so no TLS, HSTS preload or real Stripe webhook round trip (M13-S11, S12) | Needs a public host and Stripe test keys, neither available in this build environment | At deploy |
| Rate-limit stores are in memory | Correct for one instance (ADR-018); several instances need Redis (M13-S9) | When scaling out |
| Access token in memory means a reload refreshes once | By design (AUTH-12); XSS exposure limited to the 15-minute token | — |
