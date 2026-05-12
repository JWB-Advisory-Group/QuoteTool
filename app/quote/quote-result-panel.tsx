"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";
import { formatMoney } from "@/lib/format";
import type { PricingEstimate } from "@/lib/types";
import { InfoPanel } from "@/app/quote/quote-form-fields";

export type SubmitResult = {
  quoteId: string;
  rangeLow: number;
  rangeHigh: number;
  estimate: PricingEstimate;
  message: string;
};

export function ResultPanel({ result }: { result: SubmitResult }) {
  const packageOptions = result.estimate.packageOptions;
  const [selectedId, setSelectedId] = useState(
    packageOptions.find((option) => option.id === "best_value")?.id ??
      packageOptions[0]?.id ??
      null,
  );
  const selectedPackage = packageOptions.find((option) => option.id === selectedId);
  const needsPhotos = result.estimate.followUpStage === "Needs photos";

  return (
    <div className="rounded-lg border border-[#d8d4c7] bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-md bg-[#d8f269] text-[#1d211c]">
        <Check size={22} />
      </div>
      <p className="text-sm font-semibold text-[#62685f]">
        {needsPhotos
          ? "Estimate range - photos will tighten this number"
          : "Request received"}
      </p>
      <h2 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
        {`${formatMoney(result.rangeLow)}–${formatMoney(result.rangeHigh)}`}
      </h2>
      <p className="mt-3 max-w-xl text-base leading-7 text-[#62685f]">
        {`Request ID `}
        <span className="font-medium text-[#1d211c]">
          {result.quoteId.slice(0, 8)}
        </span>
        {`. Dante will review the scope and send a quote link with final package options, dates, and any deposit step.`}
      </p>

      {needsPhotos ? (
        <div className="mt-5 rounded-md border border-[#f1d18a] bg-[#fff8e5] px-3 py-3 text-sm font-medium text-[#7a5400]">
          We can hold this range, but a few photos will let us send a firmer
          number and skip the site visit. Reply to the follow-up text or email
          with front, sides, and any problem areas.
        </div>
      ) : null}

      <div className="mt-6">
        <div className="text-sm font-semibold">Likely package options</div>
        <div className="mt-3 grid gap-3">
          {packageOptions.map((option) => {
            const isSelected = selectedPackage?.id === option.id;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setSelectedId(option.id)}
                className={`rounded-md border p-4 text-left transition ${
                  isSelected
                    ? "border-[#1d211c] bg-[#f3f7df]"
                    : "border-[#e4e0d5] bg-[#fbfaf7] hover:border-[#1d211c]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{option.name}</h3>
                      {option.badge ? (
                        <span className="rounded-md bg-[#d8f269] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#1d211c]">
                          {option.badge}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-[#62685f]">
                      {option.description}
                    </p>
                  </div>
                  <div className="text-lg font-semibold">
                    {formatMoney(option.price)}
                  </div>
                </div>
                <div className="mt-3 space-y-1">
                  {option.includedServices.slice(0, 4).map((item) => (
                    <div key={item} className="flex gap-2 text-sm text-[#62685f]">
                      <CheckCircle2 size={14} className="mt-0.5 text-[#547a25]" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
                {isSelected ? (
                  <div className="mt-3 inline-flex items-center gap-1 rounded-md bg-[#1d211c] px-2 py-1 text-xs font-semibold text-white">
                    <Check size={12} />
                    Selected preview
                  </div>
                ) : null}
                {option.bundleSavings > 0 ? (
                  <div className="mt-2 text-xs font-semibold text-[#547a25]">
                    {`Same-visit value: ${formatMoney(option.bundleSavings)}`}
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <div className="rounded-md border border-[#e4e0d5] bg-[#fbfaf7] p-4">
          <div className="text-sm font-semibold">To firm this quote</div>
          <div className="mt-3 space-y-2">
            {result.estimate.intakeRequirements.requiredPhotos
              .slice(0, 5)
              .map((item) => (
                <div key={item} className="text-sm leading-6 text-[#62685f]">
                  {item}
                </div>
              ))}
          </div>
          <div className="mt-3 rounded-md bg-white px-3 py-2 text-xs font-semibold text-[#62685f]">
            {`Confidence: ${result.estimate.intakeRequirements.measurementConfidence}`}
          </div>
        </div>
        <div className="rounded-md border border-[#e4e0d5] bg-[#fbfaf7] p-4">
          <div className="text-sm font-semibold">Best route windows</div>
          <div className="mt-3 space-y-2">
            {result.estimate.scheduleWindows.slice(0, 3).map((window) => (
              <div key={window.id} className="text-sm leading-6 text-[#62685f]">
                <span className="font-semibold text-[#1d211c]">
                  {window.customerLabel}
                </span>
                {` · earliest ${window.earliestDate}`}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <InfoPanel
          icon={<CalendarDays size={16} />}
          label="Scheduling read"
          value={`${result.estimate.earliestAvailability} · ${result.estimate.crewBlock}`}
        />
        <InfoPanel
          icon={<ShieldCheck size={16} />}
          label="Deposit"
          value={
            result.estimate.depositRequired
              ? `${formatMoney(result.estimate.depositAmount)} hold may apply`
              : result.estimate.packageOptions.some(
                    (option) => option.price >= result.estimate.depositThreshold,
                  )
                ? `May apply above ${formatMoney(result.estimate.depositThreshold)}`
                : "No deposit expected"
          }
        />
      </div>

      <div className="mt-5 rounded-md border border-[#e4e0d5] p-4">
        <div className="text-sm font-semibold">What is included</div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {result.estimate.scopeInclusions.slice(0, 4).map((item) => (
            <div key={item} className="text-sm leading-6 text-[#62685f]">
              {item}
            </div>
          ))}
        </div>
        {result.estimate.scopeExclusions.length > 0 ? (
          <>
            <div className="mt-4 text-sm font-semibold">
              Not included unless added
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {result.estimate.scopeExclusions.slice(0, 4).map((item) => (
                <div key={item} className="text-sm leading-6 text-[#62685f]">
                  {item}
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <a
          className="inline-flex h-12 items-center justify-center rounded-md bg-[#1d211c] px-4 text-sm font-semibold text-white transition hover:bg-[#30372e]"
          href="tel:+16318503601"
        >
          Talk to a person
        </a>
        <Link
          className="inline-flex h-12 items-center justify-center rounded-md border border-[#cbc7bb] px-4 text-sm font-semibold transition hover:border-[#1d211c]"
          href="/quote"
        >
          Start another quote
        </Link>
      </div>
    </div>
  );
}
