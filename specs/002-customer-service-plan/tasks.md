# Tasks: Customer Service Plan

**Input**: Design documents from `/specs/002-customer-service-plan/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Focused unit tests are required by the specification.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to
- Include exact file paths in descriptions

## Phase 1: Setup

**Purpose**: Create the Spec Kit slice and confirm scope boundaries.

- [x] T001 Create feature artifacts under `specs/002-customer-service-plan/`
- [x] T002 Update current Spec Kit context to point at `specs/002-customer-service-plan/plan.md`

---

## Phase 2: Foundational

**Purpose**: Build a deterministic customer plan model before UI work.

- [x] T003 Add customer service plan tests in `__tests__/customer-service-plan.test.ts`
- [x] T004 Implement `buildCustomerServicePlan` in `lib/customer-service-plan.ts`

**Checkpoint**: Plan logic can be validated without rendering the quote page.

---

## Phase 3: User Story 1 - Know What Happens Next (Priority: P1)

**Goal**: Show the customer one clear next step and a short visit timeline.

- [x] T005 [US1] Compute the customer service plan in `app/quote/[id]/page.tsx`
- [x] T006 [US1] Render the primary action and timeline near the top of the public quote page

**Checkpoint**: The public quote answers what happens next before package details.

---

## Phase 4: User Story 2 - Trust the Scope and Price (Priority: P2)

**Goal**: Make price confidence, deposit, and scope boundaries easy to trust.

- [x] T007 [US2] Render price, photo, and deposit states without internal pricing language
- [x] T008 [US2] Render scope highlights from existing quote data

**Checkpoint**: The quote feels transparent without exposing owner-only data.

---

## Phase 5: User Story 3 - Be Ready Before the Crew Arrives (Priority: P3)

**Goal**: Prevent avoidable job-day blockers.

- [x] T009 [US3] Render the risk-aware prep checklist on the public quote page
- [x] T010 [US3] Verify mobile layout with browser review

**Checkpoint**: Customers can prepare without a follow-up text thread.

---

## Phase 6: Polish & Validation

- [x] T011 Run `pnpm test __tests__/customer-service-plan.test.ts`
- [x] T012 Run `pnpm test`
- [x] T013 Run `pnpm lint`
- [x] T014 Run `pnpm build`
- [x] T015 Capture browser QA screenshots for desktop and mobile quote pages

## Dependencies & Execution Order

T003 must precede T004. T004 must precede UI integration. Validation tasks run
after implementation.

## Parallel Opportunities

The pure helper tests and UI layout review are separable after the model shape is
stable, but this slice is small enough to implement sequentially.

## Implementation Strategy

Derive the plan first, wire it into the existing public quote page, then verify
behavior through focused tests, full validation, and browser review.
