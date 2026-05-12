import type { CostInput, Service } from "@/lib/types";
import { roundToFive } from "@/lib/format";

export type Bucket = {
  label: string;
  description?: string;
  midpoint: number;
};

export type OnboardingBuckets = {
  size: Bucket[];
  hours: Bucket[];
  drive: Bucket[];
};

const HOUSE_WASH_HOURS: Bucket[] = [
  { label: "2-3 hours", midpoint: 2.5 },
  { label: "4-5 hours", midpoint: 4.5 },
  { label: "6-7 hours", midpoint: 6.5 },
  { label: "8+ hours", midpoint: 9 },
];

const ROOF_WASH_HOURS: Bucket[] = [
  { label: "3-4 hours", midpoint: 3.5 },
  { label: "5-6 hours", midpoint: 5.5 },
  { label: "7-8 hours", midpoint: 7.5 },
  { label: "9+ hours", midpoint: 10 },
];

const WINDOW_HOURS: Bucket[] = [
  { label: "Under 1 hour", midpoint: 0.5 },
  { label: "1-2 hours", midpoint: 1.5 },
  { label: "2-3 hours", midpoint: 2.5 },
  { label: "3+ hours", midpoint: 4 },
];

const DRIVE_BUCKETS: Bucket[] = [
  { label: "Local", description: "Under 20 min round-trip", midpoint: 15 },
  { label: "Medium", description: "20-40 min round-trip", midpoint: 30 },
  { label: "Long", description: "40+ min round-trip", midpoint: 50 },
];

export function getOnboardingBuckets(service: Service): OnboardingBuckets {
  const size: Bucket[] = service.sizeOptions.map((option) => ({
    label: option.label,
    description: option.description,
    midpoint: option.value,
  }));

  if (service.slug === "roof-wash") {
    return { size, hours: ROOF_WASH_HOURS, drive: DRIVE_BUCKETS };
  }

  if (service.slug === "window-cleaning") {
    return { size, hours: WINDOW_HOURS, drive: DRIVE_BUCKETS };
  }

  return { size, hours: HOUSE_WASH_HOURS, drive: DRIVE_BUCKETS };
}

export type OnboardingAnswers = {
  typicalSize: number;
  typicalHours: number;
  typicalCharge: number;
  driveMinutes: number;
};

function unitCount(service: Service, jobSize: number) {
  if (service.unit === "per_1000_sqft") return jobSize / 1000;
  if (service.unit === "per_window") return jobSize;
  return 1;
}

const STANDARD_STORY_MULTIPLIER = 1.12;

export function computeCostInputFromOnboarding(
  service: Service,
  current: CostInput,
  answers: OnboardingAnswers,
): CostInput {
  const units = unitCount(service, answers.typicalSize);
  const safeUnits = units > 0 ? units : 1;
  const hoursPerUnitRaw =
    answers.typicalHours / safeUnits / STANDARD_STORY_MULTIPLIER;
  const hoursPerUnit = Number(hoursPerUnitRaw.toFixed(3));
  const buffer = current.bufferActive ? 1.15 : 1;
  const laborHours = hoursPerUnit * safeUnits * STANDARD_STORY_MULTIPLIER * buffer;
  const labor = laborHours * current.hourlyLaborRate;
  const materials = current.materialCostPerUnit * safeUnits * buffer;
  const drive = (answers.driveMinutes / 60) * current.hourlyLaborRate;
  const equipment = current.equipmentWearPerHour * laborHours;
  const subtotal = labor + materials + drive + equipment;
  const costProtectedFloor =
    subtotal * (1 + current.overheadPct) * (1 + current.minMarginPct);
  const serviceMinimum = roundToFive(
    Math.max(costProtectedFloor, answers.typicalCharge / 1.12),
  );

  return {
    ...current,
    hoursPerUnit,
    driveReserveMinutes: answers.driveMinutes,
    serviceMinimum,
    source: "dante_input",
    updatedAt: new Date().toISOString(),
  };
}
