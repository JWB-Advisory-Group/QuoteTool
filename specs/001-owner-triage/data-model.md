# Data Model: Owner Action Triage

## OwnerAction

Derived recommendation shown on `/dashboard`.

- `id`: Stable action identifier built from quote id and action kind.
- `quoteId`: Existing quote id used for dashboard detail links.
- `customerName`: Customer label shown in the action card.
- `kind`: Action category such as `collect_deposit`, `confirm_booking`,
  `follow_up`, `price_ready`, `closing_window`, `request_photos`, or
  `review_risk`.
- `title`: Short owner-facing instruction.
- `reason`: Human-readable explanation of why the action is ranked.
- `cta`: Button label for the next owner step.
- `href`: Quote detail route.
- `callHref`: Direct phone link when a normalized phone number is available.
- `smsHref`: Direct SMS link with owner-ready message copy when a phone number
  is available.
- `mapsHref`: Google Maps search link for the job address when address data is
  available.
- `stage`: Compact status label.
- `tone`: Visual tone used by the dashboard.
- `value`: Estimated dollar value from final amount or recommended ask.
- `dueDate`: Date pressure when a follow-up task or expiry exists.
- `nextStep`: Short instruction for what Dante should do from the card.
- `message`: Suggested text for the customer touch.
- `score`: Internal ranking score; higher appears earlier.

## Quote

Existing entity. Relevant fields for this feature:

- `status`
- `photoAttachments`
- `estimate.recommendedAsk`
- `estimate.followUpStage`
- `estimate.leadQuality`
- `estimate.closeProbability`
- `followUps`
- `approval`
- `finalQuoteAmount`
- `expiresAt`
- `duplicateContext`
- `createdAt`
- `updatedAt`

## State Rules

- Terminal quotes (`won`, `lost`, `no_response`) do not create actions.
- `awaiting_deposit`, `approved`, and `scheduled` quotes create booking actions.
- Due follow-up tasks create follow-up actions.
- Pending/contacted quotes with photos create pricing actions.
- Pending/contacted quotes without photos create photo request actions.
- Sent quotes expiring within 72 hours create closing-window actions.

## JobBrief

Derived quote-detail operating panel used before pricing, scheduling, or job
dispatch.

- `headline`: Current operational state in owner language.
- `subhead`: Route, crew, and close-probability summary.
- `tone`: Overall state based on missing photos, blocking deposits, risk flags,
  and margin.
- `callHref`, `smsHref`, `mapsHref`, `publicQuoteHref`: Direct owner links.
- `checks`: Photo, deposit, water, scope, and margin status.
- `crewPlan`: Route, service, crew, labor, and deposit planning notes.
- `riskFlags`: Access, water, roof, surface, manual-review, and address warnings.
- `dayOfChecklist`: Repeatable prep checklist for every job.
