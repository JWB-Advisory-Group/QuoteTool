"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  Loader2,
  Settings2,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import type { CostInput, Service } from "@/lib/types";
import { formatMoney } from "@/lib/format";

type CalibrationSummary = {
  jobsWithActuals: number;
  jobsNeededForFit: number;
  fitReady: boolean;
};

type EditorState = Omit<CostInput, "serviceSlug" | "source" | "updatedAt">;

function toPercent(value: number) {
  return Math.round(value * 100);
}

function fromPercent(value: number) {
  return value / 100;
}

function pickStandardSize(service: Service) {
  return (
    service.sizeOptions.find((option) =>
      option.label.toLowerCase().includes("standard"),
    ) ??
    service.sizeOptions[1] ??
    service.sizeOptions[0]
  );
}

function previewSnapshot(input: EditorState, service: Service) {
  const sample = pickStandardSize(service);
  const sampleSize = sample?.value ?? (service.unit === "per_window" ? 35 : 2500);
  const units =
    service.unit === "per_window" || service.unit === "per_panel"
      ? sampleSize
      : service.unit === "per_100_sqft" ||
          service.unit === "per_100_linear_ft"
        ? sampleSize / 100
        : service.unit === "per_1000_sqft"
          ? sampleSize / 1000
          : 1;
  const buffer = input.bufferActive ? 1.15 : 1;
  const hours = input.hoursPerUnit * units * 1.12 * buffer;
  const labor = hours * input.hourlyLaborRate;
  const materials = input.materialCostPerUnit * units * buffer;
  const drive = (input.driveReserveMinutes / 60) * input.hourlyLaborRate;
  const equipment = input.equipmentWearPerHour * hours;
  const subtotal = labor + materials + drive + equipment;
  const floor = subtotal * (1 + input.overheadPct) * (1 + input.minMarginPct);
  return {
    sampleLabel: sample?.label ?? "Standard",
    sampleSize,
    hours,
    materials,
    protectedFloor: Math.max(floor, input.serviceMinimum) * 1.12,
  };
}

