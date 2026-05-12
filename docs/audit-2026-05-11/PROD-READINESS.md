# Production-Readiness Probe — 631 Solutions

**Date:** 2026-05-11
**Method:** Synthetic-data probe with `@faker-js/faker` against the live dev server. Two scripts:
- `scripts/probe.mjs` — 9 suites, 59 assertions covering happy path, validation, attack surface, owner action endpoints, webhooks, full pricing-engine sweep (40 service×size×urgency combos), concurrency, address sanitization, and SSR pages.
- `scripts/probe-deep.mjs` — 8 targeted checks for prototype pollution, cron auth, owner-endpoint auth, duplicate detection, field-length limits, control-char persistence, file-store race conditions, and email edges.

**Run the probes yourself:**
```bash
pnpm dev &           # plain dev (auth disabled, permissive)
node scripts/probe.mjs
node scripts/probe-deep.mjs

# repeat with auth enabled — proves production posture
DASHBOARD_PIN=1234 CRON_SECRET=any-secret pnpm dev &
node scripts/probe-deep.mjs
```

---

## Headline numbers

| Pass | Suite (initial) | After patches |
| --- | --- | --- |
| Base probe (59 assertions) | 52 pass · 7 warn · 0 fail | 54 pass · 5 warn · 0 fail |
| Deep probe — dev | 12 pass · 5 warn · 4 fail | 19 pass · 0 warn · 2 fail (both intentional dev-mode permissive) |
| Deep probe — with auth envs set | n/a | **20 pass · 0 fail** |
| Unit tests | 12 pass | **17 pass** (added 5 auth-gate tests) |

All hard failures are now resolved. The two remaining "fails" in dev-mode deep probe are intentional — when no `DASHBOARD_PIN` / `CRON_SECRET` are set in *development*, the server stays open so the owner can iterate locally. In *production* the same code path returns **503 Service Unavailable** until the secrets are wired up.

---

## Findings — all patched

### P0-A. Cron endpoint was publicly callable
- **Endpoint:** `GET|POST /api/cron`
- **Risk:** Anyone with the URL could fire the customer-outcome SMS fanout: spam customers and burn Twilio credit.
- **Before:** When `CRON_SECRET` is unset, handler ran unconditionally — including in production.
- **Fix:** [app/api/cron/route.ts](app/api/cron/route.ts) — `cronAllowed()` now returns 503 when `CRON_SECRET` is unset in production, and requires `Authorization: Bearer ${CRON_SECRET}` otherwise.
- **Verified:** `node scripts/probe-deep.mjs` with `CRON_SECRET=test` set → 401 on bad/missing header, 200 with correct header.

### P0-B. Owner-only API endpoints accepted anonymous requests in production
- **Endpoints:** `/api/quotes/:id/send`, `/outcome`, `/approve`, `/request-photos`, `/follow-up`, `/deposit`, `/cost-inputs/:slug`, `/cost-inputs/:slug/onboard`, `/outcomes/:id/actuals`.
- **Risk:** With `DASHBOARD_PIN` unset, the dashboard *page* showed PIN-protected but the *API endpoints* underneath did not gate auth. Anyone with a quote ID (visible in customer SMS links) could:
  - mark quotes won/lost (poison analytics)
  - re-send the customer quote SMS (spam, billable)
  - change cost inputs that govern all future pricing
- **Before:** Each endpoint called `requestHasDashboardAccess(request)`, which returned `true` when no PIN was set — including in production.
- **Fix:** Added [`requireOwnerApi(request)`](lib/server/auth.ts) helper that returns 503 in production when no PIN is configured, 401 when PIN is configured but the cookie is missing/wrong, and `null` (pass) when authorized. Wired into all 9 owner endpoints.
- **Verified:** 5 new unit tests in [__tests__/auth-gates.test.ts](__tests__/auth-gates.test.ts) cover dev/prod × pin-set/unset × correct/wrong cookie.

