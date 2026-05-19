# Tasks: Owner Action Triage

**Input**: Design documents from `/specs/001-owner-triage/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Focused unit tests are required by the specification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish Spec Kit context and dashboard touch points

- [x] T001 Initialize Spec Kit Codex integration in `.specify/` and `.agents/skills/`
- [x] T002 Write QuoteTool constitution in `.specify/memory/constitution.md`
- [x] T003 Create feature artifacts under `specs/001-owner-triage/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Extract testable ranking logic before UI wiring

- [x] T004 Add triage unit tests for ranking and clean queues in `__tests__/dashboard-triage.test.ts`
- [x] T005 Implement `buildOwnerActionPlan` and owner action types in `lib/dashboard-triage.ts`

**Checkpoint**: Ranking logic can be tested without rendering the dashboard.

---

## Phase 3: User Story 1 - Work the Next Dollar (Priority: P1) MVP

**Goal**: Show Dante the highest-value owner action immediately.

**Independent Test**: A mixed quote queue ranks deposit/booking and due follow-up actions before lower-value work.

### Tests for User Story 1

- [x] T006 [US1] Verify deposit and due follow-up ordering in `__tests__/dashboard-triage.test.ts`

### Implementation for User Story 1

- [x] T007 [US1] Import triage output and compute the next owner action in `app/dashboard/page.tsx`
- [x] T008 [US1] Update the top dashboard CTA to link to the highest-priority action in `app/dashboard/page.tsx`

**Checkpoint**: Dante can open the dashboard and jump to the top recommended quote.

---

## Phase 4: User Story 2 - Understand Why It Matters (Priority: P2)

**Goal**: Render a ranked action plan with reasons, values, stages, and CTAs.

**Independent Test**: Each action type includes an owner-readable reason and a quote-detail link.

### Tests for User Story 2

- [x] T009 [US2] Verify ready-to-price and request-photo action payloads in `__tests__/dashboard-triage.test.ts`

### Implementation for User Story 2

- [x] T010 [US2] Add `OwnerActionPlan` and `OwnerActionCard` UI components in `app/dashboard/page.tsx`
- [x] T011 [US2] Replace the old "Chase today" card with the new action plan in `app/dashboard/page.tsx`

**Checkpoint**: The dashboard explains why each recommended quote is next.

---

## Phase 5: User Story 3 - Stay Useful When the Queue Is Clean (Priority: P3)

**Goal**: Render a clean-queue state when there is no actionable quote.

**Independent Test**: Terminal quotes produce no owner actions and the dashboard still renders a calm empty state.

### Tests for User Story 3

- [x] T012 [US3] Verify terminal quotes produce no actions in `__tests__/dashboard-triage.test.ts`

### Implementation for User Story 3

- [x] T013 [US3] Add owner action plan empty state in `app/dashboard/page.tsx`

**Checkpoint**: Clean queues remain understandable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validate and document the completed slice

- [x] T014 Mark completed task checkboxes in `specs/001-owner-triage/tasks.md`
- [x] T015 Run `pnpm test __tests__/dashboard-triage.test.ts`
- [x] T016 Run `pnpm test`
- [x] T017 Run `pnpm lint`
- [x] T018 Run `pnpm build`

---

## Phase 7: Quick Action Controls (Continuation)

**Purpose**: Make action cards usable without opening the quote first

- [x] T019 [US1] Add direct call, text, and map payload fields in `lib/dashboard-triage.ts`
- [x] T020 [US1] Add suggested owner message copy and next-step text in `lib/dashboard-triage.ts`
- [x] T021 [US2] Cover quick-action links and message copy in `__tests__/dashboard-triage.test.ts`
- [x] T022 [US2] Replace full-card links with action controls in `app/dashboard/page.tsx`
- [x] T023 Run `pnpm test __tests__/dashboard-triage.test.ts`
- [x] T024 Run `pnpm lint`
- [x] T025 Run `pnpm build`

---

## Phase 8: Crew-Ready Job Brief (Continuation)

**Purpose**: Make each quote detail page useful before pricing, scheduling, or dispatch

- [x] T026 Add derived job brief model in `lib/job-brief.ts`
- [x] T027 Cover missing-photo, deposit, risk, and contact-link cases in `__tests__/job-brief.test.ts`
- [x] T028 Render job brief panel on quote detail pages in `app/dashboard/quotes/[id]/page.tsx`
- [x] T029 Move job brief above long detail sections on mobile in `app/dashboard/quotes/[id]/page.tsx`
- [x] T030 Run `pnpm test __tests__/job-brief.test.ts`
- [x] T031 Run `pnpm test`
- [x] T032 Run `pnpm lint`
- [x] T033 Run `pnpm build`

---

## Dependencies & Execution Order

T004 must precede T005. T005 must precede dashboard UI work. User Story 1 is the
MVP and should land before User Stories 2 and 3. Validation tasks run last.

## Parallel Opportunities

After T005, dashboard CTA wiring and action-card rendering can be reviewed
together because they remain in the same file but touch separate component
sections. Validation commands can run independently after implementation.

## Implementation Strategy

Deliver the pure ranking helper first, then add the server-rendered UI panel,
then validate the whole dashboard with tests, lint, and build.