export function CostEditor({
  services,
  costInputs,
  calibrationByService,
}: {
  services: Service[];
  costInputs: CostInput[];
  calibrationByService: Record<string, CalibrationSummary>;
}) {
  const router = useRouter();
  const [activeSlug, setActiveSlug] = useState(services[0]?.slug ?? "");
  const activeService =
    services.find((service) => service.slug === activeSlug) ?? services[0];
  const activeInput =
    costInputs.find((input) => input.serviceSlug === activeSlug) ?? costInputs[0];
  const activeCalibration = calibrationByService[activeSlug] ?? {
    jobsWithActuals: 0,
    jobsNeededForFit: 5,
    fitReady: false,
  };
  const [form, setForm] = useState<EditorState>({
    hourlyLaborRate: activeInput.hourlyLaborRate,
    materialCostPerUnit: activeInput.materialCostPerUnit,
    equipmentWearPerHour: activeInput.equipmentWearPerHour,
    hoursPerUnit: activeInput.hoursPerUnit,
    driveReserveMinutes: activeInput.driveReserveMinutes,
    overheadPct: activeInput.overheadPct,
    minMarginPct: activeInput.minMarginPct,
    serviceMinimum: activeInput.serviceMinimum,
    depositThreshold: activeInput.depositThreshold,
    bufferActive: activeInput.bufferActive,
  });
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const snapshot = useMemo(
    () => previewSnapshot(form, activeService),
    [activeService, form],
  );

  function switchService(slug: string) {
    const next = costInputs.find((input) => input.serviceSlug === slug);
    if (!next) return;
    setActiveSlug(slug);
    setForm({
      hourlyLaborRate: next.hourlyLaborRate,
      materialCostPerUnit: next.materialCostPerUnit,
      equipmentWearPerHour: next.equipmentWearPerHour,
      hoursPerUnit: next.hoursPerUnit,
      driveReserveMinutes: next.driveReserveMinutes,
      overheadPct: next.overheadPct,
      minMarginPct: next.minMarginPct,
      serviceMinimum: next.serviceMinimum,
      depositThreshold: next.depositThreshold,
      bufferActive: next.bufferActive,
    });
    setAdvancedOpen(false);
    setMessage("");
  }

  function update<K extends keyof EditorState>(key: K, value: EditorState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`/api/cost-inputs/${activeSlug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not save inputs");
      setMessage("Saved. New quotes will use these.");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not save inputs",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
      <div className="rounded-lg border border-[#d8d4c7] bg-white p-3 shadow-sm">
        {services.map((service) => (
          <button
            key={service.slug}
            type="button"
            onClick={() => switchService(service.slug)}
            className={`mb-2 block w-full rounded-md px-3 py-3 text-left text-sm font-semibold transition ${
              service.slug === activeSlug
                ? "bg-[#1d211c] text-white"
                : "bg-[#fbfaf7] text-[#1d211c] hover:bg-[#f0ede4]"
            }`}
          >
            {service.name}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-[#d8d4c7] bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold tracking-tight">
          {activeService.name}
        </h2>

        <SourceBadge
          source={activeInput.source}
          calibration={activeCalibration}
          serviceSlug={activeSlug}
        />

        <div className="mt-5 rounded-md border border-[#e4e0d5] bg-[#fbfaf7] p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-[#7a806f]">
            On a typical {snapshot.sampleLabel.toLowerCase()} 2-story job
          </div>
          <div className="mt-3 space-y-3">
            <SnapshotRow
              label="Time on site"
              value={`~${snapshot.hours.toFixed(1)} hours`}
            />
            <SnapshotRow
              label="Material"
              value={`~${formatMoney(snapshot.materials)}`}
            />
            <SnapshotRow
              label="Drive + setup buffer"
              value={`${form.driveReserveMinutes} min`}
            />
            <SnapshotRow
              label="Your hourly rate"
              value={formatMoney(form.hourlyLaborRate)}
            />
            <SnapshotRow
              label="Overhead + minimum margin"
              value={`${toPercent(form.overheadPct)}% + ${toPercent(form.minMarginPct)}%`}
            />
            <SnapshotRow
              label="Service minimum"
              value={formatMoney(form.serviceMinimum)}
            />
            <div className="border-t border-[#e4e0d5] pt-3">
              <SnapshotRow
                label="Protected floor"
                value={formatMoney(snapshot.protectedFloor)}
                bold
              />
            </div>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-[#62685f]">
          You don&apos;t need to edit anything here. Re-do the onboarding to
          reset the model, or log how each job actually went and the numbers
          tune themselves.
        </p>

        <button
          type="button"
          onClick={() => setAdvancedOpen((open) => !open)}
          className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#62685f] transition hover:text-[#1d211c]"
        >
          <Settings2 size={14} />
          {advancedOpen ? "Hide" : "Show"} advanced settings
          <ChevronDown
            size={14}
            className={`transition ${advancedOpen ? "rotate-180" : ""}`}
          />
        </button>

        {advancedOpen ? (
          <div className="mt-5 rounded-md border border-[#e4e0d5] bg-white p-4">
            <p className="text-xs leading-5 text-[#7a806f]">
              Raw model inputs. Edit only if you know exactly what you&apos;re
              changing — the onboarding flow and per-job actuals normally keep
              these healthy.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <NumberField
                label="Hourly labor rate"
                prefix="$"
                value={form.hourlyLaborRate}
                onChange={(value) => update("hourlyLaborRate", value)}
              />
              <NumberField
                label={`Material cost per ${activeService.unitLabel}`}
                prefix="$"
                value={form.materialCostPerUnit}
                step="0.01"
                onChange={(value) => update("materialCostPerUnit", value)}
              />
              <NumberField
                label={`Hours per ${activeService.unitLabel}`}
                value={form.hoursPerUnit}
                step="0.01"
                onChange={(value) => update("hoursPerUnit", value)}
              />
              <NumberField
                label="Equipment wear per hour"
                prefix="$"
                value={form.equipmentWearPerHour}
                step="0.01"
                onChange={(value) => update("equipmentWearPerHour", value)}
              />
              <NumberField
                label="Drive/setup reserve minutes"
                value={form.driveReserveMinutes}
                onChange={(value) => update("driveReserveMinutes", value)}
              />
              <NumberField
                label="Service minimum"
                prefix="$"
                value={form.serviceMinimum}
                onChange={(value) => update("serviceMinimum", value)}
              />
              <NumberField
                label="Deposit threshold"
                prefix="$"
                value={form.depositThreshold}
                onChange={(value) => update("depositThreshold", value)}
              />
              <NumberField
                label="Overhead"
                suffix="%"
                value={toPercent(form.overheadPct)}
                onChange={(value) => update("overheadPct", fromPercent(value))}
              />
              <NumberField
                label="Minimum margin"
                suffix="%"
                value={toPercent(form.minMarginPct)}
                onChange={(value) => update("minMarginPct", fromPercent(value))}
              />
              <label className="flex min-h-12 items-center gap-3 rounded-md border border-[#d8d4c7] bg-[#fbfaf7] px-3 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={form.bufferActive}
                  onChange={(event) =>
                    update("bufferActive", event.target.checked)
                  }
                  className="h-4 w-4"
                />
                Keep 15% safety buffer active
              </label>
            </div>

            <button
              type="button"
              onClick={save}
              disabled={loading}
              className="mt-5 inline-flex h-12 items-center gap-2 rounded-md bg-[#1d211c] px-5 text-sm font-semibold text-white transition hover:bg-[#30372e] disabled:cursor-wait disabled:opacity-70"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <Check size={16} />
              )}
              Save raw values
            </button>
          </div>
        ) : null}

        {message ? (
          <p className="mt-4 rounded-md border border-[#dedbd1] bg-[#fbfaf7] px-3 py-2 text-sm font-medium">
            {message}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function SnapshotRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-[#62685f]">{label}</span>
      <span className={bold ? "text-base font-semibold" : "font-semibold"}>
        {value}
      </span>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  prefix,
  suffix,
  step = "1",
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  prefix?: string;
  suffix?: string;
  step?: string;
}) {
  return (
    <label className="block text-sm font-semibold">
      {label}
      <div className="mt-2 flex h-12 items-center rounded-md border border-[#cbc7bb] bg-white px-3 ring-[#1d211c]/20 focus-within:ring-4">
        {prefix ? <span className="mr-1 text-[#62685f]">{prefix}</span> : null}
        <input
          type="number"
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="h-full min-w-0 flex-1 bg-transparent outline-none"
        />
        {suffix ? <span className="ml-1 text-[#62685f]">{suffix}</span> : null}
      </div>
    </label>
  );
}

function SourceBadge({
  source,
  calibration,
  serviceSlug,
}: {
  source: CostInput["source"];
  calibration: CalibrationSummary;
  serviceSlug: string;
}) {
  if (source === "industry_default") {
    return (
      <Link
        href={`/dashboard/onboarding/${serviceSlug}`}
        className="mt-3 flex items-start gap-3 rounded-md border border-[#f1d18a] bg-[#fff8e5] p-3 transition hover:border-[#caa54a]"
      >
        <Sparkles size={16} className="mt-0.5 text-[#8a6100]" />
        <div className="text-sm">
          <div className="font-semibold">Using industry defaults</div>
          <p className="text-[#62685f]">
            Four questions tailor the model to how you work. Tap to start.
          </p>
        </div>
      </Link>
    );
  }
  if (source === "dante_input") {
    return (
      <div className="mt-3 flex items-start gap-3 rounded-md border border-[#cbe0c2] bg-[#f4fbef] p-3">
        <TrendingUp size={16} className="mt-0.5 text-[#3a6c2c]" />
        <div className="text-sm">
          <div className="font-semibold">Tailored to you</div>
          <p className="text-[#62685f]">
            {calibration.jobsWithActuals} of {calibration.jobsNeededForFit} real
            jobs logged. Auto-calibration kicks in at{" "}
            {calibration.jobsNeededForFit}.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="mt-3 flex items-start gap-3 rounded-md border border-[#cbe0c2] bg-[#f4fbef] p-3">
      <TrendingUp size={16} className="mt-0.5 text-[#3a6c2c]" />
      <div className="text-sm">
        <div className="font-semibold">
          Calibrated from {calibration.jobsWithActuals} real jobs
        </div>
        <p className="text-[#62685f]">
          Each completed job updates these numbers automatically.
        </p>
      </div>
    </div>
  );
}
