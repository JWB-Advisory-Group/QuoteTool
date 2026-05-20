import { roundToFive } from "@/lib/format";
import { serviceUnitCount } from "@/lib/pricing-config";
import type {
  AppStore,
  CompetitorPrice,
  EstimateConfidence,
  JobActuals,
  Outcome,
  PricingSignals,
  Quote,
  QuoteServiceLine,
} from "@/lib/types";

const HISTORY_MIN_SAMPLE = 3;
const HISTORY_MAX_SAMPLE = 20;
const COST_FRESH_DAYS = 30;
const MARKET_FRESH_DAYS = 75;

const MATERIAL_MULTIPLIER: Record<string, number> = {
  less: 0.75,
  normal: 1,
  more: 1.3,
};

type HistoricalVarianceProfile = PricingSignals["historicalVariance"] & {
  reserveMultiplier: number;
  reviewReasons: string[];
};

type PrecisionContext = {
  confidence: EstimateConfidence;
  currentInputs: PricingSignals["currentInputs"];
  historicalVariance: HistoricalVarianceProfile;
  customerPricingNote: string;
  ownerReviewReasons: string[];
};

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundPct(value: number) {
  return Number(value.toFixed(3));
}

function daysOld(iso: string, now: Date) {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.max(
    0,
    Math.round((now.getTime() - parsed.getTime()) / (1000 * 60 * 60 * 24)),
  );
}

function selectedCostInputs(
  store: AppStore,
  serviceLines: QuoteServiceLine[],
) {
  const slugs = new Set(serviceLines.map((line) => line.serviceSlug));
  return store.costInputs.filter((input) => slugs.has(input.serviceSlug));
}

function currentInputProfile(
  store: AppStore,
  serviceLines: QuoteServiceLine[],
  marketRows: CompetitorPrice[],
  now: Date,
): PricingSignals["currentInputs"] {
  const costInputs = selectedCostInputs(store, serviceLines);
  const costAges = costInputs
    .map((input) => daysOld(input.updatedAt, now))
    .filter((age): age is number => age !== null);
  const marketAges = marketRows
    .map((row) => daysOld(row.observedDate, now))
    .filter((age): age is number => age !== null);

  return {
    services: Array.from(new Set(serviceLines.map((line) => line.serviceSlug))),
    sourceMix: Array.from(new Set(costInputs.map((input) => input.source))),
    costInputAgeDays: costAges.length > 0 ? Math.max(...costAges) : null,
    marketDataAgeDays: marketAges.length > 0 ? Math.max(...marketAges) : null,
    marketSampleSize: marketRows.length,
  };
}

function matchingHistoryRows(
  store: AppStore,
  serviceLines: QuoteServiceLine[],
) {
  const serviceSlugs = new Set(serviceLines.map((line) => line.serviceSlug));
  const rows: { quote: Quote; outcome: Outcome; actuals: JobActuals }[] = [];

  for (const outcome of store.outcomes) {
    if (outcome.outcome !== "won" || !outcome.actuals?.hours) continue;
    const quote = store.quotes.find((item) => item.id === outcome.quoteId);
    if (!quote) continue;
    const quoteSlugs =
      quote.serviceLines.length > 0
        ? quote.serviceLines.map((line) => line.serviceSlug)
        : [quote.serviceSlug];
    if (!quoteSlugs.some((slug) => serviceSlugs.has(slug))) continue;
    rows.push({ quote, outcome, actuals: outcome.actuals });
  }

  rows.sort(
    (a, b) =>
      new Date(b.outcome.createdAt).getTime() -
      new Date(a.outcome.createdAt).getTime(),
  );
  return rows.slice(0, HISTORY_MAX_SAMPLE);
}

function estimatedLaborHoursFor(quote: Quote, serviceSlugs: Set<string>) {
  const matchingBreakdowns = quote.estimate.serviceBreakdowns.filter((line) =>
    serviceSlugs.has(line.serviceSlug),
  );
  const breakdownHours = matchingBreakdowns.reduce(
    (sum, line) => sum + line.laborHours,
    0,
  );
  return breakdownHours > 0 ? breakdownHours : quote.estimate.laborHours;
}

function actualLaborHours(actuals: JobActuals) {
  if (!actuals.hours) return null;
  return actuals.hours * (actuals.crewCount ?? 1);
}

function estimatedActualCost(
  store: AppStore,
  quote: Quote,
  actuals: JobActuals,
) {
  const laborHours = actualLaborHours(actuals);
  if (!laborHours) return null;

  const serviceLine = quote.serviceLines[0] ?? {
    serviceSlug: quote.serviceSlug,
    jobSize: quote.jobSize,
    jobSizeLabel: quote.jobSizeLabel,
  };
  const service = store.services.find((item) => item.slug === serviceLine.serviceSlug);
  const cost = store.costInputs.find((item) => item.serviceSlug === serviceLine.serviceSlug);
  if (!service || !cost) return null;

  const units = serviceUnitCount(service, serviceLine.jobSize);
  const materialMultiplier =
    actuals.materialUsage ? MATERIAL_MULTIPLIER[actuals.materialUsage] ?? 1 : 1;
  const labor = laborHours * cost.hourlyLaborRate;
  const materials = units * cost.materialCostPerUnit * materialMultiplier;
  const equipment = laborHours * cost.equipmentWearPerHour;
  const drive =
    ((quote.estimate.driveReserveMinutes ?? cost.driveReserveMinutes) / 60) *
    cost.hourlyLaborRate;

  return {
    cost: (labor + materials + equipment + drive) * (1 + cost.overheadPct),
    minMarginPct: cost.minMarginPct,
  };
}

