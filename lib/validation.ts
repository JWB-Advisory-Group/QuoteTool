import { z } from "zod";

const CONTROL_CHARS = /\p{Cc}/gu;

const cleanString = (max: number) =>
  z
    .string()
    .transform((value) => value.replace(CONTROL_CHARS, "").trim())
    .pipe(z.string().max(max));

const cleanOptional = (max: number) =>
  z
    .string()
    .optional()
    .default("")
    .transform((value) => (value ?? "").replace(CONTROL_CHARS, "").trim())
    .pipe(z.string().max(max));

const riskProfileSchema = z.object({
  surfaceCondition: z
    .enum(["light", "moderate", "heavy", "oxidation", "restoration"])
    .default("moderate"),
  roofPitch: z
    .enum(["low", "standard", "steep", "very_steep", "not_sure"])
    .default("standard"),
  roofWalkable: z.enum(["yes", "no", "not_sure"]).default("not_sure"),
  waterAccess: z.enum(["confirmed", "not_sure", "none"]).default("confirmed"),
  access: z
    .array(
      z.enum([
        "tight_side_yard",
        "locked_gate",
        "long_hose_pull",
        "no_driveway",
        "no_spigot",
        "ladder_work",
        "steep_property",
        "pool_equipment",
        "pets",
        "fragile_surface",
        "gutter_guards",
        "heavy_furniture",
      ]),
    )
    .default([]),
  windowDetails: z
    .array(
      z.enum([
        "exterior_only",
        "inside_outside",
        "screens",
        "tracks",
        "storm_windows",
        "french_panes",
        "hard_water",
        "ladder_windows",
      ]),
    )
    .default([]),
});

const serviceDetailsSchema = z.object({
  roofMossSeverity: z
    .enum(["none", "light", "heavy", "not_sure"])
    .default("not_sure"),
  roofPlantProtection: z
    .enum(["standard", "heavy", "not_sure"])
    .default("not_sure"),
  gutterGuards: z.enum(["none", "some", "all", "not_sure"]).default("not_sure"),
  downspoutConcern: z.coerce.boolean().default(false),
  fenceSides: z.enum(["one", "both", "not_sure"]).default("not_sure"),
  paverCondition: z
    .enum(["standard", "weeds", "failed_sealer", "sanding_sealing", "not_sure"])
    .default("standard"),
  screenCount: z.coerce.number().int().min(0).max(300).nullable().default(null),
  stormWindowCount: z.coerce.number().int().min(0).max(300).nullable().default(null),
  hardWaterPanes: z.coerce.number().int().min(0).max(300).nullable().default(null),
  patioFurnitureLevel: z
    .enum(["none", "light", "heavy", "not_sure"])
    .default("not_sure"),
  solarPanelPitch: z
    .enum(["low", "standard", "steep", "not_sure"])
    .default("not_sure"),
});

const photoAttachmentSchema = z.object({
  id: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(120),
  dataUrl: z.string().startsWith("data:image/").max(2_600_000),
});

const preferredWindowSchema = z.object({
  day: z.string().trim().min(1).max(40),
  time: z.enum(["morning", "afternoon", "flexible"]),
});

const propertyTypeSchema = z
  .enum([
    "single_family",
    "townhome",
    "condo",
    "multi_family",
    "commercial",
    "hoa",
    "other",
  ])
  .default("single_family");

const preferredContactMethodSchema = z
  .enum(["text", "call", "email"])
  .default("text");

const KNOWN_SERVICE_SLUGS = [
  "house-wash",
  "window-cleaning",
  "roof-wash",
  "gutters",
  "patio-wash",
  "fence-wash",
  "paver-refresh",
  "solar-panels",
  "permanent-lighting",
  "painting",
] as const;

const knownServiceSlug = z.enum(KNOWN_SERVICE_SLUGS);

export const quoteRequestSchema = z.object({
  customerName: cleanString(120).pipe(z.string().min(1, "Name is required")),
  customerEmail: z
    .union([z.literal(""), z.string().trim().email("Email looks invalid").max(254)])
    .default(""),
  customerPhone: cleanOptional(40),
  preferredContactMethod: preferredContactMethodSchema,
  source: cleanOptional(80).transform((value) => value || "Not provided"),
  propertyType: propertyTypeSchema,
  addressStreet: cleanString(200).pipe(z.string().min(1, "Street address is required")),
  addressCity: cleanString(100).pipe(z.string().min(1, "City is required")),
  addressZip: z.string().trim().regex(/^\d{5}$/, "ZIP must be 5 digits"),
  serviceSlug: knownServiceSlug,
  jobSize: z.coerce.number().positive().max(1_000_000),
  jobSizeLabel: z.string().trim().min(1).max(64),
  serviceLines: z
    .array(
      z.object({
        serviceSlug: knownServiceSlug,
        jobSize: z.coerce.number().positive().max(1_000_000),
        jobSizeLabel: z.string().trim().min(1).max(64),
      }),
    )
    .min(1)
    .max(8)
    .optional(),
  stories: z.coerce.number().int().min(1).max(3),
  urgency: z.enum(["asap", "this_week", "this_month", "flexible"]),
  serviceDetails: serviceDetailsSchema.default({
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
  }),
  riskProfile: riskProfileSchema.default({
    surfaceCondition: "moderate",
    roofPitch: "standard",
    roofWalkable: "not_sure",
    waterAccess: "confirmed",
    access: [],
    windowDetails: [],
  }),
  photoAttachments: z.array(photoAttachmentSchema).max(6).default([]),
  preferredWindows: z.array(preferredWindowSchema).max(3).default([]),
  notes: cleanOptional(2000),
}).superRefine((data, ctx) => {
  const hasPhone = data.customerPhone.replace(/\D/g, "").length >= 10;
  const hasEmail = Boolean(data.customerEmail.trim());

  if (!hasPhone && !hasEmail) {
    ctx.addIssue({
      code: "custom",
      path: ["customerPhone"],
      message: "Add a phone number or email so Dante can respond.",
    });
  }
  if (data.preferredContactMethod !== "email" && !hasPhone) {
    ctx.addIssue({
      code: "custom",
      path: ["customerPhone"],
      message: "Text or call requires a phone number.",
    });
  }
  if (data.preferredContactMethod === "email" && !hasEmail) {
    ctx.addIssue({
      code: "custom",
      path: ["customerEmail"],
      message: "Email is required if email is your preferred contact method.",
    });
  }
});

