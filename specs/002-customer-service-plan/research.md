# Research: Customer Service Plan

## Decision: Derive the plan from existing quote data

**Rationale**: The fastest useful version turns already-known data into a better
customer explanation. This follows implementation preservation by avoiding new
storage, approval behavior, and scheduling contracts.

**Alternatives considered**: Add editable plan fields per quote. Rejected for
this slice because it adds owner workload before proving the presentation value.

## Decision: Make the primary action state-driven

**Rationale**: The quote page should reduce noise. Missing photos, expired
quotes, survey-required work, sent quotes, and approved quotes each need a
different customer instruction.

**Alternatives considered**: Always send customers to the package chooser.
Rejected because it fails for photos, surveys, expired quotes, and approved
jobs.

## Decision: Keep copy customer-readable and omit internal operating metrics

**Rationale**: Margin, protected floors, close probability, and owner review
language belong to dashboard tools. The public quote should explain confidence,
scope, prep, deposit, and scheduling in normal homeowner terms.

**Alternatives considered**: Reuse owner job brief copy. Rejected because it is
crew/owner-oriented and exposes operational terms that can reduce trust.

## Method Choices Applied

- **First principles**: A great trade quote must answer price, scope, next step,
  schedule path, and job-day prep.
- **Working backwards**: The customer outcome is "I know exactly what happens
  next and why this company feels organized."
- **Inversion**: Prevent surprise costs, stale pricing, missing photos, locked
  gates, unclear water access, and uncertain deposits.
- **Toyota/Ohno**: Remove follow-up waste by putting the most common questions
  directly on the quote.
- **Shannon**: Compress the page around one primary action and a short timeline.
- **Implementation preservation**: Leave working mutations untouched.
