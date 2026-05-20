# Implementation Plan: Customer Service Plan

**Branch**: `002-customer-service-plan` | **Date**: 2026-05-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-customer-service-plan/spec.md`

## Summary

Add a derived customer service plan to the public quote page so homeowners
understand the quote state, next action, visit timeline, scope, deposit/photo
needs, and job-day prep without exposing internal pricing language or changing
existing mutations.

## Technical Context

**Language/Version**: TypeScript 5, React 19, Next.js 16 App Router

**Primary Dependencies**: Existing Next app, lucide-react icons, Tailwind CSS 4

**Storage**: Existing quote data only; no storage schema changes

**Testing**: Vitest, Testing Library for existing public quote render coverage

**Target Platform**: Public web quote flow and owner demo/development app

**Project Type**: Web application

**Performance Goals**: Server-rendered derived plan with no new client bundle
boundary; public quote remains responsive on mobile

**Constraints**: Preserve existing approval, deposit, and photo upload behavior;
do not expose internal pricing terms to customers

**Scale/Scope**: One public quote route, one pure derivation helper, focused unit
tests, and browser review

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Owner-First Operating Value**: Pass. The plan reduces customer confusion and
  prevents owner follow-up waste on every public quote.
- **Margin and Scope Protection**: Pass. The feature only presents existing
  price/scope boundaries and explicitly avoids internal pricing terms.
- **Production-Safe Data and Auth**: Pass. No owner-only data is exposed and no
  persistence/auth behavior changes.
- **Evidence Before Intelligence**: Pass. The plan derives from existing quote
  data, not AI inference.
- **Testable, Spec-Driven Delivery**: Pass. This plan defines focused helper and
  render validation.

## Project Structure

### Documentation (this feature)

```text
specs/002-customer-service-plan/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── customer-service-plan.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
app/
└── quote/
    └── [id]/
        └── page.tsx

lib/
└── customer-service-plan.ts

__tests__/
└── customer-service-plan.test.ts
```

**Structure Decision**: Keep derivation in `lib/` for pure tests, then render it
inside the existing server-rendered public quote route.

## Complexity Tracking

No constitution violations. No added persistence, API, or client component is
required.