export const previewRequestSchema = z.object({
  serviceSlug: knownServiceSlug,
  jobSize: z.coerce.number().positive().max(1_000_000),
  stories: z.coerce.number().int().min(1).max(3),
  urgency: z.enum(["asap", "this_week", "this_month", "flexible"]),
  zip: z.string().trim().regex(/^\d{5}$/),
});

export const sendQuoteSchema = z.object({
  amount: z.coerce.number().positive().max(1_000_000),
  reviewConfirmed: z.coerce.boolean().default(false),
  overrideReason: cleanOptional(500),
});

export const approveQuoteSchema = z.object({
  selectedPackageId: z
    .enum(["essential", "best_value", "full_refresh"])
    .optional(),
  selectedPrice: z.coerce.number().positive().max(1_000_000),
  preferredDates: z.array(preferredWindowSchema).max(4).default([]),
  customerNote: cleanOptional(500),
  acceptedUpsellIds: z.array(z.string().trim().min(1).max(64)).max(6).default([]),
  acceptedUpsellsLift: z.coerce.number().min(0).max(20000).default(0),
  scopeAccepted: z.coerce.boolean().default(false),
});

export const requestPhotosSchema = z.object({
  channel: z.enum(["sms", "email", "both"]).default("both"),
});

export const quotePhotosSchema = z.object({
  photoAttachments: z.array(photoAttachmentSchema).min(1).max(6),
});

export const followUpSchema = z.object({
  taskId: z.string().trim().min(1).max(64),
  channel: z.enum(["sms", "email", "call"]).default("sms"),
  message: cleanOptional(700),
});

export const quoteStatusSchema = z.object({
  status: z.enum([
    "pending",
    "contacted",
    "sent",
    "approved",
    "awaiting_deposit",
    "scheduled",
    "won",
    "lost",
    "no_response",
  ]),
});

export const jobActualsSchema = z.object({
  hours: z.coerce.number().positive().max(48).nullable(),
  crewCount: z.coerce.number().int().min(1).max(6).nullable().default(null),
  materialUsage: z.enum(["less", "normal", "more"]).nullable(),
  addedRevenue: z.coerce.number().min(0).max(1_000_000).nullable().default(null),
  materialNotes: cleanOptional(500),
  reasonCodes: z
    .array(
      z.enum([
        "access_slowdown",
        "heavy_buildup",
        "extra_ladder_work",
        "chemical_demand",
        "customer_added_scope",
        "weather_delay",
        "priced_too_low",
        "priced_correctly",
      ]),
    )
    .default([]),
  tags: z
    .array(z.enum(["easy", "tough", "long_drive", "add_on", "customer_issue"]))
    .default([]),
});

export const outcomeSchema = z.object({
  outcome: z.enum(["won", "lost", "no_response", "later"]),
  amount: z.coerce.number().positive().max(1_000_000).optional(),
  notes: cleanOptional(700),
  actuals: jobActualsSchema.optional().nullable(),
});

export const costInputUpdateSchema = z.object({
  hourlyLaborRate: z.coerce.number().min(0).max(1000),
  materialCostPerUnit: z.coerce.number().min(0).max(10000),
  equipmentWearPerHour: z.coerce.number().min(0).max(1000),
  hoursPerUnit: z.coerce.number().min(0).max(100),
  driveReserveMinutes: z.coerce.number().min(0).max(240),
  overheadPct: z.coerce.number().min(0).max(1),
  minMarginPct: z.coerce.number().min(0).max(1),
  serviceMinimum: z.coerce.number().min(0).max(100_000),
  depositThreshold: z.coerce.number().min(0).max(100_000),
  bufferActive: z.coerce.boolean(),
});

export const onboardingSchema = z.object({
  typicalSize: z.coerce.number().positive().max(1_000_000),
  typicalHours: z.coerce.number().positive().max(48),
  typicalCharge: z.coerce.number().positive().max(1_000_000),
  driveMinutes: z.coerce.number().min(0).max(240),
});
