import { roundToFive } from "@/lib/format";
import { validateAddress } from "@/lib/address-validation";
import type {
  AddressValidation,
  AppStore,
  BundleRecommendation,
  CostInput,
  CompetitorPrice,
  FollowUpTask,
  IntakeRequirements,
  MarketComparison,
  PhotoAttachment,
  PricingEstimate,
  PricingInput,
  QuotePackageOption,
  QuoteRiskProfile,
  ScheduleWindowOption,
  QuoteServiceDetails,
  QuoteServiceLine,
  Service,
  ServiceEstimateBreakdown,
} from "@/lib/types";

const urgencyAdjustments: Record<string, number> = {
  asap: 1.16,
  this_week: 1.08,
  this_month: 1,
  flexible: 0.97,
};

const defaultDriveReserveMinutes: Record<string, number> = {
  "house-wash": 30,
  "window-cleaning": 30,
  "roof-wash": 40,
  gutters: 30,
  "patio-wash": 30,
  "fence-wash": 35,
  "paver-refresh": 40,
  "solar-panels": 30,
  "permanent-lighting": 45,
  painting: 45,
};

const defaultServiceMinimums: Record<string, number> = {
  "house-wash": 350,
  "window-cleaning": 225,
  "roof-wash": 650,
  gutters: 225,
  "patio-wash": 225,
  "fence-wash": 275,
  "paver-refresh": 500,
  "solar-panels": 225,
  "permanent-lighting": 900,
  painting: 750,
};

const serviceScopes: Record<string, { include: string[]; exclude: string[] }> = {
  "house-wash": {
    include: [
      "Soft wash of exterior siding, trim, soffits, and accessible exterior surfaces",
      "Standard algae and organic growth treatment",
    ],
    exclude: [
      "Oxidation removal, paint correction, detached structures, and interior windows",
      "Moving heavy furniture or clearing locked access points",
    ],
  },
  "window-cleaning": {
    include: ["Exterior glass cleaning for selected window count"],
    exclude: [
      "Storm windows, hard water removal, tracks, and screens unless added to scope",
    ],
  },
  "roof-wash": {
    include: ["Soft wash roof treatment with plant and runoff protection planning"],
    exclude: ["Roof repairs, roof walking guarantees, and gutter repairs"],
  },
  gutters: {
    include: ["Gutter cleanout for selected linear footage"],
    exclude: ["Gutter repairs, underground drain clearing, and guard removal unless noted"],
  },
  "patio-wash": {
    include: ["Surface wash for selected patio or walkway square footage"],
    exclude: ["Sealing, sanding, rust/oil treatment, and furniture moving unless noted"],
  },
  "fence-wash": {
    include: ["Fence wash for selected linear footage and normal organic buildup"],
    exclude: ["Stain removal, old paint risk, repairs, and both sides unless noted"],
  },
  "paver-refresh": {
    include: ["Paver surface cleaning and restoration review for selected square footage"],
    exclude: ["Polymeric sand, sealing, failed sealer removal, and weed remediation unless quoted"],
  },
  "solar-panels": {
    include: ["Solar panel rinse/cleaning for selected panel count"],
    exclude: ["Electrical diagnostics, roof repairs, and unsafe roof access"],
  },
  "permanent-lighting": {
    include: ["Permanent lighting lead intake and budgetary install range"],
    exclude: ["Electrical upgrades, custom controls, and final install survey"],
  },
  painting: {
    include: ["Painting lead intake and budgetary project range"],
    exclude: ["Repairs, lead paint remediation, and final paint/material selection"],
  },
};

export const urgencyOptions = [
  { value: "asap", label: "ASAP" },
  { value: "this_week", label: "This week" },
  { value: "this_month", label: "This month" },
  { value: "flexible", label: "Flexible" },
];

export const sourceOptions = [
  "Truck QR",
  "Yard sign",
  "Nextdoor",
  "Google",
  "Referral",
  "Repeat customer",
  "Other",
];

export function getService(store: AppStore, slug: string) {
  return store.services.find((service) => service.slug === slug);
}

export function getCostInput(store: AppStore, serviceSlug: string) {
  return store.costInputs.find((input) => input.serviceSlug === serviceSlug);
}

function unitsFor(service: Service, jobSize: number) {
  if (service.unit === "per_1000_sqft") return jobSize / 1000;
  if (service.unit === "per_100_sqft") return jobSize / 100;
  if (service.unit === "per_100_linear_ft") return jobSize / 100;
  if (service.unit === "per_window") return jobSize;
  if (service.unit === "per_panel") return jobSize;
  return 1;
}

function getStoryMultiplier(stories: number) {
  if (stories <= 1) return 1;
  if (stories === 2) return 1.12;
  return 1.25;
}

function fallbackRiskProfile(): QuoteRiskProfile {
  return {
    surfaceCondition: "moderate",
    roofPitch: "standard",
    roofWalkable: "not_sure",
    waterAccess: "confirmed",
    access: [],
    windowDetails: [],
  };
}

export function fallbackServiceDetails(): QuoteServiceDetails {
  return {
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
  };
}

function serviceLinesFromInput(input: PricingInput): QuoteServiceLine[] {
  if (input.serviceLines && input.serviceLines.length > 0) {
    return input.serviceLines;
  }

  return [
    {
      serviceSlug: input.serviceSlug,
      jobSize: input.jobSize,
      jobSizeLabel: input.jobSizeLabel ?? "Custom",
    },
  ];
}

function serviceMinimum(input: CostInput) {
  return input.serviceMinimum ?? defaultServiceMinimums[input.serviceSlug] ?? 225;
}

function depositThreshold(input: CostInput) {
  return input.depositThreshold ?? 900;
}

export function getRoutePlan(zip: string) {
  if (/^1174[3-9]$/.test(zip) || ["11721", "11725", "11731"].includes(zip)) {
    return {
      zone: "Core Huntington route",
      driveMinutes: 20,
      minimumMultiplier: 1,
      manualReason: "",
    };
  }

  if (/^117|^119/.test(zip)) {
    return {
      zone: "Suffolk route",
      driveMinutes: 40,
      minimumMultiplier: 1.08,
      manualReason: "",
    };
  }

  if (/^11[05-8]/.test(zip)) {
    return {
      zone: "Nassau route",
      driveMinutes: 55,
      minimumMultiplier: 1.18,
      manualReason: "Nassau drive time may need route-fit confirmation.",
    };
  }

  return {
    zone: "Manual service-area review",
    driveMinutes: 75,
    minimumMultiplier: 1.35,
    manualReason: "Address may be outside the normal Long Island service route.",
  };
}

