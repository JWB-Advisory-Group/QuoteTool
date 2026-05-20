# Data Model: Customer Service Plan

## CustomerServicePlan

Derived customer-facing model for one quote.

Fields:

- `statusLabel`: Customer-readable state label.
- `headline`: Short plan heading.
- `summary`: One or two sentence promise for the current quote state.
- `priceConfidence`: Customer-readable explanation of final price, estimate, or
  review requirement.
- `photoState`: Current photo status and why it matters.
- `depositState`: Current or expected deposit status.
- `primaryAction`: Highest-value customer action with label, href, and intent.
- `secondaryAction`: Optional supporting customer action.
- `timeline`: Ordered visit steps.
- `scopeHighlights`: Short list of included/service scope points.
- `prepChecklist`: Short customer preparation checklist.
- `trustSignals`: Short list of route, crew, local, or confirmation signals.

Validation rules:

- Must include exactly one primary action.
- Must not include internal pricing terms.
- Lists should remain short enough for mobile scanning.
- Must be safe to render for pending, contacted, sent, approved, awaiting
  deposit, scheduled, won/lost/no-response, survey-required, and expired quotes.

## CustomerPlanAction

Fields:

- `label`: Customer-facing action text.
- `href`: Anchor, phone link, or page link.
- `intent`: `photos`, `approve`, `call`, `review`, `prep`, or `deposit`.

## Existing Quote Inputs

Inputs used by the derived model:

- Quote status, final amount, expiry, photos, approval, address, service lines,
  risk profile, and estimate.
- Estimate package options, schedule windows, route zone, crew block, deposit
  state, scope inclusions/exclusions, and intake requirements.

No new persisted entity is introduced.