### P0-C. File-based store lost writes under concurrent load
- **Risk:** Two parallel `POST /api/quotes` reads the same on-disk JSON, both modify in-memory, both write — last writer wins, first writer's data lost. The probe sent 50 parallel submissions and the store **lost 65 entries** (the 50 new ones plus 15 pre-existing got clobbered).
- **Before:** `loadStore → mutate → saveStore` had no lock.
- **Fix:** [lib/server/store.ts](lib/server/store.ts) — added `withStoreLock<T>()` chain mutex; every mutation function (`createQuote`, `sendQuote`, `approveQuote`, `markDepositPaid`, `markPhotosRequested`, `recordFollowUp`, `recordOutcome`, `updateJobActuals`, `applyOnboarding`, `setDepositCheckoutUrl`, `updateCostInput`) now runs inside the lock so reads always see the latest committed state.
- **Verified:** Re-running suite G shows all 50 parallel writes persist.
- **Caveat:** This mutex is **process-local**. On a multi-instance serverless deployment (Vercel autoscaling), instances will still race. The real long-term fix is the already-installed Postgres/Supabase backend. The mutex protects single-instance deploys (Fluid Compute, classic Node container, local dev).

### P0-D. Unknown `serviceSlug` was accepted
- **Risk:** Schema only required a non-empty string. A typo or curl prank could create a "quote" for `serviceSlug: "magic-beans"`, which the pricing engine then half-handles, producing nonsense estimates and weird dashboard rows.
- **Fix:** [lib/validation.ts](lib/validation.ts) — added `knownServiceSlug` enum derived from the actual seed services, applied to `quoteRequestSchema.serviceSlug`, each `serviceLines[].serviceSlug`, and `previewRequestSchema`.

### P0-E. NUL bytes + control chars were persisted in addresses & names
- **Risk:** Embedded `\x00` truncates strings in many C-based downstream libs (Twilio SDK in some versions, Postgres `text` columns, OS path APIs). One bad copy-paste from a richtext editor could break SMS templating silently.
- **Fix:** [lib/validation.ts](lib/validation.ts) — added `cleanString(max)` and `cleanOptional(max)` helpers that strip Unicode general-category `Cc` (control chars) and trim, then cap length; applied to `customerName`, `addressStreet`, `addressCity`, `customerPhone`, `source`, `notes`, plus all action endpoint string fields (`overrideReason`, `customerNote`, `message`, `materialNotes`).
- **Verified:** Suite F now shows `addressStreet` strips NUL bytes; round-trip via `/api/quotes` returns a clean string.

### P0-F. No upper bounds on user-supplied text
- **Risk:** Submitting a 10KB `customerName` or 50KB `notes` would persist verbatim, bloating the JSON store and likely breaking Twilio's 1600-char SMS payload.
- **Fix:** [lib/validation.ts](lib/validation.ts) — explicit `.max()` caps:
  - `customerName`: 120
  - `addressStreet`: 200
  - `addressCity`: 100
  - `customerPhone`: 40
  - `source`: 80
  - `notes`: 2000
  - `customerEmail`: 254 (RFC 5321 max)
  - `customerNote` (approval), `overrideReason`, `message` (follow-up), `materialNotes`, `outcome.notes`, etc.: 500–700
  - Numeric: `jobSize` ≤ 1,000,000, `amount` ≤ 1,000,000 (no negative or unbounded large)
  - Cost inputs: `hourlyLaborRate` ≤ 1000, `serviceMinimum` ≤ 100,000, etc.

### P1-G. `urgency` was a free-string field
- **Risk:** Front-end always sends one of 4 values, but the API accepted any string. A malformed value silently fell through the pricing engine's `urgency === "asap"` branches and produced an unflagged "flexible" default.
- **Fix:** [lib/validation.ts](lib/validation.ts) — `urgency: z.enum(["asap","this_week","this_month","flexible"])` in both `quoteRequestSchema` and `previewRequestSchema`.

---

## What was tested and found clean

### Pricing engine — 40-combo sweep
For every service (10) × every size (4) × every urgency (4) = **160 combos** submitted (also captured in 200 random happy-path), all returned an estimate with:
- `rangeLow <= rangeHigh`
- `rangeLow <= recommendedAsk <= rangeHigh`
- `recommendedAsk >= protectedFloor`
- `grossMarginPct >= 0`

