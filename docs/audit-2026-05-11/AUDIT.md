# 631 Solutions — UI/UX & Fixes Audit

**Date:** 2026-05-11
**Scope:** `/quote` (customer intake, 3 steps), `/dashboard` (owner), `/dashboard/quotes/[id]` (owner detail), `/quote/[id]` (customer approval)
**How tested:** Manual walkthrough at desktop 1440×900 and mobile 375×812 in a controlled Chromium preview, plus source review, `pnpm lint`, `pnpm test`.

Lint: clean. Tests: 12/12 pass. No console errors at runtime.

---

## P0 — Visible bugs (fix this week)

### 1. Customer approval page renders `$185deposit` (no space)
- **Where:** [public-quote-actions.tsx:406](app/quote/[id]/public-quote-actions.tsx:406)
- **What you see:** "A **$185deposit** is collected after you approve…"
- **Why:** JSX text immediately after `{formatMoney(...)}` is losing its leading space in the rendered DOM. The DOM shows three children: `"A "`, `"$185"`, `"deposit is collected…"` (leading space stripped). This is a literal collision the customer will read before paying you.
- **Fix:**
  ```tsx
  A {formatMoney(selectedDepositAmount)}{" "}deposit is collected…
  ```
  Or use a template literal: `{`A ${formatMoney(selectedDepositAmount)} deposit is collected…`}`.
- **Search the rest of `public-quote-actions.tsx` and `page.tsx` under `quote/[id]/` for similar `{expr} word` patterns and apply the same `{" "}` guard.**

### 2. Customer approval page: "Weekday standard window afternoon" overflows its chip
- **Where:** [public-quote-actions.tsx:380](app/quote/[id]/public-quote-actions.tsx:380) — `h-12` fixed height on a 2-column grid chip; the long label `"Weekday standard window"` + ` ` + `"afternoon"` wraps and runs into the **"Anything we should know before booking?"** heading below.
- **Fix options:** remove `h-12` (let it size to content), or stack `day` over `time` as a smaller secondary line:
  ```tsx
  <span className="block">{window.day}</span>
  {window.time !== "flexible" && (
    <span className="block text-xs font-medium text-[#62685f]">{window.time}</span>
  )}
  ```

