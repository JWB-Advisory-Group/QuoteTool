import { Check } from "lucide-react";
import type { ReactNode } from "react";

export function InfoPanel({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-[#e4e0d5] bg-[#fbfaf7] p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#62685f]">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold">{value}</div>
    </div>
  );
}

export function SelectDetail({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-sm font-semibold">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-12 w-full rounded-md border border-[#cbc7bb] bg-white px-3 text-base outline-none ring-[#1d211c]/20 focus:ring-4"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

export function NumberDetail({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <label className="text-sm font-semibold">
      {label}
      <input
        type="number"
        min={0}
        value={value ?? ""}
        onChange={(event) =>
          onChange(event.target.value ? Number(event.target.value) : null)
        }
        className="mt-2 h-12 w-full rounded-md border border-[#cbc7bb] bg-white px-3 text-base outline-none ring-[#1d211c]/20 focus:ring-4"
        placeholder="Optional"
      />
    </label>
  );
}

export function ToggleGroup<T extends string>({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string;
  options: { value: T; label: string }[];
  selected: T[];
  onToggle: (value: T) => void;
}) {
  return (
    <div>
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((option) => {
          const active = selected.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => onToggle(option.value)}
              className={`inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition ${
                active
                  ? "border-[#1d211c] bg-[#1d211c] text-white"
                  : "border-[#cbc7bb] bg-white text-[#1d211c] hover:border-[#1d211c]"
              }`}
            >
              {active ? <Check size={14} /> : null}
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
