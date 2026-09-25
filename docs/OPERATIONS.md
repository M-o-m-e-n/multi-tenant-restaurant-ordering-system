# Operations
## Restaurant Ordering System (ROS)

| | |
|---|---|
| **Document ID** | ROS-OPS-001 |
| **Version** | 1.0 |
| **Date** | 2026-09-25 |
| **Covers** | M13-S9…S12: scaling, backups, deployment, Stripe webhooks |

## 1. Backups (NFR-A3, HLD §11.5)

| What | How |
|---|---|
| Backup | `scripts/backup.sh`: `pg_dump --format=custom` named by UTC timestamp. When `BACKUP_BUCKET` is set, it is copied to object storage with the AWS CLI |
| Schedule | Nightly, e.g. `15 3 * * * /app/scripts/backup.sh` (03:15 UTC, after close) |
| Retention | 30 days: `find -mtime +30 -delete` locally, plus a 30-day lifecycle rule on the bucket |
| Restore | `scripts/restore.sh <file.dump>` into an **empty** database named by `RESTORE_URL`. It prints row counts to check, then you switch `DATABASE_URL`. Never restore over the live database |

### Restore drill — run 2026-09-25

The drill ran against the local Docker Postgres 15.8 with the seeded demo history:

1. `backup.sh` against `ros` wrote `ros-20260925T074417Z.dump` (378 KB).
2. `restore.sh` restored it into a fresh `ros_restore_drill` database with `--exit-on-error`.
3. The counts matched the live database exactly:

| Table | Live | Restored |
|---|---|---|
| `Order` | 781 | 781 |
| `Payment` | 759 | 759 |
| `User` | 3 | 3 |
| `_prisma_migrations` | — | 4 |

4. The drill database was dropped afterwards.

The object-storage upload was not exercised: no bucket or credentials exist in the build
environment. Test the upload the first time the job runs on the real host.

## 2. Scaling past one instance (M13-S9, ADR-018)

The build runs as **one instance**, and M13-S9 is skipped as the milestone allows. Three things are
per-process today and would need Redis before adding a second instance:

| Per-process state | Redis replacement |
|---|---|
| Socket.IO rooms | `@socket.io/redis-adapter` so `events.publish` reaches sockets on every instance |
| Rate-limit counters | `rate-limit-redis` store for `express-rate-limit` |
| Menu and report caches, and the `reservationAlerts` "already flagged" set | Invalidate over Redis pub/sub, or keep the caches (TTL-bounded) and move the flag set to a Redis `SET` with expiry |

The interval jobs (reconcile, purges, reservation alerts) would also need to run on one instance
only, for example behind a Postgres advisory lock.

## 3. Deployment checklist (M13-S11)

No staging host exists in the build environment, so this has not been deployed. When it is:

- **Build:** `npm ci && npm run build`. That gives `server/dist/server.js` (tsup) and `client/dist` (static).
- **Release step:** `npm run db:deploy -w server` (`prisma migrate deploy`) before the new
  version takes traffic.
- **TLS:** terminate TLS at the proxy or platform. The API already sends HSTS (1 year,
  includeSubDomains). Serve the client over HTTPS too, and proxy `/api` and `/socket.io` with
  WebSocket upgrade.
- **Environment:** every variable in `server/.env.example`:
  - `NODE_ENV=production`
  - `CLIENT_ORIGINS` set to the real origin
  - a new 32+ character `JWT_ACCESS_SECRET`
  - `BCRYPT_ROUNDS` of 12 or more
  - `PUBLIC_APP_URL` set to the HTTPS client URL, since QR codes encode it
  - Stripe **test** keys only; live keys are refused at boot
- **`trust proxy`:** the app trusts only loopback. Behind a platform proxy, set it to that proxy's
  hop count or rate limits will see the proxy's IP.
- **Health:** `GET /health` for the platform check.

## 4. Stripe webhook end to end (M13-S12)

Also pending a public URL. Steps:

1. In the Stripe dashboard (test mode), add an endpoint `https://<host>/api/v1/payments/webhook`
   for `payment_intent.succeeded` and `payment_intent.payment_failed`, then copy its signing
   secret into `STRIPE_WEBHOOK_SECRET`.
2. Pay a test order with card `4242 4242 4242 4242`. The order turns PAID, and `WebhookEvent`
   holds one row for the event.
3. Resend the same event from the dashboard. The response is 200 and nothing new is written
   (dedupe).
4. Locally, the same round trip works with
   `stripe listen --forward-to localhost:4000/api/v1/payments/webhook`.

Signature checking and dedupe are already covered offline by `payments.test.ts`. It signs events
with the real Stripe HMAC scheme, so the code path is the one production uses.
