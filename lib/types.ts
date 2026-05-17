export type PricingUnit =
  | "per_1000_sqft"
  | "per_100_sqft"
  | "per_100_linear_ft"
  | "per_window"
  | "per_panel"
  | "flat";

export type QuoteMode = "instant" | "review_required" | "survey_required";

export type QuoteStatus =
  | "pending"
  | "contacted"
  | "sent"
  | "approved"
  | "awaiting_deposit"
  | "scheduled"
  | "won"
  | "lost"
  | "no_response";

export type PropertyType =
  | "single_family"
  | "townhome"
  | "condo"
  | "multi_family"
  | "commercial"
  | "hoa"
  | "other";

export type PreferredContactMethod = "text" | "call" | "email";

export type EstimateConfidence = "high" | "medium" | "low";

export type ApprovalRecord = {
  approvedAt: string;
  selectedPackageId: string;
  selectedPrice: number;
  preferredDates: PreferredWindow[];
  depositRequired: boolean;
  depositAmount: number;
  depositPaid: boolean;
  customerNote: string;
  acceptedUpsellIds: string[];
  acceptedUpsellsLift: number;
  scopeAccepted: boolean;
  depositCheckoutUrl: string | null;
};

export type FollowUpChannel = "sms" | "email" | "call";

export type FollowUpPriority = "now" | "today" | "soon";

export type FollowUpTask = {
  id: string;
  label: string;
  dueDate: string;
  channel: FollowUpChannel;
  priority: FollowUpPriority;
  message: string;
  ownerNote: string;
};

export type FollowUpRecord = {
  id: string;
  taskId: string;
  label: string;
  channel: FollowUpChannel;
  message: string;
  sentAt: string;
  sentBy: "dashboard" | "cron";
};

export type OutcomeKind = "won" | "lost" | "no_response" | "later";

export type OutcomeSource = "dashboard" | "sms" | "cron";

export type MaterialUsage = "less" | "normal" | "more";

export type JobTag =
  | "easy"
  | "tough"
  | "long_drive"
  | "add_on"
  | "customer_issue";

export type ActualReasonCode =
  | "access_slowdown"
  | "heavy_buildup"
  | "extra_ladder_work"
  | "chemical_demand"
  | "customer_added_scope"
  | "weather_delay"
  | "priced_too_low"
  | "priced_correctly";

export type JobActuals = {
  hours: number | null;
  crewCount: number | null;
  materialUsage: MaterialUsage | null;
  addedRevenue: number | null;
  materialNotes: string;
  reasonCodes: ActualReasonCode[];
  tags: JobTag[];
};

export type ServiceSizeOption = {
  label: string;
  value: number;
  description: string;
};

export type Service = {
  slug: string;
  name: string;
  shortName: string;
  description: string;
  quoteMode: QuoteMode;
  unit: PricingUnit;
  unitLabel: string;
  sizeLabel: string;
  sizeOptions: ServiceSizeOption[];
};

export type CostInput = {
  serviceSlug: string;
  hourlyLaborRate: number;
  materialCostPerUnit: number;
  equipmentWearPerHour: number;
  hoursPerUnit: number;
  driveReserveMinutes: number;
  overheadPct: number;
  minMarginPct: number;
  serviceMinimum: number;
  depositThreshold: number;
  bufferActive: boolean;
  source: "industry_default" | "dante_input" | "actuals_fit";
  updatedAt: string;
};

export type CompetitorPrice = {
  id: string;
  serviceSlug: string;
  competitorName: string;
  zipOrRegion: string;
  priceLow: number;
  priceMedian: number;
  priceHigh: number;
  unit: string;
  sourceUrl: string;
  observedDate: string;
};

export type PricingInput = {
  serviceSlug: string;
  jobSize: number;
  jobSizeLabel?: string;
  stories: number;
  urgency: string;
  zip: string;
  street?: string;
  city?: string;
  source?: string;
  customerPhone?: string;
  customerEmail?: string;
  propertyType?: PropertyType;
  jobDetails?: string;
  serviceLines?: QuoteServiceLine[];
  serviceDetails?: QuoteServiceDetails;
  riskProfile?: QuoteRiskProfile;
  photoAttachments?: PhotoAttachment[];
};

