# Coding Standards
## Restaurant Ordering System (ROS)

| | |
|---|---|
| **Document ID** | ROS-STD-001 |
| **Version** | 1.2 |
| **Status** | Draft |
| **Date** | 2026-09-25 |
| **Applies to** | `shared/`, `server/`, `client/` |
| **Enforcement** | ESLint + `tsc --strict` in CI where possible; review where not. A rule a tool can check is a rule that should be checked by a tool. |

---

## Table of Contents
1. [Precedence](#1-precedence)
2. [TypeScript](#2-typescript)
3. [Naming](#3-naming)
4. [Project structure](#4-project-structure)
5. [Dependency direction](#5-dependency-direction)
6. [Money and numbers](#6-money-and-numbers)
7. [Dates, times and the business date](#7-dates-times-and-the-business-date)
8. [Validation](#8-validation)
9. [Errors](#9-errors)
10. [Async and transactions](#10-async-and-transactions)
11. [Data access](#11-data-access)
12. [Authorisation](#12-authorisation)
13. [Realtime](#13-realtime)
14. [React and client code](#14-react-and-client-code)
15. [Styling](#15-styling)
16. [Testing](#16-testing)
17. [Comments](#17-comments)
18. [Git](#18-git)
19. [Forbidden — quick reference](#19-forbidden--quick-reference)
20. [Revision history](#20-revision-history)

---

## 1. Precedence

When guidance conflicts, the earlier source wins:

1. The user's explicit instruction in a ticket
2. `docs/SRS.md`, `docs/HLD.md`, `docs/LLD.md` (the contract)
3. This document
4. Existing code in the module you are editing
5. Personal preference

**Match the file you are editing.** A consistent codebase that disagrees with one rule here is
healthier than a file that follows every rule and looks unlike its neighbours. If a rule here is
wrong, change the rule rather than working around it in silence.

---

## 2. TypeScript

**Strict everywhere.** `strict: true` in `tsconfig.base.json`, extended by all three workspaces. No
per-file relaxation.

**No `any` in domain code** (NFR-M1). If a type genuinely cannot be known, use `unknown` and narrow
it. `any` is permitted only in a test fixture, and even there prefer a typed factory.

```ts
// No
function apply(discount: any, subtotal: any) { … }

// Yes
function apply(discount: Discount, subtotal: number): number { … }
```

**Prefer `type` for data shapes, `interface` for extensible contracts.** Both are fine; do not mix
them for the same concept in one file.

**Never use enums; use string-literal unions or the shared const objects.** TypeScript `enum`
generates runtime code, does not narrow well across package boundaries, and duplicates the Prisma
enums we already have.

```ts
// No
enum OrderType { DINE_IN, TAKEAWAY }

// Yes
export const ORDER_TYPES = ['DINE_IN', 'TAKEAWAY', 'DELIVERY'] as const;
export type OrderType = (typeof ORDER_TYPES)[number];
```

**Derive types from Zod schemas rather than declaring them twice.**

```ts
export const createOrderSchema = z.object({ … }).strict();
export type CreateOrderDto = z.infer<typeof createOrderSchema>;
```

**Return types are explicit on exported functions.** Inference is fine inside a function body; at a
module boundary an explicit return type is documentation and stops an accidental widening from
escaping.

**No non-null assertions (`!`) in domain or service code.** If a value can be absent, handle it. In
tests, `!` is acceptable for fixture access.

**Exhaustive switches.** Use a `never` guard so adding a status makes the compiler find every site.

```ts
function label(s: OrderStatus): string {
  switch (s) {
    case 'PLACED':    return 'Placed';
    …
    default: {
      const exhaustive: never = s;
      throw new Error(`Unhandled status: ${exhaustive}`);
    }
  }
}
```

---

## 3. Naming

| Thing | Convention | Example |
|---|---|---|
| Directory | kebab-case | `modules/order-items/` |
| Server module file | `<module>.<layer>.ts` | `orders.service.ts`, `orders.repo.ts` |
| React component file | PascalCase, matching the export | `TicketCard.tsx` |
| Hook file | camelCase with `use` prefix | `useOrderTracker.ts` |
| Test file | mirrors its subject | `pricing.test.ts` |
| Variable, function | camelCase | `computeTotals`, `paidSum` |
| Type, interface, component | PascalCase | `OrderDto`, `TicketCard` |
| Constant object / literal union source | SCREAMING_SNAKE | `ORDER_TRANSITIONS` |
| Enum **value** | SCREAMING_SNAKE | `PARTIALLY_PAID` |
| DB model | PascalCase singular | `OrderItem` |
| DB column | camelCase | `businessDate` |
| API path segment | kebab-case plural | `/orders/:id/items`, `/reports/revenue-by-day` |
| Socket event | `domain:action`, lower-case | `order:status`, `payment:changed` |
| Error code | SCREAMING_SNAKE | `ORDER_NOT_AMENDABLE` |
| Setting key | camelCase | `serviceChargeBps` |
| Audit action | SCREAMING_SNAKE, `ENTITY_VERB` | `ORDER_ITEMS_APPENDED` |

**Name by what it is to the user, not how it is built.** `unavailableItems`, not `lowStock86` —
the second names inventory tracking that SRS §1.2 puts out of scope.

**Booleans read as assertions:** `isActive`, `isAvailable`, `isAmendable`, `hasOpenOrders`. Not
`active`, not `amendFlag`.

**Suffix money variables with their unit when ambiguity is possible:** `amountCents`, `taxBps`.
Inside the pricing engine, where everything is cents by construction, plain names are fine.

---

## 4. Project structure

```
shared/src/
  domain/        pricing.ts · order-status.ts · enums.ts     (pure, no IO)
  schemas/       zod DTOs imported by both client and server
  index.ts       the only public surface

server/src/
  app.ts         express factory — no listen(), so tests can import it
  server.ts      bootstrap: env → db → http → sockets → jobs
  config/        env parsing (zod), constants
  middleware/    authenticate · requireRole · validate · rateLimit · errors
  modules/<name>/
    <name>.routes.ts    HTTP: path, role, schema. No business logic.
    <name>.service.ts   use-cases, transactions, authorisation, domain calls
    <name>.repo.ts      Prisma only. Returns models, never DTOs.
    <name>.dto.ts       toDto() mappers
    index.ts            the module's public surface
  realtime/      socket server, rooms, publish façade
  jobs/          interval jobs
  lib/           prisma client, logger, errors, stripe

client/src/
  shared/        api client, socket client, ui kit
  features/<name>/   hooks, stores, components for one domain
  pages/<surface>/   customer · kitchen · pos · admin
```

**The layer triad is not optional.** A route that touches Prisma directly, or a service that
formats an HTTP response, is a review rejection.

| Layer | May do | May not do |
|---|---|---|
| `*.routes.ts` | Declare path, role, Zod schema; call one service method; send the result | Contain conditionals about business state, touch Prisma |
| `*.service.ts` | Orchestrate, open transactions, authorise, call domain functions, emit events | Know about `req`/`res`, build SQL |
| `*.repo.ts` | Prisma queries and nothing else | Throw `AppError`, call other services |

**Adding a feature means adding a module folder**, not extending an existing one sideways.

---

## 5. Dependency direction

Dependencies point inward. `shared/` imports nothing from `server/` or `client/`, ever.

```
routes  →  service  →  domain (shared)
              ↓
            repo  →  Prisma
```

- `shared/` has exactly one runtime dependency: `zod`. Adding a second requires a decision recorded
  in the HLD, because the client bundles this package.
- Server modules import each other **only** through `index.ts`. No reaching into
  `../orders/orders.repo`.
- Circular imports are a build error, not a warning. If two modules need each other, the shared part
  belongs in `shared/domain` or a third module.

---

## 6. Money and numbers

The rules that protect NFR-R2, and the single most common source of subtle bugs in this codebase.

**All money is integer minor units (cents).** Never a float, never a decimal string in arithmetic,
never a `Number` holding dollars.

**Why integers and not a decimal type.** Integer cents is this codebase's BigDecimal: a fixed-point
decimal with scale 2 (`1234` is $12.34). JavaScript has no BigDecimal, and Stripe takes integer
cents. Columns are Postgres `integer` / Prisma `Int` (ADR-004). Don't add decimal.js,
`Prisma.Decimal` or `NUMERIC` columns.

**The decimal point exists only on screen.** Format with the single client money utility
(`formatMoney(1234)` → `"$12.34"`, built on `Intl.NumberFormat`). Never divide by 100 inside
arithmetic, and never parse a formatted string back into money. User-entered amounts (custom tip,
cash tendered) go through one `parseMoneyInput` that returns cents.

**All rates are integer basis points.** `taxBps = 875` means 8.75%. Rates never appear as `0.0875`.

**Every rate multiplication goes through `bps()`.** Not `Math.round`, not inline arithmetic.

```ts
// No — Math.round is half-toward-+∞, so it is wrong for negative amounts
const tax = Math.round(amount * 0.0875);

// Yes
import { bps } from '@ros/shared';
const tax = bps(amount, settings.taxBps);
```

`Math.round(-0.5)` is `-0`, not `-1`. `ModifierItem.priceDelta` is allowed to be negative, so a line
total can be negative during intermediate arithmetic. Asymmetric rounding there puts the client
preview and the server charge a cent apart, which is exactly what AC-4 forbids.

**Never compute totals outside `computeTotals()`.** Not in a route, not in a React component, not
in a report. One function, called from both sides, is the only thing that makes client/server parity
provable.

**Format money in exactly one client utility.** No `toFixed(2)` scattered through components.

**Use `font-variant-numeric: tabular-nums` wherever digits align in a column** — prices in a list,
totals in a receipt, figures in a report table.

---

## 7. Dates, times and the business date

**Store UTC. Display local. Bucket by business date.** These are three different concerns and
conflating them is how reports end up wrong by one day.

| Use | Type | Rule |
|---|---|---|
| An instant something happened | `timestamptz` | Always UTC in the database |
| The operating day it belongs to | `date` (`Order.businessDate`) | Computed once at placement from the `timezone` setting, then **never recomputed** |
| Display | — | Formatted in the viewer's local timezone, in one client utility |

**Never bucket a report on a timestamp.** `date_trunc('day', "placedAt")` buckets by UTC and splits
a late dinner service across two days. Group on `businessDate`; convert with `AT TIME ZONE` when you
genuinely need an hour-of-day (RPT-04).

**`businessDate` is immutable.** If the restaurant later changes timezone, historical orders keep
the business date they were filed under. Recomputing would silently rewrite past reports.

---

## 8. Validation

**Every route boundary parses its input with a Zod schema from `shared/schemas`.** Params, query and
body — not just body.

**Schemas are `.strict()`.** Unknown keys are rejected, not stripped (NFR-S5). A tampered payload
should fail loudly.

**Validation is not authorisation and not a business rule.** Zod answers "is this well-formed?".
Whether this user may do it is §12; whether the system permits it now (`ORDER_NOT_AMENDABLE`,
`ITEM_UNAVAILABLE`) is the service's job and returns 409/422, never 400.

**Re-resolve anything the client sends by reference.** A client sends ids; the server looks up the
truth.

```ts
// No — trusts the client's idea of what a modifier costs
const delta = body.modifierPriceDelta;

// Yes — resolveSelections asserts the modifier belongs to this item,
// is available, satisfies minSelect/maxSelect, and returns the real delta
const { deltas } = await resolveSelections(item.id, body.modifierItemIds);
```

The same rule covers `tableId` (resolve from the QR token, never from the body — AC-12) and every
price (re-read from the database — PAY-07).

---

## 9. Errors

**One typed hierarchy, one mapping middleware.** Throw a typed error from anywhere; exactly one
place turns it into HTTP.

```ts
abstract class AppError extends Error { abstract code: string; abstract status: number; details?: unknown }
class ValidationError    extends AppError { status = 400 }
class AuthError          extends AppError { status = 401 }
class ForbiddenError     extends AppError { status = 403 }
class NotFoundError      extends AppError { status = 404 }
class ConflictError      extends AppError { status = 409 }
class BusinessRuleError  extends AppError { status = 422 }
class RateLimitError     extends AppError { status = 429 }
```

**Every error carries a specific code.** `DISCOUNT_EXPIRED`, not a generic `BAD_REQUEST` with prose
in the message. The client switches on the code; the message is for humans and may change.

**Never leak internals.** Stack traces, SQL, and Prisma error text never reach a client. Log them
with the request id; return `500 INTERNAL_ERROR` and that id.

**Error messages say what went wrong and what to do**, without apology.

```
// No
"An error occurred processing your request."
// No
"Sorry! Something went wrong :("
// Yes
"This code expired on 3 March. Try another, or continue without one."
```

**Do not catch what you cannot handle.** A `try/catch` that logs and rethrows unchanged is noise;
let it propagate to the mapper.

---

## 10. Async and transactions

**`async`/`await` only.** No `.then()` chains, no callbacks.

**Anything that writes more than one row is one transaction.** Order placement, status transition,
amendment, payment recording. A crash between two related writes is how the audit trail stops
matching the status (NFR-R3).

```ts
await prisma.$transaction(async (tx) => {
  const order = await tx.order.update({ … });
  await tx.orderEvent.create({ … });
  return order;
});
// emit only after the transaction resolves
events.publish('order:status', payload, { rooms: [...] });
```

**Emit events after commit, never inside the transaction** (HLD §8.2). Clients must never see an
event for a write that rolled back.

**Concurrency is handled by conditional updates, not by reading first.**

```ts
// No — two requests can both pass this check
const order = await tx.order.findUnique({ where: { id } });
if (order.status !== from) throw new ConflictError();
await tx.order.update({ where: { id }, data: { status: to } });

// Yes — the database arbitrates
const { count } = await tx.order.updateMany({ where: { id, status: from }, data: { status: to } });
if (count === 0) throw new ConflictError('CONCURRENT_UPDATE');
```

The same shape covers discount redemption (`WHERE usedCount < usageLimit`) and webhook dedupe
(insert on a primary key and let the duplicate fail).

**No floating promises.** `await` it, or explicitly `void` it with a comment saying why.

---

## 11. Data access

**Prisma only. No raw string-concatenated SQL** (NFR-S6). Where raw SQL is genuinely needed — the
report aggregates — use `$queryRaw` with parameter binding, never template interpolation of values.

**Quote identifiers in raw SQL.** Prisma's default mapping gives Postgres mixed-case names, so
`FROM "Order" WHERE "businessDate" = $1`. Unquoted `from orders` does not resolve.

**Prisma models never cross the API boundary.** Map through an explicit `toDto()`. This is what
stops `passwordHash` reaching a response by accident.

```ts
// modules/users/users.dto.ts
export const toUserDto = (u: User): UserDto => ({
  id: u.id, name: u.name, email: u.email, role: u.role,
});
```

**Select what you need.** `include` everything only when you need everything; watch for N+1 when
assembling the menu or an order.

**Never write a derived column by hand.** `Order.status` is written only by `transitionStatus`;
`Order.paymentStatus` only by `syncPaymentStatus`; `Discount.usedCount` only by the conditional
update in placement. See ERD §9.

---

## 12. Authorisation

**Two independent checks, both required** (NFR-S4, defence in depth):

1. **Route level** — `requireRole('ADMIN')` declared as route metadata, before the handler.
2. **Service level** — ownership re-checked against the resource itself.

Route-level role checks alone do not stop a customer reading another customer's order, because both
are customers.

```ts
// routes
router.get('/orders/:id', authenticate, validate(idParam), h(getOrder));

// service
const order = await repo.findById(id);
if (!order) throw new NotFoundError('ORDER_NOT_FOUND');
if (actor.role === 'CUSTOMER' && order.userId !== actor.id) {
  throw new NotFoundError('ORDER_NOT_FOUND');   // 404, not 403 — do not confirm it exists
}
```

**Return 404, not 403, for resources the caller may not know exist.** A 403 confirms the id is real.

**Never trust the role in the JWT alone.** `authenticate` re-reads `isActive` and `role` from the
database (briefly cached) so disabling an account takes effect on the next request rather than at
token expiry (ADM-02, AC-18).

**Transitions authorise on the edge, not the status.** Use `canTransition(from, to, role)`; do not
hand-roll a role check per endpoint.

### Tokens

**The access token lives in memory. Nowhere else.** Not `localStorage`, not `sessionStorage`, not a
non-`httpOnly` cookie. A page refresh loses it and the client silently calls `/auth/refresh` — that
is the design, not a bug to work around (AUTH-12).

```ts
// No — survives a reload, and so does an XSS payload's access to it
useAuthStore.persist({ accessToken });

// Yes — memory only; rehydrate by refreshing
let accessToken: string | null = null;
```

**Never read, write or log the refresh token in application code.** It arrives and leaves as an
`httpOnly` cookie; server code touches only its SHA-256 hash. If you find yourself typing
`req.cookies.rt` outside the auth service, stop.

**One refresh in flight at a time.** Concurrent 401s must queue behind a single refresh call and
replay afterwards. Firing several rotates the token several times, and every rotation but the last
looks like a replay — which trips reuse detection and logs the user out.

```ts
let refreshing: Promise<string> | null = null;
const refresh = () => (refreshing ??= doRefresh().finally(() => { refreshing = null; }));
```

**A 401 triggers exactly one retry.** Refresh, replay the original request once, and if that also
401s, clear auth and go to login. No loops.

---

## 13. Realtime

**Events are hints. REST is the source of truth.** A client that cannot recover its state by
refetching is broken, because delivery is at-most-once (HLD §8.4).

**Publish through the façade**, never `io.emit` from a service.

```ts
events.publish('order:status', payload, { rooms: ['kitchen', 'pos', `customer:${orderId}`] });
```

**Rooms are joined server-side after a role check.** A client may request `customer:watch`; the
server verifies ownership before joining. No client self-joins a privileged room.

**Socket auth is optional by design.** No token connects anonymously into the `menu` room only; an
invalid token is rejected. Guests must receive 86 broadcasts (BROWSE-01, AC-7).

**Event names are `domain:action` and match LLD §6.2 exactly.** `order:status`, not `order:updated`.

---

## 14. React and client code

**Server state belongs to TanStack Query. Client state belongs to Zustand.** Do not duplicate server
data into a store.

| State | Owner |
|---|---|
| Menu, orders, reports | TanStack Query |
| Cart, auth token, tip selection | Zustand with `persist` |
| Table session token | URL param + `sessionStorage` |
| Live updates | Socket event → `invalidateQueries` |

**Query keys are arrays, tuple-shaped, narrowest last:** `['orders', filters]`, `['order', id]`.

**Components are function components with typed props.** No `React.FC` (it complicates generics and
implies `children` that may not exist).

**One component, one job.** A component that both fetches and renders a complex tree should split
into a container hook plus a presentational component.

**Business logic does not live in components.** Pricing, transition legality and formatting come
from `shared/` or a hook — never inline in JSX.

```tsx
// No
<span>${(item.unitPrice * item.qty / 100).toFixed(2)}</span>

// Yes
<span>{formatMoney(lineTotal(item))}</span>
```

**Render legal actions from the domain**, so the UI cannot offer an illegal move:

```tsx
{nextStatuses(order.status, user.role).map(s => <BumpButton key={s} to={s} />)}
```

**Every interactive element is reachable and labelled.** Keyboard focus is visible, targets are at
least 44 × 44 px on touch surfaces (NFR-U2), and state is never conveyed by colour alone — the KDS
aging bands carry a text label beside the colour (NFR-U3, WCAG 1.4.1).

**Respect `prefers-reduced-motion`** for any animation.

---

## 15. Styling

**Tailwind with theme tokens from the chosen design direction.** No arbitrary hex values in
components; if a colour is missing from the theme, add it to the theme.

```tsx
// No
<div className="bg-[#1f3d2f] text-[#faf6f0]">
// Yes
<div className="bg-surface-inverse text-on-inverse">
```

**Spacing comes from layout, not per-element margins.** Use flex/grid with `gap`; margins collapse
and double without warning.

**Wide content scrolls in its own container.** Tables, code and diagrams get `overflow-x: auto` so
the page body never scrolls sideways.

**Four surfaces, one system.** Customer, KDS, POS and Admin share tokens and primitives. A KDS-only
button style is a smell — extend the shared primitive with a variant.

---

## 16. Testing

**Test at the level the risk lives.**

| Level | Subject | Tool | Rule |
|---|---|---|---|
| Unit | pricing, state machine, discounts | Vitest | **No IO at all** — no DB, no network, no mocks of either (NFR-M3) |
| Integration | services + repos | Vitest + dockerised Postgres | Real database, real transactions |
| API | route contracts: auth, validation, error codes | Supertest | Import `app.ts`; do not boot a server |
| E2E | the six smoke journeys | Playwright | Against a seeded environment |

**Name tests by behaviour, not by function.**

```ts
// No
it('computeTotals works', …)
// Yes
it('excludes the tip from the tax base', …)
```

**Assert on values, not on snapshots,** for anything numeric. A snapshot of a wrong total passes
forever.

**Every bug fix starts with a failing test** that reproduces it.

**Do not test the framework.** No tests that Express routes, that Prisma saves, or that Zod
rejects a wrong type.

**Report tests assert against the seed's emitted fixture**, not against a second hand-written query.
Comparing report SQL to report SQL passes even when both are wrong (AC-9).

---

## 17. Comments

**Comment why, not what.** The code says what.

```ts
// No
// increment the counter
counter++;

// Yes
// Conditional so two concurrent checkouts cannot both take the last redemption;
// zero rows affected means we lost the race (DISC-06).
```

**Cite the rule.** When code exists because of a requirement, name it: `(BR-13)`, `(AC-17)`,
`(LLD §3.2)`. A future reader can then find out whether the rule still holds.

**Delete commented-out code.** Git remembers it.

**JSDoc on every exported domain function** — what it returns, what it throws, and the units.

```ts
/**
 * Multiply an amount by a rate in basis points, rounding half away from zero.
 * Symmetric rounding matters: priceDelta may be negative, and Math.round is
 * half-toward-+∞, which would put client preview and server charge a cent apart (AC-4).
 * @param amountCents integer minor units
 * @param rateBps integer basis points (875 = 8.75%)
 */
```

**`TODO` carries a name and a ticket** or it does not go in. `// TODO: fix this` is banned.

---

## 18. Git

**Branches:** `feat/<milestone>-<slug>`, `fix/<slug>`, `chore/<slug>`. Example:
`feat/m7-s3-create-order-transaction`.

**One slice per branch**, matching `docs/MILESTONES.md`. If a branch touches two slices, it is two
branches.

**Conventional commits**, imperative mood, lower case, no trailing period:

```
feat(orders): allocate business date and order number in the placement transaction

Draws the daily counter from OrderSequence inside the same transaction as the
insert, so two concurrent placements cannot collide. Uniqueness is
(businessDate, orderNumber) because the counter recycles daily.

Closes M7-S2. Refs ORD-10, BR-15.
```

Types: `feat` · `fix` · `refactor` · `test` · `docs` · `chore` · `perf`.
Scopes: the module name (`orders`, `payments`, `menu`, `kds`, `shared`).

**Never commit:** `.env`, credentials, `node_modules`, build output, commented-out code, a failing
test marked `.skip` without a linked ticket.

**A pull request states** what changed, which slice it closes, how it was verified, and anything the
reviewer should look at hardest. Green CI is a precondition for review, not a substitute for it.

---

## 19. Forbidden — quick reference

| Never | Because | Instead |
|---|---|---|
| `any` in domain code | Defeats the point of the type system | `unknown` + narrowing |
| Floats in money arithmetic | NFR-R2; rounding drift | Integer cents, integer bps, `bps()` |
| `Math.round` for rates | Half-toward-+∞ breaks negative deltas | `bps()` |
| Totals computed outside `computeTotals` | Client and server drift apart | Call the shared function |
| Writing `Order.status` directly | Breaks the audit trail (NFR-R3) | `transitionStatus` |
| Writing `Order.paymentStatus` directly | Split payments desynchronise | `syncPaymentStatus` |
| Trusting a client-sent price, `tableId`, or modifier | PAY-07, AC-12, AC-17 | Re-resolve server-side |
| Trusting the JWT role alone | Disable/demote waits for expiry | Re-read `isActive` and role |
| Access token in `localStorage` | XSS reads it; survives reload | Memory only, refresh on reload |
| Touching the refresh cookie outside the auth service | It is `httpOnly` for a reason | Let the browser carry it |
| Parallel refresh calls | Extra rotations look like replay and kill the session | One in-flight refresh, queued retries |
| `date_trunc` on `placedAt` for reports | Buckets by UTC | Group on `businessDate` |
| A `GET` that changes state | Prefetchers and crawlers fire it | `POST` |
| Emitting inside a transaction | Clients see rolled-back writes | Emit after commit |
| Read-then-write for concurrency | Lost updates | Conditional `updateMany` |
| Raw SQL with interpolated values | Injection | Parameter binding |
| Prisma models in responses | Field leaks (`passwordHash`) | `toDto()` |
| Colour as the only state signal | WCAG 1.4.1, NFR-U3 | Colour **and** text or icon |
| `nextStatuses[0]` for the bump | Array order is not meaning | `FORWARD_TRANSITION` |

---

## 20. Revision history

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.2 | 2026-09-25 | Dev Team | §6: recorded why money is integer cents rather than a decimal type (ADR-004); display-only formatting and single input-parsing rule. |
| 1.1 | 2026-09-25 | Dev Team | Added the token-handling rules for the access/refresh model introduced in LLD v1.2 §4.2. |
| 1.0 | 2026-09-25 | Dev Team | Initial standard, derived from SRS/HLD/LLD v1.1 and the v1.1 design review findings. |
