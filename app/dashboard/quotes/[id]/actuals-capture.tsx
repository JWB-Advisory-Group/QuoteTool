"use client";

import {
  ArrowLeft,
  Check,
  Clock,
  DollarSign,
  Droplets,
  Loader2,
  Users,
} from "lucide-react";
import type {
  ActualReasonCode,
  JobActuals,
  JobTag,
  MaterialUsage,
} from "@/lib/types";

const TAG_OPTIONS: { value: JobTag; label: string }[] = [
  { value: "easy", label: "Easy job" },
  { value: "tough", label: "Tougher than expected" },
  { value: "long_drive", label: "Long drive" },
  { value: "add_on", label: "Add-on work" },
  { value: "customer_issue", label: "Customer issue" },
];

const REASON_OPTIONS: { value: ActualReasonCode; label: string }[] = [
  { value: "access_slowdown", label: "Access slowed crew" },
  { value: "heavy_buildup", label: "Heavy buildup" },
  { value: "extra_ladder_work", label: "Extra ladder work" },
  { value: "chemical_demand", label: "More chemical" },
  { value: "customer_added_scope", label: "Customer added scope" },
  { value: "weather_delay", label: "Weather delay" },
  { value: "priced_too_low", label: "Price was low" },
  { value: "priced_correctly", label: "Price felt right" },
];

export type HoursMode = "unset" | "spot" | "custom";

export type ActualsState = {
  hoursMode: HoursMode;
  customHours: number | null;
  crewCount: number | null;
  materialUsage: MaterialUsage | null;
  addedRevenue: number | null;
  materialNotes: string;
  reasonCodes: ActualReasonCode[];
  tags: JobTag[];
};

export const initialActualsState: ActualsState = {
  hoursMode: "unset",
  customHours: null,
  crewCount: 1,
  materialUsage: null,
  addedRevenue: null,
  materialNotes: "",
  reasonCodes: [],
  tags: [],
};

export function hoursFor(state: ActualsState, estimatedHours: number) {
  if (state.hoursMode === "spot") return Number(estimatedHours.toFixed(1));
  if (state.hoursMode === "custom" && state.customHours !== null) {
    return state.customHours;
  }
  return null;
}

export function buildActualsPayload(
  state: ActualsState,
  estimatedHours: number,
): JobActuals | null {
  if (
    state.hoursMode === "unset" &&
    state.materialUsage === null &&
    state.tags.length === 0
  ) {
    return null;
  }
  return {
    hours: hoursFor(state, estimatedHours),
    crewCount: state.crewCount,
    materialUsage: state.materialUsage,
    addedRevenue: state.addedRevenue,
    materialNotes: state.materialNotes,
    reasonCodes: state.reasonCodes,
    tags: state.tags,
  };
}

export function hourSuggestionsFor(estimatedHours: number) {
  const base = Math.max(2, Math.round(estimatedHours));
  return [base - 2, base - 1, base, base + 1, base + 2, base + 3]
    .filter((value) => value >= 1)
    .slice(0, 6);
}

