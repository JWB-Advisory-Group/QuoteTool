import { businessProfile } from "@/lib/business";
import { formatMoney } from "@/lib/format";
import type { Quote } from "@/lib/types";

export type CustomerPlanActionIntent =
  | "photos"
  | "approve"
  | "call"
  | "review"
  | "prep"
  | "deposit";

export type CustomerPlanTone = "green" | "amber" | "red" | "neutral";

export type CustomerPlanAction = {
  label: string;
  href: string;
  intent: CustomerPlanActionIntent;
};

export type CustomerPlanState = {
  label: string;
  detail: string;
  tone: CustomerPlanTone;
};

export type CustomerPlanStep = {
  label: string;
  detail: string;
};

export type CustomerServicePlan = {
  statusLabel: string;
  headline: string;
  summary: string;
  priceConfidence: string;
  photoState: CustomerPlanState;
  depositState: CustomerPlanState;
  primaryAction: CustomerPlanAction;
  secondaryAction: CustomerPlanAction | null;
  timeline: CustomerPlanStep[];
  scopeHighlights: string[];
  prepChecklist: string[];
  trustSignals: string[];
};

export type CustomerServicePlanOptions = {
  surveyRequired: boolean;
  expired: boolean;
};

export function buildCustomerServicePlan(
  quote: Quote,
  options: CustomerServicePlanOptions,
): CustomerServicePlan {
  const hasPhotos = quote.photoAttachments.length > 0;
  const isApproved = isApprovedLike(quote);
  const canApprove =
    quote.status === "sent" && !options.expired && !options.surveyRequired;
  const primaryAction = buildPrimaryAction(quote, options, hasPhotos, isApproved);

  return {
    statusLabel: statusLabel(quote, options, hasPhotos, isApproved),
    headline: headline(quote, options, hasPhotos, isApproved),
    summary: summary(quote, options, hasPhotos, isApproved),
    priceConfidence: priceConfidence(quote, options, hasPhotos),
    photoState: photoState(quote, options, hasPhotos),
    depositState: depositState(quote, options),
    primaryAction,
    secondaryAction: secondaryAction(primaryAction, canApprove, hasPhotos, options),
    timeline: timeline(quote, options, hasPhotos, isApproved),
    scopeHighlights: scopeHighlights(quote),
    prepChecklist: prepChecklist(quote, options, hasPhotos),
    trustSignals: trustSignals(quote),
  };
}

function buildPrimaryAction(
  quote: Quote,
  options: CustomerServicePlanOptions,
  hasPhotos: boolean,
  isApproved: boolean,
): CustomerPlanAction {
  if (options.expired) {
    return {
      label: "Refresh quote",
      href: businessProfile.phoneHref,
      intent: "call",
    };
  }

  if (options.surveyRequired) {
    return {
      label: "Schedule scope review",
      href: businessProfile.phoneHref,
      intent: "call",
    };
  }

  if (quote.approval?.depositRequired && !quote.approval.depositPaid) {
    return {
      label: "Review deposit step",
      href: "#choose-package",
      intent: "deposit",
    };
  }

  if (isApproved) {
    return {
      label: "Review prep list",
      href: "#visit-prep",
      intent: "prep",
    };
  }

  if (!hasPhotos && !quote.finalQuoteAmount) {
    return {
      label: "Upload photos",
      href: "#photos",
      intent: "photos",
    };
  }

  if (quote.status === "sent") {
    return {
      label: "Choose package",
      href: "#choose-package",
      intent: "approve",
    };
  }

  return {
    label: "Review quote details",
    href: "#service-scope",
    intent: "review",
  };
}

function secondaryAction(
  primaryAction: CustomerPlanAction,
  canApprove: boolean,
  hasPhotos: boolean,
  options: CustomerServicePlanOptions,
): CustomerPlanAction | null {
  if (!hasPhotos && primaryAction.intent !== "photos" && !options.surveyRequired) {
    return {
      label: "Add photos",
      href: "#photos",
      intent: "photos",
    };
  }

  if (canApprove && primaryAction.intent !== "approve") {
    return {
      label: "See packages",
      href: "#choose-package",
      intent: "approve",
    };
  }

  if (primaryAction.intent !== "call") {
    return {
      label: "Call Dante",
      href: businessProfile.phoneHref,
      intent: "call",
    };
  }

  return null;
}

function statusLabel(
  quote: Quote,
  options: CustomerServicePlanOptions,
  hasPhotos: boolean,
  isApproved: boolean,
) {
  if (options.expired) return "Quote needs refresh";
  if (options.surveyRequired) return "Scope review first";
  if (quote.approval?.depositRequired && !quote.approval.depositPaid) {
    return "Deposit step open";
  }
  if (isApproved) return "Approved plan";
  if (quote.status === "sent") return "Ready to approve";
  if (!hasPhotos && !quote.finalQuoteAmount) return "Photos can firm this up";
  return "Quote in review";
}

