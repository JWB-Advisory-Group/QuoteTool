"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import type { Bucket, OnboardingBuckets } from "@/lib/onboarding";

type Answers = {
  typicalSize: number | null;
  typicalHours: number | null;
  typicalCharge: string;
  driveMinutes: number | null;
};

const initialAnswers: Answers = {
  typicalSize: null,
  typicalHours: null,
  typicalCharge: "",
  driveMinutes: null,
};

const STEP_TITLES = [
  "Pick a typical job size",
  "About how long are you on site?",
  "What did you charge?",
  "How far is the drive, round-trip?",
];

export function OnboardingForm({
  serviceSlug,
  buckets,
}: {
  serviceSlug: string;
  buckets: OnboardingBuckets;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const totalSteps = STEP_TITLES.length;
  const isLastStep = step === totalSteps - 1;

  function canAdvance() {
    switch (step) {
      case 0:
        return answers.typicalSize !== null;
      case 1:
        return answers.typicalHours !== null;
      case 2: {
        const value = Number(answers.typicalCharge);
        return Number.isFinite(value) && value > 0;
      }
      case 3:
        return answers.driveMinutes !== null;
      default:
        return false;
    }
  }

  async function submit() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/cost-inputs/${serviceSlug}/onboard`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            typicalSize: answers.typicalSize,
            typicalHours: answers.typicalHours,
            typicalCharge: Number(answers.typicalCharge),
            driveMinutes: answers.driveMinutes,
          }),
        },
      );
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not save");
      router.push("/dashboard/onboarding");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save");
      setLoading(false);
    }
  }

  function next() {
    if (isLastStep) {
      submit();
      return;
    }
    setStep((current) => Math.min(current + 1, totalSteps - 1));
  }

  function back() {
    setStep((current) => Math.max(current - 1, 0));
  }

  return (
    <div className="rounded-lg border border-[#d8d4c7] bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#7a806f]">
        Step {step + 1} of {totalSteps}
      </div>
      <h2 className="mt-2 text-xl font-semibold tracking-tight">
        {STEP_TITLES[step]}
      </h2>

      <div className="mt-5">
        {step === 0 ? (
          <ChoiceGrid
            buckets={buckets.size}
            selected={answers.typicalSize}
            onSelect={(value) =>
              setAnswers((prev) => ({ ...prev, typicalSize: value }))
            }
          />
        ) : null}

        {step === 1 ? (
          <ChoiceGrid
            buckets={buckets.hours}
            selected={answers.typicalHours}
            onSelect={(value) =>
              setAnswers((prev) => ({ ...prev, typicalHours: value }))
            }
          />
        ) : null}

        {step === 2 ? (
          <div>
            <label className="text-sm font-semibold" htmlFor="typicalCharge">
              Dollar amount you typically charge
            </label>
            <div className="mt-2 flex h-14 items-center rounded-md border border-[#cbc7bb] bg-white px-4 ring-[#1d211c]/20 focus-within:ring-4">
              <span className="mr-2 text-base font-semibold text-[#62685f]">
                $
              </span>
              <input
                id="typicalCharge"
                type="number"
                inputMode="numeric"
                value={answers.typicalCharge}
                onChange={(event) =>
                  setAnswers((prev) => ({
                    ...prev,
                    typicalCharge: event.target.value,
                  }))
                }
                className="h-full min-w-0 flex-1 bg-transparent text-base outline-none"
                placeholder="625"
              />
            </div>
            <p className="mt-2 text-xs text-[#7a806f]">
              Used to sanity-check that the floor lands somewhere realistic.
            </p>
          </div>
        ) : null}

        {step === 3 ? (
          <ChoiceGrid
            buckets={buckets.drive}
            selected={answers.driveMinutes}
            onSelect={(value) =>
              setAnswers((prev) => ({ ...prev, driveMinutes: value }))
            }
          />
        ) : null}
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        {step > 0 ? (
          <button
            type="button"
            onClick={back}
            disabled={loading}
            className="inline-flex h-12 items-center gap-2 rounded-md border border-[#cbc7bb] bg-white px-4 text-sm font-semibold transition hover:border-[#1d211c] disabled:opacity-50"
          >
            <ArrowLeft size={16} />
            Back
          </button>
        ) : (
          <span />
        )}

        <button
          type="button"
          onClick={next}
          disabled={loading || !canAdvance()}
          className="inline-flex h-14 items-center gap-2 rounded-md bg-[#1d211c] px-6 text-base font-semibold text-white transition hover:bg-[#30372e] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="animate-spin" size={16} />
          ) : isLastStep ? (
            <>
              <Check size={18} />
              Save tailoring
            </>
          ) : (
            <>
              Next
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </div>

      {error ? (
        <p className="mt-4 rounded-md border border-[#f2b8b5] bg-[#fff5f5] px-3 py-2 text-sm font-medium text-[#9f2b22]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ChoiceGrid({
  buckets,
  selected,
  onSelect,
}: {
  buckets: Bucket[];
  selected: number | null;
  onSelect: (value: number) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {buckets.map((bucket) => {
        const active = selected === bucket.midpoint;
        return (
          <button
            key={bucket.label}
            type="button"
            onClick={() => onSelect(bucket.midpoint)}
            className={`flex min-h-16 items-start gap-3 rounded-md border px-4 py-3 text-left transition ${
              active
                ? "border-[#1d211c] bg-[#1d211c] text-white"
                : "border-[#cbc7bb] bg-white text-[#1d211c] hover:border-[#1d211c]"
            }`}
          >
            <div className="flex-1">
              <div className="text-base font-semibold">{bucket.label}</div>
              {bucket.description ? (
                <div
                  className={`mt-1 text-sm ${
                    active ? "text-white/80" : "text-[#62685f]"
                  }`}
                >
                  {bucket.description}
                </div>
              ) : null}
            </div>
            {active ? <Check size={18} className="mt-0.5" /> : null}
          </button>
        );
      })}
    </div>
  );
}
