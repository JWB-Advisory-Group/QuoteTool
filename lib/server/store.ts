import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { followUpTasksForQuote, isTaskDue } from "@/lib/follow-ups";
import { cleanCity, cleanStreet, cleanZip } from "@/lib/format";
import { calculateEstimate, fallbackServiceDetails } from "@/lib/pricing";
import { fitCostInputFromActuals, shouldRefit } from "@/lib/calibration";
import type {
  AppStore,
  ApprovalRecord,
  CompetitorPrice,
  CostInput,
  DecisionLogEntry,
  DuplicateContext,
  DuplicateMatch,
  FollowUpChannel,
  JobActuals,
  Outcome,
  OutcomeKind,
  OutcomeSource,
  PreferredWindow,
  PricingInput,
  Quote,
  QuoteStatus,
  QuoteRiskProfile,
  SendReviewRecord,
  Service,
} from "@/lib/types";
import { seedStore } from "@/lib/server/seeds";
import { buildDemoLeads, shouldSeedDemoLeads } from "@/lib/server/demo-leads";
import { MAX_QUOTE_PHOTOS } from "@/lib/photo-limits";

const QUOTE_EXPIRY_DAYS = 7;
const DUPLICATE_LOOKBACK_DAYS = 30;
const REPEAT_LOOKBACK_DAYS = 540;

const vercelRuntime = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
const dataDir = vercelRuntime
  ? path.join("/tmp", "quote-tool")
  : path.join(process.cwd(), ".data");
const storePath = process.env.LOCAL_DATA_PATH
  ? path.resolve(process.env.LOCAL_DATA_PATH)
  : path.join(dataDir, "pricing-agent.json");

function supabaseConfig() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;
  return url && serviceRoleKey ? { url: url.replace(/\/+$/, ""), serviceRoleKey } : null;
}

export function getStorageHealth() {
  const supabase = supabaseConfig();
  const mode = supabase
    ? "supabase"
    : vercelRuntime
      ? "vercel_ephemeral_file"
      : "local_file";
  const durable = Boolean(supabase) || !vercelRuntime;
  return {
    mode,
    durable,
    readyForProduction: Boolean(supabase),
    missing:
      supabase || !vercelRuntime
        ? []
        : ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
    path: supabase ? "Supabase Postgres" : storePath,
    ownerAction: supabase
      ? "Persistent production storage is configured."
      : vercelRuntime
        ? "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel before live traffic. The app can render, but writes use temporary serverless storage and can disappear."
        : "Local file storage is active for development.",
  };
}

async function ensureDataDir() {
  await mkdir(path.dirname(storePath), { recursive: true });
}

// Serialize all read-modify-write transactions so concurrent requests don't
// clobber each other when the store is a plain JSON file. Multi-instance
// deployments still need a real DB — this only protects single-instance.
let writeChain: Promise<unknown> = Promise.resolve();

async function withStoreLock<T>(fn: () => Promise<T>): Promise<T> {
  const previous = writeChain;
  let release!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason: unknown) => void;
  const next = new Promise<T>((res, rej) => {
    release = res;
    reject = rej;
  });
  writeChain = next.catch(() => undefined);
  try {
    await previous;
  } catch {
    // previous task failed; we still proceed
  }
  try {
    const result = await fn();
    release(result);
    return result;
  } catch (error) {
    reject(error);
    throw error;
  }
}

function cloneSeed(): AppStore {
  const store = JSON.parse(JSON.stringify(seedStore)) as AppStore;
  if (store.quotes.length === 0 && shouldSeedDemoLeads()) {
    store.quotes = buildDemoLeads(store);
  }
  return store;
}

function normalizeCostInput(input: CostInput): CostInput {
  const seeded = seedStore.costInputs.find(
    (item) => item.serviceSlug === input.serviceSlug,
  );

  return {
    ...input,
    driveReserveMinutes:
      input.driveReserveMinutes ?? seeded?.driveReserveMinutes ?? 30,
    serviceMinimum:
      input.serviceMinimum ?? seeded?.serviceMinimum ?? 225,
    depositThreshold:
      input.depositThreshold ?? seeded?.depositThreshold ?? 900,
  };
}

function normalizeService(service: Service): Service {
  const seeded = seedStore.services.find((item) => item.slug === service.slug);
  return {
    ...service,
    shortName: service.shortName ?? seeded?.shortName ?? service.name,
    description: service.description ?? seeded?.description ?? service.name,
    quoteMode: service.quoteMode ?? seeded?.quoteMode ?? "instant",
  };
}

function defaultRiskProfile(): QuoteRiskProfile {
  return {
    surfaceCondition: "moderate",
    roofPitch: "standard",
    roofWalkable: "not_sure",
    waterAccess: "confirmed",
    access: [],
    windowDetails: [],
  };
}

function normalizeServiceDetails(
  input: Partial<ReturnType<typeof fallbackServiceDetails>> | undefined,
) {
  return {
    ...fallbackServiceDetails(),
    ...(input ?? {}),
  };
}

function normalizeOutcome(outcome: Outcome): Outcome {
  return {
    ...outcome,
    actuals: outcome.actuals
      ? {
          hours: outcome.actuals.hours ?? null,
          crewCount: outcome.actuals.crewCount ?? null,
          materialUsage: outcome.actuals.materialUsage ?? null,
          addedRevenue: outcome.actuals.addedRevenue ?? null,
          materialNotes: outcome.actuals.materialNotes ?? "",
          reasonCodes: outcome.actuals.reasonCodes ?? [],
          tags: outcome.actuals.tags ?? [],
        }
      : null,
  };
}

function normalizePhone(value: string) {
  return value.replace(/\D+/g, "").replace(/^1(?=\d{10}$)/, "");
}