export type LeadQuality = "good" | "caution" | "bad";

export type QuotePackageOption = {
  id: "essential" | "best_value" | "full_refresh";
  name: string;
  badge?: string;
  description: string;
  price: number;
  bundleSavings: number;
  includedServices: string[];
  scopeNotes: string[];
  ownerNote: string;
};

export type ServiceEstimateBreakdown = {
  serviceSlug: string;
  serviceName: string;
  jobSize: number;
  jobSizeLabel: string;
  unitCount: number;
  laborHours: number;
  materials: number;
  protectedMinimum: number;
  riskMultiplier: number;
};

export type PricingEstimate = {
  floor: number;
  floorBandHigh: number;
  recommendedAsk: number;
  rangeLow: number;
  rangeHigh: number;
  marketMedian: number | null;
  marketAnchor: number | null;
  seasonAdjustment: number;
  storyMultiplier: number;
  riskMultiplier: number;
  materialMultiplier: number;
  unitCount: number;
  laborHours: number;
  costSubtotal: number;
  driveReserveMinutes: number;
  routeZone: string;
  estimatedDriveMinutes: number;
  crewSize: number;
  crewBlock: string;
  earliestAvailability: string;
  scheduleWindows: ScheduleWindowOption[];
  leadQuality: LeadQuality;
  leadScore: number;
  estimateConfidence: EstimateConfidence;
  pricingNotes: string[];
  closeProbability: number;
  followUpStage: string;
  nextFollowUpDate: string;
  followUpPlan: FollowUpTask[];
  intakeRequirements: IntakeRequirements;
  bundleRecommendations: BundleRecommendation[];
  depositThreshold: number;
  depositRequired: boolean;
  depositAmount: number;
  manualReviewReasons: string[];
  suggestedAddOns: string[];
  scopeInclusions: string[];
  scopeExclusions: string[];
  packageOptions: QuotePackageOption[];
  serviceBreakdowns: ServiceEstimateBreakdown[];
  bufferActive: boolean;
  aiEligible: boolean;
  aiBlockedReason: string;
  profitability: EstimateProfitability;
  marketComparison: MarketComparison;
  addressValidation: AddressValidation;
  lineItems: {
    label: string;
    value: number;
  }[];
};

export type ScheduleWindowOption = {
  id: "premium_opening" | "route_fit" | "standard_window" | "flex_fill";
  label: string;
  customerLabel: string;
  earliestDate: string;
  time: PreferredWindow["time"];
  routeFit: "excellent" | "good" | "needs_review";
  urgencyPremiumPct: number;
  ownerNote: string;
};

export type IntakeRequirements = {
  measurementConfidence: "high" | "medium" | "low";
  requiredPhotos: string[];
  missingDetails: string[];
  ownerAction: string;
};

export type BundleRecommendation = {
  id: string;
  title: string;
  services: string[];
  reason: string;
  estimatedLift: number;
  ownerNote: string;
};

export type EstimateProfitability = {
  estimatedCost: number;
  grossProfit: number;
  grossMarginPct: number;
  floorDelta: number;
};

export type MarketPosition = "below" | "at" | "above" | "premium" | "unknown";

export type MarketComparison = {
  median: number | null;
  low: number | null;
  high: number | null;
  sampleSize: number;
  region: string;
  delta: number;
  deltaPct: number;
  position: MarketPosition;
  ownerNote: string;
};

export type AddressConfidence = "verified" | "plausible" | "unverified" | "out_of_area";

export type AddressValidation = {
  confidence: AddressConfidence;
  inServiceArea: boolean;
  county: "Suffolk" | "Nassau" | "Queens" | "Other" | "Unknown";
  routeZone: string;
  warnings: string[];
  ownerAction: string;
};

export type NotificationHealth = {
  ready: boolean;
  smsReady: boolean;
  emailReady: boolean;
  ownerSmsReady: boolean;
  ownerEmailReady: boolean;
  appUrlReady: boolean;
  missing: string[];
};

export type SourceRoiRow = {
  source: string;
  quoteCount: number;
  wonCount: number;
  lostCount: number;
  closeRatePct: number;
  totalRevenue: number;
  averageTicket: number;
  pipelineValue: number;
};

