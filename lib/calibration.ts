import type {
  AppStore,
  CostInput,
  JobActuals,
  Outcome,
  Quote,
  Service,
} from "@/lib/types";

const MIN_JOBS_FOR_FIT = 5;
const MAX_JOBS_FOR_FIT = 12;
const MATERIAL_MULTIPLIER: Record<string, number> = {
  less: 0.75,
  normal: 1,
  more: 1.3,
};

export type CalibrationStats = {
  serviceSlug: string;
  jobsWithActuals: number;
  jobsNeededForFit: number;
  fitReady: boolean;
};

function unitsFor(service: Service, jobSize: number) {
  if (service.unit === "per_1000_sqft") return jobSize / 1000;
  if (service.unit === "per_100_sqft") return jobSize / 100;
  if (service.unit === "per_100_linear_ft") return jobSize / 100;
  if (service.unit === "per_window") return jobSize;
  if (service.unit === "per_panel") return jobSize;
  return 1;
}

function storyAdjustment(stories: number) {
  if (stories <= 1) return 1;
  if (stories === 2) return 1.12;
  return 1.25;
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

type JobRecord = {
  quote: Quote;
  outcome: Outcome;
  actuals: JobActuals;
};

function recentWonJobsWithActuals(
  store: AppStore,
  serviceSlug: string,
): JobRecord[] {
  const rows: JobRecord[] = [];
  for (const outcome of store.outcomes) {
    if (outcome.outcome !== "won") continue;
    if (!outcome.actuals) continue;
    if (outcome.actuals.hours === null) continue;
    const quote = store.quotes.find((q) => q.id === outcome.quoteId);
    if (!quote) continue;
    if (quote.serviceSlug !== serviceSlug) continue;
    rows.push({ quote, outcome, actuals: outcome.actuals });
  }
  rows.sort(
    (a, b) =>
      new Date(b.outcome.createdAt).getTime() -
      new Date(a.outcome.createdAt).getTime(),
  );
  return rows.slice(0, MAX_JOBS_FOR_FIT);
}

export function getCalibrationStats(
  store: AppStore,
  serviceSlug: string,
): CalibrationStats {
  const jobs = recentWonJobsWithActuals(store, serviceSlug);
  return {
    serviceSlug,
    jobsWithActuals: jobs.length,
    jobsNeededForFit: MIN_JOBS_FOR_FIT,
    fitReady: jobs.length >= MIN_JOBS_FOR_FIT,
  };
}

export function fitCostInputFromActuals(
  store: AppStore,
  serviceSlug: string,
): CostInput | null {
  const service = store.services.find((s) => s.slug === serviceSlug);
  const current = store.costInputs.find((c) => c.serviceSlug === serviceSlug);
  if (!service || !current) return null;

  const jobs = recentWonJobsWithActuals(store, serviceSlug);
  if (jobs.length < MIN_JOBS_FOR_FIT) return null;

  const hoursPerUnitSamples: number[] = [];
  const materialMultiplierSamples: number[] = [];
  const longDriveCount = jobs.reduce(
    (count, job) => count + (job.actuals.tags.includes("long_drive") ? 1 : 0),
    0,
  );

  for (const job of jobs) {
    const units = unitsFor(service, job.quote.jobSize);
    if (units <= 0) continue;
    const storyMultiplier = storyAdjustment(job.quote.stories);
    const clockHours = job.actuals.hours ?? 0;
    if (clockHours <= 0) continue;
    const crewCount = job.actuals.crewCount ?? 1;
    const laborHours = clockHours * crewCount;
    const adjustedPerUnit = laborHours / units / storyMultiplier;
    hoursPerUnitSamples.push(adjustedPerUnit);

    if (job.actuals.materialUsage) {
      materialMultiplierSamples.push(
        MATERIAL_MULTIPLIER[job.actuals.materialUsage] ?? 1,
      );
    }
  }

  const fittedHoursPerUnit = median(hoursPerUnitSamples);
  if (fittedHoursPerUnit === null) return null;

  const materialMedian = median(materialMultiplierSamples);
  const materialAdjusted =
    materialMedian !== null
      ? current.materialCostPerUnit * materialMedian
      : current.materialCostPerUnit;

  const driveDriftRatio = jobs.length > 0 ? longDriveCount / jobs.length : 0;
  const driveAdjusted =
    driveDriftRatio >= 0.4
      ? Math.min(current.driveReserveMinutes + 10, 90)
      : current.driveReserveMinutes;

  const next: CostInput = {
    ...current,
    hoursPerUnit: Number(fittedHoursPerUnit.toFixed(3)),
    materialCostPerUnit: Number(materialAdjusted.toFixed(2)),
    driveReserveMinutes: driveAdjusted,
    source: "actuals_fit",
    updatedAt: new Date().toISOString(),
  };

  return next;
}

export function shouldRefit(
  store: AppStore,
  serviceSlug: string,
  newOutcomeHadActuals: boolean,
): boolean {
  if (!newOutcomeHadActuals) return false;
  const stats = getCalibrationStats(store, serviceSlug);
  return stats.fitReady;
}