export function ActualsCapture({
  estimatedHours,
  state,
  loading,
  saveLabel = "Save",
  showSkip = true,
  showBack = true,
  intro,
  onChange,
  onBack,
  onSkip,
  onSave,
}: {
  estimatedHours: number;
  state: ActualsState;
  loading: boolean;
  saveLabel?: string;
  showSkip?: boolean;
  showBack?: boolean;
  intro?: string;
  onChange: (next: ActualsState) => void;
  onBack?: () => void;
  onSkip?: () => void;
  onSave: () => void;
}) {
  const customHoursReady =
    state.hoursMode === "custom" && state.customHours !== null;
  const canSave = state.hoursMode === "spot" || customHoursReady;
  const showHourPicker = state.hoursMode === "custom";
  const hourSuggestions = hourSuggestionsFor(estimatedHours);
  const clockHours = hoursFor(state, estimatedHours);
  const laborHours =
    clockHours !== null && state.crewCount
      ? Number((clockHours * state.crewCount).toFixed(1))
      : null;

  function setHoursMode(mode: "spot" | "custom") {
    if (mode === "spot") {
      onChange({ ...state, hoursMode: "spot", customHours: null });
    } else {
      const seed =
        state.customHours ??
        Math.max(1, Math.round(estimatedHours));
      onChange({ ...state, hoursMode: "custom", customHours: seed });
    }
  }

  function setCustomHours(hours: number) {
    onChange({ ...state, hoursMode: "custom", customHours: hours });
  }

  function setMaterialUsage(usage: MaterialUsage) {
    onChange({ ...state, materialUsage: usage });
  }

  function setCrewCount(crewCount: number) {
    onChange({ ...state, crewCount });
  }

  function toggleReason(reason: ActualReasonCode) {
    const exists = state.reasonCodes.includes(reason);
    onChange({
      ...state,
      reasonCodes: exists
        ? state.reasonCodes.filter((value) => value !== reason)
        : [...state.reasonCodes, reason],
    });
  }

  function toggleTag(tag: JobTag) {
    const exists = state.tags.includes(tag);
    onChange({
      ...state,
      tags: exists
        ? state.tags.filter((value) => value !== tag)
        : [...state.tags, tag],
    });
  }

  return (
    <div>
      {showBack && onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-[#62685f] transition hover:text-[#1d211c]"
        >
          <ArrowLeft size={14} />
          Back
        </button>
      ) : null}

      <h2 className="text-lg font-semibold tracking-tight">
        Quick check on this one
      </h2>
      <p className="mt-2 text-sm leading-6 text-[#62685f]">
        {intro ??
          `We estimated about ${estimatedHours.toFixed(1)} hours. Tell me what actually happened — it makes future quotes more accurate. Skip if you're busy, no problem.`}
      </p>
      <div className="mt-4 rounded-md border border-[#e4e0d5] bg-[#fbfaf7] px-3 py-3 text-sm">
        <span className="font-semibold">Calibration uses labor-hours:</span>{" "}
        {laborHours !== null
          ? `${clockHours} clock hr x ${state.crewCount ?? 1} tech = ${laborHours} labor hr`
          : "choose time and crew size"}
      </div>

      <div className="mt-5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Clock size={15} />
          Time on site
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <BigChoice
            active={state.hoursMode === "spot"}
            onClick={() => setHoursMode("spot")}
            label={`Spot on (~${estimatedHours.toFixed(1)} hr)`}
          />
          <BigChoice
            active={
              state.hoursMode === "custom" &&
              (state.customHours ?? estimatedHours) < estimatedHours
            }
            onClick={() => {
              setHoursMode("custom");
              setCustomHours(Math.max(1, Math.floor(estimatedHours - 1)));
            }}
            label="Less time"
          />
          <BigChoice
            active={
              state.hoursMode === "custom" &&
              (state.customHours ?? 0) > estimatedHours
            }
            onClick={() => {
              setHoursMode("custom");
              setCustomHours(Math.ceil(estimatedHours + 1));
            }}
            label="More time"
          />
        </div>

        {showHourPicker ? (
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {hourSuggestions.map((hours) => (
              <button
                key={hours}
                type="button"
                onClick={() => setCustomHours(hours)}
                className={`h-12 rounded-md border text-base font-semibold transition ${
                  state.customHours === hours
                    ? "border-[#1d211c] bg-[#1d211c] text-white"
                    : "border-[#cbc7bb] bg-white text-[#1d211c] hover:border-[#1d211c]"
                }`}
              >
                {hours} hr
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-6">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Users size={15} />
          Crew size
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[1, 2, 3].map((count) => (
            <BigChoice
              key={count}
              active={state.crewCount === count}
              onClick={() => setCrewCount(count)}
              label={`${count} tech${count > 1 ? "s" : ""}`}
            />
          ))}
        </div>
      </div>

      <div className="mt-6">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Droplets size={15} />
          Material used
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <BigChoice
            active={state.materialUsage === "less"}
            onClick={() => setMaterialUsage("less")}
            label="Less than usual"
          />
          <BigChoice
            active={state.materialUsage === "normal"}
            onClick={() => setMaterialUsage("normal")}
            label="Normal"
          />
          <BigChoice
            active={state.materialUsage === "more"}
            onClick={() => setMaterialUsage("more")}
            label="More than usual"
          />
        </div>
      </div>

      <div className="mt-6">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <DollarSign size={15} />
          Added work or materials
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-[160px_1fr]">
          <label className="text-sm font-semibold">
            Add-on dollars
            <input
              type="number"
              min={0}
              value={state.addedRevenue ?? ""}
              onChange={(event) =>
                onChange({
                  ...state,
                  addedRevenue: event.target.value
                    ? Number(event.target.value)
                    : null,
                })
              }
              className="mt-2 h-12 w-full rounded-md border border-[#cbc7bb] bg-white px-3 text-base outline-none ring-[#1d211c]/20 focus:ring-4"
              placeholder="0"
            />
          </label>
          <label className="text-sm font-semibold">
            Material notes
            <input
              value={state.materialNotes}
              onChange={(event) =>
                onChange({ ...state, materialNotes: event.target.value })
              }
              className="mt-2 h-12 w-full rounded-md border border-[#cbc7bb] bg-white px-3 text-base outline-none ring-[#1d211c]/20 focus:ring-4"
              placeholder="Extra SH, rust treatment, sand, screens..."
            />
          </label>
        </div>
      </div>

      <div className="mt-6">
        <div className="text-sm font-semibold">
          Why did it vary?{" "}
          <span className="font-normal text-[#62685f]">(optional)</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {REASON_OPTIONS.map((reason) => {
            const active = state.reasonCodes.includes(reason.value);
            return (
              <button
                key={reason.value}
                type="button"
                onClick={() => toggleReason(reason.value)}
                className={`inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition ${
                  active
                    ? "border-[#1d211c] bg-[#1d211c] text-white"
                    : "border-[#cbc7bb] bg-white text-[#1d211c] hover:border-[#1d211c]"
                }`}
              >
                {active ? <Check size={14} /> : null}
                {reason.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6">
        <div className="text-sm font-semibold">
          Anything else?{" "}
          <span className="font-normal text-[#62685f]">(optional)</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {TAG_OPTIONS.map((tag) => {
            const active = state.tags.includes(tag.value);
            return (
              <button
                key={tag.value}
                type="button"
                onClick={() => toggleTag(tag.value)}
                className={`inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition ${
                  active
                    ? "border-[#1d211c] bg-[#1d211c] text-white"
                    : "border-[#cbc7bb] bg-white text-[#1d211c] hover:border-[#1d211c]"
                }`}
              >
                {active ? <Check size={14} /> : null}
                {tag.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={onSave}
          disabled={loading || !canSave}
          className="inline-flex h-14 items-center justify-center gap-2 rounded-md bg-[#1d211c] px-4 text-base font-semibold text-white transition hover:bg-[#30372e] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="animate-spin" size={16} />
          ) : (
            <Check size={18} />
          )}
          {saveLabel}
        </button>
        {showSkip && onSkip ? (
          <button
            type="button"
            onClick={onSkip}
            disabled={loading}
            className="h-14 rounded-md border border-[#cbc7bb] px-4 text-base font-semibold transition hover:border-[#1d211c] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Skip — log later
          </button>
        ) : null}
      </div>
    </div>
  );
}

function BigChoice({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-14 rounded-md border px-3 text-sm font-semibold transition ${
        active
          ? "border-[#1d211c] bg-[#1d211c] text-white"
          : "border-[#cbc7bb] bg-white text-[#1d211c] hover:border-[#1d211c]"
      }`}
    >
      {label}
    </button>
  );
}
