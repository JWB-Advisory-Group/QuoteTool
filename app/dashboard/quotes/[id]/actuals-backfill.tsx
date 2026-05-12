"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import {
  ActualsCapture,
  buildActualsPayload,
  initialActualsState,
  type ActualsState,
} from "./actuals-capture";

export function ActualsBackfill({
  outcomeId,
  estimatedHours,
}: {
  outcomeId: string;
  estimatedHours: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ActualsState>(initialActualsState);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    setLoading(true);
    setMessage("");
    try {
      const payload = buildActualsPayload(state, estimatedHours);
      if (!payload || payload.hours === null) {
        setMessage("Pick a time on site so we can calibrate.");
        setLoading(false);
        return;
      }
      const response = await fetch(`/api/outcomes/${outcomeId}/actuals`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not save actuals");
      setMessage("Logged. Future quotes get sharper.");
      setOpen(false);
      setState(initialActualsState);
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not save actuals",
      );
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-md border border-[#cbc7bb] bg-white px-3 py-2 text-xs font-semibold transition hover:border-[#1d211c]"
        >
          <ClipboardCheck size={14} />
          Log how the job went
        </button>
        {message ? (
          <p className="mt-2 text-xs text-[#62685f]">{message}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-md border border-[#e4e0d5] bg-[#fbfaf7] p-4">
      <ActualsCapture
        estimatedHours={estimatedHours}
        state={state}
        loading={loading}
        saveLabel="Save actuals"
        showSkip={false}
        showBack={true}
        intro={`We estimated about ${estimatedHours.toFixed(1)} hours. Log what really happened so future quotes get sharper.`}
        onChange={setState}
        onBack={() => {
          setOpen(false);
          setState(initialActualsState);
        }}
        onSave={save}
      />
      {message ? (
        <p className="mt-3 text-sm text-[#62685f]">{message}</p>
      ) : null}
    </div>
  );
}
