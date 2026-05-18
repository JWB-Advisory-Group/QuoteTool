import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { ResultPanel } from "@/app/quote/quote-result-panel";
import { PublicQuoteView } from "@/app/quote/[id]/page";
import { computeCostInputFromOnboarding } from "@/lib/onboarding";
import { fitCostInputFromActuals } from "@/lib/calibration";
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
} from "@/lib/types";

const defaultRiskProfile: QuoteRiskProfile = {
  surfaceCondition: "moderate",
  roofPitch: "standard",
  roofWalkable: "not_sure",
  waterAccess: "confirmed",
  access: [],
  windowDetails: [],
};

function cloneStore(): AppStore {
  return JSON.parse(JSON.stringify(seedStore)) as AppStore;
}

function quoteFor(
  store: AppStore,
  serviceSlug = "house-wash",
  id = crypto.randomUUID(),
): Quote {
  const service = store.services.find((item) => item.slug === serviceSlug);
  if (!service) throw new Error(`Missing service ${serviceSlug}`);
  const size = service.sizeOptions[1] ?? service.sizeOptions[0];
  const serviceLines = [
    {
      serviceSlug,
      jobSize: size.value,
      jobSizeLabel: size.label,
    },
  ];
  const estimate = calculateEstimate(store, {
    serviceSlug,
    jobSize: size.value,
    jobSizeLabel: size.label,
    stories: 1,
    urgency: "this_week",
    zip: "11743",
    source: "Referral",
    serviceLines,
    serviceDetails: fallbackServiceDetails(),
    riskProfile: defaultRiskProfile,
    photoAttachments: [
      {
        id: "photo_1",
        name: "front.jpg",
        dataUrl: "data:image/jpeg;base64,abc",
      },
    ],
  });

  return {
    id,
    customerName: "Test Customer",
    customerEmail: "test@example.com",
    customerPhone: "6315550123",
    preferredContactMethod: "text",
    source: "Referral",
    propertyType: "single_family",
    addressStreet: "123 Main St",
    addressCity: "Huntington",
    addressZip: "11743",
    serviceSlug,
    jobSize: size.value,
    jobSizeLabel: size.label,
    serviceLines,
    stories: 1,
    urgency: "this_week",
    riskProfile: defaultRiskProfile,
    serviceDetails: fallbackServiceDetails(),
    photoAttachments: [
      {
        id: "photo_1",
        name: "front.jpg",
        dataUrl: "data:image/jpeg;base64,abc",
      },
    ],
    preferredWindows: [],
    notes: "",
    internalNotes: "",
    status: "pending",
    estimate,
    finalQuoteAmount: null,
    sendReview: null,
    followUps: [],
    sentAt: null,
    outcomeCheckDate: null,
    approval: null,
    photosRequestedAt: null,
    expiresAt: "2099-01-01T00:00:00.000Z",
    duplicateContext: {
      isDuplicate: false,
      isRepeat: false,
      matches: [],
      ownerNote: "",
    },
    createdAt: "2026-05-11T12:00:00.000Z",
    updatedAt: "2026-05-11T12:00:00.000Z",
  };
}

function createInputFromQuote(quote: Quote) {
  return {
    customerName: quote.customerName,
    customerEmail: quote.customerEmail,
    customerPhone: quote.customerPhone,
    preferredContactMethod: quote.preferredContactMethod,
    source: quote.source,
    propertyType: quote.propertyType,
    addressStreet: quote.addressStreet,
    addressCity: quote.addressCity,
    addressZip: quote.addressZip,
    serviceSlug: quote.serviceSlug,
    jobSize: quote.jobSize,
    jobSizeLabel: quote.jobSizeLabel,
    serviceLines: quote.serviceLines,
    stories: quote.stories,
    urgency: quote.urgency,
    riskProfile: quote.riskProfile,
    serviceDetails: quote.serviceDetails,
    photoAttachments: quote.photoAttachments,
    preferredWindows: quote.preferredWindows,
    notes: quote.notes,
  };
}

async function freshStoreModule() {
  vi.resetModules();
  const dir = mkdtempSync(path.join(tmpdir(), "mas-pricing-"));
  process.env.LOCAL_DATA_PATH = path.join(dir, "store.json");
  return import("@/lib/server/store");
}