function historicalVarianceProfile(
  store: AppStore,
  serviceLines: QuoteServiceLine[],
): HistoricalVarianceProfile {
  const serviceSlugs = new Set(serviceLines.map((line) => line.serviceSlug));
  const rows = matchingHistoryRows(store, serviceLines);
  const laborRatios: number[] = [];
  const revenueVariances: number[] = [];
  let underpricedJobs = 0;

  for (const row of rows) {
    const actualLabor = actualLaborHours(row.actuals);
    const estimatedLabor = estimatedLaborHoursFor(row.quote, serviceSlugs);
    if (actualLabor && estimatedLabor > 0) {
      laborRatios.push(actualLabor / estimatedLabor);
    }

    const recommended = row.quote.estimate.recommendedAsk;
    const revenue =
      (row.outcome.amount ?? row.quote.finalQuoteAmount ?? recommended) +
      (row.actuals.addedRevenue ?? 0);
    if (recommended > 0 && revenue > 0) {
      revenueVariances.push((revenue - recommended) / recommended);
    }

    const actualCost = estimatedActualCost(store, row.quote, row.actuals);
    const margin =
      actualCost && revenue > 0 ? (revenue - actualCost.cost) / revenue : null;
    if (
      row.actuals.reasonCodes.includes("priced_too_low") ||
      (margin !== null && margin < actualCost!.minMarginPct)
    ) {
      underpricedJobs += 1;
    }
  }

  const sampleSize = rows.length;
  const medianLaborRatio = median(laborRatios);
  const underpricedShare =
    sampleSize > 0 ? Number((underpricedJobs / sampleSize).toFixed(2)) : 0;
  const revenueVarianceAvg = average(revenueVariances);
  const laborPressure =
    sampleSize >= HISTORY_MIN_SAMPLE && medianLaborRatio !== null
      ? Math.max(0, Math.min(0.16, (medianLaborRatio - 1) * 0.45))
      : 0;
  const underpricePressure =
    sampleSize >= HISTORY_MIN_SAMPLE
      ? underpricedShare >= 0.5
        ? 0.06
        : underpricedShare >= 0.25
          ? 0.03
          : 0
      : 0;
  const materialPressure =
    sampleSize >= HISTORY_MIN_SAMPLE &&
    rows.filter((row) => row.actuals.materialUsage === "more").length / sampleSize >=
      0.4
      ? 0.03
      : 0;
  const costReservePct = roundPct(
    laborPressure + underpricePressure + materialPressure,
  );

  const reviewReasons: string[] = [];
  if (costReservePct >= 0.06) {
    reviewReasons.push(
      "Recent completed jobs are running above the estimate; review before discounting.",
    );
  }
  if (medianLaborRatio !== null && medianLaborRatio >= 1.2) {
    reviewReasons.push(
      `Recent actual labor is ${Math.round((medianLaborRatio - 1) * 100)}% higher than estimated for this service.`,
    );
  }

  const ownerNote =
    sampleSize < HISTORY_MIN_SAMPLE
      ? `Need ${HISTORY_MIN_SAMPLE - sampleSize} more completed job${
          HISTORY_MIN_SAMPLE - sampleSize === 1 ? "" : "s"
        } with actuals before variance regression can reserve price.`
      : costReservePct > 0
        ? `Historical variance added a ${Math.round(costReservePct * 100)}% reserve to protect margin.`
        : "Recent actuals are inside tolerance; no historical reserve needed.";

  return {
    sampleSize,
    medianLaborRatio:
      medianLaborRatio === null ? null : Number(medianLaborRatio.toFixed(2)),
    underpricedShare,
    revenueVariancePct:
      revenueVarianceAvg === null
        ? null
        : Number((revenueVarianceAvg * 100).toFixed(1)),
    costReservePct,
    reserveMultiplier: 1 + costReservePct,
    ownerNote,
    reviewReasons,
  };
}

function confidenceFor(
  currentInputs: PricingSignals["currentInputs"],
  history: HistoricalVarianceProfile,
): EstimateConfidence {
  let score = 0;
  if (
    currentInputs.costInputAgeDays !== null &&
    currentInputs.costInputAgeDays <= COST_FRESH_DAYS
  ) {
    score += 1;
  }
  if (!currentInputs.sourceMix.includes("industry_default")) {
    score += 1;
  }
  if (
    currentInputs.marketSampleSize > 0 &&
    (currentInputs.marketDataAgeDays ?? Number.POSITIVE_INFINITY) <=
      MARKET_FRESH_DAYS
  ) {
    score += 1;
  }
  if (history.sampleSize >= HISTORY_MIN_SAMPLE) {
    score += 1;
  }

  if (score >= 3) return "high";
  if (score >= 2) return "medium";
  return "low";
}

