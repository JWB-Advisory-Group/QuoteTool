import { describe, expect, test } from "vitest";
import { buildJobBrief } from "@/lib/job-brief";
import type { Quote } from "@/lib/types";

function quote(overrides: Partial<Quote> & { estimate?: Partial<Quote["estimate"]> } = {}): Quote {
  const base = {
    id: "quote_1",
    customerName: "Chris Romano",
    customerEmail: "chris@example.com",
    customerPhone: "(631) 555-0123",
    preferredContactMethod: "text",
    source: "Referral",
    propertyType: "single_family",
    addressStreet: "12 Briarwood Pl",
    addressCity: "Dix Hills",
    addressZip: "11746",
    serviceSlug: "house-wash",
    jobSize: 2500,
    jobSizeLabel: "Standard",
    serviceLines: [
      { serviceSlug: "house-wash", jobSize: 2500, jobSizeLabel: "Standard" },
    ],
    stories: 2,
    urgency: "this_week",
    riskProfile: {
      surfaceCondition: "moderate",
      roofPitch: "standard",
      roofWalkable: "not_sure",
      waterAccess: "confirmed",
      access: [],
      windowDetails: [],
    },
    serviceDetails: {
      roofMossSeverity: "not_sure",
      roofPlantProtection: "not_sure",
      gutterGuards: "not_sure",
      downspoutConcern: false,
      fenceSides: "not_sure",
      paverCondition: "standard",
      screenCount: null,
      stormWindowCount: null,
      hardWaterPanes: null,
      patioFurnitureLevel: "not_sure",
      solarPanelPitch: "not_sure",
    },
    photoAttachments: [],
    preferredWindows: [],
    notes: "",
    internalNotes: "",
    status: "pending",
    estimate: {
      recommendedAsk: 700,
      floorBandHigh: 600,
      depositRequired: false,
      depositAmount: 0,
      routeZone: "Core Huntington route",
      crewBlock: "1 tech, half day",
      closeProbability: 70,
      laborHours: 4.5,
      estimatedDriveMinutes: 20,
      serviceBreakdowns: [
        {
          serviceSlug: "house-wash",
          serviceName: "House wash",
          jobSize: 2500,
          jobSizeLabel: "Standard",
          unitCount: 2.5,
          laborHours: 4.5,
          materials: 90,
          protectedMinimum: 600,
          riskMultiplier: 1,
        },
      ],
      manualReviewReasons: [],
      addressValidation: {
        confidence: "verified",
        inServiceArea: true,
        county: "Suffolk",
        routeZone: "Core Huntington route",
        warnings: [],
        ownerAction: "Address is in range.",
      },
      profitability: {
        estimatedCost: 350,
        grossProfit: 350,
        grossMarginPct: 50,
        floorDelta: 100,
      },
      scopeExclusions: ["Moving heavy furniture"],
    },
    finalQuoteAmount: null,
    sendReview: null,
    followUps: [],
    sentAt: null,
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
    createdAt: "2026-05-18T12:00:00.000Z",
    updatedAt: "2026-05-18T12:00:00.000Z",
  } as Quote;

  return {
    ...base,
    ...overrides,
    estimate: {
      ...base.estimate,
      ...(overrides.estimate ?? {}),
    },
  } as Quote;
}

describe("buildJobBrief", () => {
  test("makes missing photos impossible to miss", () => {
    const brief = buildJobBrief(quote());

    expect(brief.headline).toBe("Needs photos before final price");
    expect(brief.tone).toBe("amber");
    expect(brief.checks.find((check) => check.label === "Photos")).toMatchObject({
      value: "Needed before final price",
      tone: "amber",
    });
    expect(brief.dayOfChecklist[0]).toMatch(/Get photos/i);
  });

  test("surfaces deposit-blocked bookings", () => {
    const brief = buildJobBrief(
      quote({
        status: "awaiting_deposit",
        finalQuoteAmount: 1200,
        approval: {
          approvedAt: "2026-05-18T12:00:00.000Z",
          selectedPackageId: "best_value",
          selectedPrice: 1200,
          preferredDates: [],
          depositRequired: true,
          depositAmount: 300,
          depositPaid: false,
          customerNote: "",
          acceptedUpsellIds: [],
          acceptedUpsellsLift: 0,
          scopeAccepted: true,
          depositCheckoutUrl: null,
        },
      }),
    );

    expect(brief.headline).toBe("Deposit is blocking booking");
    expect(brief.checks.find((check) => check.label === "Deposit")).toMatchObject({
      value: "$300 pending",
      tone: "amber",
    });
  });

  test("turns access and water risk into crew flags", () => {
    const brief = buildJobBrief(
      quote({
        photoAttachments: [{ id: "photo_1", name: "front.jpg", dataUrl: "data:" }],
        riskProfile: {
          surfaceCondition: "heavy",
          roofPitch: "steep",
          roofWalkable: "no",
          waterAccess: "none",
          access: ["locked_gate", "long_hose_pull"],
          windowDetails: ["screens"],
        },
        estimate: {
          manualReviewReasons: ["Water access must be confirmed before dispatch."],
          profitability: {
            estimatedCost: 550,
            grossProfit: 150,
            grossMarginPct: 30,
            floorDelta: 0,
          },
        },
      }),
    );

    expect(brief.tone).toBe("red");
    expect(brief.riskFlags).toContain("No outdoor water");
    expect(brief.riskFlags).toContain("Locked gate");
    expect(brief.riskFlags).toContain("Long hose pull");
    expect(brief.checks.find((check) => check.label === "Margin")).toMatchObject({
      value: "30% gross",
      tone: "red",
    });
  });

  test("creates owner contact links", () => {
    const brief = buildJobBrief(quote());

    expect(brief.callHref).toBe("tel:+16315550123");
    expect(brief.smsHref).toContain("sms:+16315550123");
    expect(brief.mapsHref).toBe(
      "https://www.google.com/maps/search/?api=1&query=12%20Briarwood%20Pl%2C%20Dix%20Hills%2C%2011746",
    );
    expect(brief.publicQuoteHref).toBe("/quote/quote_1");
  });
});