describe("Dante-first pricing reliability", () => {
  test("package prices stay at or above the protected floor", () => {
    const store = cloneStore();
    for (const service of store.services) {
      const size = service.sizeOptions[1] ?? service.sizeOptions[0];
      const estimate = calculateEstimate(store, {
        serviceSlug: service.slug,
        jobSize: size.value,
        jobSizeLabel: size.label,
        stories: 1,
        urgency: "this_week",
        zip: "11743",
        serviceLines: [
          {
            serviceSlug: service.slug,
            jobSize: size.value,
            jobSizeLabel: size.label,
          },
        ],
        serviceDetails: fallbackServiceDetails(),
        riskProfile: defaultRiskProfile,
        photoAttachments: [
          {
            id: "photo_1",
            name: "front.jpg",
            dataUrl: "data:image/jpeg;base64,abc",
          },
        ],
      });

      for (const option of estimate.packageOptions) {
        expect(option.price).toBeGreaterThanOrEqual(estimate.floorBandHigh);
      }
    }
  });

  test("onboarding uses typical charge to protect the service minimum", () => {
    const store = cloneStore();
    const service = store.services.find((item) => item.slug === "house-wash")!;
    const current = store.costInputs.find(
      (item) => item.serviceSlug === service.slug,
    )!;

    const next = computeCostInputFromOnboarding(service, current, {
      typicalSize: 2500,
      typicalHours: 3,
      typicalCharge: 1200,
      driveMinutes: 20,
    });

    expect(next.serviceMinimum).toBeGreaterThanOrEqual(1070);
    expect(next.source).toBe("dante_input");
  });

  test("calibration treats actual hours as clock hours multiplied by crew count", () => {
    const store = cloneStore();
    const quote = quoteFor(store, "house-wash", "quote_house");
    store.quotes = [quote];
    const actuals: JobActuals = {
      hours: 3,
      crewCount: 2,
      materialUsage: "normal",
      addedRevenue: null,
      materialNotes: "",
      reasonCodes: ["priced_correctly"],
      tags: [],
    };
    store.outcomes = Array.from({ length: 5 }, (_, index) => ({
      id: `outcome_${index}`,
      quoteId: quote.id,
      outcome: "won",
      amount: quote.estimate.recommendedAsk,
      amountExplicit: true,
      source: "dashboard",
      notes: "",
      actuals,
      createdAt: `2026-05-${10 - index}T12:00:00.000Z`,
    }));

    const fitted = fitCostInputFromActuals(store, "house-wash");

    expect(fitted?.hoursPerUnit).toBe(2.4);
  });

  test("sent and approved quotes cannot go below the protected floor", async () => {
    const storeModule = await freshStoreModule();
    const quote = await storeModule.createQuote(
      createInputFromQuote(quoteFor(cloneStore(), "house-wash")),
    );

    await expect(
      storeModule.sendQuote(quote.id, quote.estimate.floorBandHigh - 5),
    ).rejects.toThrow("protected floor");
    await expect(
      storeModule.approveQuote(quote.id, {
        selectedPackageId: "essential",
        selectedPrice: quote.estimate.floorBandHigh - 5,
        preferredDates: [],
        customerNote: "",
        scopeAccepted: true,
      }),
    ).rejects.toThrow("protected floor");
  });

  test("no-photo and manual-review sends require confirmation and a reason", async () => {
    const storeModule = await freshStoreModule();
    const quote = await storeModule.createQuote(
      createInputFromQuote({
        ...quoteFor(cloneStore(), "roof-wash"),
        photoAttachments: [],
      }),
    );

    await expect(
      storeModule.sendQuote(quote.id, quote.estimate.recommendedAsk),
    ).rejects.toThrow("Review confirmation");

    await expect(
      storeModule.sendQuote(quote.id, quote.estimate.recommendedAsk, {
        reviewConfirmed: true,
        overrideReason: "Customer confirmed roof access and photos are coming by text.",
      }),
    ).resolves.toMatchObject({ id: quote.id, status: "sent" });
  });

  test("survey-required services cannot be approved as final bookings", async () => {
    const storeModule = await freshStoreModule();
    const quote = await storeModule.createQuote(
      createInputFromQuote(quoteFor(cloneStore(), "painting")),
    );

    await expect(
      storeModule.approveQuote(quote.id, {
        selectedPackageId: "essential",
        selectedPrice: quote.estimate.recommendedAsk,
        preferredDates: [],
        customerNote: "",
      }),
    ).rejects.toThrow("survey");
  });

  test("deposit requirement follows the selected package price", async () => {
    const storeModule = await freshStoreModule();
    const quote = await storeModule.createQuote(
      createInputFromQuote(quoteFor(cloneStore(), "house-wash")),
    );
    const fullRefresh = quote.estimate.packageOptions.find(
      (option) => option.id === "full_refresh",
    )!;

    expect(fullRefresh.price).toBeGreaterThanOrEqual(quote.estimate.depositThreshold);

    const result = await storeModule.approveQuote(quote.id, {
      selectedPackageId: "full_refresh",
      selectedPrice: fullRefresh.price,
      preferredDates: [],
      customerNote: "",
      scopeAccepted: true,
    });

    expect(result?.approval.depositRequired).toBe(true);
    expect(result?.approval.depositAmount).toBeGreaterThanOrEqual(150);
  });

  test("approval requires scope acceptance before recording", async () => {
    const storeModule = await freshStoreModule();
    const quote = await storeModule.createQuote(
      createInputFromQuote(quoteFor(cloneStore(), "house-wash")),
    );

    await expect(
      storeModule.approveQuote(quote.id, {
        selectedPackageId: "essential",
        selectedPrice: quote.estimate.recommendedAsk,
        preferredDates: [],
        customerNote: "",
        scopeAccepted: false,
      }),
    ).rejects.toThrow(/scope/i);

    const result = await storeModule.approveQuote(quote.id, {
      selectedPackageId: "essential",
      selectedPrice: quote.estimate.recommendedAsk,
      preferredDates: [],
      customerNote: "",
      scopeAccepted: true,
    });
    expect(result?.approval.scopeAccepted).toBe(true);
  });

  test("accepted upsells are recorded and survive an invalid id", async () => {
    const storeModule = await freshStoreModule();
    const quote = await storeModule.createQuote(
      createInputFromQuote(quoteFor(cloneStore(), "house-wash")),
    );
    const bundleIds = quote.estimate.bundleRecommendations.map((bundle) => bundle.id);

    const result = await storeModule.approveQuote(quote.id, {
      selectedPackageId: "essential",
      selectedPrice: quote.estimate.recommendedAsk,
      preferredDates: [],
      customerNote: "",
      scopeAccepted: true,
      acceptedUpsellIds: [...bundleIds.slice(0, 1), "bogus_id"],
      acceptedUpsellsLift: 225,
    });
    expect(result?.approval.acceptedUpsellIds).toEqual(bundleIds.slice(0, 1));
    expect(result?.approval.acceptedUpsellsLift).toBe(225);
  });

  test("public quote page renders package, scope, and deposit state", () => {
    const store = cloneStore();
    const roofQuote = quoteFor(store, "roof-wash");
    const quote = {
      ...roofQuote,
      status: "sent" as const,
      finalQuoteAmount: roofQuote.estimate.recommendedAsk,
    };

    render(<PublicQuoteView quote={quote} surveyRequired={false} expired={false} />);

    expect(screen.getByText(/Choose your package/i)).toBeDefined();
    expect(screen.getByText(/Included and excluded/i)).toBeDefined();
    expect(screen.getAllByText(/Deposit/i).length).toBeGreaterThan(0);
  });

  test("public quote page makes photos optional but valuable", () => {
    const store = cloneStore();
    const quote = quoteFor(store, "house-wash");
    quote.photoAttachments = [];
    quote.estimate = calculateEstimate(store, {
      serviceSlug: quote.serviceSlug,
      jobSize: quote.jobSize,
      jobSizeLabel: quote.jobSizeLabel,
      stories: quote.stories,
      urgency: quote.urgency,
      zip: quote.addressZip,
      source: quote.source,
      serviceLines: quote.serviceLines,
      serviceDetails: quote.serviceDetails,
      riskProfile: quote.riskProfile,
      photoAttachments: [],
    });

    render(<PublicQuoteView quote={quote} surveyRequired={false} expired={false} />);

    expect(screen.getByText(/This is an estimated quote/i)).toBeDefined();
    expect(screen.getByText(/Upload photos for an actual quote/i)).toBeDefined();
    expect(screen.getByText(/Skip them if you prefer an estimated quote/i)).toBeDefined();
  });

  test("instant result separates requested estimate from optional upgrades", () => {
    const store = cloneStore();
    const quote = quoteFor(store, "house-wash", "quote_result");

    render(
      <ResultPanel
        result={{
          quoteId: quote.id,
          rangeLow: quote.estimate.rangeLow,
          rangeHigh: quote.estimate.rangeHigh,
          estimate: quote.estimate,
          message: "",
        }}
      />,
    );

    expect(
      screen.getByText(/This first number is for the work you requested/i),
    ).toBeDefined();
    expect(screen.getByText(/Requested scope/i)).toBeDefined();
    expect(
      screen.getByText(/Upgrades are optional add-ons, not hidden fees/i),
    ).toBeDefined();
    expect(screen.getByRole("link", { name: /Review quote link/i })).toHaveProperty(
      "pathname",
      "/quote/quote_result",
    );
  });

  test("customer photo uploads attach to the lead and clear the photo follow-up stage", async () => {
    const storeModule = await freshStoreModule();
    const quote = await storeModule.createQuote(
      createInputFromQuote({
        ...quoteFor(cloneStore(), "house-wash"),
        photoAttachments: [],
      }),
    );

    expect(quote.estimate.followUpStage).toBe("Needs photos");

    const updated = await storeModule.addQuotePhotos(quote.id, [
      {
        id: "upload_1",
        name: "front.jpg",
        dataUrl: "data:image/jpeg;base64,abc",
      },
      {
        id: "upload_2",
        name: "worst-area.jpg",
        dataUrl: "data:image/jpeg;base64,abc",
      },
    ]);

    expect(updated?.photoAttachments).toHaveLength(2);
    expect(updated?.estimate.followUpStage).toBe("Ready to quote");
  });

  test("service-specific requirements create owner review flags and photo guidance", () => {
    const store = cloneStore();
    const estimate = calculateEstimate(store, {
      serviceSlug: "roof-wash",
      jobSize: 2500,
      jobSizeLabel: "Standard",
      stories: 2,
      urgency: "asap",
      zip: "11743",
      source: "Google",
      serviceLines: [
        {
          serviceSlug: "roof-wash",
          jobSize: 2500,
          jobSizeLabel: "Standard",
        },
      ],
      serviceDetails: fallbackServiceDetails(),
      riskProfile: {
        ...defaultRiskProfile,
        roofPitch: "not_sure",
        roofWalkable: "not_sure",
      },
      photoAttachments: [],
    });

    expect(estimate.intakeRequirements.measurementConfidence).toBe("low");
    expect(estimate.intakeRequirements.requiredPhotos).toContain("Roof from front");
    expect(estimate.manualReviewReasons.join(" ")).toMatch(/Roof pitch/);
    expect(estimate.followUpPlan[0].id).toBe("photo_request_now");
  });

  test("ASAP and route-zone pricing protect premium schedule pressure", () => {
    const store = cloneStore();
    const base = calculateEstimate(store, {
      serviceSlug: "house-wash",
      jobSize: 2500,
      jobSizeLabel: "Standard",
      stories: 1,
      urgency: "flexible",
      zip: "11743",
      source: "Google",
      serviceLines: [
        {
          serviceSlug: "house-wash",
          jobSize: 2500,
          jobSizeLabel: "Standard",
        },
      ],
      serviceDetails: fallbackServiceDetails(),
      riskProfile: defaultRiskProfile,
      photoAttachments: [
        {
          id: "photo_1",
          name: "front.jpg",
          dataUrl: "data:image/jpeg;base64,abc",
        },
        {
          id: "photo_2",
          name: "side.jpg",
          dataUrl: "data:image/jpeg;base64,abc",
        },
        {
          id: "photo_3",
          name: "back.jpg",
          dataUrl: "data:image/jpeg;base64,abc",
        },
      ],
    });
    const urgentNassau = calculateEstimate(store, {
      serviceSlug: "house-wash",
      jobSize: 2500,
      jobSizeLabel: "Standard",
      stories: 1,
      urgency: "asap",
      zip: "11501",
      source: "Google",
      serviceLines: [
        {
          serviceSlug: "house-wash",
          jobSize: 2500,
          jobSizeLabel: "Standard",
        },
      ],
      serviceDetails: fallbackServiceDetails(),
      riskProfile: defaultRiskProfile,
      photoAttachments: [
        {
          id: "photo_1",
          name: "front.jpg",
          dataUrl: "data:image/jpeg;base64,abc",
        },
        {
          id: "photo_2",
          name: "side.jpg",
          dataUrl: "data:image/jpeg;base64,abc",
        },
        {
          id: "photo_3",
          name: "back.jpg",
          dataUrl: "data:image/jpeg;base64,abc",
        },
      ],
    });

    expect(urgentNassau.recommendedAsk).toBeGreaterThan(base.recommendedAsk);
    expect(urgentNassau.scheduleWindows[0].urgencyPremiumPct).toBeGreaterThan(0);
  });
});
