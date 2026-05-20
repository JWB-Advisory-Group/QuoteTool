# Contract: Customer Service Plan

The public quote route expects a pure customer service plan object derived from
an existing quote.

```ts
type CustomerPlanAction = {
  label: string;
  href: string;
  intent: "photos" | "approve" | "call" | "review" | "prep" | "deposit";
};

type CustomerServicePlan = {
  statusLabel: string;
  headline: string;
  summary: string;
  priceConfidence: string;
  photoState: { label: string; detail: string; tone: "green" | "amber" | "red" | "neutral" };
  depositState: { label: string; detail: string; tone: "green" | "amber" | "red" | "neutral" };
  primaryAction: CustomerPlanAction;
  secondaryAction: CustomerPlanAction | null;
  timeline: { label: string; detail: string }[];
  scopeHighlights: string[];
  prepChecklist: string[];
  trustSignals: string[];
};
```

Rules:

- Plan generation must be deterministic for the same quote/options.
- Plan generation must not mutate the quote.
- Customer-facing strings must not include `protected floor`, gross margin, close
  probability, or owner-only action language.
- `primaryAction.href` may point to existing in-page anchors such as `#photos`
  and `#choose-package`, or to the business phone link for review/refresh states.