function riskFor(
  riskProfile: QuoteRiskProfile,
  serviceSlug: string,
  serviceDetails: QuoteServiceDetails = fallbackServiceDetails(),
  photoAttachments: PhotoAttachment[] = [],
) {
  let timeMultiplier = 1;
  let materialMultiplier = 1;
  const reasons: string[] = [];

  if (riskProfile.surfaceCondition === "heavy") {
    timeMultiplier += 0.14;
    materialMultiplier += 0.18;
    reasons.push("Heavy organic growth needs extra dwell/rinse time.");
  }
  if (riskProfile.surfaceCondition === "oxidation") {
    timeMultiplier += 0.22;
    materialMultiplier += 0.08;
    reasons.push("Oxidation risk needs manual review before promising results.");
  }
  if (riskProfile.surfaceCondition === "restoration") {
    timeMultiplier += 0.3;
    materialMultiplier += 0.2;
    reasons.push("Restoration-level staining should be scoped before sending a firm price.");
  }

  if (riskProfile.waterAccess === "not_sure") {
    timeMultiplier += 0.06;
    reasons.push("Water access is not confirmed.");
  }
  if (riskProfile.waterAccess === "none") {
    timeMultiplier += 0.18;
    reasons.push("No outdoor water source may require a different setup.");
  }

  const accessPenalty = riskProfile.access.length * 0.035;
  if (accessPenalty > 0) timeMultiplier += Math.min(0.24, accessPenalty);

  const accessReasonMap: Partial<Record<string, string>> = {
    tight_side_yard: "Tight side-yard access can slow setup.",
    locked_gate: "Locked gate/access coordination needed.",
    long_hose_pull: "Long hose pull adds setup time.",
    no_driveway: "No driveway/parking may slow setup.",
    no_spigot: "No outdoor spigot may require manual review.",
    ladder_work: "Ladder-heavy work increases risk and time.",
    steep_property: "Steep property increases setup risk.",
    pool_equipment: "Pool equipment needs protection/clearance.",
    pets: "Pets require access coordination.",
    fragile_surface: "Fragile surface needs manual scope protection.",
    gutter_guards: "Gutter guards can materially change gutter cleanout time.",
    heavy_furniture: "Furniture movement is not included by default.",
  };
  for (const concern of riskProfile.access) {
    const reason = accessReasonMap[concern];
    if (reason) reasons.push(reason);
  }

  const serviceRisk = serviceSpecificRiskFor(
    serviceSlug,
    riskProfile,
    serviceDetails,
  );
  timeMultiplier += serviceRisk.timeAdd;
  materialMultiplier += serviceRisk.materialAdd;
  reasons.push(...serviceRisk.reasons);

  if (photoAttachments.length === 0) {
    reasons.push("No photos yet; quote should stay range-based until photos arrive.");
  }

  return {
    timeMultiplier,
    materialMultiplier,
    reasons: [...new Set(reasons)],
  };
}

function serviceSpecificRiskFor(
  serviceSlug: string,
  riskProfile: QuoteRiskProfile,
  serviceDetails: QuoteServiceDetails,
) {
  if (serviceSlug === "window-cleaning") {
    return windowRiskFor(riskProfile, serviceDetails);
  }
  if (serviceSlug === "roof-wash") {
    return roofRiskFor(riskProfile, serviceDetails);
  }
  if (serviceSlug === "gutters") {
    return gutterRiskFor(riskProfile, serviceDetails);
  }
  if (serviceSlug === "fence-wash") {
    return fenceRiskFor(riskProfile, serviceDetails);
  }
  if (serviceSlug === "paver-refresh") {
    return paverRiskFor(riskProfile, serviceDetails);
  }
  if (serviceSlug === "patio-wash") {
    return patioRiskFor(riskProfile, serviceDetails);
  }
  if (serviceSlug === "solar-panels") {
    return solarRiskFor(serviceDetails);
  }
  return { timeAdd: 0, materialAdd: 0, reasons: [] as string[] };
}

function windowRiskFor(
  riskProfile: QuoteRiskProfile,
  serviceDetails: QuoteServiceDetails,
) {
  const windowDetailWeights: Record<string, { time: number; material: number; reason?: string }> = {
    exterior_only: { time: 0, material: 0 },
    inside_outside: { time: 0.18, material: 0.04, reason: "Interior windows nearly double the time." },
    screens: { time: 0.08, material: 0.02, reason: "Screen cleaning adds setup and dry time." },
    tracks: { time: 0.1, material: 0.02, reason: "Tracks require detail work per window." },
    storm_windows: { time: 0.22, material: 0.04, reason: "Storm windows should be priced as a separate scope." },
    french_panes: { time: 0.16, material: 0.02, reason: "Divided/french panes multiply touch points per window." },
    hard_water: { time: 0.14, material: 0.18, reason: "Hard water removal is excluded unless quoted as restoration." },
    ladder_windows: { time: 0.18, material: 0.04, reason: "High glass requires extension ladder and second tech." },
  };
  let timeAdd = 0;
  let materialAdd = 0;
  const reasons: string[] = [];
  for (const detail of riskProfile.windowDetails) {
    const weight = windowDetailWeights[detail];
    if (!weight) continue;
    timeAdd += weight.time;
    materialAdd += weight.material;
    if (weight.reason) reasons.push(weight.reason);
  }
  if ((serviceDetails.screenCount ?? 0) > 20) {
    timeAdd += 0.08;
    reasons.push("High screen count adds handling and drying time.");
  }
  if ((serviceDetails.stormWindowCount ?? 0) > 0) {
    timeAdd += 0.18;
    materialAdd += 0.04;
    reasons.push("Storm windows need a confirmed count before final pricing.");
  }
  if ((serviceDetails.hardWaterPanes ?? 0) > 0) {
    timeAdd += 0.16;
    materialAdd += 0.16;
    reasons.push("Hard-water panes should be quoted as restoration, not normal glass cleaning.");
  }
  return {
    timeAdd: Math.min(0.7, timeAdd),
    materialAdd: Math.min(0.4, materialAdd),
    reasons,
  };
}

