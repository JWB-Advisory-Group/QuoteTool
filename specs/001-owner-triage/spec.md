# Feature Specification: Owner Action Triage

**Feature Branch**: `001-owner-triage`

**Created**: 2026-05-19

**Status**: Draft

**Input**: User description: "Upgrade the 631 Solutions QuoteTool dashboard so Dante sees a prioritized owner action plan, clear reasons for each lead priority, and faster links to call, text, map, or open the next quote without changing the customer quote intake flow."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Work the Next Dollar (Priority: P1)

Dante opens the dashboard and immediately sees a ranked list of the most valuable
actions to take across open quotes, including booking confirmations, deposit
holds, follow-ups, ready-to-price leads, expiring sent quotes, and photo requests.

**Why this priority**: The owner feedback says the dashboard must answer "who
needs a quote, who is ready to book, and what is on the schedule?" before it
adds more analytics.

**Independent Test**: Given a mixed quote queue, the dashboard action plan ranks
booking/deposit/follow-up/ready-to-price work ahead of lower-value waiting states.

**Acceptance Scenarios**:

1. **Given** one awaiting-deposit quote and one ready-to-price quote, **When**
   Dante opens `/dashboard`, **Then** the deposit action appears above the
   ready-to-price action.
2. **Given** a sent quote with a follow-up due today, **When** the action plan is
   generated, **Then** it includes the due task label, owner reason, and a link
   to the quote detail page.

---

### User Story 2 - Understand Why It Matters (Priority: P2)

Dante can scan each recommended action and understand why the lead is ranked
there, including due-date pressure, missing photos, price-window expiry, deposit
state, lead completeness, and revenue signal.

**Why this priority**: A sorted list without reasons is hard to trust while the
owner is between jobs or on site.

**Independent Test**: Given quotes that trigger different action types, each
action exposes a human-readable title, reason, call-to-action, and value signal.

**Acceptance Scenarios**:

1. **Given** a pending quote with photos attached, **When** the action is shown,
   **Then** it explains that photos are in and the scope can be reviewed.
2. **Given** a pending quote without photos, **When** the action is shown,
   **Then** it tells Dante to request photos instead of sending a final price.

---

### User Story 3 - Stay Useful When the Queue Is Clean (Priority: P3)

When there are no actionable open quotes, the dashboard shows a calm empty state
that confirms the queue is clean and nudges outreach or follow-up review.

**Why this priority**: Empty states should keep the owner oriented instead of
making the dashboard feel broken.

**Independent Test**: Given only won, lost, or no-response quotes, the action
plan displays no actionable leads and the dashboard keeps rendering normally.

**Acceptance Scenarios**:

1. **Given** no open quotes, **When** Dante opens `/dashboard`, **Then** the owner
   action plan displays a clean-queue message.

### Edge Cases

- Quotes with the same priority are ordered by value and then most recent update.
- Won, lost, and no-response quotes do not create owner actions.
- Sent quotes with expired price windows are called out differently from quotes
  still inside the 72-hour closing window.
- Missing customer phone numbers do not block the action plan because the quote
  detail page remains available.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST generate a deterministic owner action list from the
  current quote queue without requiring client-side state.
- **FR-002**: System MUST rank booking confirmation and deposit-blocked work
  ahead of quote preparation and photo collection.
- **FR-003**: System MUST rank due follow-ups ahead of new ready-to-price quotes.
- **FR-004**: System MUST show each action with title, customer, reason, CTA,
  quote detail link, status/stage, and quote value signal.
- **FR-005**: System MUST show ready-to-price actions only for pending or
  contacted quotes that already have photos.
- **FR-006**: System MUST show photo-request actions for pending or contacted
  quotes without photos.
- **FR-007**: System MUST not alter the public `/quote` intake or customer quote
  approval flow.
- **FR-008**: System MUST keep the action plan available on the authenticated
  owner dashboard only.
- **FR-009**: System MUST provide focused automated coverage for action ranking
  and empty-action behavior.
- **FR-010**: System MUST expose quick call, text, map, and quote-open controls
  for owner actions when the underlying quote has the required contact data.
- **FR-011**: System MUST provide owner-ready message copy for follow-up, photo
  request, booking, deposit, closing-window, and quote-prep actions.
- **FR-012**: System MUST show a crew-ready job brief on quote detail pages with
  contact actions, route/crew/deposit state, risk flags, and an every-job
  checklist before lower-priority quote detail sections on mobile.

### Key Entities *(include if feature involves data)*

- **OwnerAction**: A ranked recommendation derived from one quote; includes the
  quote id, customer name, action kind, title, reason, CTA, value, due date, and
  visual tone.
- **Quote**: Existing customer quote record with status, estimate, photos,
  follow-ups, approval/deposit state, expiry, and customer details.
- **FollowUpTask**: Existing calculated task used to identify due owner contact.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Given a representative mixed queue, the top action can be identified
  from the dashboard without opening a quote detail page.
- **SC-002**: Action ranking unit tests cover at least deposit/booking, due
  follow-up, ready-to-price, missing-photo, and clean-queue cases.
- **SC-003**: Action payload tests cover direct contact links and message copy.
- **SC-004**: Dashboard render remains server-side and does not introduce a new
  client component for the action plan.
- **SC-005**: Existing automated tests, lint, and production build continue to
  pass after the upgrade.
- **SC-006**: Job brief tests cover missing-photo, deposit-blocked, risk-flag,
  and contact-link scenarios.

## Assumptions

- The first slice upgrades owner triage only; it does not add scheduling,
  calendar integration, or new notifications.
- Existing quote statuses and follow-up rules remain the source of truth.
- The dashboard already requires owner access when production auth is configured.
- The owner wants a dense operations surface, not a marketing-style dashboard.
