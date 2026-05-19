import { describe, expect, test } from "vitest";
import { buildOwnerActionPlan } from "@/lib/dashboard-triage";
import type { Quote } from "@/lib/types";

const asOf = new Date("2026-05-19T12:00:00.000Z");

function quote(
  id: string,
  overrides: Partial<Quote> & { estimate?: Partial<Quote["estimate"]> } = {},
): Quote {
  const base = {
    id,
    customerName: id,
    customerEmail: `${id}@example.com`,
    customerPhone: "6315550123",
    preferredContactMethod: "text",
    source: "Referral",
    propertyType: "single_family",
    addressStreet: "123 Main St",
    addressCity: "Huntington",
    addressZip: "11743",
    serviceSlug: "house-wash",
    jobSize: 2500,
    jobSizeLabel: "Standard",
    serviceLines: [
      {
        serviceSlug: "house-wash",
        jobSize: 2500,
        jobSizeLabel: "Standard",
      },
    ],
    stories: 1,
    urgency: "this_week",
    riskProfile: {},
    serviceDetails: {},
    photoAttachments: [],
    preferredWindows: [],
    notes: "",
    internalNotes: "",
    status: "pending",
    estimate: {
      recommendedAsk: 700,
      leadQuality: "good",
      closeProbability: 70,
      followUpStage: "Ready to quote",
      nextFollowUpDate: "2026-05-19",
      followUpPlan: [],
      packageOptions: [
        {
          id: "best_value",
          name: "Best Value",
          description: "House wash plus exterior windows",
          price: 850,
          bundleSavings: 50,
          includedServices: ["House wash"],
          scopeNotes: [],
          ownerNote: "",
        },
      ],
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

describe("buildOwnerActionPlan", () => {
  test("puts deposit-blocked work ahead of ready-to-price leads", () => {
    const actions = buildOwnerActionPlan(
      [
        quote("ready", {
          photoAttachments: [{ id: "p1", name: "front.jpg", dataUrl: "data:" }],
        }),
        quote("deposit", {
          status: "awaiting_deposit",
          approval: {
            approvedAt: "2026-05-15T12:00:00.000Z",
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
          finalQuoteAmount: 1200,
        }),
      ],
      "2026-05-19",
      asOf,
    );

    expect(actions[0]).toMatchObject({
      quoteId: "deposit",
      kind: "collect_deposit",
      cta: "Open deposit",
    });
    expect(actions[1]).toMatchObject({
      quoteId: "ready",
      kind: "price_ready",
    });
  });

  test("ranks due sent-quote follow-ups ahead of new ready-to-price work", () => {
    const actions = buildOwnerActionPlan(
      [
        quote("ready", {
          photoAttachments: [{ id: "p1", name: "front.jpg", dataUrl: "data:" }],
        }),
        quote("sent", {
          status: "sent",
          sentAt: "2026-05-15T12:00:00.000Z",
          finalQuoteAmount: 850,
        }),
      ],
      "2026-05-19",
      asOf,
    );

    expect(actions[0]).toMatchObject({
      quoteId: "sent",
      kind: "follow_up",
      title: "24-hour follow-up",
      callHref: "tel:+16315550123",
    });
    expect(actions[0].reason).toMatch(/protects the close/i);
    expect(actions[0].smsHref).toContain("Wanted%20to%20make%20sure");
    expect(actions[0].mapsHref).toContain("123%20Main%20St");
  });

  test("describes ready-to-price and missing-photo actions clearly", () => {
    const actions = buildOwnerActionPlan(
      [
        quote("with-photos", {
          photoAttachments: [{ id: "p1", name: "front.jpg", dataUrl: "data:" }],
        }),
        quote("without-photos", {
          updatedAt: "2026-05-17T12:00:00.000Z",
        }),
      ],
      "2026-05-19",
      asOf,
    );

    expect(actions.find((action) => action.quoteId === "with-photos")).toMatchObject({
      kind: "price_ready",
      cta: "Price quote",
    });
    expect(
      actions.find((action) => action.quoteId === "with-photos")?.reason,
    ).toMatch(/photos are in/i);
    expect(actions.find((action) => action.quoteId === "without-photos")).toMatchObject({
      kind: "request_photos",
      cta: "Request photos",
    });
    expect(
      actions.find((action) => action.quoteId === "without-photos")?.nextStep,
    ).toMatch(/2-4 clear photos/i);
  });

  test("returns quick-action links and owner-ready message text", () => {
    const [action] = buildOwnerActionPlan(
      [
        quote("lead", {
          customerPhone: "(631) 555-0199",
          photoAttachments: [{ id: "p1", name: "front.jpg", dataUrl: "data:" }],
        }),
      ],
      "2026-05-19",
      asOf,
    );

    expect(action.callHref).toBe("tel:+16315550199");
    expect(action.smsHref).toContain("sms:+16315550199");
    expect(action.smsHref).toContain("Thanks%20for%20sending%20the%20photos");
    expect(action.mapsHref).toBe(
      "https://www.google.com/maps/search/?api=1&query=123%20Main%20St%2C%20Huntington%2C%2011743",
    );
    expect(action.message).toMatch(/reviewing the scope/i);
  });

  test("returns no actions for terminal quotes", () => {
    const actions = buildOwnerActionPlan(
      [
        quote("won", { status: "won" }),
        quote("lost", { status: "lost" }),
        quote("no-response", { status: "no_response" }),
      ],
      "2026-05-19",
      asOf,
    );

    expect(actions).toEqual([]);
  });
});
