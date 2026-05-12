"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Send,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import type { Quote } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import {
  ActualsCapture,
  buildActualsPayload,
  initialActualsState,
  type ActualsState,
} from "./actuals-capture";

type CaptureStep = "actions" | "actuals";

export function QuoteActions({ quote }: { quote: Quote }) {
  const router = useRouter();
  const [amount, setAmount] = useState(
    quote.finalQuoteAmount ?? quote.estimate.recommendedAsk,
  );
  const [outcomeAmount, setOutcomeAmount] = useState(
    quote.finalQuoteAmount ?? quote.estimate.recommendedAsk,
  );
  const [step, setStep] = useState<CaptureStep>("actions");
  const [actuals, setActuals] = useState<ActualsState>(initialActualsState);
  const [outcomeNotes, setOutcomeNotes] = useState("");
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const estimatedHours = quote.estimate.laborHours;
  const belowFloor = amount < quote.estimate.floorBandHigh;
  const reviewReasons = reviewReasonsFor(quote, amount);
  const needsSendReview = reviewReasons.length > 0;
  const canSend =
    !loading &&
    !belowFloor &&
    (!needsSendReview || (reviewConfirmed && overrideReason.trim().length > 0));

  async function sendQuote() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`/api/quotes/${quote.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, reviewConfirmed, overrideReason }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not send quote");
      setMessage("Quote sent and outcome follow-up scheduled.");
      setReviewConfirmed(false);
      setOverrideReason("");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not send quote");
    } finally {
      setLoading(false);
    }
  }

  async function submitOutcome(
    outcome: "won" | "lost" | "no_response" | "later",
    includeActuals: boolean,
  ) {
    setLoading(true);
    setMessage("");
    try {
      const payload = includeActuals
        ? buildActualsPayload(actuals, estimatedHours)
        : null;
      const response = await fetch(`/api/quotes/${quote.id}/outcome`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outcome,
          amount: outcome === "won" ? outcomeAmount : undefined,
          notes: outcomeNotes,
          actuals: payload,
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not log outcome");
      setMessage(`Logged ${outcome.replace("_", " ")}.`);
      setStep("actions");
      setActuals(initialActualsState);
      setOutcomeNotes("");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not log outcome",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-[#d8d4c7] bg-white p-5 shadow-sm">
      {step === "actions" ? (
        <>
          <h2 className="text-lg font-semibold tracking-tight">Quote controls</h2>
          <div className="mt-4 rounded-md border border-[#e4e0d5] bg-[#fbfaf7] p-3">
            <div className="text-sm font-semibold">Package prices</div>
            <div className="mt-3 grid gap-2">
              {quote.estimate.packageOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setAmount(option.price);
                    setOutcomeAmount(option.price);
                  }}
                  className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm transition ${
                    amount === option.price
                      ? "border-[#1d211c] bg-[#1d211c] text-white"
                      : "border-[#d8d4c7] bg-white hover:border-[#1d211c]"
                  }`}
                >
                  <span className="inline-flex items-center gap-2 font-semibold">
                    {amount === option.price ? <CheckCircle2 size={15} /> : null}
                    {option.name}
                  </span>
                  <span>{formatMoney(option.price)}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="mt-5">
            <label className="text-sm font-semibold" htmlFor="amount">
              Final quote amount
            </label>
            <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_auto]">
              <input
                id="amount"
                type="number"
                min={quote.estimate.floorBandHigh}
                value={amount}
                onChange={(event) => setAmount(Number(event.target.value))}
                className="h-12 rounded-md border border-[#cbc7bb] bg-white px-3 text-base outline-none ring-[#1d211c]/20 focus:ring-4"
              />
              <button
                type="button"
                onClick={sendQuote}
                disabled={!canSend}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-[#1d211c] px-5 text-sm font-semibold text-white transition hover:bg-[#30372e] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <Send size={16} />
                )}
                Send quote
              </button>
            </div>
            {belowFloor ? (
              <p className="mt-2 text-sm font-medium text-[#b42318]">
                The protected floor is{" "}
                {formatMoney(quote.estimate.floorBandHigh)}.
              </p>
            ) : null}
            {needsSendReview ? (
              <div className="mt-4 rounded-md border border-[#f1d18a] bg-[#fff8e5] p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#7a5400]">
                  <AlertTriangle size={15} />
                  Review required before sending
                </div>
                <div className="mt-2 space-y-1">
                  {reviewReasons.map((reason) => (
                    <div key={reason} className="text-xs leading-5 text-[#62685f]">
                      {reason}
                    </div>
                  ))}
                </div>
                <label className="mt-3 flex items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={reviewConfirmed}
                    onChange={(event) => setReviewConfirmed(event.target.checked)}
                    className="h-4 w-4"
                  />
                  I reviewed the scope and assumptions
                </label>
                <label className="mt-3 block text-sm font-semibold">
                  Review reason
                  <textarea
                    value={overrideReason}
                    onChange={(event) => setOverrideReason(event.target.value)}
                    className="mt-2 min-h-20 w-full rounded-md border border-[#cbc7bb] bg-white px-3 py-2 text-sm outline-none ring-[#1d211c]/20 focus:ring-4"
                    placeholder="Photos reviewed, customer confirmed access, price adjusted for..."
                  />
                </label>
              </div>
            ) : null}
          </div>

          <div id="log-outcome" className="mt-6 scroll-mt-6 border-t border-[#ece8dd] pt-5">
            <label className="text-sm font-semibold" htmlFor="outcomeAmount">
              Won amount confirmation
            </label>
            <input
              id="outcomeAmount"
              type="number"
              value={outcomeAmount}
              onChange={(event) => setOutcomeAmount(Number(event.target.value))}
              className="mt-2 h-12 w-full rounded-md border border-[#cbc7bb] bg-white px-3 text-base outline-none ring-[#1d211c]/20 focus:ring-4"
            />
            <label className="mt-3 block text-sm font-semibold" htmlFor="outcomeNotes">
              Outcome reason / notes
              <select
                id="outcomeNotes"
                value={outcomeNotes}
                onChange={(event) => setOutcomeNotes(event.target.value)}
                className="mt-2 h-12 w-full rounded-md border border-[#cbc7bb] bg-white px-3 text-base outline-none ring-[#1d211c]/20 focus:ring-4"
              >
                <option value="">No reason selected</option>
                <option value="Price too high">Price too high</option>
                <option value="Booked competitor">Booked competitor</option>
                <option value="No response after follow-up">No response after follow-up</option>
                <option value="Outside service area">Outside service area</option>
                <option value="Not ready yet">Not ready yet</option>
                <option value="Bad fit / unrealistic timing">Bad fit / unrealistic timing</option>
                <option value="Scope changed">Scope changed</option>
              </select>
            </label>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setActuals({
                    ...initialActualsState,
                    crewCount: quote.estimate.crewSize,
                  });
                  setStep("actuals");
                }}
                disabled={loading || quote.status === "pending"}
                className="inline-flex h-14 items-center justify-center gap-2 rounded-md bg-[#d8f269] px-4 text-base font-semibold text-[#1d211c] transition hover:bg-[#cbe65c] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ThumbsUp size={18} />
                Mark won
              </button>
              <button
                type="button"
                onClick={() => submitOutcome("lost", false)}
                disabled={loading || quote.status === "pending"}
                className="inline-flex h-14 items-center justify-center gap-2 rounded-md border border-[#cbc7bb] px-4 text-base font-semibold transition hover:border-[#1d211c] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ThumbsDown size={18} />
                Mark lost
              </button>
              <button
                type="button"
                onClick={() => submitOutcome("no_response", false)}
                disabled={loading || quote.status === "pending"}
                className="h-14 rounded-md border border-[#cbc7bb] px-4 text-base font-semibold transition hover:border-[#1d211c] disabled:cursor-not-allowed disabled:opacity-50"
              >
                No response
              </button>
              <button
                type="button"
                onClick={() => submitOutcome("later", false)}
                disabled={loading || quote.status === "pending"}
                className="h-14 rounded-md border border-[#cbc7bb] px-4 text-base font-semibold transition hover:border-[#1d211c] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Later
              </button>
            </div>
            {quote.status === "pending" ? (
              <p className="mt-3 text-sm text-[#62685f]">
                Send the quote before logging an outcome.
              </p>
            ) : null}
          </div>
        </>
      ) : (
        <ActualsCapture
          estimatedHours={estimatedHours}
          state={actuals}
          loading={loading}
          saveLabel="Save and mark won"
          onChange={setActuals}
          onBack={() => {
            setStep("actions");
            setActuals(initialActualsState);
          }}
          onSkip={() => submitOutcome("won", false)}
          onSave={() => submitOutcome("won", true)}
        />
      )}

      {message ? (
        <p className="mt-5 rounded-md border border-[#dedbd1] bg-[#fbfaf7] px-3 py-2 text-sm font-medium">
          {message}
        </p>
      ) : null}
    </div>
  );
}

function reviewReasonsFor(quote: Quote, amount: number) {
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
      `Final amount is more than 10% away from the recommended ask of ${formatMoney(
        recommended,
      )}.`,
    );
  }
  return [...new Set(reasons)];
}