### 3. Customer intake: generic "Invalid quote request" error eats the field-level details
- **Where:** [quote-form.tsx:478-484](app/quote/quote-form.tsx:478) — the API returns `{ error, details: { fieldErrors: {...} } }` but the client throws `new Error(json.error)` and discards `details`.
- **Why it bites:** if Town or ZIP are blank (very easy to do — see #4), the customer sees only `Invalid quote request` and has no way to find what's wrong.
- **Fix:** read `json.details?.fieldErrors`, render per-field inline error messages, and announce the error region via `role="alert"`.

### 4. Quote form does not validate per-step — user can submit empty required fields
- **Where:** [quote-form.tsx:1081-1090](app/quote/quote-form.tsx:1081) — Next/Back simply `setStep(current ± 1)`; no gate.
- **Today's behavior:** I clicked through Step 1 → 2 → 3 with **Town and ZIP empty** and only learned on submit (and only via the generic error from #3) that anything was missing.
- **Fix:** add a per-step `validateStep(step)` returning a `{ok: false, fieldErrors}` object; disable Next while invalid; show inline field errors after first attempt.

### 5. Dirty data renders unsanitised in customer copy
- **What you see:** "Service address: 50 Lantern Street**,,** Huntington **11743 11743**."
- **Where:** the JSX is fine ([app/quote/[id]/page.tsx:120](app/quote/[id]/page.tsx:120)) — the data in `.data/pricing-agent.json` has `addressStreet: "50 Lantern Street,"` (trailing comma) and `addressCity: "Huntington 11743"` (city contains the ZIP).
- **Two fixes (do both):**
  1. **Sanitize on write** in `createQuote`: trim trailing commas/whitespace from `addressStreet`, strip embedded 5-digit ZIPs out of `addressCity`.
  2. **Render defensively** with a small helper: `formatAddressLine(street, city, zip)` that dedupes the ZIP.

---

## P1 — Conversion & trust risk

### 6. Two `<h1>` elements on `/quote`
- The form has `<h1>What should we quote?</h1>` ([quote-form.tsx:507](app/quote/quote-form.tsx:507)) and the marketing column has `<h1>Fast, clear exterior cleaning quotes…</h1>` ([app/quote/page.tsx:27](app/quote/page.tsx:27)).
- **Impact:** SEO ranks the page on a contradictory primary heading and screen-reader landmark navigation is confusing.
- **Fix:** demote the form heading to `<h2>` (it lives inside the page, not above it). Keep the marketing one as `<h1>`.

### 7. Mobile users see the form first, marketing/trust below — no above-the-fold context
- **Where:** [app/quote/page.tsx:21](app/quote/page.tsx:21) — `flex-col gap-6 lg:flex-row-reverse` — on mobile, the form section renders first and the headline/value-prop only appears after the customer scrolls past 3 steps of choices.
- **Fix:** for `< lg`, render a compact 2-line value-prop above the form: name, "Fast, photo-confirmed quote in minutes", plus the phone number.

### 8. Photo upload doesn't suggest the camera on mobile
- **Where:** [quote-form.tsx:674-680](app/quote/quote-form.tsx:674)
- **Fix:** add `capture="environment"` to the `<input type="file">` so phones surface "Take Photo" alongside "Photo Library":
  ```tsx
  <input type="file" accept="image/*" capture="environment" multiple … />
  ```
  Photos are the core value prop of the form — make taking one the path of least resistance.

### 9. No per-input `id`s → labels associate only by wrapping, not `for`
- All form inputs (Step 2 address, Step 3 contact) have no `id` and labels rely on wrapping. That works visually but breaks:
  - Screen reader announcements in some browsers (especially Safari iOS).
  - Password manager / Apple Wallet autofill heuristics (which prefer `id` + `name`).
- **Fix:** add `id` to every input and `htmlFor` to the surrounding `<label>` text; also set `name=` so error reporting maps cleanly to schema fields.

### 10. "Service cards" use color alone to distinguish badges
- `OWNER REVIEW` (blue) vs `SURVEY FIRST` (yellow) vs unbadged are color-only. Color-blind customers (~8% of men) cannot tell these apart at a glance.
- **Fix:** prepend a small icon (e.g., `Eye` for owner review, `ClipboardCheck` for survey first) — already importing lucide-react, almost free.

---

## P2 — Code quality / maintainability

### 11. `app/quote/quote-form.tsx` is **1,437 lines**
- Your team rule is 800 lines max. This file is doing intake state, photo handling, validation, pricing preview, package selection, and trust messaging. Split into:
  - `QuoteForm` (orchestrator + state),
  - `ServicePicker` (step 1),
  - `LocationAndPhotos` (step 2),
  - `ContactStep` (step 3),
  - `usePhotoUpload` (camera/file logic),
  - `QuoteTrustRail` (already exported separately — keep as is).

### 12. Inline `<img src={photo.dataUrl}>` keeps base64 photos in component state
- **Where:** [quote-form.tsx:716](app/quote/quote-form.tsx:716)
- Each photo is a base64 data URL held in React state. 5 phone photos at ~3MB raw → ~20MB base64 in memory. On a 3-year-old Android browser this will jank during re-renders.
- **Fix:** store the `File` blob and use `URL.createObjectURL(file)` for the preview (`<img src={URL.createObjectURL(file)} />`); revoke on unmount. Send the actual files on submit (multipart) instead of base64 JSON.

### 13. Lead source attribution lost on revisit to `/quote/[id]` → `/quote`
- The "← New quote" back link on the customer approval page sends them to `/quote` without `?src=…`. Customers who close the approval page and come back lose attribution.
- **Fix:** preserve the original `source` on the quote and stitch it into the back link's URL.

### 14. `<img>` over `next/image` for customer-uploaded thumbs
- Fine while base64, but if you switch to object URLs (#12) you can use `next/image` for the dashboard's photo gallery on the detail page.

---

## P3 — Polish & visual

### 15. The customer-facing `$740–$910 estimate` headline reads small relative to the surrounding card
- The number is **the** thing the customer cares about — it should out-weigh the address line by 2×, but currently sits at `text-3xl` while the address sits at `text-base`. Try `text-4xl sm:text-5xl` and a tighter line-height.

### 16. Trust rail is visually monotonous
- All three trust items render in the same gray pill with the same `MapPin` icon mid-style. Differentiate with three icons (location, shield, droplets) and one warmer surface color — these are the trust signals that earn the click on Approve.

### 17. Notifications-disabled banner is verbose
- ~5 lines of env var names on top of the dashboard. Useful once, noisy daily. Collapse to a one-line orange chip ("Notifications partially off — 4 channels need keys") with an expand-to-details on click.

### 18. Approve button looks identical to Back/Next
- The most positive action of the entire customer journey (Approve) uses the same `#1d211c` dark fill as secondary buttons. Push it greener (e.g., the existing accent `#d8f269` on the dashboard "Work the next lead" CTA, or a saturated green) so customers feel the affordance.

### 19. Quote-detail right column ends abruptly with empty space
- Below "Follow-up plan" + "Outcomes" on the owner detail page (`/dashboard/quotes/[id]`), the right column ends but the left column continues for ~1,500px more. The sticky aside should either grow with the page or detach + recenter the left column for the final sections.

### 20. Color-only state for lead-quality badges
- `bad lead` (red) / `mid` (yellow) / `good` (green) on the dashboard rely on color alone. Add a small triangle/check/dot icon prefix.

### 21. Empty state for "No outcome logged for this quote" lacks a CTA
- Right column on `/dashboard/quotes/[id]` shows the text and stops. Add a primary button to log the outcome directly.

### 22. Owner detail page header has no breadcrumb or pipeline context
- After clicking a row from "Booking pipeline", the only way back is the browser back button. Add a "← All leads" link or sticky breadcrumb.

---

## P4 — Accessibility recap (small but worthwhile)

- Add `id` + `for` to all form labels (covered in #9).
- Wrap the global `<header>` in a real `<header>` landmark and the marketing column in `<aside>` (currently both are `<section>`).
- The photo "Add photos" `<label>` wraps an `<input class="sr-only">` — works, but no `aria-describedby` to the checklist of suggested photos. Link them.
- Schedule-window toggle buttons (#2) should expose `aria-pressed` so screen reader users know they're selected.
- The dashboard `[Phone]` / `[Map]` / `[Open]` icon-only buttons on each pipeline row already have `aria-label` — good. Keep this pattern.

---

## Quick-win checklist (a half-day's work, in order)

- [ ] Fix #1 (`$185 deposit` space) — 5 min.
- [ ] Fix #2 (chip overflow / time wrap) — 10 min.
- [ ] Fix #5 (sanitize address on save + render) — 20 min.
- [ ] Add per-step validation gates (#4) and inline error messaging (#3) — 1–2 hours.
- [ ] Demote `<h1>` in form to `<h2>` (#6) — 2 min.
- [ ] Add `capture="environment"` to photo input (#8) — 1 min.
- [ ] Add `id` + `for` to all inputs (#9) — 30 min.
- [ ] Add icons to OWNER REVIEW / SURVEY FIRST badges (#10) — 15 min.
- [ ] Split `quote-form.tsx` into 4–5 files (#11) — half-day.
- [ ] Switch photo previews to `URL.createObjectURL` (#12) — 1 hour.

If you only ship 3 of these, ship **#1, #2, and #4** — they are the ones that materially affect whether a customer trusts the price they see and gets through the form on the first try.