function customerPricingNoteFor(context: {
  confidence: EstimateConfidence;
  currentInputs: PricingSignals["currentInputs"];
  historicalVariance: HistoricalVarianceProfile;
}) {
  if (
    context.confidence === "high" &&
    context.currentInputs.marketSampleSize > 0 &&
    context.historicalVariance.sampleSize >= HISTORY_MIN_SAMPLE
  ) {
    return "This range uses current labor/material settings, local market checks, and recent completed-job feedback.";
  }
  if (context.currentInputs.marketSampleSize > 0) {
    return "This range uses current labor/material settings and local market checks.";
  }
  return "This range uses current labor/material settings; photos and owner review tighten the final number.";
}

export function buildPrecisionContext({
  store,
  serviceLines,
  marketRows,
  now = new Date(),
}: {
  store: AppStore;
  serviceLines: QuoteServiceLine[];
  marketRows: CompetitorPrice[];
  now?: Date;
}): PrecisionContext {
  const currentInputs = currentInputProfile(store, serviceLines, marketRows, now);
  const historicalVariance = historicalVarianceProfile(store, serviceLines);
  const confidence = confidenceFor(currentInputs, historicalVariance);

  const context = {
    confidence,
    currentInputs,
    historicalVariance,
  };

  return {
    ...context,
    customerPricingNote: customerPricingNoteFor(context),
    ownerReviewReasons: historicalVariance.reviewReasons,
  };
}

export function buildCompetitivePosition({
  marketRows,
  pricingAnchor,
  floorBandHigh,
  seasonAdjustment,
  storyMultiplier,
  riskMultiplier,
  addOnMinimums,
}: {
  marketRows: CompetitorPrice[];
  pricingAnchor: number;
  floorBandHigh: number;
  seasonAdjustment: number;
  storyMultiplier: number;
  riskMultiplier: number;
  addOnMinimums: number;
}): PricingSignals["competitivePosition"] {
  if (marketRows.length === 0) {
    return {
      targetPrice: null,
      ceiling: null,
      adjustmentPct: 0,
      ownerNote: "No market rows available; price is set from protected floor and internal cost signals.",
    };
  }

  const marketMedian = median(marketRows.map((row) => row.priceMedian)) ?? 0;
  const marketHigh = Math.max(...marketRows.map((row) => row.priceHigh));
  const marketCeiling =
    marketHigh * seasonAdjustment * storyMultiplier * riskMultiplier +
    addOnMinimums * 0.55;
  const premiumCeiling = marketCeiling * 1.08;
  let target = pricingAnchor;
  let ownerNote = "Recommended ask is inside the competitive market guardrail.";

  if (floorBandHigh > premiumCeiling) {
    target = floorBandHigh;
    ownerNote =
      "Protected floor is above the market guardrail; keep scope transparent before sending.";
  } else if (pricingAnchor > premiumCeiling) {
    target = Math.max(floorBandHigh, premiumCeiling);
    ownerNote =
      "Recommended ask was trimmed toward the local high while preserving the protected floor.";
  } else if (pricingAnchor < marketMedian * 0.92 && floorBandHigh < marketMedian) {
    target = Math.max(pricingAnchor, Math.min(marketMedian * 0.96, floorBandHigh * 1.18));
    ownerNote =
      "Recommended ask was lifted toward market so the quote is not needlessly underpriced.";
  }

  return {
    targetPrice: roundToFive(target),
    ceiling: roundToFive(premiumCeiling),
    adjustmentPct:
      pricingAnchor > 0
        ? Number((((target - pricingAnchor) / pricingAnchor) * 100).toFixed(1))
        : 0,
    ownerNote,
  };
}

export function buildPricingSignals({
  precisionContext,
  competitivePosition,
  blockerCount,
}: {
  precisionContext: PrecisionContext;
  competitivePosition: PricingSignals["competitivePosition"];
  blockerCount: number;
}): PricingSignals {
  const automationReady =
    blockerCount === 0 && precisionContext.confidence !== "low";

  return {
    confidence: precisionContext.confidence,
    currentInputs: precisionContext.currentInputs,
    historicalVariance: {
      sampleSize: precisionContext.historicalVariance.sampleSize,
      medianLaborRatio: precisionContext.historicalVariance.medianLaborRatio,
      underpricedShare: precisionContext.historicalVariance.underpricedShare,
      revenueVariancePct: precisionContext.historicalVariance.revenueVariancePct,
      costReservePct: precisionContext.historicalVariance.costReservePct,
      ownerNote: precisionContext.historicalVariance.ownerNote,
    },
    competitivePosition,
    quoteSpeed: {
      automationReady,
      blockerCount,
      ownerNote: automationReady
        ? "Enough signal to produce a same-session quote without extra owner work."
        : "Ask only for the photos/details that remove the listed blockers.",
    },
  };
}
