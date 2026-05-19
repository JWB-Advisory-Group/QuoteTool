import type { Quote } from "@/lib/types";

export type JobBriefTone = "green" | "amber" | "red" | "neutral";

export type JobBriefCheck = {
  label: string;
  value: string;
  tone: JobBriefTone;
};

export type JobBrief = {
  headline: string;
  subhead: string;
  tone: JobBriefTone;
  callHref: string | null;
  smsHref: string | null;
  mapsHref: string | null;
  publicQuoteHref: string;
  checks: JobBriefCheck[];
  crewPlan: string[];
  riskFlags: string[];
  dayOfChecklist: string[];
};

const accessLabels: Record<string, string> = {
  tight_side_yard: "Tight side-yard access",
  locked_gate: "Locked gate",
  long_hose_pull: "Long hose pull",
  no_driveway: "No driveway or parking",
  no_spigot: "No outdoor spigot",
  ladder_work: "Ladder-heavy work",
  steep_property: "Steep property",
  pool_equipment: "Protect pool equipment",
  pets: "Pets on site",
  fragile_surface: "Fragile surface",
  gutter_guards: "Gutter guards",
  heavy_furniture: "Heavy furniture",
};

const windowLabels: Record<string, string> = {
  exterior_only: "Exterior windows only",
  inside_outside: "Inside and outside windows",
  screens: "Screens",
  tracks: "Tracks",
  storm_windows: "Storm windows",
  french_panes: "French panes",
  hard_water: "Hard water panes",
  ladder_windows: "Ladder windows",
};

export function buildJobBrief(quote: Quote): JobBrief {
  const riskFlags = buildRiskFlags(quote);
  const checks = buildChecks(quote);
  const tone = checks.some((check) => check.tone === "red")
    ? "red"
    : checks.some((check) => check.tone === "amber") || riskFlags.length > 0
      ? "amber"
      : "green";

  return {
    headline: briefHeadline(quote),
    subhead: briefSubhead(quote),
    tone,
    callHref: phoneHref(quote.customerPhone),
    smsHref: smsHref(quote),
    mapsHref: mapsHref(quote),
    publicQuoteHref: `/quote/${quote.id}`,
    checks,
    crewPlan: buildCrewPlan(quote),
    riskFlags,
    dayOfChecklist: buildDayOfChecklist(quote, riskFlags),
  };
}

function briefHeadline(quote: Quote) {
  if (quote.status === "awaiting_deposit") return "Deposit is blocking booking";
  if (quote.status === "approved") return "Approved - confirm before scheduling";
  if (quote.status === "scheduled") return "Crew-ready job brief";
  if (quote.status === "sent") return "Quote sent - chase the decision";
  if (quote.status === "pending" || quote.status === "contacted") {
    return quote.photoAttachments.length > 0
      ? "Ready to review and price"
      : "Needs photos before final price";
  }
  if (quote.status === "won") return "Won - log actuals";
  if (quote.status === "lost") return "Lost - keep reason clean";
  return "No-response lead";
}

function briefSubhead(quote: Quote) {
  return `${quote.estimate.routeZone} · ${quote.estimate.crewBlock} · ${quote.estimate.closeProbability}% close`;
}

function buildChecks(quote: Quote): JobBriefCheck[] {
  return [
    {
      label: "Photos",
      value:
        quote.photoAttachments.length > 0
          ? `${quote.photoAttachments.length} attached`
          : "Needed before final price",
      tone: quote.photoAttachments.length > 0 ? "green" : "amber",
    },
    {
      label: "Deposit",
      value: depositState(quote),
      tone: depositTone(quote),
    },
    {
      label: "Water",
      value: waterState(quote.riskProfile.waterAccess),
      tone:
        quote.riskProfile.waterAccess === "confirmed"
          ? "green"
          : quote.riskProfile.waterAccess === "none"
            ? "red"
            : "amber",
    },
    {
      label: "Scope",
      value:
        quote.estimate.manualReviewReasons.length > 0
          ? `${quote.estimate.manualReviewReasons.length} review flag${quote.estimate.manualReviewReasons.length === 1 ? "" : "s"}`
          : "No manual flags",
      tone: quote.estimate.manualReviewReasons.length > 0 ? "amber" : "green",
    },
    {
      label: "Margin",
      value: `${quote.estimate.profitability.grossMarginPct}% gross`,
      tone:
        quote.estimate.profitability.grossMarginPct >= 45
          ? "green"
          : quote.estimate.profitability.grossMarginPct >= 35
            ? "amber"
            : "red",
    },
  ];
}