function roofRiskFor(
  riskProfile: QuoteRiskProfile,
  serviceDetails: QuoteServiceDetails,
) {
  let timeAdd = 0;
  let materialAdd = 0;
  const reasons: string[] = [];
  if (riskProfile.roofPitch === "steep") {
    timeAdd += 0.2;
    materialAdd += 0.08;
    reasons.push("Steep roof pitch requires extra safety and runoff planning.");
  }
  if (riskProfile.roofPitch === "very_steep") {
    timeAdd += 0.38;
    materialAdd += 0.14;
    reasons.push("Very steep roof should be reviewed before final quote.");
  }
  if (riskProfile.roofPitch === "not_sure") {
    reasons.push("Roof pitch not confirmed; quote should stay range-based.");
  }
  if (riskProfile.roofWalkable === "no") {
    timeAdd += 0.2;
    materialAdd += 0.06;
    reasons.push("Non-walkable roof requires ladder-only soft wash; more time and chemical needed.");
  }
  if (riskProfile.roofWalkable === "not_sure") {
    reasons.push("Roof walkability not confirmed; manual review before sending.");
  }
  if (serviceDetails.roofMossSeverity === "heavy") {
    timeAdd += 0.2;
    materialAdd += 0.18;
    reasons.push("Heavy roof moss needs stronger chemical planning and manual confirmation.");
  }
  if (serviceDetails.roofPlantProtection === "heavy") {
    timeAdd += 0.1;
    materialAdd += 0.04;
    reasons.push("Heavy landscaping protection adds setup and rinse time.");
  }
  return { timeAdd, materialAdd, reasons };
}

function gutterRiskFor(
  riskProfile: QuoteRiskProfile,
  serviceDetails: QuoteServiceDetails,
) {
  let timeAdd = 0;
  const reasons: string[] = [];
  if (serviceDetails.gutterGuards === "some") {
    timeAdd += 0.14;
    reasons.push("Some gutter guards may slow cleanout.");
  }
  if (serviceDetails.gutterGuards === "all") {
    timeAdd += 0.28;
    reasons.push("Full gutter guard removal/reinstall needs manual confirmation.");
  }
  if (serviceDetails.gutterGuards === "not_sure" || riskProfile.access.includes("gutter_guards")) {
    reasons.push("Gutter guard status should be confirmed before final pricing.");
  }
  if (serviceDetails.downspoutConcern) {
    timeAdd += 0.1;
    reasons.push("Downspout issues may require extra clearing time.");
  }
  return { timeAdd, materialAdd: 0, reasons };
}

function fenceRiskFor(
  riskProfile: QuoteRiskProfile,
  serviceDetails: QuoteServiceDetails,
) {
  let timeAdd = 0;
  let materialAdd = riskProfile.surfaceCondition === "heavy" ? 0.08 : 0;
  const reasons: string[] = [];
  if (serviceDetails.fenceSides === "both") {
    timeAdd += 0.55;
    materialAdd += 0.25;
    reasons.push("Both sides of the fence materially changes time and chemical use.");
  }
  if (serviceDetails.fenceSides === "not_sure") {
    reasons.push("Fence side count should be confirmed before final pricing.");
  }
  if (riskProfile.surfaceCondition === "restoration") {
    reasons.push("Restoration work may need sanding/sealing or stain-specific pricing.");
  }
  return { timeAdd, materialAdd, reasons };
}

function paverRiskFor(
  riskProfile: QuoteRiskProfile,
  serviceDetails: QuoteServiceDetails,
) {
  let timeAdd = 0;
  let materialAdd = riskProfile.surfaceCondition === "heavy" ? 0.08 : 0;
  const reasons: string[] = [];
  if (serviceDetails.paverCondition === "weeds") {
    timeAdd += 0.12;
    reasons.push("Weeds between pavers add prep and cleanup time.");
  }
  if (serviceDetails.paverCondition === "failed_sealer") {
    timeAdd += 0.25;
    materialAdd += 0.12;
    reasons.push("Failed sealer is restoration work and needs manual scope confirmation.");
  }
  if (serviceDetails.paverCondition === "sanding_sealing") {
    reasons.push("Polymeric sand or sealing should be quoted as a separate premium scope.");
  }
  if (riskProfile.surfaceCondition === "restoration") {
    reasons.push("Restoration work may need sanding/sealing or stain-specific pricing.");
  }
  return { timeAdd, materialAdd, reasons };
}

function patioRiskFor(
  riskProfile: QuoteRiskProfile,
  serviceDetails: QuoteServiceDetails,
) {
  let timeAdd = 0;
  const materialAdd = riskProfile.surfaceCondition === "heavy" ? 0.08 : 0;
  const reasons: string[] = [];
  if (serviceDetails.patioFurnitureLevel === "light") {
    timeAdd += 0.06;
    reasons.push("Light patio furniture moving should be confirmed before scheduling.");
  }
  if (serviceDetails.patioFurnitureLevel === "heavy") {
    timeAdd += 0.18;
    reasons.push("Heavy patio furniture can materially change time and should be excluded or added.");
  }
  if (serviceDetails.patioFurnitureLevel === "not_sure") {
    reasons.push("Patio furniture level should be confirmed before final scheduling.");
  }
  return { timeAdd, materialAdd, reasons };
}

function solarRiskFor(serviceDetails: QuoteServiceDetails) {
  let timeAdd = 0;
  const reasons: string[] = [];
  if (serviceDetails.solarPanelPitch === "steep") {
    timeAdd += 0.18;
    reasons.push("Steep solar panel access requires ladder/safety confirmation.");
  }
  if (serviceDetails.solarPanelPitch === "not_sure") {
    reasons.push("Solar panel roof pitch should be confirmed before final pricing.");
  }
  return { timeAdd, materialAdd: 0.02, reasons };
}

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function addBusinessDays(days: number) {
  const date = new Date();
  let remaining = days;
  while (remaining > 0) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return date.toISOString().slice(0, 10);
}

function seasonDemandFor(date = new Date()) {
  const month = date.getMonth() + 1;
  if (month >= 4 && month <= 6) {
    return {
      label: "Peak exterior-cleaning season",
      multiplier: 1.08,
      ownerNote: "Protect schedule capacity; avoid discounting prime route slots.",
    };
  }
  if (month >= 7 && month <= 9) {
    return {
      label: "Summer maintenance season",
      multiplier: 1.04,
      ownerNote: "Demand is still healthy; favor route-fit jobs.",
    };
  }
  if (month >= 11 || month <= 2) {
    return {
      label: "Off-season route fill",
      multiplier: 0.97,
      ownerNote: "Use flexibility to fill routes, but do not break floor.",
    };
  }
  return {
    label: "Normal demand",
    multiplier: 1,
    ownerNote: "Standard pricing pressure.",
  };
}

