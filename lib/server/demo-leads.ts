import "server-only";

import { calculateEstimate, fallbackServiceDetails } from "@/lib/pricing";
import type {
  AppStore,
  PhotoAttachment,
  Quote,
  QuoteRiskProfile,
  QuoteServiceDetails,
  QuoteServiceLine,
} from "@/lib/types";

const demoPhoto: PhotoAttachment = {
  id: "demo_photo_1",
  name: "demo-property-photo.svg",
  dataUrl:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='420' viewBox='0 0 600 420'%3E%3Crect width='600' height='420' fill='%23f3f0e7'/%3E%3Cpath d='M110 250h380v95H110z' fill='%23ffffff' stroke='%23d5d0c2' stroke-width='8'/%3E%3Cpath d='M84 250l216-150 216 150z' fill='%234b5148'/%3E%3Crect x='155' y='280' width='70' height='65' fill='%23cfe1f5'/%3E%3Crect x='270' y='280' width='60' height='65' fill='%236f5b45'/%3E%3Crect x='375' y='280' width='70' height='65' fill='%23cfe1f5'/%3E%3Ccircle cx='470' cy='116' r='42' fill='%23d8f269'/%3E%3Cpath d='M75 348c78-28 158-29 240-4s155 25 220-8v84H75z' fill='%23dae8d3'/%3E%3C/svg%3E",
};

