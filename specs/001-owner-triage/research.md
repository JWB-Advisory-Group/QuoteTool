# Research: Owner Action Triage

## Decision: Use deterministic server-side quote ranking

**Rationale**: The dashboard already loads the full store on the server, and the
triage plan depends only on existing quote state, follow-up tasks, photos,
status, expiry, and value. A pure helper keeps the UI light and testable.

**Alternatives considered**: Client-side filtering was rejected because it would
ship unnecessary JavaScript and duplicate server data. Persisting a new action
table was rejected because actions are derived from current quote state.

## Decision: One primary action per quote

**Rationale**: Dante needs a short, ranked plan. Showing multiple actions for the
same quote can crowd out other leads and make the plan feel noisy.

**Alternatives considered**: A full task inbox was rejected for this slice; it
belongs with broader scheduling/follow-up automation.

## Decision: Preserve existing follow-up rules

**Rationale**: `followUpTasksForQuote` already knows when sent, approved, and
deposit quotes need contact. Reusing it avoids a second definition of due work.

**Alternatives considered**: New hard-coded follow-up dates were rejected because
they could drift from cron and quote-detail behavior.
