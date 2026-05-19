<!--
Sync Impact Report
Version change: none -> 1.0.0
Modified principles: template placeholders -> QuoteTool operating principles
Added sections: Delivery Constraints; Development Workflow
Removed sections: placeholder Section 2/3 names
Templates requiring updates: .specify/templates/plan-template.md (reviewed), .specify/templates/spec-template.md (reviewed), .specify/templates/tasks-template.md (reviewed)
Follow-up TODOs: none
-->

# QuoteTool Constitution

## Core Principles

### I. Owner-First Operating Value
Every feature MUST help Dante quote, chase, book, schedule, or learn from real
631 Solutions jobs faster. Dashboards MUST surface the next owner action, the
reason it matters, and the quote or customer record needed to act. Cosmetic or
internal improvements are allowed only when they protect those owner workflows.

### II. Margin and Scope Protection
The app MUST never make it easier to send, approve, or recommend work below the
protected floor. Public customer copy MUST avoid internal pricing language while
still preserving clear inclusions, exclusions, deposits, photo needs, and review
states. Any override path MUST capture a reason that is useful for later audit.

### III. Production-Safe Data and Auth
Owner-only actions MUST stay authenticated in production, and production storage
MUST be durable before live traffic is trusted. File-backed local storage may be
used for development and demos, but production-facing features MUST keep
Supabase, notification, cron, Stripe, and environment readiness visible when
they affect customer or owner outcomes.

### IV. Evidence Before Intelligence
AI, enrichment, automation, and calibration features MUST be gated by real
operating signal: quotes, explicit outcomes, actuals, truth-gate results, and
documented owner feedback. The app MUST not imply accuracy from unverified
property data, weak coverage, or model-generated guesswork.

### V. Testable, Spec-Driven Delivery
Behavioral changes MUST start from a Spec Kit artifact or an explicit bug report
and MUST include focused verification proportional to risk. Pricing, auth,
mutation, and owner-decision logic require automated tests. UI-only changes
still require at least lint/build validation and, when practical, browser review.

## Delivery Constraints

The project uses Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4,
Vitest, local JSON storage for development, and Supabase for durable production
storage. Before editing Next.js routes, pages, layouts, server components, route
handlers, or config, agents MUST read the relevant local guide under
`node_modules/next/dist/docs/` and heed deprecation notices in `AGENTS.md`.

Customer-facing flows MUST stay fast and homeowner-readable. Owner-facing flows
MUST stay dense, scannable, and action-oriented. No feature may add demographic
fields or hidden customer profiling. Notification fallbacks, temporary storage,
and missing production credentials MUST remain visible to the owner.

## Development Workflow

Feature work follows Specify's sequence: constitution, specification, plan,
tasks, implementation, and validation. Each feature spec MUST define user
stories, success criteria, assumptions, and edge cases. Each plan MUST list the
real app paths affected and run a constitution check. Each task list MUST keep
work independently testable by user story.

Recommended validation for code changes is `pnpm test`, `pnpm lint`, and
`pnpm build`. Pricing or intake changes SHOULD also run the truth gate when
address, parcel, sizing, or enrichment assumptions change.

## Governance

This constitution supersedes ad hoc project preferences for QuoteTool work.
Amendments require an updated constitution file with a Sync Impact Report,
semantic version bump, and any needed template or documentation changes.
Compliance is checked during Spec Kit planning and again before implementation
is considered complete.

Versioning follows semantic rules: MAJOR for principle redefinitions or removed
constraints, MINOR for new principles or materially expanded governance, and
PATCH for clarifications. Any violation MUST be documented in the implementation
plan with the reason, simpler alternative, and validation strategy.

**Version**: 1.0.0 | **Ratified**: 2026-05-19 | **Last Amended**: 2026-05-19
