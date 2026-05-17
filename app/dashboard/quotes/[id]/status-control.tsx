"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { QuoteStatus } from "@/lib/types";

const statusOptions: { value: QuoteStatus; label: string }[] = [
  { value: "pending", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "sent", label: "Quoted" },
  { value: "scheduled", label: "Scheduled" },
];

const terminalLabels: Partial<Record<QuoteStatus, string>> = {
  won: "Won",
  lost: "Lost",
  no_response: "No response",
  approved: "Approved",
  awaiting_deposit: "Awaiting deposit",
};

export function StatusControl({
  quoteId,
  status,
}: {
  quoteId: string;
  status: QuoteStatus;
}) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const options = statusOptions.some((option) => option.value === value)
    ? statusOptions
    : [
        {
          value,
          label: terminalLabels[value] ?? value.replaceAll("_", " "),
        },
        ...statusOptions,
      ];

  async function update(next: QuoteStatus) {
    setValue(next);
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`/api/quotes/${quoteId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not update status");
      router.refresh();
    } catch (error) {
      setValue(status);
      setMessage(error instanceof Error ? error.message : "Could not update status");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-[#d8d4c7] bg-white p-5 shadow-sm">
      <label className="text-sm font-semibold" htmlFor="quote-status">
        Lead status
      </label>
      <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
        <select
          id="quote-status"
          value={value}
          disabled={loading}
          onChange={(event) => update(event.target.value as QuoteStatus)}
          className="h-11 rounded-md border border-[#cbc7bb] bg-white px-3 text-sm font-semibold outline-none ring-[#1d211c]/20 focus:ring-4 disabled:opacity-60"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="flex h-11 w-11 items-center justify-center rounded-md border border-[#e4e0d5] bg-[#fbfaf7] text-[#62685f]">
          {loading ? <Loader2 size={16} className="animate-spin" /> : null}
        </div>
      </div>
      {message ? (
        <p className="mt-2 text-xs font-medium text-[#b42318]">{message}</p>
      ) : null}
    </div>
  );
}