function buildCrewPlan(quote: Quote) {
  return [
    `${quote.estimate.crewBlock} for ${quote.estimate.laborHours} estimated labor hours.`,
    `${quote.estimate.estimatedDriveMinutes} min drive/setup reserve in ${quote.estimate.routeZone}.`,
    `${quote.estimate.serviceBreakdowns.length} service line${quote.estimate.serviceBreakdowns.length === 1 ? "" : "s"}: ${quote.estimate.serviceBreakdowns.map((line) => line.serviceName).join(", ")}.`,
    quote.estimate.depositRequired
      ? `Deposit threshold hit: $${quote.estimate.depositAmount} hold expected.`
      : "No deposit required by current rules.",
  ];
}

function buildRiskFlags(quote: Quote) {
  const flags: string[] = [];

  if (quote.riskProfile.surfaceCondition !== "moderate") {
    flags.push(`Surface condition: ${quote.riskProfile.surfaceCondition.replaceAll("_", " ")}`);
  }
  if (quote.riskProfile.roofPitch === "steep" || quote.riskProfile.roofPitch === "very_steep") {
    flags.push(`Roof pitch: ${quote.riskProfile.roofPitch.replaceAll("_", " ")}`);
  }
  if (quote.riskProfile.roofWalkable === "no") {
    flags.push("Roof not walkable");
  }
  if (quote.riskProfile.waterAccess !== "confirmed") {
    flags.push(waterState(quote.riskProfile.waterAccess));
  }

  flags.push(
    ...quote.riskProfile.access.map((item) => accessLabels[item] ?? item),
    ...quote.riskProfile.windowDetails
      .filter((item) => item !== "exterior_only")
      .map((item) => windowLabels[item] ?? item),
    ...quote.estimate.manualReviewReasons,
    ...quote.estimate.addressValidation.warnings,
  );

  return [...new Set(flags)].slice(0, 10);
}

function buildDayOfChecklist(quote: Quote, riskFlags: string[]) {
  const checklist = [
    "Confirm water access, gate/parking, pets, and fragile areas before arrival.",
    "Take before photos before moving hoses or equipment.",
    "Review included and excluded scope with the customer before starting.",
    "Log hours, crew count, materials, added revenue, and reason codes before closing the job.",
  ];

  if (quote.photoAttachments.length === 0) {
    checklist.unshift("Get photos before promising this as a final number.");
  }
  if (quote.estimate.scopeExclusions.length > 0) {
    checklist.push(`Do not include: ${quote.estimate.scopeExclusions.slice(0, 3).join(", ")}.`);
  }
  if (riskFlags.length > 0) {
    checklist.push(`Watch: ${riskFlags.slice(0, 3).join(", ")}.`);
  }

  return checklist;
}

function depositState(quote: Quote) {
  if (quote.approval?.depositRequired) {
    return quote.approval.depositPaid
      ? "Paid"
      : `$${quote.approval.depositAmount} pending`;
  }
  if (quote.estimate.depositRequired) return `$${quote.estimate.depositAmount} expected`;
  return "Not required";
}

function depositTone(quote: Quote): JobBriefTone {
  if (quote.approval?.depositRequired && !quote.approval.depositPaid) return "amber";
  return "green";
}

function waterState(value: Quote["riskProfile"]["waterAccess"]) {
  if (value === "confirmed") return "Confirmed";
  if (value === "none") return "No outdoor water";
  return "Not sure";
}

function phoneHref(phone: string) {
  const normalized = normalizedPhone(phone);
  return normalized ? `tel:+${normalized}` : null;
}

function smsHref(quote: Quote) {
  const normalized = normalizedPhone(quote.customerPhone);
  if (!normalized) return null;
  const body = `Hey ${quote.customerName.split(" ")[0] || "there"}, this is 631 Solutions. I am reviewing your ${quote.estimate.serviceBreakdowns[0]?.serviceName ?? "quote"} and want to confirm the access/photos before locking the final number.`;
  return `sms:+${normalized}?&body=${encodeURIComponent(body)}`;
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
