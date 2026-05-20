# Quote Tool Improvement Backlog

Updated: May 19, 2026

## Completed In This Pass

- Customer primary action now appears before the optional upsell on public quote pages.
- Optional package CTA now says "See package" instead of implying it already adds the upgrade.
- Unapproved quote pages no longer promise one static deposit amount while package selection can change it.
- Estimate-range flows default to the Essential/requested-scope package instead of defaulting above the quoted range.
- Package cards now label when a package is inside the estimate band or an upgrade above it.
- Dense scope/trust supporting details moved behind a collapsible section while the prep list stays visible.
- Customer quote pages now include a proof-before-booking panel with the uploaded reference photo, before/after documentation expectations, owner-reachable trust signals, and insurance/license confirmation copy.
- Owner quote detail pages now format risk/story multipliers cleanly instead of exposing raw decimal noise.
- Production dashboard access now fails closed when `DASHBOARD_PIN` is missing, while local development can still run without a PIN.

## Still Needs To Be Done

- Configure production env vars: `NEXT_PUBLIC_APP_URL`, `DASHBOARD_PIN`, `DANTE_EMAIL`, `DANTE_PHONE`, Resend, Twilio, Supabase, Stripe, and cron secret. The dashboard now blocks owner data until `DASHBOARD_PIN` is present.
- Tailor all service cost inputs from industry defaults to Dante's real labor, material, drive, minimum, and deposit assumptions.
- Add real calendar capacity instead of heuristic route windows.
- Add a real before/after project library and verified review snippets once Dante has approved source photos/testimonials to display.
- Make photo requirements smarter by service and quote state, including clearer categories for roof, pavers, windows, gutters, and access.
- Add scheduled-date and crew-load views for the owner dashboard.
- Add follow-up history and customer reply tracking so the owner can see what already happened.
- Run a production smoke test with live notification delivery, deposit fallback, and durable Supabase writes before exposing live traffic.