function crewBlockFor(hours: number, crewSize: number) {
  const clockHours = hours / Math.max(crewSize, 1);
  if (clockHours <= 2.5) return `${crewSize} tech, short route stop`;
  if (clockHours <= 4.5) return `${crewSize} tech${crewSize > 1 ? "s" : ""}, half day`;
  if (clockHours <= 7) return `${crewSize} tech${crewSize > 1 ? "s" : ""}, long half day`;
  return `${crewSize} tech${crewSize > 1 ? "s" : ""}, full day`;
}

function availabilityFor(
  urgency: string,
  leadQuality: string,
  manualReviewReasons: string[],
) {
  if (manualReviewReasons.length > 0 && leadQuality !== "good") {
    return "After photo/manual review";
  }
  if (urgency === "asap") return "Next premium opening";
  if (urgency === "this_week") return "2-4 day route window";
  if (urgency === "this_month") return "Next 1-2 weeks";
  return "Flexible route fill";
}

function scheduleWindowsFor(
  urgency: string,
  leadQuality: string,
  manualReviewReasons: string[],
  routeZone: string,
): ScheduleWindowOption[] {
  const routeFit =
    routeZone === "Core Huntington route"
      ? "excellent"
      : routeZone === "Manual service-area review"
        ? "needs_review"
        : "good";
  const reviewGated = manualReviewReasons.length > 0 && leadQuality !== "good";
  const baseDelay = reviewGated ? 3 : urgency === "asap" ? 1 : urgency === "this_week" ? 2 : 5;

  return [
    {
      id: "premium_opening",
      label: "Premium opening",
      customerLabel: "ASAP premium opening",
      earliestDate: addBusinessDays(Math.max(1, baseDelay - 1)),
      time: "flexible",
      routeFit,
      urgencyPremiumPct: urgency === "asap" ? 12 : 6,
      ownerNote: "Use only if schedule is tight or customer has a real deadline.",
    },
    {
      id: "route_fit",
      label: "Best route fit",
      customerLabel: "Best route-fit opening",
      earliestDate: addBusinessDays(baseDelay + 1),
      time: "morning",
      routeFit,
      urgencyPremiumPct: 0,
      ownerNote: "Best margin protection because drive/setup waste is lowest.",
    },
    {
      id: "standard_window",
      label: "Standard window",
      customerLabel: "Weekday standard window",
      earliestDate: addBusinessDays(baseDelay + 3),
      time: "afternoon",
      routeFit,
      urgencyPremiumPct: 0,
      ownerNote: "Normal follow-up window for good leads without deadline pressure.",
    },
    {
      id: "flex_fill",
      label: "Flexible route fill",
      customerLabel: "Flexible route fill",
      earliestDate: addBusinessDays(baseDelay + 7),
      time: "flexible",
      routeFit,
      urgencyPremiumPct: -3,
      ownerNote: "Use to keep slower weeks full without discounting below floor.",
    },
  ];
}

function suggestedAddOnsFor(lines: QuoteServiceLine[]) {
  const selected = new Set(lines.map((line) => line.serviceSlug));
  const suggestions: string[] = [];
  if (selected.has("house-wash") && !selected.has("window-cleaning")) {
    suggestions.push("Exterior windows after the house wash");
  }
  if (selected.has("house-wash") && !selected.has("patio-wash")) {
    suggestions.push("Patio or walkway refresh while equipment is already set up");
  }
  if (!selected.has("gutters")) {
    suggestions.push("Gutter cleanout or whitening check");
  }
  if (selected.has("roof-wash") && !selected.has("house-wash")) {
    suggestions.push("House rinse after roof treatment runoff");
  }
  if (selected.has("paver-refresh")) {
    suggestions.push("Polymeric sand/sealing review as a separate premium scope");
  }
  return suggestions.slice(0, 4);
}

function bundleRecommendationsFor(
  lines: QuoteServiceLine[],
  recommendedAsk: number,
): BundleRecommendation[] {
  const selected = new Set(lines.map((line) => line.serviceSlug));
  const recommendations: BundleRecommendation[] = [];

  if (selected.has("house-wash") && !selected.has("window-cleaning")) {
    recommendations.push({
      id: "house_windows",
      title: "House wash + exterior windows",
      services: ["House wash", "Exterior windows"],
      reason: "Glass usually looks worse after fresh siding if it is skipped.",
      estimatedLift: roundToFive(Math.max(150, recommendedAsk * 0.18)),
      ownerNote: "Natural curb-appeal upsell; discount shared setup only.",
    });
  }
  if (selected.has("house-wash") && !selected.has("patio-wash")) {
    recommendations.push({
      id: "house_patio",
      title: "House wash + patio/walkway",
      services: ["House wash", "Patio / walkway wash"],
      reason: "Same hoses and surface equipment are already on site.",
      estimatedLift: roundToFive(Math.max(175, recommendedAsk * 0.2)),
      ownerNote: "Good route-margin add-on when furniture is light.",
    });
  }
  if (selected.has("roof-wash") && !selected.has("house-wash")) {
    recommendations.push({
      id: "roof_rinse_house",
      title: "Roof treatment + house rinse",
      services: ["Roof wash", "House rinse"],
      reason: "Runoff planning is cleaner when siding rinse is included.",
      estimatedLift: roundToFive(Math.max(225, recommendedAsk * 0.16)),
      ownerNote: "Useful scope-control upsell after roof chemical work.",
    });
  }
  if (selected.has("paver-refresh")) {
    recommendations.push({
      id: "paver_restoration",
      title: "Paver restoration review",
      services: ["Paver refresh", "Sand/seal review"],
      reason: "Cleaning often exposes joint sand or failed sealer issues.",
      estimatedLift: roundToFive(Math.max(300, recommendedAsk * 0.28)),
      ownerNote: "Keep final restoration price survey-gated.",
    });
  }
  if (!selected.has("gutters") && (selected.has("house-wash") || selected.has("roof-wash"))) {
    recommendations.push({
      id: "gutter_check",
      title: "Gutter cleanout check",
      services: ["Gutter cleanout"],
      reason: "Height setup is already planned, so it is a logical same-visit add-on.",
      estimatedLift: 225,
      ownerNote: "Confirm guards before committing a final price.",
    });
  }

  return recommendations.slice(0, 4);
}

