# API Contract
## Restaurant Ordering System (ROS)

| | |
|---|---|
| **Document ID** | ROS-API-001 |
| **Version** | 1.1 (API `v1`) |
| **Status** | Draft |
| **Date** | 2026-09-25 |
| **Authority** | **ROS-LLD-001 v1.1 §5 and §6 define the endpoint set.** This document is the wire contract: exact payloads, status codes, headers and error bodies. Where the two disagree, the LLD wins and this file is the bug. |
| **Base URL** | `https://<host>/api/v1` |

---

## Table of Contents
1. [Conventions](#1-conventions)
2. [Authentication](#2-authentication)
3. [Authorisation levels](#3-authorisation-levels)
4. [Response envelopes](#4-response-envelopes)
5. [Error catalogue](#5-error-catalogue)
6. [Pagination](#6-pagination)
7. [Idempotency](#7-idempotency)
8. [Rate limits](#8-rate-limits)
9. [Shared DTOs](#9-shared-dtos)
10. [Auth endpoints](#10-auth-endpoints)
11. [Menu endpoints](#11-menu-endpoints)
12. [Order endpoints](#12-order-endpoints)
13. [Payment endpoints](#13-payment-endpoints)
14. [Table & reservation endpoints](#14-table--reservation-endpoints)
15. [Discount & settings endpoints](#15-discount--settings-endpoints)
16. [Report & dashboard endpoints](#16-report--dashboard-endpoints)
17. [Realtime contract](#17-realtime-contract)
18. [Stripe webhook contract](#18-stripe-webhook-contract)
19. [Versioning policy](#19-versioning-policy)
20. [Revision history](#20-revision-history)

---

## 1. Conventions

| | |
|---|---|
| Protocol | HTTPS only in production; TLS 1.2+ (NFR-S1) |
| Base path | `/api/v1` — the version is in the path, never a header |
| Content type | `application/json; charset=utf-8` both directions, except the Stripe webhook which receives the raw body |
| Money | Integer **minor units** (cents). `1250` is $12.50. Never a decimal, never a string |
| Rates | Integer **basis points**. `875` is 8.75% |
| Dates | `businessDate` is `YYYY-MM-DD`. Instants are RFC 3339 UTC, e.g. `2026-09-25T19:04:11.482Z` |
| Ids | UUID v4 strings |
| Unknown fields | **Rejected** with `400 VALIDATION_ERROR`. Schemas are `.strict()` (NFR-S5) |
| Casing | `camelCase` in bodies; `kebab-case` in paths |
| Trailing slashes | Not accepted |
| Body size | 256 KB maximum |

**Method semantics are honoured.** No `GET` mutates state. Opening a dine-in session seats a table,
so it is a `POST` even though it reads like a lookup — link previews and prefetchers fire `GET`s.

---

## 2. Authentication

Two tokens with different jobs. The **access token** proves who you are on each call; the
**refresh token** buys new access tokens without re-entering a password.

### Access token

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIs…
```

| | |
|---|---|
| Format | JWT, HS256, secret ≥ 256 bits from the environment (NFR-S3) |
| Claims | `{ sub: userId, role, name, sid: familyId, iat, exp }` |
| Lifetime | **15 minutes**, configurable |
| Storage | **Memory only.** Never `localStorage`, `sessionStorage`, or a readable cookie (AUTH-12) |
| On expiry | `401 UNAUTHENTICATED` → call `/auth/refresh` → replay the request once |

### Refresh token

Delivered as a cookie the browser manages for you. **It never appears in a response body and page
scripts cannot read it.**

```http
Set-Cookie: rt=<opaque>; HttpOnly; Secure; SameSite=Strict;
            Path=/api/v1/auth; Max-Age=2592000
```

| | |
|---|---|
| Format | Opaque 256-bit random value, base64url. **Not a JWT** — it must be revocable |
| Lifetime | **30 days** from each issue |
| At rest | Stored server-side as a SHA-256 hash only, so a database disclosure yields no usable tokens |
| Scope | `Path=/api/v1/auth` — not attached to ordinary API traffic |
| Rotation | Every `/auth/refresh` issues a new one and revokes its predecessor (AUTH-11) |

**Rotation means a refresh token is single-use.** Presenting one that has already been rotated means
two parties hold it, which means it was stolen — so the **entire session family is revoked** and
every device on that session must sign in again (`401 SESSION_REVOKED`, AC-21).

### Session lifetime in practice

A client that is used at least once every 30 days never sees a login prompt. This is what keeps an
always-on kitchen display working through a shift: it refreshes roughly four times an hour, silently,
and is never interrupted (AUTH-10, AC-20).

### Revocation

Immediate, by two independent mechanisms:

- `authenticate` re-reads `isActive` and `role` from the database on every request (60 s cache), so a
  disabled or demoted account loses access on its **next call** rather than in up to 15 minutes
  (ADM-02, AUTH-08, AC-18).
- `POST /auth/logout` revokes that refresh token server-side; `POST /auth/logout-all` revokes every
  session for the user.

**The role in the access token is a hint, not the authority.** Clients may read it to decide what to
render; the server always re-reads.

### CORS

Because the refresh token is a cookie, the browser only sends it on a credentialed request:

```js
fetch(url, { credentials: 'include' })
```

The server therefore runs CORS with `credentials: true` against an **explicit origin allow-list**.
A wildcard origin is impossible alongside credentials and browsers reject it outright (NFR-S8).

### Client responsibilities

1. Hold the access token in memory. On a page reload, call `/auth/refresh` before the first request.
2. On `401 UNAUTHENTICATED`, refresh **once** and replay the original request. If that also fails,
   clear auth and go to login. Never loop.
3. **Exactly one refresh in flight.** Concurrent 401s must queue behind a single refresh call.
   Firing several rotates the token several times, and every rotation but the last looks like a
   replay — which trips reuse detection and logs the user out.

### The 401 family

| Code | Meaning | Client action |
|---|---|---|
| `UNAUTHENTICATED` | Access token missing, malformed or expired | Refresh, then replay once |
| `ACCOUNT_DISABLED` | Token valid, account now inactive | Clear auth, explain why |
| `REFRESH_TOKEN_INVALID` | No refresh cookie, or it is unrecognised | Clear auth, go to login |
| `SESSION_EXPIRED` | Refresh token past its 30-day life | Clear auth, go to login |
| `SESSION_REVOKED` | A rotated token was replayed — treated as theft | Clear auth, tell the user the session was ended for safety |
| `INVALID_CREDENTIALS` | Login failed. Identical for a wrong email and a wrong password | Show one generic message |

---

## 3. Authorisation levels

| Symbol | Level | Meaning |
|---|---|---|
| 🔓 | public | No token required |
| 🔒 | authenticated | Any valid token |
| 👤 | owner | The authenticated user owns the resource |
| 🛎 | staff | `STAFF` or `ADMIN` |
| 🛠 | admin | `ADMIN` only |

Enforcement is two-layer (NFR-S4): a role gate as route metadata, and an ownership check inside the
service. A route-level role check alone cannot stop one customer reading another's order.

**Resources you may not know exist return `404`, not `403`** — a 403 confirms the id is real.

---

## 4. Response envelopes

**Success** — the resource, unwrapped:

```json
{ "id": "3f8a…", "orderNumber": "A-1042", "status": "PLACED" }
```

**Collection** — data plus pagination meta:

```json
{
  "data": [ { "id": "3f8a…" } ],
  "meta": { "page": 1, "limit": 25, "total": 137 }
}
```

**Error** — always this shape, for every status:

```json
{
  "error": {
    "code": "INVALID_MODIFIER_SELECTION",
    "message": "Choose a size before adding this item.",
    "details": { "groupId": "8c21…", "minSelect": 1, "received": 0 },
    "requestId": "01JB2X…"
  }
}
```

| Field | Notes |
|---|---|
| `code` | Stable. **Switch on this.** Never parse the message |
| `message` | Human-readable, may change between releases, safe to display |
| `details` | Optional, shape varies by code. Field-level errors arrive here |
| `requestId` | Present on every error; matches the server log line |

Success statuses: `200` read or update · `201` created · `204` deleted, no body.

---

## 5. Error catalogue

Every code the API can return. `details` is omitted unless described.

### 400 — malformed request

| Code | When | `details` |
|---|---|---|
| `VALIDATION_ERROR` | Zod rejected the body, params or query, including an unknown field | `{ fieldErrors: { <path>: [msg] } }` |
| `WEBHOOK_INVALID_SIGNATURE` | Stripe signature verification failed | — |

### 401 — not authenticated

| Code | When |
|---|---|
| `UNAUTHENTICATED` | Access token missing, malformed or expired |
| `ACCOUNT_DISABLED` | Token valid, account `isActive = false` |
| `INVALID_CREDENTIALS` | Login failed. **Identical for a wrong email and a wrong password** |
| `REFRESH_TOKEN_INVALID` | Refresh cookie absent or unrecognised |
| `SESSION_EXPIRED` | Refresh token past its 30-day life |
| `SESSION_REVOKED` | A rotated refresh token was replayed; the family has been revoked |

### 403 — authenticated but not permitted

| Code | When |
|---|---|
| `FORBIDDEN` | Role insufficient for this route |

### 404 — not found

| Code | When |
|---|---|
| `ORDER_NOT_FOUND` | No such order, **or** it exists and is not yours |
| `MENU_ITEM_NOT_FOUND` · `TABLE_NOT_FOUND` · `RESERVATION_NOT_FOUND` · `DISCOUNT_NOT_FOUND` | As named |

### 409 — conflict with current state

| Code | When | Client action |
|---|---|---|
| `EMAIL_TAKEN` | Registration with an existing email | Offer login |
| `ILLEGAL_TRANSITION` | The `(from → to)` edge does not exist, or your role may not take it | Refetch, re-render actions |
| `CONCURRENT_UPDATE` | Someone else moved this order first | Refetch silently |
| `ITEM_UNAVAILABLE` | An item was 86'd between cart and checkout | Remove the line, highlight it |
| `ORDER_NOT_AMENDABLE` | Append attempted past `PREPARING` | Hide "add to order", refetch |
| `TABLE_DIRTY` | Session requested on a table needing clearing | Ask staff |
| `TABLE_HAS_OPEN_ORDERS` | Close attempted with orders still open (BR-08) | Show which orders |

### 422 — well-formed but a business rule refuses

| Code | When |
|---|---|
| `EMPTY_CART` | No items submitted |
| `ZERO_TOTAL` | Computed total is zero |
| `INVALID_MODIFIER_SELECTION` | A modifier is not offered on this item, is unavailable, or violates `minSelect`/`maxSelect` |
| `DISCOUNT_INACTIVE` · `DISCOUNT_EXPIRED` · `DISCOUNT_MIN_NOT_MET` · `DISCOUNT_LIMIT_REACHED` | Promo code rejected, reason named |
| `PAYMENT_EXCEEDS_BALANCE` | Amount greater than `total − amountPaid` |
| `IDEMPOTENCY_KEY_REUSED` | Same key, different body — a client bug. **Do not retry** |
| `REFUND_NOT_AVAILABLE` | No successful payment to refund |

### 429 / 500

| Code | When | Headers |
|---|---|---|
| `RATE_LIMITED` | Limit exceeded (§8) | `Retry-After: <seconds>` |
| `INTERNAL_ERROR` | Unhandled. Never carries internal detail | — |

---

## 6. Pagination

Applies to every collection endpoint.

| Param | Type | Default | Max |
|---|---|---|---|
| `page` | integer ≥ 1 | `1` | — |
| `limit` | integer ≥ 1 | `25` | `100` |

```http
GET /api/v1/orders?page=2&limit=50&status=PLACED&status=CONFIRMED
```

Repeated params build an array. `from` and `to` are **business dates** (`YYYY-MM-DD`), inclusive.

---

## 7. Idempotency

Supported on `POST /orders` and `POST /payments/intent` — the two calls where a retry could take
money twice or place a duplicate order (NFR-R5).

```http
POST /api/v1/orders
Idempotency-Key: 8f14e45f-ea6a-4c11-9f3b-2d7c1a9e5b40
```

| Situation | Response |
|---|---|
| First use of the key | Processed normally; the response is stored |
| Repeat, same body | The **stored response replayed verbatim**, same status code |
| Repeat, different body | `422 IDEMPOTENCY_KEY_REUSED` |
| Header omitted | Processed normally, no replay protection |

Keys are scoped per user and per endpoint, and retained 24 h. Generate a fresh UUID per user
intent — not per retry attempt.

---

## 8. Rate limits

| Scope | Limit | Window |
|---|---|---|
| `/auth/login`, `/auth/register` | 10 per IP | 15 min |
| `/auth/refresh` | 60 per IP | 15 min |
| `POST /orders` | 30 per user | 5 min |
| `GET /tables/qr/:token`, `POST /tables/sessions` | 20 per IP | 1 min |
| Everything else | 300 per IP | 5 min |

Exceeding a limit returns `429 RATE_LIMITED` with `Retry-After`. The Stripe webhook is exempt.

---

## 9. Shared DTOs

### UserDto
```json
{ "id": "uuid", "name": "Jane Okafor", "email": "jane@example.com", "role": "CUSTOMER" }
```
Never contains `passwordHash`. `phone` appears only for the owner or staff (NFR-S9).

### MenuItemDto
```json
{
  "id": "uuid",
  "name": "Roast Halibut",
  "description": "Brown butter · capers · confit potato",
  "price": 2100,
  "imageUrl": "https://…/halibut.jpg",
  "isAvailable": true,
  "allergens": ["fish", "dairy"],
  "station": "grill",
  "modifierGroups": [
    {
      "id": "uuid", "name": "Size", "minSelect": 1, "maxSelect": 1,
      "items": [
        { "id": "uuid", "name": "Regular", "priceDelta": 0,   "isAvailable": true },
        { "id": "uuid", "name": "Large",   "priceDelta": 400, "isAvailable": true }
      ]
    }
  ]
}
```
An 86'd item is returned with `isAvailable: false`, **not omitted** (MENU-05).
`modifierGroups` appears on the item-detail endpoint only.

### PricingBreakdown
```json
{
  "subtotal": 3750, "discountAmount": 375, "serviceCharge": 422,
  "taxAmount": 295, "deliveryFee": 0, "tipAmount": 500,
  "total": 4592, "currency": "usd"
}
```
`total = (subtotal − discountAmount) + serviceCharge + taxAmount + deliveryFee + tipAmount` (BR-01).
The tip is never discounted and never taxed (BR-13).

### OrderDto
```json
{
  "id": "uuid",
  "orderNumber": "A-1042",
  "businessDate": "2026-09-25",
  "type": "DINE_IN",
  "status": "PREPARING",
  "paymentStatus": "PARTIALLY_PAID",
  "amountPaid": 2000,
  "balanceDue": 2592,
  "table": { "id": "uuid", "number": "12" },
  "customer": { "name": "Jane Okafor", "phone": "+15550142" },
  "items": [
    {
      "id": "uuid", "menuItemId": "uuid",
      "nameSnapshot": "Wagyu Burger",
      "unitPrice": 1850, "qty": 2,
      "modifiers": [
        { "groupName": "Size", "items": [ { "name": "Large", "priceDelta": 400 } ] }
      ],
      "modifierTotal": 400, "lineTotal": 4500,
      "notes": "no onions", "station": "grill",
      "addedAt": "2026-09-25T19:04:11.482Z"
    }
  ],
  "totals": { "…": "PricingBreakdown" },
  "discountCode": "SAVE10",
  "notes": "extra napkins",
  "placedAt": "2026-09-25T19:04:11.482Z",
  "completedAt": null,
  "nextStatuses": ["READY"],
  "isAmendable": true
}
```

| Field | Notes |
|---|---|
| `status` | Never `REFUNDED` — refund is a payment state (LLD §2.1, BR-07) |
| `paymentStatus` | `UNPAID` · `PARTIALLY_PAID` · `PAID` · `REFUNDED`. Derived from payment rows |
| `balanceDue` | `total − amountPaid`. What a further payment may charge |
| `nextStatuses` | **Role-filtered** for the caller. Drives the client's action buttons so the UI cannot offer an illegal move |
| `isAmendable` | True while `PLACED`, `CONFIRMED` or `PREPARING` (ORD-12) |
| `items[].*Snapshot` | Frozen at placement. A later menu edit never changes a placed order (ORD-05) |
| `customer` | Present for the owner and staff only |

### ReceiptDto
```json
{
  "orderNumber": "A-1042",
  "businessDate": "2026-09-25",
  "issuedAt": "2026-09-25T20:41:02.114Z",
  "restaurant": { "name": "Dar Zellige", "vat": "8837-22" },
  "lines": [ { "name": "Wagyu Burger", "qty": 2, "modifiers": ["Large"], "lineTotal": 4500 } ],
  "totals": { "…": "PricingBreakdown" },
  "payments": [
    { "method": "STRIPE", "amount": 2000, "tipAmount": 0,   "state": "SUCCEEDED", "at": "…" },
    { "method": "CASH",   "amount": 2592, "tipAmount": 300, "state": "SUCCEEDED", "at": "…" }
  ]
}
```
Built **entirely from stored snapshots** — never recomputed from the live menu or current settings,
so a price change after the order cannot alter a receipt (PRINT-02, AC-19).

### PaymentDto
```json
{
  "id": "uuid", "method": "STRIPE", "amount": 2000, "tipAmount": 0,
  "state": "SUCCEEDED", "actor": null, "createdAt": "…"
}
```
`state`: `PENDING` · `SUCCEEDED` · `FAILED` · `REFUNDED`. `actor` names the cashier for cash.

---

## 10. Auth endpoints

### `POST /auth/register` 🔓
```json
{ "name": "Jane Okafor", "email": "jane@example.com", "password": "correct horse battery" }
```
`201` → `{ "user": UserDto, "accessToken": "eyJ…", "expiresIn": 900 }`
plus `Set-Cookie: rt=…; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth; Max-Age=2592000`
Errors: `400 VALIDATION_ERROR` · `409 EMAIL_TAKEN` · `429 RATE_LIMITED`
Registration always creates a `CUSTOMER`. Staff accounts are provisioned by an admin (AUTH-08).

### `POST /auth/login` 🔓
```json
{ "email": "jane@example.com", "password": "correct horse battery" }
```
`200` → `{ "user": UserDto, "accessToken": "eyJ…", "expiresIn": 900 }` plus the same `Set-Cookie`.
Errors: `401 INVALID_CREDENTIALS` · `429 RATE_LIMITED`

### `POST /auth/refresh` 🍪 cookie
Takes no body. Requires the refresh cookie and the header below, and must be sent with
`credentials: 'include'`.

```http
POST /api/v1/auth/refresh
Cookie: rt=<opaque>
X-Refresh-Request: 1
```

`200` → `{ "accessToken": "eyJ…", "expiresIn": 900 }` plus a **rotated** `Set-Cookie`.

Errors: `401 REFRESH_TOKEN_INVALID` · `401 SESSION_EXPIRED` · `401 SESSION_REVOKED` ·
`401 ACCOUNT_DISABLED` · `429 RATE_LIMITED`

The `X-Refresh-Request` header is a CSRF barrier: a cross-origin form cannot set a custom header
without a preflight the allow-list refuses. `SameSite=Strict` is the primary control; this is the
second.

**`401 SESSION_REVOKED` is not an ordinary expiry.** It means a rotated token was replayed, so the
whole family was revoked. Clear auth and tell the user their session was ended for safety.

### `POST /auth/logout` 🍪 cookie
Revokes that one refresh token and clears the cookie. `204`, and idempotent — an unrecognised or
absent cookie still returns `204`, because logging out should never fail.

### `POST /auth/logout-all` 🔒
Revokes every unexpired session for the authenticated user, on every device. `204`.

### `GET /auth/sessions` 🔒
```json
{
  "data": [
    { "familyId": "uuid", "userAgent": "KDS tablet · Chrome 141",
      "ip": "10.0.4.19", "createdAt": "…", "lastUsedAt": "…", "current": true }
  ]
}
```
Active sessions only (AUTH-13). `current` marks the one making this request.

### `DELETE /auth/sessions/:familyId` 🔒
Revokes one session. `204`. Errors: `404` if the family is not yours.

### `GET /auth/me` 🔒
`200` → `UserDto`. Errors: `401 UNAUTHENTICATED` · `401 ACCOUNT_DISABLED`

---

## 11. Menu endpoints

### `GET /menu` 🔓
`200` → `{ "categories": [ { "id", "name", "description", "sortOrder", "items": MenuItemDto[] } ] }`

Filtered to `isActive` categories and items, within their `availableFrom`/`availableTo` window
(MENU-06). 86'd items are present with `isAvailable: false`. Cached 30 s, invalidated on any write.

### `GET /menu/items/:id` 🔓
`200` → `MenuItemDto` including `modifierGroups`. Errors: `404 MENU_ITEM_NOT_FOUND`

### Admin menu

| Method | Path | Access | Body | Success |
|---|---|---|---|---|
| POST | `/staff/menu/categories` | 🛠 | `{ name, description?, sortOrder? }` | `201` category |
| PATCH | `/staff/menu/categories/:id` | 🛠 | any subset | `200` category |
| DELETE | `/staff/menu/categories/:id` | 🛠 | — | `204` — soft delete |
| POST | `/staff/menu/items` | 🛠 | `{ categoryId, name, price, description?, imageUrl?, allergens?, station?, availableFrom?, availableTo? }` | `201` item |
| PATCH | `/staff/menu/items/:id` | 🛠 | any subset | `200` item |
| DELETE | `/staff/menu/items/:id` | 🛠 | — | `204` — soft delete (BR-11) |
| PATCH | `/staff/menu/items/:id/availability` | 🛎🛠 | `{ "isAvailable": false }` | `200` item |
| POST | `/staff/menu/items/:id/modifier-groups` | 🛠 | `{ modifierGroupId, sortOrder? }` | `201` |
| DELETE | `/staff/menu/items/:id/modifier-groups/:groupId` | 🛠 | — | `204` |
| POST/PATCH/DELETE | `/staff/menu/modifier-groups[/:id]` | 🛠 | `{ name, minSelect, maxSelect }` | as above |
| POST/PATCH/DELETE | `/staff/menu/modifier-groups/:id/items[/:itemId]` | 🛠 | `{ name, priceDelta, isAvailable? }` | as above |

Every write emits `menu:changed` and records an `AuditLog` row. `price` and `priceDelta` are cents;
`priceDelta` may be negative.

---

## 12. Order endpoints

### `POST /orders/preview` 🔓
Authoritative totals without persisting anything. Public, so a guest sees real totals before login.

```json
{
  "type": "DINE_IN",
  "items": [ { "menuItemId": "uuid", "qty": 2, "modifierItemIds": ["uuid"] } ],
  "discountCode": "SAVE10",
  "tipAmount": 500
}
```
`200` → `{ "totals": PricingBreakdown, "lines": [ { "menuItemId", "lineTotal" } ] }`
Errors: `422 EMPTY_CART|INVALID_MODIFIER_SELECTION|DISCOUNT_*` · `409 ITEM_UNAVAILABLE`

The client computes the same figures locally with the shared engine; the two must agree to the cent
(AC-4). Never charge from a client-supplied total (PAY-07).

### `POST /orders` 🔒
```json
{
  "type": "DINE_IN",
  "tableToken": "9f3b2d7c1a9e5b40…",
  "customer": { "name": "Jane Okafor", "phone": "+15550142" },
  "delivery": { "address": "12 Bridge St", "note": "ring twice" },
  "items": [
    { "menuItemId": "uuid", "qty": 2, "modifierItemIds": ["uuid", "uuid"], "notes": "no onions" }
  ],
  "discountCode": "SAVE10",
  "tipAmount": 500,
  "notes": "extra napkins"
}
```

| Field | Required when |
|---|---|
| `tableToken` | `DINE_IN`. The server resolves the table **from this token**; a `tableId` in the body is rejected as an unknown field (AC-12) |
| `customer` | `TAKEAWAY` and `DELIVERY` (DEL-01) |
| `delivery` | `DELIVERY` (DEL-02) |
| `tipAmount` | Never; defaults to `0` |

`201` → `OrderDto`. Honours `Idempotency-Key`.
Errors: `400 VALIDATION_ERROR` · `401` · `409 ITEM_UNAVAILABLE|TABLE_DIRTY` ·
`422 EMPTY_CART|ZERO_TOTAL|INVALID_MODIFIER_SELECTION|DISCOUNT_*|IDEMPOTENCY_KEY_REUSED`

Everything happens in one transaction: prices and availability re-read, modifiers re-resolved,
discount redeemed atomically, totals computed, business date and order number allocated, order and
items and the first `OrderEvent (null → PLACED)` inserted. `order:new` is emitted after commit.

### `GET /orders` 🔒
Query: `status` (repeatable) · `type` · `from` · `to` (business dates) · `tableId` · `page` · `limit`
`200` → `{ data: OrderDto[], meta }`. A `CUSTOMER` sees only their own orders; staff see all.

### `GET /orders/:id` 🔒 👤 / 🛎
`200` → `OrderDto`. Errors: `404 ORDER_NOT_FOUND` (also when it exists but is not yours)

### `GET /orders/:id/events` 🔒 👤 / 🛎
`200` → `{ "data": [ { "fromStatus": null, "toStatus": "PLACED", "actor": null, "reason": null, "at": "…" } ] }`
Append-only, oldest first. `fromStatus` is null on the first event only.

### `GET /orders/:id/receipt` 👤 / 🛎🛠
`200` → `ReceiptDto`

### `POST /orders/:id/items` 👤 own / 🛎🛠
Append to an open order (ORD-12).
```json
{ "items": [ { "menuItemId": "uuid", "qty": 1, "modifierItemIds": [], "notes": null } ] }
```
`200` → `OrderDto`
Errors: `409 ORDER_NOT_AMENDABLE` past `PREPARING` · `409 ITEM_UNAVAILABLE` · `422 INVALID_MODIFIER_SELECTION`

Totals are recomputed using the **rates snapshotted on the order**, not current settings, so a
mid-service tax change cannot reprice the first round. `paymentStatus` is re-derived, so a `PAID`
order becomes `PARTIALLY_PAID` (BR-14, AC-14). Emits `order:status` with `from === to`.

### `PATCH /orders/:id/status` 🛎🛠
```json
{ "to": "READY", "reason": null }
```
`200` → `OrderDto`
Errors: `409 ILLEGAL_TRANSITION` · `409 CONCURRENT_UPDATE`

Only the single forward step is legal, plus `CANCELLED` from any pre-`COMPLETED` state (BR-12).
`CONCURRENT_UPDATE` means another client moved it first — refetch silently.

### `POST /orders/:id/cancel` 👤 own / 🛎🛠
```json
{ "reason": "Changed my mind" }
```
`200` → `OrderDto` with `status: "CANCELLED"`
A customer may cancel only from `PLACED` or `CONFIRMED` (ORD-09, BR-06); staff may cancel any
pre-`COMPLETED` order. A cancelled order that holds a successful payment **remains refundable**
(AC-13). Emits `order:removed`.

---

## 13. Payment endpoints

### `POST /payments/intent` 👤 own / 🛎🛠
```json
{ "orderId": "uuid", "amount": 2000 }
```
`amount` is optional and defaults to `balanceDue`. Supplying less enables split payment (PAY-06).

`200` → `{ "clientSecret": "pi_…_secret_…", "publishableKey": "pk_test_…", "amount": 2000, "currency": "usd" }`
Errors: `404 ORDER_NOT_FOUND` · `422 PAYMENT_EXCEEDS_BALANCE` · `422 ZERO_TOTAL`

Precondition is `paymentStatus != PAID`, not `== UNPAID` — otherwise a second split intent would be
impossible. The amount is always recomputed server-side (PAY-07). Honours `Idempotency-Key`.

### `POST /payments/cash` 🛎🛠
```json
{ "orderId": "uuid", "amount": 2592, "tipAmount": 300 }
```
`amount` defaults to `balanceDue`; `tipAmount` records a cash tip (TIP-02).
`200` → `{ "order": OrderDto, "payment": PaymentDto }`
Errors: `403 FORBIDDEN` for a customer (AC-8) · `422 PAYMENT_EXCEEDS_BALANCE`
The acting user is recorded on the payment (PAY-05).

### `POST /payments/refund` 🛠
```json
{ "orderId": "uuid", "reason": "Dish returned" }
```
`200` → `{ "order": OrderDto, "payment": PaymentDto }`
Errors: `403 FORBIDDEN` · `422 REFUND_NOT_AVAILABLE`

Valid against a `COMPLETED` **or** `CANCELLED` order holding a successful payment. Sets
`paymentStatus = REFUNDED` and **leaves order status unchanged** (BR-07, AC-13). Emits
`payment:changed`.

### `GET /payments/order/:orderId` 🔒 👤 / 🛎🛠
`200` → `{ "data": PaymentDto[], "amountPaid": 2000, "balanceDue": 2592 }`

### `POST /payments/webhook` 🔓 signed
See §18.

---

## 14. Table & reservation endpoints

| Method | Path | Access | Body / Query | Success | Errors |
|---|---|---|---|---|---|
| GET | `/tables` | 🛎🛠 | — | `200` `{data:[{id,number,seats,status,openOrders}]}` | — |
| POST | `/tables` | 🛠 | `{number, seats}` | `201` table | `409 TABLE_NUMBER_TAKEN` |
| PATCH | `/tables/:id` | 🛎🛠 | `{number?, seats?, status?}` | `200` table | `404` |
| POST | `/tables/:id/regenerate-qr` | 🛠 | — | `200` `{qrToken}` | `404` |
| GET | `/tables/qr/:token` | 🔓 | — | `200` `{id, number, seats, status}` | `404 TABLE_NOT_FOUND` |
| POST | `/tables/sessions` | 🔓 | `{token}` | `201` `{table, sessionOpenedAt}` | `409 TABLE_DIRTY` |
| POST | `/tables/:id/close` | 🛎🛠 | — | `200` `{status:"DIRTY"}` | `409 TABLE_HAS_OPEN_ORDERS` |
| POST | `/tables/:id/clean` | 🛎🛠 | — | `200` `{status:"FREE"}` | `404` |
| POST | `/reservations` | 🔒 | `{guestName, guestPhone, partySize, slotAt, tableId?, notes?}` | `201` reservation | `400` |
| GET | `/reservations` | 🛎🛠 | `?date=YYYY-MM-DD` | `200` `{data, meta}` | — |
| PATCH | `/reservations/:id` | 🛎🛠 | `{status, tableId?}` | `200` reservation | `404`, `409 TABLE_DIRTY` |

**`GET /tables/qr/:token` is read-only.** It resolves the token and changes nothing.
**`POST /tables/sessions` is the state change** — it seats a `FREE` table, attaches to a `SEATED`
one, and refuses a `DIRTY` one. Both are rate-limited (§8).

**Close and clean are separate** because TABLE-02 requires the `DIRTY` step: close ends service at
the table, clean returns it to `FREE`.

Setting a reservation to `SEATED` opens a table session, which is why it can return `409 TABLE_DIRTY`.

---

## 15. Discount & settings endpoints

| Method | Path | Access | Body | Success |
|---|---|---|---|---|
| GET | `/staff/discounts` | 🛠 | — | `200` `{data, meta}` |
| POST | `/staff/discounts` | 🛠 | `{code, type, value, minOrder?, startsAt?, endsAt?, usageLimit?}` | `201` |
| PATCH | `/staff/discounts/:id` | 🛠 | any subset | `200` |
| DELETE | `/staff/discounts/:id` | 🛠 | — | `204` soft |
| POST | `/discounts/validate` | 🔒 | `{code, subtotal}` | `200` |
| GET | `/settings` | 🔓 | — | `200` public subset |
| PUT | `/staff/settings` | 🛠 | full set | `200` |

`value` is **basis points** when `type` is `PERCENT` (`1000` = 10%) and **cents** when `FIXED`.

`POST /discounts/validate` → `200 { "valid": true, "discount": { "code": "SAVE10", "type": "PERCENT", "value": 1000 }, "discountAmount": 375 }`
On rejection: `422` with the specific code (`DISCOUNT_EXPIRED`, `DISCOUNT_MIN_NOT_MET`, …).
Validation does **not** reserve a redemption; the count is taken atomically at placement (DISC-06),
so a code valid here can still fail at checkout with `DISCOUNT_LIMIT_REACHED`.

`GET /settings` public subset — exactly what the client needs to reproduce server pricing:
```json
{
  "taxBps": 875, "serviceChargeBps": 1000, "serviceChargeTaxable": false,
  "deliveryFee": 499, "currency": "usd", "tipPresetsBps": [1000, 1500, 2000]
}
```
`PUT /staff/settings` additionally accepts `timezone` (IANA), `kdsGreenSec`, `kdsAmberSec`,
`kdsCompletedGraceSec` and `orderNumberPrefix`.

---

## 16. Report & dashboard endpoints

All 🛠. All take `from` and `to` as **business dates** and bucket on `businessDate` — never on a UTC
timestamp. Cached 60 s per range.

**One revenue definition throughout** (BR-16): net sales are `Σ (subtotal − discountAmount)` over
orders that are neither cancelled nor refunded. Tax, service charge, delivery fees and tips are
reported separately and never folded in. Amounts *collected* come from payment records.

| Path | Response |
|---|---|
| `GET /reports/summary` | `{ orders, netSales, taxCollected, serviceCharge, deliveryFees, tips, aov }` |
| `GET /reports/revenue-by-day` | `{ data: [ { businessDate, netSales, orders } ] }` |
| `GET /reports/top-items` | `{ data: [ { menuItemId, name, qty, revenue } ] }` — grouped by **id**; takes `?limit=10` and `?metric=` of either `qty` or `revenue` |
| `GET /reports/peak-hours` | `{ data: [ { hour, orders } ] }` — hour is **restaurant-local** |
| `GET /reports/breakdowns` | `{ byType: [ { type, netSales } ], byMethod: [ { method, collected, tips } ] }` |
| `GET /reports/cancellations` | `{ cancelled: [ { orderNumber, reason, at } ], refunded: [ … ] }` |
| `GET /dashboard/today` | `{ orders, netSales, activeTickets, tables: { free, seated, dirty }, unavailableItems: [ { id, name } ] }` |

`GET /dashboard/today` is scoped to the current business date.

---

## 17. Realtime contract

Socket.IO on the default namespace, same origin as the API.

### Handshake

```js
const socket = io(API_ORIGIN, { auth: { token } });   // token optional
```

| Token | Result |
|---|---|
| Absent | Connects **anonymously**, joined to `menu` only |
| Present and valid | Joined to `menu` plus the rooms its role permits |
| Present and invalid | `connect_error` — rejected |

Pass the **access token**, not the refresh token. Because it expires every 15 minutes, a long-lived
socket will eventually be disconnected with `connect_error`; the client refreshes and reconnects with
the new token. Treat that as routine, not as an error worth surfacing.

Anonymous connections exist deliberately: a guest browsing without an account must still see 86
broadcasts (BROWSE-01, AC-7).

### Rooms

| Room | Members | Joined |
|---|---|---|
| `menu` | everyone, including anonymous | Automatically |
| `kitchen` | `STAFF`, `ADMIN` | Server-side on connect, after a role check |
| `pos` | `STAFF`, `ADMIN` | Server-side on connect |
| `admin` | `ADMIN` | Server-side on connect |
| `customer:{orderId}` | the owning customer | On `customer:watch`, after an ownership check |

A client cannot self-join a privileged room. The only client-initiated join is `customer:watch`, and
the server verifies ownership first.

### Server → client events

| Event | Rooms | Payload |
|---|---|---|
| `order:new` | kitchen, pos, admin | `OrderDto` (summary form) |
| `order:status` | kitchen, pos, admin, `customer:{id}` | `{ orderId, orderNumber, from, to, at, order? }` |
| `order:removed` | kitchen, pos | `{ orderId, reason }` |
| `payment:changed` | pos, admin, `customer:{id}` | `{ orderId, paymentStatus, amountPaid, balanceDue }` |
| `table:changed` | pos, admin | `{ tableId, number, status }` |
| `menu:changed` | menu | `{ itemId?, categoryId? }` |
| `metrics:update` | admin | dashboard payload, throttled 5 s |
| `reservation:flag` | pos | `{ reservationId, state: "OVERDUE" }` |

On an amendment, `order:status` carries `from === to` with the refreshed order.
`order:removed` fires on cancellation only — a refund no longer changes order status.

### Client → server events

| Event | Payload | Notes |
|---|---|---|
| `customer:watch` | `orderId` | Ownership checked; silently ignored if it fails |

### Delivery guarantees

**At-most-once.** Events are hints, never the source of truth.

1. On `connect`, refetch the visible state over REST.
2. On `order:status`, invalidate the relevant query rather than patching from the payload.
3. After a disconnect longer than 60 s, resync visible lists in full.
4. The KDS polls every 30 s regardless of socket state (HLD §8.4).

Order is preserved per room per connection. Events are emitted only after the database transaction
commits, so a client never sees a rolled-back write.

---

## 18. Stripe webhook contract

### `POST /payments/webhook` 🔓 signed

| | |
|---|---|
| Body | **Raw bytes.** Mounted with `express.raw` before the JSON parser — the signature is computed over unparsed input |
| Header | `Stripe-Signature` |
| Handled events | `payment_intent.succeeded`, `payment_intent.payment_failed` |

| Outcome | Status | Notes |
|---|---|---|
| Signature invalid | `400 WEBHOOK_INVALID_SIGNATURE` | Stripe retries |
| Accepted and processed | `200` | Returned quickly; heavy work does not block the response |
| Duplicate event | `200` | Deduplicated and ignored — **no second payment row** (PAY-08, AC-6) |
| Unhandled event type | `200` | Acknowledged, ignored |

**Deduplication** is a primary-key insert into `WebhookEvent` keyed on the Stripe event id, inside
the same transaction as the payment update. Either the insert succeeds and the event is processed
once, or it fails and the handler returns early. There is no read-then-write race, and no second
mechanism anywhere else in the system.

**On success:** the matching `Payment` row moves to `SUCCEEDED`, `syncPaymentStatus` re-derives
`Order.paymentStatus`, and `payment:changed` is emitted. This is what makes AC-5 hold — the order
becomes `PAID` even if the browser closed immediately after redirect.

**On failure:** the `Payment` row moves to `FAILED` and the order stays `UNPAID` so the customer can
retry. There is no order-level `FAILED` payment status.

---

## 19. Versioning policy

The version lives in the path (`/api/v1`). Within a major version:

**Non-breaking, ships any time** — adding an endpoint; adding an optional request field; adding a
response field; adding a new error `code` to an existing status; adding a socket event.

**Breaking, requires `/api/v2`** — removing or renaming a field; changing a field's type or units;
making an optional field required; changing a success status code; removing an error code a client
switches on; changing an existing socket event's payload shape.

Clients must tolerate unknown response fields and unknown socket events. Servers must not: request
schemas are `.strict()`, and an unknown field is a rejected request, because silently ignoring a
misspelled field is how a tip or a discount goes missing without anyone noticing.

---

## 20. Revision history

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.1 | 2026-09-25 | Dev Team | Replaced the single 24 h bearer token with the access/refresh model (§2): 15-minute access tokens held in memory, a 30-day `httpOnly` refresh cookie with rotation and reuse detection, new `/auth/refresh`, `/auth/logout`, `/auth/logout-all` and `/auth/sessions` endpoints (§10), three session error codes (§5), a refresh rate limit (§8), CORS credentials, and the socket-token note (§17). **Breaking for clients**: `login` and `register` now return `accessToken` rather than `token`, and requests must be sent with `credentials: 'include'`. |
| 1.0 | 2026-09-25 | Dev Team | Initial wire contract for API v1, derived from LLD v1.1 §5, §6 and §8. |
