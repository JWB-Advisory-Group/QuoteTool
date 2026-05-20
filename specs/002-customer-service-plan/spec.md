# Feature Specification: Customer Service Plan

**Feature Branch**: `002-customer-service-plan`

**Created**: 2026-05-19

**Status**: Draft

**Input**: User description: "Use the most relevant methodology-router methods and Spec Kit to upgrade the QuoteTool into something 631 Solutions uses on every job because it is effective, easy, and loved by clients."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Know What Happens Next (Priority: P1)

A homeowner opening a public quote immediately understands the current state,
the next best action, and what 631 Solutions will do before, during, and after
the visit.

**Why this priority**: A quote that only shows price still leaves the customer
wondering whether photos, scope, deposit, access, or scheduling are handled.

**Independent Test**: Given a public quote in sent, pending, approved, expired,
or survey-required state, the customer service plan presents one clear primary
action and a concise timeline.

**Acceptance Scenarios**:

1. **Given** a sent quote that can be approved, **When** the customer opens the
   quote page, **Then** the plan tells them to choose a package and shows the
   confirmation path.
2. **Given** an estimated quote without photos, **When** the customer opens the
   quote page, **Then** the plan makes uploading photos the primary action and
   explains why photos help.
3. **Given** an approved quote, **When** the customer opens the quote page,
   **Then** the plan shifts from selling to preparation and booking clarity.

---

### User Story 2 - Trust the Scope and Price (Priority: P2)

A homeowner can see what is included, what still needs confirmation, and whether
a deposit or scope review affects booking without seeing internal pricing terms.

**Why this priority**: Customer trust depends on clear boundaries and no
surprise language.

**Independent Test**: Given quotes with final amounts, estimated ranges, photo
state, deposit requirements, and survey-required services, the plan uses
customer-readable price and scope copy with no internal margin language.

**Acceptance Scenarios**:

1. **Given** a quote with a final amount, **When** the plan is generated, **Then**
   it states the confirmed price for the selected scope.
2. **Given** a quote with deposit required, **When** the plan is generated,
   **Then** it explains the customer-facing deposit step.
3. **Given** a quote requiring review, **When** the plan is generated, **Then**
   it explains the brief review before final booking.

---

### User Story 3 - Be Ready Before the Crew Arrives (Priority: P3)

A homeowner sees a short preparation checklist based on the actual quote risks,
so access, water, pets, fragile areas, and photos do not create avoidable job-day
friction.

**Why this priority**: The best quote tool prevents the small blockers that make
trade service jobs slower or less pleasant.

**Independent Test**: Given quote risk inputs, the plan produces a practical
prep checklist and avoids generic boilerplate when risk fields are absent.

**Acceptance Scenarios**:

1. **Given** a quote with locked gate or pets marked, **When** the plan is
   generated, **Then** the prep checklist includes those reminders.
2. **Given** outdoor water is not confirmed, **When** the plan is generated,
   **Then** the checklist asks the customer to confirm the water plan before
   arrival.

### Edge Cases

- Expired quotes must direct the customer to refresh the quote instead of
  approving stale pricing.
- Survey-required services must direct the customer to a scope review instead
  of implying final booking is available.
- Quotes without customer phone or email still render the plan and keep anchors
  to photos, scope, and packages.
- Customer-facing plan copy must not include internal terms like "protected
  floor", gross margin, close probability, or owner-only review labels.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST derive a customer service plan from the existing quote
  and estimate data without adding new required customer fields.
- **FR-002**: System MUST show one primary customer action based on quote state,
  expiry, survey requirement, photo state, and approval state.
- **FR-003**: System MUST show a concise visit timeline covering quote review,
  approval or scope review, scheduling confirmation, and service visit.
- **FR-004**: System MUST show customer-readable price confidence and deposit
  state without exposing internal pricing or margin language.
- **FR-005**: System MUST show practical preparation guidance based on photos,
  water access, access concerns, pets, fragile surfaces, and heavy furniture.
- **FR-006**: System MUST summarize scope highlights from the existing service
  breakdowns and inclusions.
- **FR-007**: System MUST keep the public quote approval and photo upload
  mutation behavior unchanged.
- **FR-008**: System MUST include focused automated coverage for plan derivation
  across missing-photo, sent-quote, approved/deposit, and risk-prep scenarios.

### Key Entities *(include if feature involves data)*

- **CustomerServicePlan**: A derived customer-readable summary of status, next
  action, visit timeline, price confidence, scope highlights, trust signals, and
  prep checklist.
- **CustomerPlanAction**: The primary or secondary action shown to the
  homeowner; includes label, href, and intent.
- **Quote**: Existing public quote record with status, estimate, photos,
  approval, expiry, and risk fields.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A customer can identify the next step from the first screen of the
  quote page without reading the package form first.
- **SC-002**: Plan derivation tests cover at least missing-photo, sent,
  approved/deposit, risk-prep, and internal-language cases.
- **SC-003**: The public quote page continues to render packages, scope, photos,
  and approval controls as before.
- **SC-004**: Existing automated tests, lint, and production build continue to
  pass after the upgrade.
- **SC-005**: Browser review confirms the plan is visible and legible on desktop
  and mobile quote pages.

## Assumptions

- The first implementation is a derived presentation layer and does not change
  approval, deposit, scheduling, or notification persistence.
- Public quote copy should be homeowner-readable and calm; owner-only metrics
  remain on dashboard/detail pages.
- The existing photo upload and package approval anchors are sufficient for the
  plan actions in this slice.