const defaultRiskProfile: QuoteRiskProfile = {
  surfaceCondition: "moderate",
  roofPitch: "standard",
  roofWalkable: "not_sure",
  waterAccess: "confirmed",
  access: [],
  windowDetails: [],
};

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function daysFromNow(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function makeLine(
  serviceSlug: string,
  jobSize: number,
  jobSizeLabel: string,
): QuoteServiceLine {
  return { serviceSlug, jobSize, jobSizeLabel };
}

function makeQuote(
  store: AppStore,
  input: {
    id: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    source: string;
    propertyType: Quote["propertyType"];
    preferredContactMethod: Quote["preferredContactMethod"];
    addressStreet: string;
    addressCity: string;
    addressZip: string;
    serviceLines: QuoteServiceLine[];
    stories: number;
    urgency: string;
    riskProfile?: QuoteRiskProfile;
    serviceDetails?: Partial<QuoteServiceDetails>;
    photoAttachments?: PhotoAttachment[];
    notes: string;
    status?: Quote["status"];
    createdDaysAgo?: number;
  },
): Quote {
  const primary = input.serviceLines[0];
  const serviceDetails = {
    ...fallbackServiceDetails(),
    ...(input.serviceDetails ?? {}),
  };
  const estimate = calculateEstimate(store, {
    serviceSlug: primary.serviceSlug,
    jobSize: primary.jobSize,
    jobSizeLabel: primary.jobSizeLabel,
    stories: input.stories,
    urgency: input.urgency,
    zip: input.addressZip,
    street: input.addressStreet,
    city: input.addressCity,
    source: input.source,
    customerPhone: input.customerPhone,
    customerEmail: input.customerEmail,
    propertyType: input.propertyType,
    jobDetails: input.notes,
    serviceLines: input.serviceLines,
    riskProfile: input.riskProfile ?? defaultRiskProfile,
    serviceDetails,
    photoAttachments: input.photoAttachments ?? [],
  });
  const createdAt = daysAgo(input.createdDaysAgo ?? 0);
  const status = input.status ?? "pending";

  return {
    id: input.id,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    customerPhone: input.customerPhone,
    preferredContactMethod: input.preferredContactMethod,
    source: input.source,
    propertyType: input.propertyType,
    addressStreet: input.addressStreet,
    addressCity: input.addressCity,
    addressZip: input.addressZip,
    serviceSlug: primary.serviceSlug,
    jobSize: primary.jobSize,
    jobSizeLabel: primary.jobSizeLabel,
    serviceLines: input.serviceLines,
    stories: input.stories,
    urgency: input.urgency,
    riskProfile: input.riskProfile ?? defaultRiskProfile,
    serviceDetails,
    photoAttachments: input.photoAttachments ?? [],
    preferredWindows: [],
    notes: input.notes,
    internalNotes: "",
    status,
    estimate,
    finalQuoteAmount: status === "sent" ? estimate.recommendedAsk : null,
    sendReview: null,
    followUps: [],
    sentAt: status === "sent" ? daysAgo(1) : null,
    outcomeCheckDate: status === "sent" ? daysFromNow(2).slice(0, 10) : null,
    approval: null,
    photosRequestedAt: null,
    expiresAt: daysFromNow(7),
    duplicateContext: {
      isDuplicate: false,
      isRepeat: false,
      matches: [],
      ownerNote: "",
    },
    createdAt,
    updatedAt: createdAt,
  };
}

export function shouldSeedDemoLeads() {
  if (process.env.DEMO_QUOTES === "off") return false;
  if (process.env.DEMO_QUOTES === "on") return true;
  return process.env.NODE_ENV === "development";
}

export function buildDemoLeads(store: AppStore): Quote[] {
  return [
    makeQuote(store, {
      id: "demo_window_cleaning",
      customerName: "Maria Lopez",
      customerEmail: "maria.lopez@example.com",
      customerPhone: "6315550140",
      preferredContactMethod: "text",
      source: "Nextdoor",
      propertyType: "single_family",
      addressStreet: "42 Oakwood Rd",
      addressCity: "Huntington",
      addressZip: "11743",
      serviceLines: [makeLine("window-cleaning", 35, "Standard")],
      stories: 2,
      urgency: "this_week",
      riskProfile: {
        ...defaultRiskProfile,
        windowDetails: ["inside_outside", "screens"],
      },
      serviceDetails: { screenCount: 28 },
      photoAttachments: [demoPhoto],
      notes: "Wants inside and outside windows before family visits this weekend.",
      createdDaysAgo: 0,
    }),
    makeQuote(store, {
      id: "demo_house_wash",
      customerName: "Kevin Brown",
      customerEmail: "kevin.brown@example.com",
      customerPhone: "6315550188",
      preferredContactMethod: "call",
      source: "Google",
      propertyType: "single_family",
      addressStreet: "19 Ridgefield Ave",
      addressCity: "Northport",
      addressZip: "11768",
      serviceLines: [
        makeLine("house-wash", 2500, "Standard"),
        makeLine("patio-wash", 400, "Standard"),
      ],
      stories: 2,
      urgency: "asap",
      riskProfile: {
        ...defaultRiskProfile,
        surfaceCondition: "heavy",
        access: ["tight_side_yard", "long_hose_pull"],
      },
      photoAttachments: [demoPhoto],
      notes: "Green buildup on north side and wants patio cleaned if same-day price makes sense.",
      createdDaysAgo: 0,
    }),
    makeQuote(store, {
      id: "demo_roof_softwash",
      customerName: "Alyssa Grant",
      customerEmail: "alyssa.grant@example.com",
      customerPhone: "6315550199",
      preferredContactMethod: "text",
      source: "Referral",
      propertyType: "single_family",
      addressStreet: "7 Harbor View Dr",
      addressCity: "Cold Spring Harbor",
      addressZip: "11724",
      serviceLines: [makeLine("roof-wash", 3500, "Large")],
      stories: 2,
      urgency: "this_month",
      riskProfile: {
        ...defaultRiskProfile,
        roofPitch: "not_sure",
        roofWalkable: "not_sure",
      },
      serviceDetails: {
        roofMossSeverity: "heavy",
        roofPlantProtection: "heavy",
      },
      photoAttachments: [],
      notes: "Black streaks and moss visible from street. Customer is worried about plants.",
      createdDaysAgo: 1,
    }),
    makeQuote(store, {
      id: "demo_gutters",
      customerName: "Samir Patel",
      customerEmail: "samir.patel@example.com",
      customerPhone: "6315550112",
      preferredContactMethod: "text",
      source: "Yard sign",
      propertyType: "townhome",
      addressStreet: "88 Park Ln",
      addressCity: "Smithtown",
      addressZip: "11787",
      serviceLines: [makeLine("gutters", 150, "Standard")],
      stories: 2,
      urgency: "this_week",
      riskProfile: {
        ...defaultRiskProfile,
        access: ["gutter_guards"],
      },
      serviceDetails: {
        gutterGuards: "some",
        downspoutConcern: true,
      },
      photoAttachments: [],
      notes: "Overflowing over front entry during rain. Some gutter guards.",
      createdDaysAgo: 1,
    }),
    makeQuote(store, {
      id: "demo_patio_fence",
      customerName: "Dana Morris",
      customerEmail: "dana.morris@example.com",
      customerPhone: "6315550167",
      preferredContactMethod: "email",
      source: "Truck QR",
      propertyType: "single_family",
      addressStreet: "31 Cedar Hollow Ct",
      addressCity: "Melville",
      addressZip: "11747",
      serviceLines: [
        makeLine("patio-wash", 700, "Large"),
        makeLine("fence-wash", 200, "Standard"),
      ],
      stories: 1,
      urgency: "flexible",
      riskProfile: {
        ...defaultRiskProfile,
        surfaceCondition: "heavy",
        access: ["heavy_furniture"],
      },
      serviceDetails: {
        fenceSides: "both",
        patioFurnitureLevel: "heavy",
      },
      photoAttachments: [demoPhoto],
      notes: "Pool patio and vinyl fence. Furniture can be moved by homeowner if needed.",
      createdDaysAgo: 2,
    }),
    makeQuote(store, {
      id: "demo_lighting",
      customerName: "Chris Romano",
      customerEmail: "chris.romano@example.com",
      customerPhone: "6315550133",
      preferredContactMethod: "call",
      source: "Referral",
      propertyType: "single_family",
      addressStreet: "12 Briarwood Pl",
      addressCity: "Dix Hills",
      addressZip: "11746",
      serviceLines: [makeLine("permanent-lighting", 2, "Standard")],
      stories: 2,
      urgency: "this_month",
      photoAttachments: [],
      notes: "Interested in front roofline and side returns before fall. Needs survey.",
      status: "sent",
      createdDaysAgo: 3,
    }),
  ];
}