const photoRequirementsByService: Record<string, string[]> = {
  "house-wash": ["Front of home", "Left and right sides", "Worst green/dirty area"],
  "window-cleaning": ["Front windows", "Screens/storm windows if present", "Any high or hard-water glass"],
  "roof-wash": ["Roof from front", "Roof from back/side", "Heavy moss or black streaks", "Landscaping under roofline"],
  gutters: ["Front gutter line", "Highest gutter section", "Any guards or downspout issue"],
  "patio-wash": ["Full patio/walkway", "Furniture or obstacles", "Worst stains"],
  "fence-wash": ["Full fence run", "Close-up of buildup", "Both sides if requested"],
  "paver-refresh": ["Full paver area", "Close-up of joints", "Sealer/weeds/stains"],
  "solar-panels": ["Panel layout", "Roof access angle"],
  "permanent-lighting": ["Front roofline", "Corners/returns", "Power/control location"],
  painting: ["Each side/room", "Damaged surfaces", "Paint failure or repairs"],
};

function intakeRequirementsFor(
  lines: QuoteServiceLine[],
  riskProfile: QuoteRiskProfile,
  serviceDetails: QuoteServiceDetails,
  photoAttachments: PhotoAttachment[],
): IntakeRequirements {
  const selected = new Set(lines.map((line) => line.serviceSlug));
  const requiredPhotos = Array.from(
    new Set(lines.flatMap((line) => photoRequirementsByService[line.serviceSlug] ?? [])),
  ).slice(0, 8);
  const missingDetails: string[] = [];

  if (photoAttachments.length === 0) {
    missingDetails.push("No photos attached; keep quote review-gated.");
  } else if (photoAttachments.length < Math.min(3, requiredPhotos.length)) {
    missingDetails.push("Photo set is thin; confirm hidden sides/problem areas.");
  }
  if (selected.has("window-cleaning") && riskProfile.windowDetails.length === 0) {
    missingDetails.push("Window scope needs exterior/interior/screens/storm detail.");
  }
  if (selected.has("window-cleaning") && riskProfile.windowDetails.includes("hard_water") && !serviceDetails.hardWaterPanes) {
    missingDetails.push("Hard-water pane count is missing.");
  }
  if (selected.has("roof-wash") && riskProfile.roofPitch === "not_sure") {
    missingDetails.push("Roof pitch is not confirmed.");
  }
  if (selected.has("roof-wash") && riskProfile.roofWalkable === "not_sure") {
    missingDetails.push("Roof access/walkability is not confirmed.");
  }
  if (selected.has("gutters") && serviceDetails.gutterGuards === "not_sure") {
    missingDetails.push("Gutter guard status is not confirmed.");
  }
  if (selected.has("fence-wash") && serviceDetails.fenceSides === "not_sure") {
    missingDetails.push("Fence side count is not confirmed.");
  }
  if (selected.has("patio-wash") && serviceDetails.patioFurnitureLevel === "not_sure") {
    missingDetails.push("Patio furniture/obstacle level is not confirmed.");
  }
  if (selected.has("paver-refresh") && serviceDetails.paverCondition === "not_sure") {
    missingDetails.push("Paver condition is not confirmed.");
  }
  if (selected.has("solar-panels") && serviceDetails.solarPanelPitch === "not_sure") {
    missingDetails.push("Solar panel roof pitch/access is not confirmed.");
  }
  if (selected.has("permanent-lighting") || selected.has("painting")) {
    missingDetails.push("Survey-required service selected; do not allow final self-booking.");
  }
  if (riskProfile.waterAccess !== "confirmed") {
    missingDetails.push("Outdoor water access is not confirmed.");
  }

  const measurementConfidence =
    missingDetails.length === 0
      ? "high"
      : missingDetails.length <= 2 && photoAttachments.length > 0
        ? "medium"
        : "low";
  const ownerAction =
    measurementConfidence === "high"
      ? "Ready to send if price feels right."
      : measurementConfidence === "medium"
        ? "Send only after confirming the flagged details."
        : "Get photos/details before treating this as a final quote.";

  return {
    measurementConfidence,
    requiredPhotos,
    missingDetails,
    ownerAction,
  };
}

function followUpPlanFor(
  leadQuality: string,
  photoAttachments: PhotoAttachment[],
  urgency: string,
  closeProbability: number,
): FollowUpTask[] {
  const strongLead = leadQuality === "good" || closeProbability >= 70;
  if (photoAttachments.length === 0) {
    return [
      {
        id: "photo_request_now",
        label: "Get photos",
        dueDate: addDays(0),
        channel: "sms",
        priority: "now",
        message: "Could you send 2-4 photos of the front, sides, and worst areas? That lets us firm up the quote without wasting your time on a site visit.",
        ownerNote: "Do this before guessing a final price.",
      },
      {
        id: "photo_request_next_morning",
        label: "Second photo touch",
        dueDate: addBusinessDays(1),
        channel: strongLead ? "call" : "sms",
        priority: "today",
        message: "Quick follow-up on the photos so we can lock in your package and schedule window.",
        ownerNote: "Call good leads; text lower-quality leads.",
      },
    ];
  }

  return [
    {
      id: "quote_ready_same_day",
      label: "Send quote today",
      dueDate: addDays(0),
      channel: "sms",
      priority: urgency === "asap" ? "now" : "today",
      message: "Your quote is ready. Review package options, scope, and booking windows here.",
      ownerNote: "Fast response is the close-rate lever.",
    },
    {
      id: "quote_follow_up_24h",
      label: "24-hour follow-up",
      dueDate: addBusinessDays(1),
      channel: strongLead ? "call" : "sms",
      priority: "today",
      message: "Wanted to make sure you saw the quote. We can hold the route-fit window if the scope looks good.",
      ownerNote: "Use for sent quotes that have not approved.",
    },
    {
      id: "quote_follow_up_72h",
      label: "72-hour close/lost touch",
      dueDate: addBusinessDays(3),
      channel: "sms",
      priority: "soon",
      message: "Last check before we release the tentative route window. Happy to adjust the scope if you want a smaller or bigger package.",
      ownerNote: "Either recover the job or mark lost/no-response.",
    },
  ];
}

