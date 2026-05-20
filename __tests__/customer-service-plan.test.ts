import { describe, expect, test } from "vitest";
import { buildCustomerServicePlan } from "@/lib/customer-service-plan";
import { calculateEstimate, fallbackServiceDetails } from "@/lib/pricing";
import { seedStore } from "@/lib/server/seeds";
import type {
  AppStore,
  ApprovalRecord,
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

function recalculateWithPhotos(store: AppStore, quote: Quote, photoCount: number) {
  const photoAttachments = Array.from({ length: photoCount }, (_, index) => ({
    id: `photo_${index + 1}`,
    name: `photo-${index + 1}.jpg`,
    dataUrl: "data:image/jpeg;base64,abc",
  }));
  quote.photoAttachments = photoAttachments;
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
    photoAttachments,
  });
}

describe("customer service plan", () => {
  test("makes photo upload the primary step when photos are missing", () => {
    const store = cloneStore();
    const quote = quoteFor(store);
    recalculateWithPhotos(store, quote, 0);

    const plan = buildCustomerServicePlan(quote, {
      surveyRequired: false,
      expired: false,
    });

    expect(plan.primaryAction).toMatchObject({
      label: "Upload photos",
      href: "#photos",
      intent: "photos",
    });
    expect(plan.timeline[0].label).toBe("Photos");
    expect(plan.prepChecklist.join(" ")).toMatch(/Upload 2-4 photos/i);
    expect(JSON.stringify(plan).toLowerCase()).not.toContain("protected floor");
  });

  test("directs sent quotes to package approval with a clear visit timeline", () => {
    const store = cloneStore();
    const quote = {
      ...quoteFor(store, "roof-wash"),
      status: "sent" as const,
      finalQuoteAmount: 1180,
    };

    const plan = buildCustomerServicePlan(quote, {
      surveyRequired: false,
      expired: false,
    });

    expect(plan.statusLabel).toBe("Ready to approve");
    expect(plan.primaryAction).toMatchObject({
      label: "Choose package",
      href: "#choose-package",
      intent: "approve",
    });
    expect(plan.priceConfidence).toContain("$1,180");
    expect(plan.timeline.map((step) => step.label)).toEqual([
      "Choose",
      "Windows",
      "Confirm",
      "Visit",
    ]);
  });

  test("approved deposit-pending quotes focus the customer on the deposit step", () => {
    const store = cloneStore();
    const quote = quoteFor(store, "roof-wash");
    const approval: ApprovalRecord = {
      approvedAt: "2026-05-11T12:30:00.000Z",
      selectedPackageId: "full_refresh",
      selectedPrice: 1450,
      preferredDates: [],
      depositRequired: true,
      depositAmount: 290,
      depositPaid: false,
      customerNote: "",
      acceptedUpsellIds: [],
      acceptedUpsellsLift: 0,
      scopeAccepted: true,
      depositCheckoutUrl: "https://checkout.example/test",
    };
    quote.status = "awaiting_deposit";
    quote.approval = approval;

    const plan = buildCustomerServicePlan(quote, {
      surveyRequired: false,
      expired: false,
    });

    expect(plan.primaryAction.intent).toBe("deposit");
    expect(plan.depositState.label).toBe("Deposit pending");
    expect(plan.depositState.detail).toContain("$290");
    expect(plan.timeline[0].label).toBe("Approved");
  });

  test("pre-approval deposit copy stays package-based instead of promising one amount", () => {
    const store = cloneStore();
    const quote = quoteFor(store, "roof-wash");

    const plan = buildCustomerServicePlan(quote, {
      surveyRequired: false,
      expired: false,
    });

    expect(plan.depositState.label).toBe("Deposit at approval");
    expect(plan.depositState.detail).toMatch(/package you choose/i);
    expect(plan.depositState.detail).not.toContain("$");
  });

  test("uses risk fields to build a practical preparation checklist", () => {
    const store = cloneStore();
    const quote = quoteFor(store);
    quote.riskProfile = {
      ...quote.riskProfile,
      waterAccess: "not_sure",
      access: ["locked_gate", "pets", "fragile_surface"],
      windowDetails: ["inside_outside", "screens"],
    };

    const plan = buildCustomerServicePlan(quote, {
      surveyRequired: false,
      expired: false,
    });

    const prep = plan.prepChecklist.join(" ");
    expect(prep).toMatch(/outdoor water/i);
    expect(prep).toMatch(/Unlock gates/i);
    expect(prep).toMatch(/pets/i);
    expect(prep).toMatch(/fragile/i);
  });
});