export type DuplicateMatch = {
  quoteId: string;
  customerName: string;
  matchedOn: ("phone" | "email" | "address")[];
  daysAgo: number;
  status: QuoteStatus;
  finalAmount: number | null;
};

export type DuplicateContext = {
  isDuplicate: boolean;
  matches: DuplicateMatch[];
  isRepeat: boolean;
  ownerNote: string;
};

export type PhotoAttachment = {
  id: string;
  name: string;
  dataUrl: string;
};

export type AccessConcern =
  | "tight_side_yard"
  | "locked_gate"
  | "long_hose_pull"
  | "no_driveway"
  | "no_spigot"
  | "ladder_work"
  | "steep_property"
  | "pool_equipment"
  | "pets"
  | "fragile_surface"
  | "gutter_guards"
  | "heavy_furniture";

export type WindowDetail =
  | "exterior_only"
  | "inside_outside"
  | "screens"
  | "tracks"
  | "storm_windows"
  | "french_panes"
  | "hard_water"
  | "ladder_windows";

export type QuoteRiskProfile = {
  surfaceCondition: "light" | "moderate" | "heavy" | "oxidation" | "restoration";
  roofPitch: "low" | "standard" | "steep" | "very_steep" | "not_sure";
  roofWalkable: "yes" | "no" | "not_sure";
  waterAccess: "confirmed" | "not_sure" | "none";
  access: AccessConcern[];
  windowDetails: WindowDetail[];
};

export type QuoteServiceLine = {
  serviceSlug: string;
  jobSize: number;
  jobSizeLabel: string;
};

export type QuoteServiceDetails = {
  roofMossSeverity: "none" | "light" | "heavy" | "not_sure";
  roofPlantProtection: "standard" | "heavy" | "not_sure";
  gutterGuards: "none" | "some" | "all" | "not_sure";
  downspoutConcern: boolean;
  fenceSides: "one" | "both" | "not_sure";
  paverCondition: "standard" | "weeds" | "failed_sealer" | "sanding_sealing" | "not_sure";
  screenCount: number | null;
  stormWindowCount: number | null;
  hardWaterPanes: number | null;
  patioFurnitureLevel: "none" | "light" | "heavy" | "not_sure";
  solarPanelPitch: "low" | "standard" | "steep" | "not_sure";
};

export type PreferredWindow = {
  day: string;
  time: "morning" | "afternoon" | "flexible";
};

export type SendReviewRecord = {
  reviewedAt: string;
  reviewConfirmed: boolean;
  overrideReason: string;
  reasons: string[];
};

export type Quote = {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  source: string;
  propertyType: PropertyType;
  preferredContactMethod: PreferredContactMethod;
  addressStreet: string;
  addressCity: string;
  addressZip: string;
  serviceSlug: string;
  jobSize: number;
  jobSizeLabel: string;
  serviceLines: QuoteServiceLine[];
  stories: number;
  urgency: string;
  riskProfile: QuoteRiskProfile;
  serviceDetails: QuoteServiceDetails;
  photoAttachments: PhotoAttachment[];
  preferredWindows: PreferredWindow[];
  notes: string;
  internalNotes: string;
  status: QuoteStatus;
  estimate: PricingEstimate;
  finalQuoteAmount: number | null;
  sendReview: SendReviewRecord | null;
  followUps: FollowUpRecord[];
  sentAt: string | null;
  outcomeCheckDate: string | null;
  approval: ApprovalRecord | null;
  photosRequestedAt: string | null;
  expiresAt: string | null;
  duplicateContext: DuplicateContext;
  createdAt: string;
  updatedAt: string;
};

export type Outcome = {
  id: string;
  quoteId: string;
  outcome: OutcomeKind;
  amount: number | null;
  amountExplicit: boolean;
  source: OutcomeSource;
  notes: string;
  actuals: JobActuals | null;
  createdAt: string;
};

export type DecisionLogEntry = {
  id: string;
  event: string;
  evidence: string;
  nextReview: string;
  createdAt: string;
};

export type AppStore = {
  services: Service[];
  costInputs: CostInput[];
  competitorPrices: CompetitorPrice[];
  quotes: Quote[];
  outcomes: Outcome[];
  decisionLog: DecisionLogEntry[];
};
