import { followUpTasksForQuote, isTaskDue } from "@/lib/follow-ups";
import type { FollowUpTask, Quote } from "@/lib/types";

export type OwnerActionKind =
  | "collect_deposit"
  | "confirm_booking"
  | "follow_up"
  | "price_ready"
  | "closing_window"
  | "request_photos"
  | "review_risk";

export type OwnerActionTone = "green" | "amber" | "blue" | "red" | "neutral";

export type OwnerAction = {
  id: string;
  quoteId: string;
  customerName: string;
  kind: OwnerActionKind;
  title: string;
  reason: string;
  detail: string;
  cta: string;
  href: string;
  callHref: string | null;
  smsHref: string | null;
  mapsHref: string | null;
  stage: string;
  tone: OwnerActionTone;
  value: number;
  dueDate: string | null;
  nextStep: string;
  message: string;
  score: number;
};

type RankedOwnerAction = OwnerAction & {
  sortTime: number;
};

const terminalStatuses = new Set<Quote["status"]>([
  "won",
  "lost",
  "no_response",
]);

export function buildOwnerActionPlan(
  quotes: Quote[],
  today = isoDate(new Date()),
  asOf = new Date(),
): OwnerAction[] {
  return quotes
    .map((quote) => buildOwnerAction(quote, today, asOf))
    .filter((action): action is RankedOwnerAction => action !== null)
    .sort(compareActions);
}

function buildOwnerAction(
  quote: Quote,
  today: string,
  asOf: Date,
): RankedOwnerAction | null {
  if (terminalStatuses.has(quote.status)) return null;

  const href = `/dashboard/quotes/${quote.id}`;
  const value = quote.finalQuoteAmount ?? quote.estimate.recommendedAsk ?? 0;
  const dueTasks = followUpTasksForQuote(quote).filter((task) =>
    isTaskDue(task, today),
  );
  const dueTask = dueTasks[0] ?? null;

  if (quote.status === "awaiting_deposit") {
    return actionForQuote(quote, {
      kind: "collect_deposit",
      title: "Collect deposit hold",
      reason: dueTask?.ownerNote ?? "Deposit is blocking the booking window.",
      detail: depositDetail(quote),
      cta: "Open deposit",
      href,
      stage: "Deposit pending",
      tone: "amber",
      value,
      dueDate: dueTask?.dueDate ?? null,
      nextStep: "Text the deposit reminder or open the quote to mark it paid.",
      message:
        dueTask?.message ??
        "Quick reminder on the deposit hold so we can lock the booking window. Reply here and we will confirm the next step.",
      score: 110,
    });
  }

  if (quote.status === "approved" || quote.status === "scheduled") {
    return actionForQuote(quote, {
      kind: "confirm_booking",
      title: "Confirm booking details",
      reason:
        dueTask?.ownerNote ??
        "Approved work needs route, access, and customer readiness confirmed.",
      detail: `${quote.estimate.crewBlock} · ${quote.estimate.earliestAvailability}`,
      cta: "Confirm booking",
      href,
      stage: quote.status === "scheduled" ? "Scheduled" : "Approved",
      tone: "green",
      value,
      dueDate: dueTask?.dueDate ?? null,
      nextStep: "Text the booking confirmation and check route details.",
      message:
        dueTask?.message ??
        "We are confirming the route window. Please make sure water access, gates, and parking are ready.",
      score: 105,
    });
  }

  if (dueTask) {
    return actionForQuote(quote, {
      kind: "follow_up",
      title: dueTask.label,
      reason: dueTask.ownerNote,
      detail: followUpDetail(dueTask, quote),
      cta: "Send follow-up",
      href,
      stage: quote.status === "sent" ? "Quote sent" : quote.estimate.followUpStage,
      tone: "blue",
      value,
      dueDate: dueTask.dueDate,
      nextStep:
        dueTask.channel === "call"
          ? "Call first, then log the follow-up from the quote page."
          : "Send the saved follow-up text, then log it from the quote page.",
      message: dueTask.message,
      score: 95,
    });
  }

  if (quote.status === "sent") {
    const expiresIn = hoursUntilExpiry(quote, asOf);
    if (expiresIn !== null && expiresIn <= 0) {
      return actionForQuote(quote, {
        kind: "review_risk",
        title: "Review expired quote",
        reason: "The quote window has lapsed; confirm scope before re-sending.",
        detail: "Price window expired",
        cta: "Review quote",
        href,
        stage: "Expired",
        tone: "red",
        value,
        dueDate: quote.expiresAt ? isoDate(new Date(quote.expiresAt)) : null,
        nextStep: "Review scope before reviving or re-sending this quote.",
        message:
          "The original quote window expired, but I can review the scope and confirm whether the same package still works.",
        score: 86,
      });
    }

    if (expiresIn !== null && expiresIn <= 72) {
      return actionForQuote(quote, {
        kind: "closing_window",
        title: "Close before price expires",
        reason: "The customer still has an active quote, but the price window is tight.",
        detail: `Expires in ${Math.round(expiresIn)}h`,
        cta: "Follow up",
        href,
        stage: "Closing window",
        tone: "amber",
        value,
        dueDate: quote.expiresAt ? isoDate(new Date(quote.expiresAt)) : null,
        nextStep: "Text a closing touch before the price window lapses.",
        message:
          "Last check before we release the tentative route window. Happy to adjust the scope if you want a smaller or bigger package.",
        score: 88,
      });
    }

    return null;
  }

  if (isOpenIntakeQuote(quote) && quote.photoAttachments.length > 0) {
    return actionForQuote(quote, {
      kind: "price_ready",
      title: "Price and send quote",
      reason: appendRiskNote(
        "Photos are in, so scope can be reviewed without guessing.",
        quote,
      ),
      detail: `${quote.photoAttachments.length} photos · ${quote.estimate.closeProbability}% close`,
      cta: "Price quote",
      href,
      stage: "Ready to quote",
      tone: "green",
      value,
      dueDate: quote.estimate.nextFollowUpDate,
      nextStep: "Open the quote, review photos, and send the package options.",
      message:
        "Thanks for sending the photos. I am reviewing the scope now and will send the package options shortly.",
      score: 80,
    });
  }

  if (isOpenIntakeQuote(quote)) {
    return actionForQuote(quote, {
      kind: "request_photos",
      title: "Request job photos",
      reason: appendRiskNote(
        "The quote is waiting on photos before Dante sends a final price.",
        quote,
      ),
      detail: `${quote.estimate.leadQuality} lead · ${quote.estimate.closeProbability}% close`,
      cta: "Request photos",
      href,
      stage: "Needs photos",
      tone: "neutral",
      value,
      dueDate: quote.estimate.nextFollowUpDate,
      nextStep: "Text for 2-4 clear photos before locking a final number.",
      message:
        "Can you send 2-4 clear photos of the front, sides, back, and worst areas? That lets us confirm the actual quote without a site visit.",
      score: 65,
    });
  }

  return null;
}