function normalizeAddress(street: string, zip: string) {
  return `${street.toLowerCase().replace(/[^\w]+/g, " ").trim()}|${zip.trim()}`;
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function daysAgoFrom(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function emptyDuplicateContext(): DuplicateContext {
  return {
    isDuplicate: false,
    isRepeat: false,
    matches: [],
    ownerNote: "",
  };
}

function detectDuplicates(
  store: AppStore,
  input: Pick<
    Quote,
    "customerPhone" | "customerEmail" | "addressStreet" | "addressZip"
  >,
): DuplicateContext {
  const phoneKey = normalizePhone(input.customerPhone ?? "");
  const emailKey = normalizeEmail(input.customerEmail ?? "");
  const addressKey = normalizeAddress(input.addressStreet ?? "", input.addressZip ?? "");
  const matches: DuplicateMatch[] = [];

  for (const candidate of store.quotes) {
    if (!candidate.createdAt) continue;
    const age = daysAgoFrom(candidate.createdAt);
    if (age > REPEAT_LOOKBACK_DAYS) continue;

    const matched: DuplicateMatch["matchedOn"] = [];
    if (phoneKey && normalizePhone(candidate.customerPhone ?? "") === phoneKey) {
      matched.push("phone");
    }
    if (emailKey && normalizeEmail(candidate.customerEmail ?? "") === emailKey) {
      matched.push("email");
    }
    if (
      addressKey !== "|" &&
      normalizeAddress(candidate.addressStreet ?? "", candidate.addressZip ?? "") ===
        addressKey
    ) {
      matched.push("address");
    }
    if (matched.length === 0) continue;

    matches.push({
      quoteId: candidate.id,
      customerName: candidate.customerName,
      matchedOn: matched,
      daysAgo: age,
      status: candidate.status,
      finalAmount: candidate.finalQuoteAmount,
    });
  }

  if (matches.length === 0) return emptyDuplicateContext();

  matches.sort((a, b) => a.daysAgo - b.daysAgo);
  const recent = matches.filter((match) => match.daysAgo <= DUPLICATE_LOOKBACK_DAYS);
  const isRepeat = matches.some(
    (match) => match.status === "won" || match.daysAgo > DUPLICATE_LOOKBACK_DAYS,
  );

  const newest = matches[0];
  let ownerNote = "";
  if (recent.length > 0) {
    ownerNote = `Same ${recent[0].matchedOn.join("/")} as a quote ${recent[0].daysAgo} day${
      recent[0].daysAgo === 1 ? "" : "s"
    } ago for ${recent[0].customerName}. Confirm intent before re-quoting.`;
  } else if (isRepeat) {
    ownerNote = `Repeat customer — last ${newest.matchedOn.join("/")} match was ${newest.daysAgo} days ago${
      newest.status === "won" && newest.finalAmount
        ? `, paid ${newest.finalAmount} last time`
        : ""
    }.`;
  }

  return {
    isDuplicate: recent.length > 0,
    isRepeat,
    matches: matches.slice(0, 5),
    ownerNote,
  };
}

function addDaysIso(days: number, from: Date = new Date()) {
  const date = new Date(from);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function defaultQuoteExpiry(createdAt: string) {
  return addDaysIso(QUOTE_EXPIRY_DAYS, new Date(createdAt));
}

export function isQuoteExpired(quote: Quote, asOf: Date = new Date()) {
  if (!quote.expiresAt) return false;
  if (quote.status === "won" || quote.status === "scheduled") return false;
  return new Date(quote.expiresAt).getTime() < asOf.getTime();
}

function normalizeStore(store: AppStore): AppStore {
  const seededBySlug = new Map(seedStore.services.map((service) => [service.slug, service]));
  const serviceSlugs = new Set(store.services.map((service) => service.slug));
  const mergedServices = [
    ...store.services.map(normalizeService),
    ...seedStore.services.filter((service) => !serviceSlugs.has(service.slug)),
  ];
  const costSlugs = new Set(store.costInputs.map((input) => input.serviceSlug));
  const mergedCostInputs = [
    ...store.costInputs.map(normalizeCostInput),
    ...seedStore.costInputs.filter((input) => !costSlugs.has(input.serviceSlug)),
  ];
  const normalized = {
    ...store,
    services: mergedServices,
    costInputs: mergedCostInputs,
    outcomes: store.outcomes.map(normalizeOutcome),
  };
  normalized.quotes = normalized.quotes.map((quote) => {
    const serviceLines =
      quote.serviceLines && quote.serviceLines.length > 0
        ? quote.serviceLines
        : [
            {
              serviceSlug: quote.serviceSlug,
              jobSize: quote.jobSize,
              jobSizeLabel: quote.jobSizeLabel,
            },
          ];
    const primary = seededBySlug.get(serviceLines[0]?.serviceSlug ?? quote.serviceSlug);
    const freshEstimate = calculateEstimate(normalized, {
      serviceSlug: serviceLines[0]?.serviceSlug ?? quote.serviceSlug,
      jobSize: serviceLines[0]?.jobSize ?? quote.jobSize,
      jobSizeLabel:
        serviceLines[0]?.jobSizeLabel ??
        quote.jobSizeLabel ??
        primary?.sizeOptions[0]?.label,
      stories: quote.stories,
      urgency: quote.urgency,
      zip: quote.addressZip,
      street: quote.addressStreet,
      city: quote.addressCity,
      source: quote.source,
      customerPhone: quote.customerPhone,
      customerEmail: quote.customerEmail,
      propertyType: quote.propertyType ?? "single_family",
      jobDetails: quote.notes,
      serviceLines,
      riskProfile: quote.riskProfile ?? defaultRiskProfile(),
      serviceDetails: normalizeServiceDetails(quote.serviceDetails),
      photoAttachments: quote.photoAttachments ?? [],
    });
    const createdAt = quote.createdAt ?? new Date().toISOString();
    return {
      ...quote,
      propertyType: quote.propertyType ?? "single_family",
      preferredContactMethod: quote.preferredContactMethod ?? "text",
      serviceLines,
      riskProfile: quote.riskProfile ?? defaultRiskProfile(),
      serviceDetails: normalizeServiceDetails(quote.serviceDetails),
      photoAttachments: quote.photoAttachments ?? [],
      preferredWindows: quote.preferredWindows ?? [],
      internalNotes: quote.internalNotes ?? "",
      approval: quote.approval
        ? {
            ...quote.approval,
            acceptedUpsellIds: quote.approval.acceptedUpsellIds ?? [],
            acceptedUpsellsLift: quote.approval.acceptedUpsellsLift ?? 0,
            scopeAccepted: quote.approval.scopeAccepted ?? true,
            depositCheckoutUrl: quote.approval.depositCheckoutUrl ?? null,
          }
        : null,
      sendReview: quote.sendReview ?? null,
      followUps: quote.followUps ?? [],
      photosRequestedAt: quote.photosRequestedAt ?? null,
      expiresAt: quote.expiresAt ?? defaultQuoteExpiry(createdAt),
      duplicateContext: quote.duplicateContext ?? emptyDuplicateContext(),
      estimate: {
        ...quote.estimate,
        ...freshEstimate,
      },
    };
  });
  return normalized;
}

type ServiceRow = {
  slug: string;
  name: string;
  short_name: string;
  description: string;
  quote_mode: Service["quoteMode"];
  unit: Service["unit"];
  unit_label: string;
  size_label: string;
  size_options: Service["sizeOptions"];
};

type CostInputRow = {
  service_slug: string;
  hourly_labor_rate: number | string;
  material_cost_per_unit: number | string;
  equipment_wear_per_hour: number | string;
  hours_per_unit: number | string;
  drive_reserve_minutes: number | string;
  overhead_pct: number | string;
  min_margin_pct: number | string;
  service_minimum: number | string;
  deposit_threshold: number | string;
  buffer_active: boolean;
  source: CostInput["source"];
  updated_at: string;
};

type CompetitorPriceRow = {
  id: string;
  service_slug: string;
  competitor_name: string;
  zip_or_region: string;
  price_low: number | string;
  price_median: number | string;
  price_high: number | string;
  unit: string;
  source_url: string;
  observed_date: string;
};

type QuoteRow = {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  preferred_contact_method: Quote["preferredContactMethod"];
  source: string;
  property_type: Quote["propertyType"];
  address_street: string;
  address_city: string;
  address_zip: string;
  service_slug: string;
  job_size: number | string;
  job_size_label: string;
  service_lines: Quote["serviceLines"];
  stories: number;
  urgency: string;
  risk_profile: Quote["riskProfile"];
  service_details: Quote["serviceDetails"];
  photo_attachments: Quote["photoAttachments"];
  preferred_windows: Quote["preferredWindows"];
  notes: string | null;
  internal_notes: string;
  status: Quote["status"];
  estimate: Quote["estimate"];
  final_quote_amount: number | string | null;
  send_review: Quote["sendReview"];
  follow_ups: Quote["followUps"];
  sent_at: string | null;
  outcome_check_date: string | null;
  approval: Quote["approval"];
  photos_requested_at: string | null;
  expires_at: string | null;
  duplicate_context: Quote["duplicateContext"];
  created_at: string;
  updated_at: string;
};

type OutcomeRow = {
  id: string;
  quote_id: string;
  outcome: Outcome["outcome"];
  amount: number | string | null;
  amount_explicit: boolean;
  source: Outcome["source"];
  notes: string | null;
  actuals: Outcome["actuals"];
  created_at: string;
};

type DecisionLogRow = {
  id: string;
  event: string;
  evidence: string;
  next_review: string;
  created_at: string;
};

function asNumber(value: number | string | null | undefined, fallback = 0) {
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function supabaseRequest<T>(
  pathName: string,
  init: RequestInit = {},
): Promise<T> {
  const config = supabaseConfig();
  if (!config) throw new Error("Supabase storage is not configured.");
  const response = await fetch(`${config.url}/rest/v1/${pathName}`, {
    ...init,
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase ${pathName} failed: ${response.status} ${body}`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

async function supabaseUpsert(
  table: string,
  rows: Record<string, unknown>[],
  conflictTarget: string,
) {
  if (rows.length === 0) return;
  await supabaseRequest<void>(`${table}?on_conflict=${conflictTarget}`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  });
}

function serviceFromRow(row: ServiceRow): Service {
  return {
    slug: row.slug,
    name: row.name,
    shortName: row.short_name,
    description: row.description,
    quoteMode: row.quote_mode,
    unit: row.unit,
    unitLabel: row.unit_label,
    sizeLabel: row.size_label,
    sizeOptions: row.size_options,
  };
}

function serviceToRow(service: Service): ServiceRow {
  return {
    slug: service.slug,
    name: service.name,
    short_name: service.shortName,
    description: service.description,
    quote_mode: service.quoteMode,
    unit: service.unit,
    unit_label: service.unitLabel,
    size_label: service.sizeLabel,
    size_options: service.sizeOptions,
  };
}

function costInputFromRow(row: CostInputRow): CostInput {
  return {
    serviceSlug: row.service_slug,
    hourlyLaborRate: asNumber(row.hourly_labor_rate),
    materialCostPerUnit: asNumber(row.material_cost_per_unit),
    equipmentWearPerHour: asNumber(row.equipment_wear_per_hour),
    hoursPerUnit: asNumber(row.hours_per_unit),
    driveReserveMinutes: asNumber(row.drive_reserve_minutes),
    overheadPct: asNumber(row.overhead_pct),
    minMarginPct: asNumber(row.min_margin_pct),
    serviceMinimum: asNumber(row.service_minimum),
    depositThreshold: asNumber(row.deposit_threshold),
    bufferActive: row.buffer_active,
    source: row.source,
    updatedAt: row.updated_at,
  };
}

function costInputToRow(input: CostInput): CostInputRow {
  return {
    service_slug: input.serviceSlug,
    hourly_labor_rate: input.hourlyLaborRate,
    material_cost_per_unit: input.materialCostPerUnit,
    equipment_wear_per_hour: input.equipmentWearPerHour,
    hours_per_unit: input.hoursPerUnit,
    drive_reserve_minutes: input.driveReserveMinutes,
    overhead_pct: input.overheadPct,
    min_margin_pct: input.minMarginPct,
    service_minimum: input.serviceMinimum,
    deposit_threshold: input.depositThreshold,
    buffer_active: input.bufferActive,
    source: input.source,
    updated_at: input.updatedAt,
  };
}

function competitorFromRow(row: CompetitorPriceRow): CompetitorPrice {
  return {
    id: row.id,
    serviceSlug: row.service_slug,
    competitorName: row.competitor_name,
    zipOrRegion: row.zip_or_region,
    priceLow: asNumber(row.price_low),
    priceMedian: asNumber(row.price_median),
    priceHigh: asNumber(row.price_high),
    unit: row.unit,
    sourceUrl: row.source_url,
    observedDate: row.observed_date,
  };
}

function quoteFromRow(row: QuoteRow): Quote {
  return {
    id: row.id,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone ?? "",
    preferredContactMethod: row.preferred_contact_method,
    source: row.source,
    propertyType: row.property_type,
    addressStreet: row.address_street,
    addressCity: row.address_city,
    addressZip: row.address_zip,
    serviceSlug: row.service_slug,
    jobSize: asNumber(row.job_size),
    jobSizeLabel: row.job_size_label,
    serviceLines: row.service_lines ?? [],
    stories: row.stories,
    urgency: row.urgency,
    riskProfile: row.risk_profile ?? defaultRiskProfile(),
    serviceDetails: normalizeServiceDetails(row.service_details),
    photoAttachments: row.photo_attachments ?? [],
    preferredWindows: row.preferred_windows ?? [],
    notes: row.notes ?? "",
    internalNotes: row.internal_notes ?? "",
    status: row.status,
    estimate: row.estimate,
    finalQuoteAmount:
      row.final_quote_amount === null ? null : asNumber(row.final_quote_amount),
    sendReview: row.send_review ?? null,
    followUps: row.follow_ups ?? [],
    sentAt: row.sent_at,
    outcomeCheckDate: row.outcome_check_date,
    approval: row.approval ?? null,
    photosRequestedAt: row.photos_requested_at,
    expiresAt: row.expires_at,
    duplicateContext: row.duplicate_context ?? emptyDuplicateContext(),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function quoteToRow(quote: Quote): QuoteRow {
  return {
    id: quote.id,
    customer_name: quote.customerName,
    customer_email: quote.customerEmail,
    customer_phone: quote.customerPhone || null,
    preferred_contact_method: quote.preferredContactMethod,
    source: quote.source,
    property_type: quote.propertyType,
    address_street: quote.addressStreet,
    address_city: quote.addressCity,
    address_zip: quote.addressZip,
    service_slug: quote.serviceSlug,
    job_size: quote.jobSize,
    job_size_label: quote.jobSizeLabel,
    service_lines: quote.serviceLines,
    stories: quote.stories,
    urgency: quote.urgency,
    risk_profile: quote.riskProfile,
    service_details: quote.serviceDetails,
    photo_attachments: quote.photoAttachments,
    preferred_windows: quote.preferredWindows,
    notes: quote.notes,
    internal_notes: quote.internalNotes,
    status: quote.status,
    estimate: quote.estimate,
    final_quote_amount: quote.finalQuoteAmount,
    send_review: quote.sendReview,
    follow_ups: quote.followUps,
    sent_at: quote.sentAt,
    outcome_check_date: quote.outcomeCheckDate,
    approval: quote.approval,
    photos_requested_at: quote.photosRequestedAt,
    expires_at: quote.expiresAt,
    duplicate_context: quote.duplicateContext,
    created_at: quote.createdAt,
    updated_at: quote.updatedAt,
  };
}

function outcomeFromRow(row: OutcomeRow): Outcome {
  return {
    id: row.id,
    quoteId: row.quote_id,
    outcome: row.outcome,
    amount: row.amount === null ? null : asNumber(row.amount),
    amountExplicit: row.amount_explicit,
    source: row.source,
    notes: row.notes ?? "",
    actuals: row.actuals,
    createdAt: row.created_at,
  };
}

function outcomeToRow(outcome: Outcome): OutcomeRow {
  return {
    id: outcome.id,
    quote_id: outcome.quoteId,
    outcome: outcome.outcome,
    amount: outcome.amount,
    amount_explicit: outcome.amountExplicit,
    source: outcome.source,
    notes: outcome.notes,
    actuals: outcome.actuals,
    created_at: outcome.createdAt,
  };
}

function decisionLogFromRow(row: DecisionLogRow): DecisionLogEntry {
  return {
    id: row.id,
    event: row.event,
    evidence: row.evidence,
    nextReview: row.next_review,
    createdAt: row.created_at,
  };
}

async function loadSupabaseStore(): Promise<AppStore> {
  const [serviceRows, costRows, competitorRows, quoteRows, outcomeRows, logRows] =
    await Promise.all([
      supabaseRequest<ServiceRow[]>("services?select=*&order=slug.asc"),
      supabaseRequest<CostInputRow[]>("cost_inputs?select=*&order=service_slug.asc"),
      supabaseRequest<CompetitorPriceRow[]>(
        "competitor_prices?select=*&order=observed_date.desc",
      ),
      supabaseRequest<QuoteRow[]>("quotes?select=*&order=created_at.desc"),
      supabaseRequest<OutcomeRow[]>("outcomes?select=*&order=created_at.desc"),
      supabaseRequest<DecisionLogRow[]>("decision_log?select=*&order=created_at.desc"),
    ]);

  return normalizeStore({
    services:
      serviceRows.length > 0 ? serviceRows.map(serviceFromRow) : seedStore.services,
    costInputs:
      costRows.length > 0 ? costRows.map(costInputFromRow) : seedStore.costInputs,
    competitorPrices:
      competitorRows.length > 0
        ? competitorRows.map(competitorFromRow)
        : seedStore.competitorPrices,
    quotes: quoteRows.map(quoteFromRow),
    outcomes: outcomeRows.map(outcomeFromRow),
    decisionLog:
      logRows.length > 0 ? logRows.map(decisionLogFromRow) : seedStore.decisionLog,
  });
}

async function saveSupabaseStore(store: AppStore) {
  await supabaseUpsert("services", store.services.map(serviceToRow), "slug");
  await supabaseUpsert(
    "cost_inputs",
    store.costInputs.map(costInputToRow),
    "service_slug",
  );
  await supabaseUpsert("quotes", store.quotes.map(quoteToRow), "id");
  await supabaseUpsert("outcomes", store.outcomes.map(outcomeToRow), "id");
}

export async function loadStore(): Promise<AppStore> {
  if (supabaseConfig()) {
    return loadSupabaseStore();
  }
  await ensureDataDir();
  try {
    const raw = await readFile(storePath, "utf8");
    const store = normalizeStore(JSON.parse(raw) as AppStore);
    if (store.quotes.length === 0 && shouldSeedDemoLeads()) {
      store.quotes = buildDemoLeads(store);
      await saveStore(store);
    }
    return store;
  } catch {
    const seeded = cloneSeed();
    await saveStore(seeded);
    return seeded;
  }
}

export async function updateCostInput(
  serviceSlug: string,
  updates: Omit<CostInput, "serviceSlug" | "source" | "updatedAt">,
) {
  return withStoreLock(async () => {
    const store = await loadStore();
    const input = store.costInputs.find((item) => item.serviceSlug === serviceSlug);
    if (!input) return null;

    Object.assign(input, {
      ...updates,
      source: "dante_input",
      updatedAt: new Date().toISOString(),
    });

    await saveStore(store);
    return input;
  });
}

export async function saveStore(store: AppStore) {
  if (supabaseConfig()) {
    await saveSupabaseStore(normalizeStore(store));
    return;
  }
  await ensureDataDir();
  await writeFile(storePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

export async function getQuote(id: string) {
  const store = await loadStore();
  return {
    store,
    quote: store.quotes.find((item) => item.id === id) ?? null,
  };
}

export async function createQuote(
  input: Omit<
    Quote,
    | "id"
    | "status"
    | "estimate"
    | "finalQuoteAmount"
    | "sendReview"
    | "followUps"
    | "sentAt"
    | "outcomeCheckDate"
    | "approval"
    | "photosRequestedAt"
    | "expiresAt"
    | "duplicateContext"
    | "internalNotes"
    | "createdAt"
    | "updatedAt"
  >,
) {
  return withStoreLock(async () => {
  const store = await loadStore();
  const now = new Date().toISOString();
  const sanitized = {
    ...input,
    addressStreet: cleanStreet(input.addressStreet),
    addressCity: cleanCity(input.addressCity),
    addressZip: cleanZip(input.addressZip),
  };
  const duplicateContext = detectDuplicates(store, {
    customerPhone: sanitized.customerPhone,
    customerEmail: sanitized.customerEmail,
    addressStreet: sanitized.addressStreet,
    addressZip: sanitized.addressZip,
  });
  const sourceWithRepeat =
    duplicateContext.isRepeat && (!sanitized.source || sanitized.source === "Not provided")
      ? "Repeat customer"
      : sanitized.source;
  const estimate = calculateEstimate(store, {
    serviceSlug: sanitized.serviceSlug,
    jobSize: sanitized.jobSize,
    jobSizeLabel: sanitized.jobSizeLabel,
    stories: sanitized.stories,
    urgency: sanitized.urgency,
    zip: sanitized.addressZip,
    street: sanitized.addressStreet,
    city: sanitized.addressCity,
    source: sourceWithRepeat,
    serviceLines: sanitized.serviceLines,
    serviceDetails: sanitized.serviceDetails,
    riskProfile: sanitized.riskProfile,
    photoAttachments: sanitized.photoAttachments,
    customerPhone: sanitized.customerPhone,
    customerEmail: sanitized.customerEmail,
    propertyType: sanitized.propertyType,
    jobDetails: sanitized.notes,
  });

  const quote: Quote = {
    ...sanitized,
    source: sourceWithRepeat,
    id: crypto.randomUUID(),
    status: "pending",
    estimate,
    finalQuoteAmount: null,
    sendReview: null,
    followUps: [],
    sentAt: null,
    outcomeCheckDate: null,
    approval: null,
    photosRequestedAt: null,
    expiresAt: defaultQuoteExpiry(now),
    duplicateContext,
    internalNotes: "",
    createdAt: now,
    updatedAt: now,
  };

  store.quotes.unshift(quote);
  await saveStore(store);
  return quote;
  });
}

export async function previewEstimate(input: PricingInput) {
  const store = await loadStore();
  return calculateEstimate(store, input);
}

export function hasSurveyRequiredService(store: AppStore, quote: Quote) {
  return quote.serviceLines.some((line) => {
    const service = store.services.find((item) => item.slug === line.serviceSlug);
    return service?.quoteMode === "survey_required";
  });
}

export function sendReviewReasons(quote: Quote, amount: number) {
  const reasons: string[] = [];
  if (quote.photoAttachments.length === 0) {
    reasons.push("No photos are attached.");
  }
  if (quote.estimate.manualReviewReasons.length > 0) {
    reasons.push(...quote.estimate.manualReviewReasons);
  }
  const recommended = quote.estimate.recommendedAsk;
  if (
    recommended > 0 &&
    Math.abs(amount - recommended) / recommended > 0.1
  ) {
    reasons.push(
      `Final amount is more than 10% away from the recommended ask of ${recommended}.`,
    );
  }
  return [...new Set(reasons)];
}

function outcomeDateForUrgency(urgency: string) {
  const days =
    urgency === "asap"
      ? 2
      : urgency === "this_week"
        ? 5
        : urgency === "this_month"
          ? 14
          : 30;
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export async function sendQuote(
  id: string,
  amount: number,
  review: {
    reviewConfirmed: boolean;
    overrideReason: string;
  } = { reviewConfirmed: false, overrideReason: "" },
) {
  return withStoreLock(async () => {
  const store = await loadStore();
  const quote = store.quotes.find((item) => item.id === id);
  if (!quote) return null;
  if (amount < quote.estimate.floorBandHigh) {
    throw new Error("Quote amount cannot be below the protected floor.");
  }
  const reviewReasons = sendReviewReasons(quote, amount);
  if (
    reviewReasons.length > 0 &&
    (!review.reviewConfirmed || !review.overrideReason.trim())
  ) {
    throw new Error("Review confirmation and reason are required before sending this quote.");
  }

  const now = new Date().toISOString();
  quote.status = "sent";
  quote.finalQuoteAmount = amount;
  quote.sendReview =
    reviewReasons.length > 0
      ? ({
          reviewedAt: now,
          reviewConfirmed: review.reviewConfirmed,
          overrideReason: review.overrideReason.trim(),
          reasons: reviewReasons,
        } satisfies SendReviewRecord)
      : null;
  quote.sentAt = now;
  quote.outcomeCheckDate = outcomeDateForUrgency(quote.urgency);
  quote.expiresAt = defaultQuoteExpiry(now);
  quote.updatedAt = now;
  await saveStore(store);
  return quote;
  });
}

export async function approveQuote(
  id: string,
  input: {
    selectedPackageId?: "essential" | "best_value" | "full_refresh";
    selectedPrice: number;
    preferredDates: PreferredWindow[];
    customerNote: string;
    acceptedUpsellIds?: string[];
    acceptedUpsellsLift?: number;
    scopeAccepted?: boolean;
  },
): Promise<{ quote: Quote; approval: ApprovalRecord } | null> {
  return withStoreLock(async () => {
  const store = await loadStore();
  const quote = store.quotes.find((item) => item.id === id);
  if (!quote) return null;
  if (hasSurveyRequiredService(store, quote)) {
    throw new Error("This request needs a survey before it can be approved as a final booking.");
  }
  if (isQuoteExpired(quote)) {
    throw new Error("This quote has expired. Request a refreshed quote before approving.");
  }
  if (!input.scopeAccepted) {
    throw new Error("Please accept the scope to confirm the work that's included.");
  }

  const packageId =
    input.selectedPackageId ??
    quote.estimate.packageOptions.find(
      (pkg) => Math.abs(pkg.price - input.selectedPrice) < 1,
    )?.id ??
    "essential";

  if (input.selectedPrice < quote.estimate.floorBandHigh) {
    throw new Error("Selected price is below the protected floor.");
  }

  const validUpsellIds = new Set(
    quote.estimate.bundleRecommendations.map((bundle) => bundle.id),
  );
  const acceptedUpsellIds = (input.acceptedUpsellIds ?? []).filter((id) =>
    validUpsellIds.has(id),
  );
  const acceptedUpsellsLift = Math.max(0, input.acceptedUpsellsLift ?? 0);

  const now = new Date().toISOString();
  const depositThreshold = Math.max(
    quote.estimate.depositThreshold,
    ...quote.serviceLines.map((line) => {
      const cost = store.costInputs.find(
        (input) => input.serviceSlug === line.serviceSlug,
      );
      return cost?.depositThreshold ?? 0;
    }),
  );
  const depositRequired =
    input.selectedPrice >= depositThreshold ||
    quote.serviceLines.some((line) =>
      ["roof-wash", "paver-refresh", "permanent-lighting", "painting"].includes(
        line.serviceSlug,
      ),
    );
  const approval: ApprovalRecord = {
    approvedAt: now,
    selectedPackageId: packageId,
    selectedPrice: input.selectedPrice,
    preferredDates: input.preferredDates,
    depositRequired,
    depositAmount: depositRequired
      ? Math.round(Math.max(150, input.selectedPrice * 0.2) / 5) * 5
      : 0,
    depositPaid: false,
    customerNote: input.customerNote,
    acceptedUpsellIds,
    acceptedUpsellsLift,
    scopeAccepted: true,
    depositCheckoutUrl: null,
  };

  quote.approval = approval;
  quote.status = approval.depositRequired ? "awaiting_deposit" : "approved";
  quote.finalQuoteAmount = input.selectedPrice;
  quote.updatedAt = now;

  await saveStore(store);
  return { quote, approval };
  });
}

export async function setDepositCheckoutUrl(
  id: string,
  url: string,
): Promise<Quote | null> {
  return withStoreLock(async () => {
  const store = await loadStore();
  const quote = store.quotes.find((item) => item.id === id);
  if (!quote || !quote.approval) return null;
  quote.approval = { ...quote.approval, depositCheckoutUrl: url };
  quote.updatedAt = new Date().toISOString();
  await saveStore(store);
  return quote;
  });
}

export async function markDepositPaid(id: string) {
  return withStoreLock(async () => {
  const store = await loadStore();
  const quote = store.quotes.find((item) => item.id === id);
  if (!quote) return null;
  if (!quote.approval) {
    throw new Error("Quote has not been approved yet.");
  }
  if (!quote.approval.depositRequired) {
    throw new Error("No deposit is required for this quote.");
  }
  quote.approval.depositPaid = true;
  quote.status = "scheduled";
  quote.updatedAt = new Date().toISOString();
  await saveStore(store);
  return quote;
  });
}

export async function markPhotosRequested(id: string) {
  return withStoreLock(async () => {
  const store = await loadStore();
  const quote = store.quotes.find((item) => item.id === id);
  if (!quote) return null;
  quote.photosRequestedAt = new Date().toISOString();
  quote.updatedAt = quote.photosRequestedAt;
  await saveStore(store);
  return quote;
  });
}

export async function addQuotePhotos(
  id: string,
  attachments: Quote["photoAttachments"],
) {
  return withStoreLock(async () => {
    const store = await loadStore();
    const quote = store.quotes.find((item) => item.id === id);
    if (!quote) return null;

    const existingIds = new Set(quote.photoAttachments.map((photo) => photo.id));
    const nextPhotos = [
      ...quote.photoAttachments,
      ...attachments.filter((photo) => !existingIds.has(photo.id)),
    ].slice(0, MAX_QUOTE_PHOTOS);

    quote.photoAttachments = nextPhotos;
    quote.estimate = calculateEstimate(store, {
      serviceSlug: quote.serviceSlug,
      jobSize: quote.jobSize,
      jobSizeLabel: quote.jobSizeLabel,
      stories: quote.stories,
      urgency: quote.urgency,
      zip: quote.addressZip,
      street: quote.addressStreet,
      city: quote.addressCity,
      source: quote.source,
      customerPhone: quote.customerPhone,
      customerEmail: quote.customerEmail,
      propertyType: quote.propertyType,
      jobDetails: quote.notes,
      serviceLines: quote.serviceLines,
      serviceDetails: quote.serviceDetails,
      riskProfile: quote.riskProfile,
      photoAttachments: nextPhotos,
    });
    quote.updatedAt = new Date().toISOString();
    await saveStore(store);
    return quote;
  });
}

export async function updateQuoteStatus(id: string, status: QuoteStatus) {
  return withStoreLock(async () => {
    const store = await loadStore();
    const quote = store.quotes.find((item) => item.id === id);
    if (!quote) return null;

    const now = new Date().toISOString();
    quote.status = status;
    if (
      status === "contacted" &&
      !quote.sentAt &&
      !quote.followUps.some((item) => item.taskId === "manual_contact")
    ) {
      quote.followUps.push({
        id: crypto.randomUUID(),
        taskId: "manual_contact",
        label: "Manual contact",
        channel: quote.preferredContactMethod === "email" ? "email" : "sms",
        message: "Owner marked the lead as contacted.",
        sentAt: now,
        sentBy: "dashboard",
      });
    }
    if (status === "sent") {
      quote.finalQuoteAmount = quote.finalQuoteAmount ?? quote.estimate.recommendedAsk;
      quote.sentAt = quote.sentAt ?? now;
      quote.outcomeCheckDate = quote.outcomeCheckDate ?? outcomeDateForUrgency(quote.urgency);
      quote.expiresAt = quote.expiresAt ?? defaultQuoteExpiry(now);
    }
    quote.updatedAt = now;
    await saveStore(store);
    return quote;
  });
}

export async function recordFollowUp(
  id: string,
  input: {
    taskId: string;
    channel: FollowUpChannel;
    message: string;
    sentBy?: "dashboard" | "cron";
  },
) {
  return withStoreLock(async () => {
  const store = await loadStore();
  const quote = store.quotes.find((item) => item.id === id);
  if (!quote) return null;

  const task = followUpTasksForQuote(quote).find(
    (item) => item.id === input.taskId,
  );
  const now = new Date().toISOString();
  quote.followUps.push({
    id: crypto.randomUUID(),
    taskId: input.taskId,
    label: task?.label ?? input.taskId.replaceAll("_", " "),
    channel: input.channel,
    message: input.message.trim() || task?.message || "",
    sentAt: now,
    sentBy: input.sentBy ?? "dashboard",
  });
  quote.updatedAt = now;
  await saveStore(store);
  return quote;
  });
}

export async function recordOutcome(
  quoteId: string,
  outcome: OutcomeKind,
  amount: number | null,
  source: OutcomeSource,
  notes = "",
  actuals: JobActuals | null = null,
) {
  return withStoreLock(async () => {
  const store = await loadStore();
  const quote = store.quotes.find((item) => item.id === quoteId);
  if (!quote) return null;

  const amountExplicit = outcome === "won" && typeof amount === "number";
  if (outcome === "won" && !amountExplicit) {
    throw new Error("Won outcomes require an explicit amount.");
  }

  const createdAt = new Date().toISOString();
  const row: Outcome = {
    id: crypto.randomUUID(),
    quoteId,
    outcome,
    amount,
    amountExplicit,
    source,
    notes,
    actuals,
    createdAt,
  };

  store.outcomes.unshift(row);
  if (outcome !== "later") {
    quote.status = outcome === "won" ? "won" : outcome;
  }
  if (amountExplicit) {
    quote.finalQuoteAmount = amount;
  }
  quote.updatedAt = createdAt;

  const hasActuals = Boolean(actuals && actuals.hours !== null);
  if (outcome === "won" && shouldRefit(store, quote.serviceSlug, hasActuals)) {
    const fitted = fitCostInputFromActuals(store, quote.serviceSlug);
    if (fitted) {
      const idx = store.costInputs.findIndex(
        (item) => item.serviceSlug === quote.serviceSlug,
      );
      if (idx >= 0) store.costInputs[idx] = fitted;
    }
  }

  await saveStore(store);
  return { quote, outcome: row };
  });
}

export async function updateJobActuals(
  outcomeId: string,
  actuals: JobActuals,
) {
  return withStoreLock(async () => {
  const store = await loadStore();
  const outcome = store.outcomes.find((item) => item.id === outcomeId);
  if (!outcome) return null;
  outcome.actuals = actuals;

  const quote = store.quotes.find((q) => q.id === outcome.quoteId);
  const hasActuals = actuals.hours !== null;
  if (
    quote &&
    outcome.outcome === "won" &&
    shouldRefit(store, quote.serviceSlug, hasActuals)
  ) {
    const fitted = fitCostInputFromActuals(store, quote.serviceSlug);
    if (fitted) {
      const idx = store.costInputs.findIndex(
        (item) => item.serviceSlug === quote.serviceSlug,
      );
      if (idx >= 0) store.costInputs[idx] = fitted;
    }
  }

  await saveStore(store);
  return outcome;
  });
}

export async function applyOnboarding(
  serviceSlug: string,
  next: CostInput,
) {
  return withStoreLock(async () => {
  const store = await loadStore();
  const idx = store.costInputs.findIndex(
    (item) => item.serviceSlug === serviceSlug,
  );
  if (idx < 0) return null;
  store.costInputs[idx] = next;
  await saveStore(store);
  return next;
  });
}

export async function getDueOutcomeQuotes() {
  const store = await loadStore();
  const today = new Date().toISOString().slice(0, 10);
  const logged = new Set(store.outcomes.map((outcome) => outcome.quoteId));
  return store.quotes.filter(
    (quote) =>
      quote.status === "sent" &&
      quote.outcomeCheckDate &&
      quote.outcomeCheckDate <= today &&
      !logged.has(quote.id),
  );
}

export async function getDueCustomerFollowUps() {
  const store = await loadStore();
  return store.quotes
    .filter((quote) =>
      ["pending", "contacted", "sent", "awaiting_deposit", "approved", "scheduled"].includes(
        quote.status,
      ),
    )
    .flatMap((quote) =>
      followUpTasksForQuote(quote)
        .filter((task) => task.channel !== "call" && isTaskDue(task))
        .map((task) => ({ quote, task })),
    );
}

export function getSourceRoi(
  store: AppStore,
): import("@/lib/types").SourceRoiRow[] {
  const outcomesByQuote = new Map(
    store.outcomes.map((outcome) => [outcome.quoteId, outcome]),
  );
  const buckets = new Map<
    string,
    {
      quoteCount: number;
      wonCount: number;
      lostCount: number;
      revenue: number;
      pipelineValue: number;
    }
  >();

  for (const quote of store.quotes) {
    const source = quote.source && quote.source !== "Not provided" ? quote.source : "Unattributed";
    const bucket =
      buckets.get(source) ?? {
        quoteCount: 0,
        wonCount: 0,
        lostCount: 0,
        revenue: 0,
        pipelineValue: 0,
      };
    bucket.quoteCount += 1;
    const outcome = outcomesByQuote.get(quote.id);
    if (outcome?.outcome === "won") {
      bucket.wonCount += 1;
      if (outcome.amount) bucket.revenue += outcome.amount;
    } else if (outcome?.outcome === "lost") {
      bucket.lostCount += 1;
    } else if (
      quote.status === "pending" ||
      quote.status === "contacted" ||
      quote.status === "sent" ||
      quote.status === "approved" ||
      quote.status === "awaiting_deposit" ||
      quote.status === "scheduled"
    ) {
      bucket.pipelineValue +=
        quote.finalQuoteAmount ?? quote.estimate.recommendedAsk ?? 0;
    }
    buckets.set(source, bucket);
  }

  return Array.from(buckets.entries())
    .map(([source, bucket]) => {
      const evaluated = bucket.wonCount + bucket.lostCount;
      const closeRatePct =
        evaluated > 0 ? Math.round((bucket.wonCount / evaluated) * 100) : 0;
      const averageTicket = bucket.wonCount > 0 ? Math.round(bucket.revenue / bucket.wonCount) : 0;
      return {
        source,
        quoteCount: bucket.quoteCount,
        wonCount: bucket.wonCount,
        lostCount: bucket.lostCount,
        closeRatePct,
        totalRevenue: Math.round(bucket.revenue),
        averageTicket,
        pipelineValue: Math.round(bucket.pipelineValue),
      };
    })
    .sort((a, b) => {
      const aScore = a.totalRevenue || a.pipelineValue;
      const bScore = b.totalRevenue || b.pipelineValue;
      return bScore - aScore;
    });
}

export async function resolveOutstandingQuoteByShortId(shortId: string) {
  const store = await loadStore();
  const logged = new Set(store.outcomes.map((outcome) => outcome.quoteId));
  return store.quotes.find(
    (quote) =>
      quote.status === "sent" &&
      quote.id.startsWith(shortId) &&
      !logged.has(quote.id),
  );
}

export function getCompliance(store: AppStore, days: number) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceTime = since.getTime();
  const due = store.quotes.filter((quote) => {
    if (!quote.sentAt) return false;
    return new Date(quote.sentAt).getTime() >= sinceTime;
  });
  if (due.length === 0) return { percent: 100, logged: 0, total: 0 };

  const loggedQuoteIds = new Set(
    store.outcomes
      .filter((outcome) => new Date(outcome.createdAt).getTime() >= sinceTime)
      .map((outcome) => outcome.quoteId),
  );

  const logged = due.filter((quote) => loggedQuoteIds.has(quote.id)).length;
  return {
    percent: Math.round((logged / due.length) * 100),
    logged,
    total: due.length,
  };
}
