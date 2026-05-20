import { describe, expect, test } from "vitest";
import {
  calculateEstimate,
  fallbackServiceDetails,
} from "@/lib/pricing";
import { seedStore } from "@/lib/server/seeds";
import type {
  AppStore,
  JobActuals,
  Quote,
  QuoteRiskProfile,
  QuoteServiceLine,
} from "@/lib/types";

const defaultRiskProfile: QuoteRiskProfile = {
  surfaceCondition: "moderate",
  roofPitch: "standard",
  roofWalkable: "not_sure",
  waterAccess: "confirmed",
  access: [],
  windowDetails: [],
};

const photoSet = [
  { id: "photo_1", name: "front.jpg", dataUrl: "data:image/jpeg;base64,abc" },
  { id: "photo_2", name: "side.jpg", dataUrl: "data:image/jpeg;base64,abc" },
  { id: "photo_3", name: "back.jpg", dataUrl: "data:image/jpeg;base64,abc" },
];

function cloneStore(): AppStore {
  return JSON.parse(JSON.stringify(seedStore)) as AppStore;
}

function standardLine(store: AppStore, serviceSlug = "house-wash"): QuoteServiceLine {
  const service = store.services.find((item) => item.slug === serviceSlug);
  if (!service) throw new Error(`Missing service ${serviceSlug}`);
  const size = service.sizeOptions[1] ?? service.sizeOptions[0];
  return {
    serviceSlug,
    jobSize: size.value,
    jobSizeLabel: size.label,
  };
}

function estimateFor(
  store: AppStore,
  overrides: Partial<Parameters<typeof calculateEstimate>[1]> = {},
) {
  const line = overrides.serviceLines?.[0] ?? standardLine(store);
  return calculateEstimate(store, {
    serviceSlug: line.serviceSlug,
    jobSize: line.jobSize,
    jobSizeLabel: line.jobSizeLabel,
    stories: 1,
    urgency: "this_week",
    zip: "11743",
    street: "123 Main St",
    city: "Huntington",
    source: "Referral",
    serviceLines: [line],
    serviceDetails: fallbackServiceDetails(),
    riskProfile: defaultRiskProfile,
    photoAttachments: photoSet,
    customerPhone: "6315550123",
    customerEmail: "test@example.com",
    propertyType: "single_family",
    jobDetails: "Standard quote with clear photos.",
    ...overrides,
  });
}

function quoteForHistory(store: AppStore, id: string): Quote {
  const line = standardLine(store);
  const estimate = estimateFor(store, { serviceLines: [line] });
  return {
    id,
    customerName: `Customer ${id}`,
    customerEmail: `${id}@example.com`,
    customerPhone: "6315550123",
    preferredContactMethod: "text",
    source: "Referral",
    propertyType: "single_family",
    addressStreet: "123 Main St",
    addressCity: "Huntington",
    addressZip: "11743",
    serviceSlug: line.serviceSlug,
    jobSize: line.jobSize,
    jobSizeLabel: line.jobSizeLabel,
    serviceLines: [line],
    stories: 1,
    urgency: "this_week",
    riskProfile: defaultRiskProfile,
    serviceDetails: fallbackServiceDetails(),
    photoAttachments: photoSet,
    preferredWindows: [],
    notes: "",
    internalNotes: "",
    status: "won",
    estimate,
    finalQuoteAmount: estimate.recommendedAsk,
    sendReview: null,
    followUps: [],
    sentAt: "2026-05-10T12:00:00.000Z",
    outcomeCheckDate: null,
    approval: null,
    photosRequestedAt: null,
    expiresAt: "2026-05-26T12:00:00.000Z",
    duplicateContext: {
      isDuplicate: false,
      isRepeat: false,
      matches: [],
      ownerNote: "",
    },
    createdAt: "2026-05-10T12:00:00.000Z",
    updatedAt: "2026-05-10T12:00:00.000Z",
  };
}