function actionForQuote(
  quote: Quote,
  action: Omit<
    OwnerAction,
    "id" | "quoteId" | "customerName" | "callHref" | "smsHref" | "mapsHref"
  >,
): RankedOwnerAction {
  return {
    ...action,
    id: `${quote.id}:${action.kind}`,
    quoteId: quote.id,
    customerName: quote.customerName,
    callHref: phoneHref(quote.customerPhone),
    smsHref: smsHref(quote.customerPhone, action.message),
    mapsHref: mapsHref(quote),
    sortTime: new Date(quote.updatedAt || quote.createdAt).getTime(),
  };
}

function compareActions(a: RankedOwnerAction, b: RankedOwnerAction) {
  const scoreDelta = b.score - a.score;
  if (scoreDelta !== 0) return scoreDelta;
  const valueDelta = b.value - a.value;
  if (valueDelta !== 0) return valueDelta;
  const timeDelta = b.sortTime - a.sortTime;
  if (timeDelta !== 0) return timeDelta;
  return a.id.localeCompare(b.id);
}

function isOpenIntakeQuote(quote: Quote) {
  return quote.status === "pending" || quote.status === "contacted";
}

function depositDetail(quote: Quote) {
  if (!quote.approval?.depositRequired) return "Booking approved";
  return quote.approval.depositPaid
    ? "Deposit marked paid"
    : `$${quote.approval.depositAmount} deposit hold`;
}

function followUpDetail(task: FollowUpTask, quote: Quote) {
  const channel = task.channel === "sms" ? "text" : task.channel;
  return `${channel} due ${task.dueDate} · ${quote.estimate.closeProbability}% close`;
}

function appendRiskNote(reason: string, quote: Quote) {
  const duplicateNote = quote.duplicateContext?.ownerNote;
  if (!duplicateNote) return reason;
  return `${reason} ${duplicateNote}`;
}

function hoursUntilExpiry(quote: Quote, asOf: Date) {
  if (!quote.expiresAt) return null;
  return (new Date(quote.expiresAt).getTime() - asOf.getTime()) / 1000 / 60 / 60;
}

function phoneHref(phone: string) {
  const normalized = normalizedPhone(phone);
  return normalized ? `tel:+${normalized}` : null;
}

function smsHref(phone: string, message: string) {
  const normalized = normalizedPhone(phone);
  if (!normalized) return null;
  return `sms:+${normalized}?&body=${encodeURIComponent(message)}`;
}

function normalizedPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  return digits.length === 10 ? `1${digits}` : digits;
}

function mapsHref(quote: Quote) {
  const parts = [
    quote.addressStreet,
    quote.addressCity,
    quote.addressZip,
  ].filter(Boolean);
  if (parts.length === 0) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    parts.join(", "),
  )}`;
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}