function headline(
  quote: Quote,
  options: CustomerServicePlanOptions,
  hasPhotos: boolean,
  isApproved: boolean,
) {
  if (options.expired) return "Let's refresh this before you book.";
  if (options.surveyRequired) {
    return `${businessProfile.ownerName} will confirm the scope before final booking.`;
  }
  if (quote.approval?.depositRequired && !quote.approval.depositPaid) {
    return "Your spot is close - finish the deposit step to lock it in.";
  }
  if (isApproved) return "You're approved. Here's how to get ready.";
  if (quote.status === "sent") return "Your quote is ready. Here's the visit plan.";
  if (!hasPhotos && !quote.finalQuoteAmount) {
    return "A few photos can turn this into an actual quote.";
  }
  return "Your service plan is taking shape.";
}

function summary(
  quote: Quote,
  options: CustomerServicePlanOptions,
  hasPhotos: boolean,
  isApproved: boolean,
) {
  const serviceName = quote.estimate.serviceBreakdowns[0]?.serviceName ?? "service";
  if (options.expired) {
    return `Pricing windows move with materials and route capacity. ${businessProfile.ownerName} can refresh this ${serviceName.toLowerCase()} quote quickly.`;
  }
  if (options.surveyRequired) {
    return `This project needs a short review so the price, access, and finish details are right before anyone books a crew.`;
  }
  if (quote.approval?.depositRequired && !quote.approval.depositPaid) {
    return `The scope is approved. Once the deposit is handled, ${businessProfile.ownerName} can confirm your route window by text.`;
  }
  if (isApproved) {
    return `The scope is accepted. ${businessProfile.name} will confirm the final schedule and use this checklist to keep the visit smooth.`;
  }
  if (quote.status === "sent") {
    return `Pick the package that fits, choose a few booking windows, and ${businessProfile.ownerName} will confirm the final date by text.`;
  }
  if (!hasPhotos && !quote.finalQuoteAmount) {
    return `Upload 2-4 clear photos if you want ${businessProfile.ownerName} to confirm the number without an extra visit.`;
  }
  return `${businessProfile.ownerName} has enough context to keep moving and will confirm the final details before scheduling.`;
}

function priceConfidence(
  quote: Quote,
  options: CustomerServicePlanOptions,
  hasPhotos: boolean,
) {
  if (options.expired) {
    return "This price window has expired, so Dante should refresh the number before you approve.";
  }
  if (options.surveyRequired) {
    return `${formatMoney(quote.estimate.rangeLow)}-${formatMoney(
      quote.estimate.rangeHigh,
    )} budget range until the scope review confirms the final quote.`;
  }
  if (quote.finalQuoteAmount) {
    return `${formatMoney(quote.finalQuoteAmount)} confirmed for the included scope shown on this page.`;
  }
  if (hasPhotos) {
    return `${formatMoney(quote.estimate.rangeLow)}-${formatMoney(
      quote.estimate.rangeHigh,
    )} photo-supported estimate, with final scope confirmed before scheduling.`;
  }
  return `${formatMoney(quote.estimate.rangeLow)}-${formatMoney(
    quote.estimate.rangeHigh,
  )} estimate. Photos help turn this into an actual quote faster.`;
}

function photoState(
  quote: Quote,
  options: CustomerServicePlanOptions,
  hasPhotos: boolean,
): CustomerPlanState {
  if (hasPhotos) {
    return {
      label: `${quote.photoAttachments.length} photo${
        quote.photoAttachments.length === 1 ? "" : "s"
      } attached`,
      detail: `${businessProfile.ownerName} has visual context for access, surfaces, and the worst areas.`,
      tone: "green",
    };
  }

  if (options.surveyRequired) {
    return {
      label: "Photos optional",
      detail: "Photos help prepare the scope review, but this service may still need a quick walk-through.",
      tone: "amber",
    };
  }

  return {
    label: "Photos not attached yet",
    detail: "Two to four clear shots usually remove the need for a separate estimate visit.",
    tone: "amber",
  };
}

function depositState(
  quote: Quote,
  options: CustomerServicePlanOptions,
): CustomerPlanState {
  if (quote.approval?.depositRequired) {
    return {
      label: quote.approval.depositPaid ? "Deposit paid" : "Deposit pending",
      detail: quote.approval.depositPaid
        ? `${formatMoney(quote.approval.depositAmount)} deposit is recorded.`
        : `${formatMoney(quote.approval.depositAmount)} deposit is needed before the route window is locked.`,
      tone: quote.approval.depositPaid ? "green" : "amber",
    };
  }

  if (options.surveyRequired && quote.estimate.depositRequired) {
    return {
      label: "Deposit after final quote",
      detail: `${formatMoney(quote.estimate.depositAmount)} is expected only after the scope review and approval.`,
      tone: "neutral",
    };
  }

  if (quote.estimate.depositRequired) {
    return {
      label: "Deposit at approval",
      detail:
        "The deposit is shown with the package you choose before you approve.",
      tone: "amber",
    };
  }

  if (
    quote.estimate.packageOptions.some(
      (option) => option.price >= quote.estimate.depositThreshold,
    )
  ) {
    return {
      label: "Deposit may apply",
      detail: `Larger packages may ask for a deposit above ${formatMoney(
        quote.estimate.depositThreshold,
      )}, shown before approval.`,
      tone: "neutral",
    };
  }

  return {
    label: "No deposit expected",
    detail: "This quote does not currently require a deposit to approve.",
    tone: "green",
  };
}