describe("estimate precision framework", () => {
  test("new material and labor rates affect the next quote immediately", () => {
    const baselineStore = cloneStore();
    const baseline = estimateFor(baselineStore);
    const liveStore = cloneStore();
    const cost = liveStore.costInputs.find(
      (input) => input.serviceSlug === "house-wash",
    )!;
    cost.hourlyLaborRate *= 1.55;
    cost.materialCostPerUnit *= 1.4;
    cost.source = "dante_input";
    cost.updatedAt = "2026-05-19T12:00:00.000Z";

    const live = estimateFor(liveStore);

    expect(live.costSubtotal).toBeGreaterThan(baseline.costSubtotal);
    expect(live.floorBandHigh).toBeGreaterThan(baseline.floorBandHigh);
    expect(live.pricingSignals.currentInputs.sourceMix).toEqual(["dante_input"]);
    expect(live.pricingNotes.join(" ")).toMatch(/current labor\/material/i);
  });

  test("historical variance regression adds reserve when completed jobs ran long and low", () => {
    const baseline = estimateFor(cloneStore());
    const store = cloneStore();

    for (let index = 0; index < 5; index += 1) {
      const quote = quoteForHistory(store, `quote_${index}`);
      const actuals: JobActuals = {
        hours: Number((quote.estimate.laborHours * 1.65).toFixed(2)),
        crewCount: 1,
        materialUsage: "more",
        addedRevenue: 0,
        materialNotes: "",
        reasonCodes: ["priced_too_low", "heavy_buildup"],
        tags: ["tough"],
      };
      store.quotes.push(quote);
      store.outcomes.push({
        id: `outcome_${index}`,
        quoteId: quote.id,
        outcome: "won",
        amount: Math.round(quote.estimate.recommendedAsk * 0.86),
        amountExplicit: true,
        source: "dashboard",
        notes: "",
        actuals,
        createdAt: `2026-05-${15 - index}T12:00:00.000Z`,
      });
    }

    const regressed = estimateFor(store);

    expect(regressed.pricingSignals.historicalVariance.sampleSize).toBe(5);
    expect(regressed.pricingSignals.historicalVariance.costReservePct).toBeGreaterThan(0);
    expect(regressed.floorBandHigh).toBeGreaterThan(baseline.floorBandHigh);
    expect(regressed.manualReviewReasons.join(" ")).toMatch(/running above the estimate/i);
    expect(
      regressed.lineItems.some(
        (item) => item.label === "Historical variance reserve" && item.value > 0,
      ),
    ).toBe(true);
  });

  test("competitive market guardrail keeps the ask profitable and transparent", () => {
    const store = cloneStore();
    const estimate = estimateFor(store);

    expect(estimate.recommendedAsk).toBeGreaterThanOrEqual(estimate.floorBandHigh);
    expect(estimate.marketComparison.sampleSize).toBeGreaterThan(0);
    expect(estimate.pricingSignals.competitivePosition.targetPrice).toBeGreaterThan(0);
    expect(estimate.pricingSignals.competitivePosition.ownerNote).toMatch(
      /competitive|protected floor|market/i,
    );
  });

  test("edge-case analysis keeps ambiguous high-risk work finite and review-gated", () => {
    const store = cloneStore();
    const roof = standardLine(store, "roof-wash");
    const pavers = standardLine(store, "paver-refresh");
    const estimate = estimateFor(store, {
      serviceSlug: roof.serviceSlug,
      jobSize: roof.jobSize,
      jobSizeLabel: roof.jobSizeLabel,
      stories: 3,
      urgency: "asap",
      zip: "11001",
      serviceLines: [
        { ...roof, jobSize: 5000, jobSizeLabel: "Estate" },
        { ...pavers, jobSize: 1500, jobSizeLabel: "Estate" },
      ],
      riskProfile: {
        surfaceCondition: "restoration",
        roofPitch: "very_steep",
        roofWalkable: "no",
        waterAccess: "none",
        access: [
          "tight_side_yard",
          "locked_gate",
          "long_hose_pull",
          "no_driveway",
          "ladder_work",
          "steep_property",
          "fragile_surface",
          "heavy_furniture",
        ],
        windowDetails: [],
      },
      serviceDetails: {
        ...fallbackServiceDetails(),
        roofMossSeverity: "heavy",
        roofPlantProtection: "heavy",
        paverCondition: "failed_sealer",
      },
      photoAttachments: [],
    });

    expect(Number.isFinite(estimate.recommendedAsk)).toBe(true);
    expect(estimate.rangeHigh).toBeGreaterThan(estimate.rangeLow);
    expect(estimate.estimateConfidence).toBe("low");
    expect(estimate.pricingSignals.quoteSpeed.automationReady).toBe(false);
    expect(estimate.manualReviewReasons.length).toBeGreaterThan(5);
  });

  test("stress testing generates many quote variants quickly without breaking floors", () => {
    const store = cloneStore();
    const services = store.services.filter(
      (service) => service.quoteMode !== "survey_required",
    );
    const zips = ["11743", "11746", "11501", "11937"];
    const start = performance.now();

    for (let index = 0; index < 400; index += 1) {
      const service = services[index % services.length];
      const size = service.sizeOptions[index % service.sizeOptions.length];
      const estimate = estimateFor(store, {
        serviceSlug: service.slug,
        jobSize: size.value,
        jobSizeLabel: size.label,
        stories: (index % 3) + 1,
        urgency: index % 4 === 0 ? "asap" : index % 4 === 1 ? "this_week" : "flexible",
        zip: zips[index % zips.length],
        serviceLines: [
          {
            serviceSlug: service.slug,
            jobSize: size.value,
            jobSizeLabel: size.label,
          },
        ],
        riskProfile: {
          ...defaultRiskProfile,
          surfaceCondition: index % 5 === 0 ? "heavy" : "moderate",
          access: index % 7 === 0 ? ["long_hose_pull", "locked_gate"] : [],
        },
        photoAttachments: index % 6 === 0 ? [] : photoSet,
      });

      expect(Number.isFinite(estimate.recommendedAsk)).toBe(true);
      expect(estimate.rangeLow).toBeGreaterThanOrEqual(estimate.floorBandHigh);
      for (const option of estimate.packageOptions) {
        expect(option.price).toBeGreaterThanOrEqual(estimate.floorBandHigh);
      }
    }

    expect(performance.now() - start).toBeLessThan(2000);
  });
});