function buildScope(
  serviceSlugs: string[],
  riskProfile: QuoteRiskProfile,
): { inclusions: string[]; exclusions: string[] } {
  const inclusions = new Set<string>();
  const exclusions = new Set<string>();
  const selected = new Set(serviceSlugs);
  for (const slug of serviceSlugs) {
    const scope = serviceScopes[slug];
    scope?.include.forEach((item) => inclusions.add(item));
    scope?.exclude.forEach((item) => exclusions.add(item));
  }

  const involvesPatio =
    selected.has("patio-wash") || selected.has("paver-refresh");
  if (involvesPatio && riskProfile.access.includes("heavy_furniture")) {
    exclusions.add("Furniture moving is not included unless added before booking.");
  }
  if (selected.has("window-cleaning")) {
    if (riskProfile.windowDetails.includes("screens")) {
      exclusions.add("Screen cleaning is included in this scope; tracks remain separate.");
    }
    if (riskProfile.windowDetails.includes("hard_water")) {
      exclusions.add("Hard water restoration is excluded unless explicitly quoted.");
    }
    if (riskProfile.windowDetails.includes("storm_windows")) {
      exclusions.add("Storm window removal/replacement priced separately.");
    }
  }
  if (selected.has("roof-wash") && riskProfile.roofWalkable === "no") {
    exclusions.add("Roof walking guarantees are excluded; soft wash from ladder only.");
  }
  if (selected.has("gutters") && riskProfile.access.includes("gutter_guards")) {
    exclusions.add("Gutter guard removal/reinstall is a separate scope.");
  }

  return {
    inclusions: Array.from(inclusions).slice(0, 6),
    exclusions: Array.from(exclusions).slice(0, 7),
  };
}

function buildPackages(
  recommendedAsk: number,
  floorBandHigh: number,
  selectedNames: string[],
  suggestedAddOns: string[],
  bundleRecommendations: BundleRecommendation[],
): QuotePackageOption[] {
  const essentialServices = selectedNames.length > 0 ? selectedNames : ["Selected service"];
  const bestRecommendation = bundleRecommendations[0];
  const bestAddOn = bestRecommendation?.services.at(-1) ?? suggestedAddOns[0] ?? "priority photo-confirmed quote";
  const fullAddOns = bundleRecommendations
    .flatMap((recommendation) => recommendation.services.slice(1))
    .filter((item, index, array) => array.indexOf(item) === index)
    .slice(0, 3);
  const bestLift = bestRecommendation?.estimatedLift ?? roundToFive(recommendedAsk * 0.2);
  const fullLift =
    bundleRecommendations.length > 0
      ? roundToFive(
          bundleRecommendations
            .slice(0, 3)
            .reduce((sum, recommendation) => sum + recommendation.estimatedLift, 0) * 0.82,
        )
      : roundToFive(recommendedAsk * 0.45);

  return [
    {
      id: "essential",
      name: "Essential",
      description: "The requested work with tight scope and standard route scheduling.",
      price: recommendedAsk,
      bundleSavings: 0,
      includedServices: essentialServices,
      scopeNotes: ["Photo confirmation before final scheduling", "Standard setup and cleanup included"],
      ownerNote: "Use when customer wants exactly the requested scope.",
    },
    {
      id: "best_value",
      name: "Best Value",
      badge: "Recommended",
      description: "Adds the most natural same-visit upgrade without wasting setup time.",
      price: roundToFive(Math.max(floorBandHigh, recommendedAsk + bestLift * 0.88)),
      bundleSavings: roundToFive(bestLift * 0.12),
      includedServices: [...essentialServices, bestAddOn],
      scopeNotes: ["Bundle value comes from saved setup time", "Final amount still stays above protected floor"],
      ownerNote: bestRecommendation?.ownerNote ?? "Default best-value package.",
    },
    {
      id: "full_refresh",
      name: "Full Exterior Refresh",
      badge: "Highest ticket",
      description: "A bigger curb-appeal package for customers who want everything handled at once.",
      price: roundToFive(Math.max(floorBandHigh, recommendedAsk + fullLift)),
      bundleSavings: roundToFive(fullLift * 0.18),
      includedServices: [...essentialServices, ...fullAddOns],
      scopeNotes: ["Best for seasonal cleanups", "May require deposit or manual review for restoration scope"],
      ownerNote: "Use to raise average ticket without pretending restoration is included.",
    },
  ];
}