function timeline(
  quote: Quote,
  options: CustomerServicePlanOptions,
  hasPhotos: boolean,
  isApproved: boolean,
): CustomerPlanStep[] {
  if (options.expired) {
    return [
      { label: "Refresh", detail: "Call or text Dante for an updated number." },
      { label: "Review", detail: "Confirm scope, package, and any deposit step." },
      { label: "Book", detail: "Choose windows once the refreshed quote is ready." },
      { label: "Visit", detail: `${quote.estimate.crewBlock} completes the work.` },
    ];
  }

  if (options.surveyRequired) {
    return [
      { label: "Review", detail: "Dante confirms measurements, access, and finish details." },
      { label: "Quote", detail: "You get the actual price after the review." },
      { label: "Book", detail: "Pick a route window after the final quote." },
      { label: "Visit", detail: `${quote.estimate.crewBlock} handles the approved scope.` },
    ];
  }

  if (isApproved) {
    return [
      { label: "Approved", detail: "Your selected scope is accepted." },
      { label: "Confirm", detail: "Final date is confirmed by text." },
      { label: "Prep", detail: "Use the short checklist before arrival." },
      { label: "Visit", detail: `${quote.estimate.crewBlock} completes the work.` },
    ];
  }

  if (!hasPhotos && !quote.finalQuoteAmount) {
    return [
      { label: "Photos", detail: "Add 2-4 clear shots if you want a firmer quote." },
      { label: "Confirm", detail: "Dante checks access, surfaces, and scope." },
      { label: "Choose", detail: "Pick the package and preferred windows." },
      { label: "Book", detail: "Final date is confirmed by text." },
    ];
  }

  return [
    { label: "Choose", detail: "Pick the package that fits the work you want." },
    { label: "Windows", detail: "Select up to three preferred route windows." },
    { label: "Confirm", detail: "Dante confirms the final date by text." },
    { label: "Visit", detail: `${quote.estimate.crewBlock} completes the work.` },
  ];
}

function scopeHighlights(quote: Quote) {
  const serviceLines = quote.estimate.serviceBreakdowns.map((line) => {
    return `${line.serviceName}: ${line.jobSizeLabel} scope`;
  });
  const inclusions = quote.estimate.scopeInclusions.slice(
    0,
    Math.max(0, 5 - serviceLines.length),
  );
  return unique([...serviceLines, ...inclusions]).slice(0, 5);
}

function prepChecklist(
  quote: Quote,
  options: CustomerServicePlanOptions,
  hasPhotos: boolean,
) {
  const checklist: string[] = [];

  if (!hasPhotos && !options.surveyRequired) {
    checklist.push("Upload 2-4 photos of the front, access points, and worst areas.");
  }

  if (quote.riskProfile.waterAccess === "confirmed") {
    checklist.push("Keep outdoor water accessible if this service needs it.");
  } else if (quote.riskProfile.waterAccess === "none") {
    checklist.push("Confirm the water plan with Dante before the visit.");
  } else {
    checklist.push("Confirm whether outdoor water is available.");
  }

  if (quote.riskProfile.access.includes("locked_gate")) {
    checklist.push("Unlock gates or share the gate code before arrival.");
  }
  if (
    quote.riskProfile.access.includes("tight_side_yard") ||
    quote.riskProfile.access.includes("long_hose_pull")
  ) {
    checklist.push("Clear side-yard access for hoses and equipment.");
  }
  if (quote.riskProfile.access.includes("no_driveway")) {
    checklist.push("Share the best parking spot for the crew.");
  }
  if (quote.riskProfile.access.includes("pets")) {
    checklist.push("Keep pets inside or away from the work area.");
  }
  if (quote.riskProfile.access.includes("fragile_surface")) {
    checklist.push("Point out fragile paint, wood, or surfaces before work starts.");
  }
  if (quote.riskProfile.access.includes("heavy_furniture")) {
    checklist.push("Move heavy furniture or flag what should stay in place.");
  }
  if (
    quote.riskProfile.windowDetails.some((detail) =>
      ["inside_outside", "screens", "tracks", "storm_windows"].includes(detail),
    )
  ) {
    checklist.push("Make windows, screens, or tracks accessible where included.");
  }

  checklist.push("Reply with gate, parking, water, or timing notes before booking.");

  return unique(checklist).slice(0, 5);
}

function trustSignals(quote: Quote) {
  return [
    `${businessProfile.name} serves ${businessProfile.serviceArea}.`,
    `${quote.estimate.crewBlock} planned for this scope.`,
    `Best route fit starts ${quote.estimate.earliestAvailability}.`,
    "Scope is confirmed before crew dispatch.",
  ];
}

function isApprovedLike(quote: Quote) {
  return ["approved", "awaiting_deposit", "scheduled", "won"].includes(quote.status);
}

function unique(items: string[]) {
  return [...new Set(items.filter(Boolean))];
}
