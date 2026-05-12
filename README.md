# 631 Solutions Pricing & Quote App

Customer quote intake and owner dashboard for **631 Solutions** (Suffolk County exterior cleaning, owner: Dante, (631) 850-3601). Built to convert inbound leads — especially from the [Nextdoor business page](https://nextdoor.com/pages/631-solutions-huntington-station-ny/) — into reviewed, margin-protected, photo-confirmed bookings.

## Run

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000` (it redirects to `/quote`).

## Routes

| Path | Purpose |
| --- | --- |
| `/quote` | Customer intake. 4 steps, photo upload, instant range, three packages, one-tap approve. |
| `/dashboard` | Dante's queue. Lead quality, route zone, protected floor, follow-up stage. |
| `/dashboard/quotes/[id]` | Review a quote, send a confirmed price, log outcomes and actuals. |
| `/api/cron` | Daily outcome SMS fanout. |
| `/api/webhooks/twilio-inbound` | Accepts `WON 625`, `LOST`, `NO RESPONSE`, or `LATER`. |

## Lead attribution — Nextdoor link recipe

Always link customers to a tagged URL so Dante can attribute closes by source:

```
https://<your-deployed-host>/quote?src=nextdoor
```

The form auto-fills the **source** field when it sees `?src=` or `?utm_source=`. Recognised values: `nextdoor`, `google`, `referral`, `repeat`, `truck`, `sign` / `yardsign`. Anything else falls through to the manual dropdown.

Use the same trick for other channels:

| Channel | Link |
| --- | --- |
| Nextdoor business page | `/quote?src=nextdoor` |
| Google Business Profile | `/quote?src=google` |
| Truck QR sticker | `/quote?src=truck` |
| Yard signs | `/quote?src=sign` |

## Required environment

Notifications fall back **silently** to a JSONL log at `.data/notification-log.jsonl` when env vars are missing. That means a misconfigured deploy can look like the app is working when no one is being notified. Tail that file after the first live submission to confirm.

Copy `.env.example` to `.env.local` and set:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | Used in OG metadata and links inside SMS/email payloads |
| `DASHBOARD_PIN` | Owner login for `/dashboard` |
| `DANTE_EMAIL`, `DANTE_PHONE` | Where new-quote and approval notifications go |
| `RESEND_API_KEY`, `RESEND_FROM` | Customer + owner email |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_PHONE` | Customer + owner SMS |

If any of these are unset, that channel is skipped (logged, not sent).

## Local data

The app seeds and writes `.data/pricing-agent.json` on first boot. To start clean, delete `.data/` and restart `pnpm dev`. To experiment without polluting the seed file, set `LOCAL_DATA_PATH=/tmp/whatever.json`.

## Deposit collection (Stripe)

Stripe Checkout is wired but **only activates when `STRIPE_SECRET_KEY` is set**. Without the key, the approval flow silently falls back to the previous "manual deposit hold" copy and Dante's existing workflow. Wiring requires Dante to own the Stripe account (KYC, payouts, chargebacks all live with the merchant). See `.env.example` for the three required vars and the webhook endpoint path `/api/webhooks/stripe`.

When wired, the approval flow:

1. Customer accepts scope + clicks Approve.
2. Server creates a Stripe Checkout session, redirects the browser.
3. On `checkout.session.completed`, the webhook marks the quote `scheduled` automatically.

## "While we're there" upsell tracking

The customer-facing approval page exposes `estimate.bundleRecommendations` as toggleable same-trip add-ons (filtered to exclude items already in the selected package). Acceptance is persisted on `approval.acceptedUpsellIds` / `approval.acceptedUpsellsLift`. To compute conversion:

- **Denominator** (shown): quotes with `status >= 'approved'` and `estimate.bundleRecommendations.length > 0`
- **Numerator** (accepted): quotes where `approval.acceptedUpsellIds.length > 0`
- **Revenue lift**: sum of `approval.acceptedUpsellsLift` across approved quotes

## Known limits (do not promise these to a customer)

- **Painting and permanent lighting are quoted instantly** like cleaning services. The pricing engine still respects the protected floor, but those jobs realistically need a site visit; review them on the dashboard before sending.
- **No real calendar integration.** "Earliest availability" is heuristic, not a live calendar.
- **Stripe deposits are best-effort.** If the Checkout session fails to create (network or API error), the flow shows the customer a "we'll text a deposit link" fallback message — Dante still has to manually follow up in that case.
