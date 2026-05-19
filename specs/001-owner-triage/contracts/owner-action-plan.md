# Owner Action Plan Contract

The dashboard action plan is a server-rendered UI contract, not a public API.

## Inputs

- Current `Quote[]` from the existing store.
- Current local date string in `YYYY-MM-DD` format.
- Current timestamp for expiry math.

## Output

The action plan renderer receives a ranked list of `OwnerAction` objects.

Required fields per action:

- `id`
- `quoteId`
- `customerName`
- `kind`
- `title`
- `reason`
- `cta`
- `href`
- `callHref`
- `smsHref`
- `mapsHref`
- `stage`
- `tone`
- `value`
- `nextStep`
- `message`
- `score`

Optional fields:

- `dueDate`

## Invariants

- `href` must point to `/dashboard/quotes/{quoteId}`.
- Higher `score` sorts before lower `score`.
- Ties sort by higher `value`, then newer `updatedAt`/`createdAt`, then id.
- No action is generated for terminal quote statuses.
- Direct contact links may be `null` when the quote does not have the needed
  phone or address fields.
- `smsHref` must include encoded message copy, but the owner still controls the
  actual send action from their device.

## Job Brief UI Contract

The quote detail page must render a `JobBrief` panel:

- Desktop: first card in the right rail.
- Mobile: above the two-column detail grid so the brief appears before the long
  pricing and scope sections.
- The panel must include direct Call, Text, Map, and Public quote actions when
  source data is present.
- The panel must include check rows for photos, deposit, water, scope, and
  margin.
- The panel must include a crew plan, risk flags when present, and an every-job
  checklist.