export function getMarketRows(
  rows: CompetitorPrice[],
  serviceSlug: string,
  zip: string,
) {
  const exact = rows.filter(
    (row) => row.serviceSlug === serviceSlug && row.zipOrRegion === zip,
  );
  if (exact.length > 0) return exact;

  const regional = rows.filter(
    (row) =>
      row.serviceSlug === serviceSlug &&
      ["Long Island", "Suffolk County", "Nassau County"].includes(
        row.zipOrRegion,
      ),
  );
  return regional;
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function buildMarketComparison(
  rows: CompetitorPrice[],
  serviceSlug: string,
  zip: string,
  recommendedAsk: number,
): MarketComparison {
  const matched = getMarketRows(rows, serviceSlug, zip);
  if (matched.length === 0) {
    return {
      median: null,
      low: null,
      high: null,
      sampleSize: 0,
      region: "unknown",
      delta: 0,
      deltaPct: 0,
      position: "unknown",
      ownerNote: "No competitor data for this zip/service yet. Add observations in costs to sharpen anchoring.",
    };
  }
  const medianValue = median(matched.map((row) => row.priceMedian)) ?? 0;
  const lowValue = Math.min(...matched.map((row) => row.priceLow));
  const highValue = Math.max(...matched.map((row) => row.priceHigh));
  const delta = recommendedAsk - medianValue;
  const deltaPct = medianValue > 0 ? (delta / medianValue) * 100 : 0;
  const region = matched[0]?.zipOrRegion ?? "regional";

  let position: MarketComparison["position"];
  if (deltaPct < -7) position = "below";
  else if (deltaPct <= 7) position = "at";
  else if (deltaPct <= 18) position = "above";
  else position = "premium";

  const ownerNote =
    position === "below"
      ? `Asking ${formatDeltaPct(deltaPct)} under market — consider lifting toward median.`
      : position === "at"
        ? "Asking at the local market — fair pricing, room to upsell."
        : position === "above"
          ? `Asking ${formatDeltaPct(deltaPct)} above market — confirm differentiation in the quote.`
          : `Asking ${formatDeltaPct(deltaPct)} above market — only justifiable for premium scope.`;

  return {
    median: roundToFive(medianValue),
    low: roundToFive(lowValue),
    high: roundToFive(highValue),
    sampleSize: matched.length,
    region,
    delta: roundToFive(delta),
    deltaPct: Number(deltaPct.toFixed(1)),
    position,
    ownerNote,
  };
}

function formatDeltaPct(value: number) {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(0)}%`;
}

function emptyAddressValidation(zip: string): AddressValidation {
  return validateAddress({ street: "", city: "", zip });
}

export type { AddressValidation };

export function getAiUnlockState(store: AppStore) {
  const explicitWins = store.outcomes.filter(
    (outcome) => outcome.outcome === "won" && outcome.amountExplicit,
  );

  const quoteCount = store.quotes.length;
  const explicitOutcomeCount = store.outcomes.filter(
    (outcome) => outcome.amountExplicit || outcome.outcome !== "won",
  ).length;

  const eligible = quoteCount >= 10 && explicitWins.length >= 5;
  const alertEligible = explicitWins.length >= 16;

  return {
    eligible,
    alertEligible,
    quoteCount,
    explicitOutcomeCount,
    explicitWins: explicitWins.length,
    reason: eligible
      ? "AI coach can summarize real outcomes. Premium alerts remain gated until 16 explicit wins."
      : `Blocked until 10 quotes and 5 explicit won outcomes. Current: ${quoteCount} quotes, ${explicitWins.length} explicit wins.`,
  };
}

export function calculateEstimate(
  store: AppStore,
  input: PricingInput,
): PricingEstimate {
  const serviceLines = serviceLinesFromInput(input);
  const primaryServiceSlug = serviceLines[0]?.serviceSlug ?? input.serviceSlug;
  const service = getService(store, primaryServiceSlug);
  const costInput = getCostInput(store, primaryServiceSlug);

  if (!service || !costInput) {
    throw new Error(`Missing pricing setup for ${primaryServiceSlug}`);
  }

  const riskProfile = input.riskProfile ?? fallbackRiskProfile();
  const serviceDetails = input.serviceDetails ?? fallbackServiceDetails();
  const photoAttachments = input.photoAttachments ?? [];
  const route = getRoutePlan(input.zip);
  const storyMultiplier = getStoryMultiplier(input.stories);
  const breakdowns: ServiceEstimateBreakdown[] = [];
  let labor = 0;
  let materials = 0;
  let equipment = 0;
  let hours = 0;
  let unitCount = 0;
  let lineMinimumTotal = 0;
  let highestMinimum = 0;
  let maxHourlyRate = costInput.hourlyLaborRate;
  let maxOverheadPct = costInput.overheadPct;
  let maxMarginPct = costInput.minMarginPct;
  let maxDepositThreshold = depositThreshold(costInput);
  let driveReserveMinutes =
    defaultDriveReserveMinutes[costInput.serviceSlug] ?? 30;
  const allRiskReasons = new Set<string>();
  let maxRiskMultiplier = 1;
  let maxMaterialMultiplier = 1;

  for (const line of serviceLines) {
    const lineService = getService(store, line.serviceSlug);
    const lineCost = getCostInput(store, line.serviceSlug);
    if (!lineService || !lineCost) {
      throw new Error(`Missing pricing setup for ${line.serviceSlug}`);
    }

    const risk = riskFor(
      riskProfile,
      line.serviceSlug,
      serviceDetails,
      photoAttachments,
    );
    risk.reasons.forEach((reason) => allRiskReasons.add(reason));
    if (lineService.quoteMode === "review_required") {
      allRiskReasons.add(`${lineService.name} should be owner-reviewed before sending.`);
    }
    if (lineService.quoteMode === "survey_required") {
      allRiskReasons.add(`${lineService.name} needs a survey before it can be booked as a final price.`);
    }

    const lineUnitCount = unitsFor(lineService, line.jobSize);
    const buffer = lineCost.bufferActive ? 1.15 : 1;
    const lineHours =
      lineCost.hoursPerUnit *
      lineUnitCount *
      storyMultiplier *
      buffer *
      risk.timeMultiplier;
    const lineLabor = lineHours * lineCost.hourlyLaborRate;
    const lineMaterials =
      lineCost.materialCostPerUnit *
      lineUnitCount *
      buffer *
      risk.materialMultiplier;
    const lineEquipment = lineCost.equipmentWearPerHour * lineHours;
    const minimum = serviceMinimum(lineCost) * route.minimumMultiplier;

    labor += lineLabor;
    materials += lineMaterials;
    equipment += lineEquipment;
    hours += lineHours;
    unitCount += lineUnitCount;
    highestMinimum = Math.max(highestMinimum, minimum);
    lineMinimumTotal += minimum;
    maxHourlyRate = Math.max(maxHourlyRate, lineCost.hourlyLaborRate);
    maxOverheadPct = Math.max(maxOverheadPct, lineCost.overheadPct);
    maxMarginPct = Math.max(maxMarginPct, lineCost.minMarginPct);
    maxDepositThreshold = Math.max(maxDepositThreshold, depositThreshold(lineCost));
    driveReserveMinutes = Math.max(
      driveReserveMinutes,
      lineCost.driveReserveMinutes ??
        defaultDriveReserveMinutes[lineCost.serviceSlug] ??
        30,
    );
    maxRiskMultiplier = Math.max(maxRiskMultiplier, risk.timeMultiplier);
    maxMaterialMultiplier = Math.max(maxMaterialMultiplier, risk.materialMultiplier);

    breakdowns.push({
      serviceSlug: line.serviceSlug,
      serviceName: lineService.name,
      jobSize: line.jobSize,
      jobSizeLabel: line.jobSizeLabel,
      unitCount: Number(lineUnitCount.toFixed(2)),
      laborHours: Number(lineHours.toFixed(2)),
      materials: roundToFive(lineMaterials),
      protectedMinimum: roundToFive(minimum),
      riskMultiplier: Number(risk.timeMultiplier.toFixed(2)),
    });
  }

  const addressValidation = input.street || input.city
    ? validateAddress({
        street: input.street ?? "",
        city: input.city ?? "",
        zip: input.zip,
      })
    : emptyAddressValidation(input.zip);

  if (!addressValidation.inServiceArea && addressValidation.county !== "Unknown") {
    allRiskReasons.add(addressValidation.ownerAction);
  }
  if (addressValidation.warnings.length > 0) {
    addressValidation.warnings.forEach((warning) => allRiskReasons.add(warning));
  }

  driveReserveMinutes = Math.max(driveReserveMinutes, route.driveMinutes);
  if (route.manualReason) allRiskReasons.add(route.manualReason);

  const drive = (driveReserveMinutes / 60) * maxHourlyRate;
  const subtotal = labor + materials + drive + equipment;
  const floor =
    subtotal * (1 + maxOverheadPct) * (1 + maxMarginPct);
  const addOnMinimums = Math.max(0, lineMinimumTotal - highestMinimum);
  const minimumFloor = highestMinimum + addOnMinimums * 0.45;
  const protectedFloor = Math.max(floor, minimumFloor);
  const floorBandHigh = protectedFloor * 1.12;

  const marketRows = getMarketRows(
    store.competitorPrices,
    primaryServiceSlug,
    input.zip,
  );
  const marketMedian = median(marketRows.map((row) => row.priceMedian));
  const urgencyAdjustment = urgencyAdjustments[input.urgency] ?? 1;
  const seasonDemand = seasonDemandFor();
  const seasonAdjustment = urgencyAdjustment * seasonDemand.multiplier;
  const marketAnchor = marketMedian
    ? marketMedian * seasonAdjustment * storyMultiplier * maxRiskMultiplier
    : null;
  const bundleEfficiency = serviceLines.length > 1
    ? Math.min(0.08, (serviceLines.length - 1) * 0.025)
    : 0;
  const urgencyPremium =
    input.urgency === "asap" ? 0.1 : input.urgency === "this_week" ? 0.04 : 0;
  const pricingAnchor = marketAnchor
    ? Math.max(marketAnchor + addOnMinimums * 0.55, floorBandHigh * 1.08)
    : floorBandHigh * (1.28 + urgencyPremium + (seasonDemand.multiplier - 1) * 0.65 - bundleEfficiency);

  const rangeLow = roundToFive(floorBandHigh);
  const recommendedAsk = roundToFive(Math.max(floorBandHigh, pricingAnchor));
  const rangeHigh = roundToFive(
    Math.max(floorBandHigh * 1.18, recommendedAsk * 1.14),
  );
  const estimatedCost = roundToFive(subtotal);
  const grossProfit = roundToFive(Math.max(0, recommendedAsk - subtotal));
  const grossMarginPct =
    recommendedAsk > 0 ? Math.round((grossProfit / recommendedAsk) * 100) : 0;
  const unlock = getAiUnlockState(store);
  const intakeRequirements = intakeRequirementsFor(
    serviceLines,
    riskProfile,
    serviceDetails,
    photoAttachments,
  );
  const manualReviewReasons = Array.from(
    new Set([...allRiskReasons, ...intakeRequirements.missingDetails]),
  );
  const photoPenalty = photoAttachments.length === 0 ? 18 : photoAttachments.length < 3 ? 8 : 0;
  const riskPenalty = Math.min(24, Math.max(0, manualReviewReasons.length - 1) * 4);
  const routePenalty = route.manualReason ? 18 : route.zone.includes("Nassau") ? 6 : 0;
  const sourceBoost =
    input.source === "Repeat customer" || input.source === "Referral" ? 8 : 0;
  const leadScore = Math.max(
    20,
    Math.min(96, 78 + sourceBoost - photoPenalty - riskPenalty - routePenalty),
  );
  const leadQuality =
    leadScore >= 72 ? "good" : leadScore >= 50 ? "caution" : "bad";
  const closeProbability = Math.max(
    15,
    Math.min(88, leadScore - (rangeLow > 1200 ? 8 : 0) + (sourceBoost ? 4 : 0)),
  );
  const crewSize = hours >= 11 ? 3 : hours >= 5.5 ? 2 : 1;
  const depositRequired =
    recommendedAsk >= maxDepositThreshold ||
    serviceLines.some((line) =>
      ["roof-wash", "paver-refresh", "permanent-lighting", "painting"].includes(
        line.serviceSlug,
      ),
    );
  const depositAmount = depositRequired
    ? roundToFive(Math.max(150, recommendedAsk * 0.2))
    : 0;
  const selectedNames = breakdowns.map((line) => line.serviceName);
  const suggestedAddOns = suggestedAddOnsFor(serviceLines);
  const bundleRecommendations = bundleRecommendationsFor(
    serviceLines,
    recommendedAsk,
  );
  const scope = buildScope(
    serviceLines.map((line) => line.serviceSlug),
    riskProfile,
  );
  const scheduleWindows = scheduleWindowsFor(
    input.urgency,
    leadQuality,
    manualReviewReasons,
    route.zone,
  );
  const followUpPlan = followUpPlanFor(
    leadQuality,
    photoAttachments,
    input.urgency,
    closeProbability,
  );

  return {
    floor: roundToFive(protectedFloor),
    floorBandHigh: rangeLow,
    recommendedAsk,
    rangeLow,
    rangeHigh,
    marketMedian: marketMedian ? roundToFive(marketMedian) : null,
    marketAnchor: marketAnchor ? roundToFive(marketAnchor) : null,
    seasonAdjustment,
    storyMultiplier,
    riskMultiplier: maxRiskMultiplier,
    materialMultiplier: maxMaterialMultiplier,
    unitCount: Number(unitCount.toFixed(2)),
    laborHours: Number(hours.toFixed(2)),
    costSubtotal: estimatedCost,
    driveReserveMinutes,
    routeZone: route.zone,
    estimatedDriveMinutes: route.driveMinutes,
    crewSize,
    crewBlock: crewBlockFor(hours, crewSize),
    earliestAvailability: availabilityFor(input.urgency, leadQuality, manualReviewReasons),
    scheduleWindows,
    leadQuality,
    leadScore,
    closeProbability,
    followUpStage: photoAttachments.length === 0 ? "Needs photos" : "Ready to quote",
    nextFollowUpDate: followUpPlan[0]?.dueDate ?? addDays(input.urgency === "asap" ? 1 : 2),
    followUpPlan,
    intakeRequirements,
    bundleRecommendations,
    depositThreshold: maxDepositThreshold,
    depositRequired,
    depositAmount,
    manualReviewReasons,
    suggestedAddOns,
    scopeInclusions: scope.inclusions,
    scopeExclusions: scope.exclusions,
    packageOptions: buildPackages(
      recommendedAsk,
      rangeLow,
      selectedNames,
      suggestedAddOns,
      bundleRecommendations,
    ),
    serviceBreakdowns: breakdowns,
    bufferActive: costInput.bufferActive,
    aiEligible: unlock.eligible,
    aiBlockedReason: unlock.reason,
    profitability: {
      estimatedCost,
      grossProfit,
      grossMarginPct,
      floorDelta: roundToFive(Math.max(0, recommendedAsk - rangeLow)),
    },
    marketComparison: buildMarketComparison(
      store.competitorPrices,
      primaryServiceSlug,
      input.zip,
      recommendedAsk,
    ),
    addressValidation,
    lineItems: [
      { label: "Labor", value: roundToFive(labor) },
      { label: "Materials", value: roundToFive(materials) },
      { label: "Drive time reserve", value: roundToFive(drive) },
      { label: "Equipment wear", value: roundToFive(equipment) },
      { label: "Overhead + margin floor", value: roundToFive(protectedFloor) },
    ],
  };
}
