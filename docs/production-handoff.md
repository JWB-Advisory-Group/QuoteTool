# Production Handoff

## Runtime

The app runs locally with a file-backed store at `.data/pricing-agent.json`. That makes V1 usable immediately for testing. For production, move the same core tables to Supabase using `supabase/migrations/00001_initial.sql` and swap `lib/server/store.ts` for a Supabase-backed adapter.

Local development seeds demo leads when the queue is empty. Set `DEMO_QUOTES=off`
in any shared/staging environment where seeded leads would create confusion.

## Environment

Copy `.env.example` to `.env.local`.

- Without notification credentials, emails/SMS are logged to `.data/notification-log.jsonl`.
- Set `DASHBOARD_PIN` before exposing the app publicly.
- Set `CRON_SECRET` if `/api/cron` should reject unauthenticated calls.
- Vercel Hobby cron is configured once daily in `vercel.json`.

## Vendor Guardrails

- Resend free tier is enough for V1 testing, but the 100/day cap matters.
- Twilio requires a leased number and production SMS registration work before customer-facing traffic.
- Google Places is intentionally absent from V1. Plain address entry avoids the post-2025 SKU/free-cap surprise.
- Claude model use is intentionally absent from V1 runtime. When V1.5 unlocks, make the model name an environment variable.

## Acceptance Checks

- Submit 10 test quotes through `/quote`.
- Submit at least one quote without photos, then upload 2-4 photos from `/quote/[id]#photos`.
- Confirm no quote can be sent below `estimate.floorBandHigh`.
- Confirm notification log or live SMS/email receives customer and Dante messages.
- Log `WON 625`, `LOST`, and `NO RESPONSE` through dashboard or Twilio webhook.
- Run `pnpm truth-gate path/to/15-addresses.json` and update `docs/truth-gate-results.md`.
