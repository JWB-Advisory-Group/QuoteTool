# Implementation Plan: Owner Action Triage

**Branch**: `001-owner-triage` | **Date**: 2026-05-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-owner-triage/spec.md`

## Summary

Add a server-rendered owner action plan to the dashboard. The feature derives
deterministic action recommendations from existing quotes and follow-up rules,
then renders the top actions with reasons and quote-detail CTAs.

## Technical Context

**Language/Version**: TypeScript 5, React 19.2.4, Next.js 16.2.6 App Router

**Primary Dependencies**: Next.js, lucide-react, Tailwind CSS 4, Vitest

**Storage**: Existing quote store abstraction; no schema change

**Testing**: Vitest unit tests plus existing lint/build checks

**Target Platform**: Next.js server-rendered dashboard on local dev and Vercel

**Project Type**: Web application

**Performance Goals**: Dashboard triage calculation completes in memory for the
loaded quote list with no additional network or storage request.

**Constraints**: Keep the dashboard page as a Server Component; do not change
public quote intake; preserve owner auth behavior.

**Scale/Scope**: Single owner/operator queue with dozens to low hundreds of open
quotes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Owner-First Operating Value: PASS. The feature directly answers what Dante
  should do next.
- Margin and Scope Protection: PASS. No price override, send, or approve logic
  changes. Missing-photo actions avoid premature final pricing.
- Production-Safe Data and Auth: PASS. Dashboard-only rendering uses existing
  auth and storage paths.
- Evidence Before Intelligence: PASS. Ranking uses existing quote/follow-up
  signal, not AI or external enrichment.
- Testable, Spec-Driven Delivery: PASS. Spec, plan, tasks, and focused unit
  tests are included.

## Project Structure

### Documentation (this feature)

```text
specs/001-owner-triage/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── owner-action-plan.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
app/
└── dashboard/
    └── page.tsx

lib/
├── dashboard-triage.ts
├── follow-ups.ts
└── types.ts

__tests__/
└── dashboard-triage.test.ts
```

**Structure Decision**: Put ranking logic in `lib/dashboard-triage.ts` so it can
be tested without rendering the dashboard. Keep UI composition in
`app/dashboard/page.tsx`.

## Complexity Tracking

No constitution violations.