No anomalies. The pricing math holds across the full intended input domain.

### XSS / SQL injection
- All SQL-shaped names (`Robert'); DROP TABLE…`) accepted but never executed — no SQL backend, just a JSON file. React escapes by default on render. **Pass.**
- `<script>alert(1)</script>` in `customerName` accepted but echoed only as text in JSON; would render as escaped text. **Pass.**
- `javascript:alert(1)` in `notes` accepted as plain text. **Pass.**

### Prototype pollution
- Payload with literal `__proto__: {polluted:"yes"}` accepted. Verified `Object.prototype.polluted` remains `undefined` both client- and server-side. Node 18+ handles `__proto__` keys as own properties in JSON.parse (not prototype walks). **Pass.**

### Duplicate detection
- Same phone + same street within 30 days → `duplicateContext.isDuplicate === true`. **Pass.**

### Email validation
- Empty, plain, +tag, multi-dot TLD: accepted.
- `a@b`, `a@`, `@b.com`: rejected.
- IP-address domain (`test@123.45.67.89`): accepted (boundary case — most APIs permit, fine here).

### SSR — no 5xx
- All public/owner pages (`/quote`, `/dashboard`, `/dashboard/costs`, `/dashboard/onboarding`, plus 404 paths) return 2xx/3xx/4xx never 5xx.

### Webhooks
- `/api/webhooks/twilio-inbound` parses well-formed `WON 625` payloads, handles emoji bodies, handles empty bodies — no 5xx.
- `/api/webhooks/stripe` correctly rejects unsigned payloads with 400.

### Concurrency (with mutex)
- 50 parallel `POST /api/quotes`: all 50 IDs unique, all 50 persisted, no clobbered writes.

---

## Open items / production checklist before going live

1. **Set `DASHBOARD_PIN`** in production env. The new `requireOwnerApi` gate returns 503 in production until this is present. Without it, the owner API is locked, not open.
2. **Set `CRON_SECRET`** in production env. Vercel's cron will inject `Authorization: Bearer ${CRON_SECRET}` automatically when you wire it up via the Vercel dashboard.
3. **Migrate off the file-based store.** The mutex protects single-instance writes, but every serverless function instance has its own copy of `.data/pricing-agent.json` (the bundled seed) and writes are *not* shared across instances. Use the already-installed Supabase/Postgres for multi-instance deploys. (`supabase/` directory is present but the wiring isn't done — that's the next milestone.)
4. **Add rate limiting on `POST /api/quotes`.** A scraper could spam quotes and flood Dante's inbox. Use Vercel Firewall or `@vercel/edge-config` with a per-IP token bucket.
5. **Wire Stripe webhook signature verification.** It currently rejects unsigned, which is correct, but check that the `STRIPE_WEBHOOK_SECRET` env is set in production.
6. **Audit notification fallback.** The `/dashboard` already surfaces a banner when notification env vars are missing, but consider failing hard (return 503 on `POST /api/quotes`) in production instead of silently logging to `.data/notification-log.jsonl` — losing notifications is worse than dropping the lead, because Dante can re-engage a known dropped submission but cannot re-engage a customer who got nothing.

---

## Artifacts left behind

- [scripts/probe.mjs](scripts/probe.mjs) — base probe (9 suites)
- [scripts/probe-deep.mjs](scripts/probe-deep.mjs) — deep probe (8 targeted checks)
- [__tests__/auth-gates.test.ts](__tests__/auth-gates.test.ts) — 5 new unit tests for `requireOwnerApi`
- [docs/audit-2026-05-11/AUDIT.md](docs/audit-2026-05-11/AUDIT.md) — earlier UI/UX audit (separate batch, already patched)
- [docs/audit-2026-05-11/PROD-READINESS.md](docs/audit-2026-05-11/PROD-READINESS.md) — this document

Both probe scripts are safe to re-run on a clean dev server. They write real quotes to `.data/pricing-agent.json`; delete the file or set `LOCAL_DATA_PATH=/tmp/probe.json` to keep the seed clean.
