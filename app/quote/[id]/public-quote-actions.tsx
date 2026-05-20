"use client";

import { useMemo, useState } from "react";
import { Check, CheckCircle2, Loader2, Plus, Sparkles } from "lucide-react";
import type {
  ApprovalRecord,
  BundleRecommendation,
  PreferredWindow,
  QuotePackageOption,
  ScheduleWindowOption,
} from "@/lib/types";
import { formatMoney } from "@/lib/format";

const DEPOSIT_AUTO_SERVICES = new Set([
  "roof-wash",
  "paver-refresh",
  "permanent-lighting",
  "painting",
]);

export function PublicQuoteActions({
  quoteId,
  packageOptions,
  scheduleWindows,
  depositThreshold,
  estimateRangeHigh,
  initialPackageId,
  initialApproval,
  surveyRequired,
  canApprove,
  expired = false,
  bundleRecommendations,
  serviceSlugs,
}: {
  quoteId: string;
  packageOptions: QuotePackageOption[];
  scheduleWindows: ScheduleWindowOption[];
  depositThreshold: number;
  estimateRangeHigh: number;
  initialPackageId: QuotePackageOption["id"];
  initialApproval: ApprovalRecord | null;
  surveyRequired: boolean;
  canApprove: boolean;
  expired?: boolean;
  bundleRecommendations: BundleRecommendation[];
  serviceSlugs: string[];
}) {
  const approvedPackageId = packageOptions.find(
    (option) => option.id === initialApproval?.selectedPackageId,
  )?.id;
  const [selectedPackageId, setSelectedPackageId] =
    useState<QuotePackageOption["id"]>(
      approvedPackageId ?? initialPackageId,
    );
  const [acceptedUpsells, setAcceptedUpsells] = useState<Set<string>>(
    () => new Set(initialApproval?.acceptedUpsellIds ?? []),
  );
  const [preferredDates, setPreferredDates] = useState<PreferredWindow[]>(
    initialApproval?.preferredDates ?? [],
  );
  const [customerNote, setCustomerNote] = useState(
    initialApproval?.customerNote ?? "",
  );
  const [scopeAccepted, setScopeAccepted] = useState(
    initialApproval?.scopeAccepted ?? false,
  );
  const [approval, setApproval] = useState<ApprovalRecord | null>(
    initialApproval,
  );
  const [status, setStatus] = useState<"idle" | "saving" | "redirecting" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  const selectedPackage =
    packageOptions.find((option) => option.id === selectedPackageId) ??
    packageOptions[0];

  const availableUpsells = useMemo(
    () =>
      bundleRecommendations.filter((bundle) => {
        const addOn = bundle.services.at(-1);
        if (!addOn || !selectedPackage) return false;
        return !selectedPackage.includedServices.includes(addOn);
      }),
    [bundleRecommendations, selectedPackage],
  );

  const acceptedUpsellsLift = useMemo(
    () =>
      availableUpsells
        .filter((bundle) => acceptedUpsells.has(bundle.id))
        .reduce((sum, bundle) => sum + bundle.estimatedLift, 0),
    [availableUpsells, acceptedUpsells],
  );

  const selectedTotal = (selectedPackage?.price ?? 0) + acceptedUpsellsLift;
  const selectedDepositRequired =
    Boolean(selectedPackage) &&
    (selectedTotal >= depositThreshold ||
      serviceSlugs.some((slug) => DEPOSIT_AUTO_SERVICES.has(slug)));
  const selectedDepositAmount = selectedDepositRequired
    ? Math.round(Math.max(150, selectedTotal * 0.2) / 5) * 5
    : 0;
  const preferredWindowOptions: PreferredWindow[] = scheduleWindows.map(
    (window) => ({
      day: window.customerLabel,
      time: window.time,
    }),
  );

  function togglePreferredDate(window: PreferredWindow) {
    const exists = preferredDates.some(
      (item) => item.day === window.day && item.time === window.time,
    );
    const next = exists
      ? preferredDates.filter(
          (item) => !(item.day === window.day && item.time === window.time),
        )
      : [...preferredDates, window].slice(0, 3);
    setPreferredDates(next);
  }

  function toggleUpsell(id: string) {
    setAcceptedUpsells((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function approve() {
    if (!selectedPackage || surveyRequired || !canApprove) return;
    if (!scopeAccepted) {
      setStatus("error");
      setMessage("Please confirm the scope before approving.");
      return;
    }
    setStatus("saving");
    setMessage("");
    try {
      const response = await fetch(`/api/quotes/${quoteId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedPackageId: selectedPackage.id,
          selectedPrice: selectedTotal,
          preferredDates,
          customerNote,
          acceptedUpsellIds: Array.from(acceptedUpsells),
          acceptedUpsellsLift,
          scopeAccepted: true,
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not approve quote");

      setApproval(json.approval);
      setMessage(String(json.nextStep ?? "Approved. We will confirm shortly."));

      if (json.checkoutUrl) {
        setStatus("redirecting");
        window.location.href = String(json.checkoutUrl);
        return;
      }

      setStatus("idle");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not approve quote");
    }
  }

  if (expired && !approval) {
    return (
      <div className="rounded-lg border border-[#f5b3b0] bg-[#fff5f5] p-5">
        <div className="text-sm font-semibold text-[#b42318]">
          This quote has expired
        </div>
        <p className="mt-2 text-sm leading-6 text-[#62685f]">
          Pricing windows are valid for 7 days because chemicals, fuel, and
          schedule capacity move. Call or text Dante to refresh — repeat
          customers usually keep the same number.
        </p>
        <a
          href="tel:+16318503601"
          className="mt-4 inline-flex h-12 items-center justify-center rounded-md bg-[#1d211c] px-4 text-sm font-semibold text-white transition hover:bg-[#30372e]"
        >
          Refresh quote
        </a>
      </div>
    );
  }

  if (surveyRequired) {
    return (
      <div className="rounded-lg border border-[#f1d18a] bg-[#fff8e5] p-5">
        <div className="text-sm font-semibold text-[#7a5400]">
          Survey required before final booking
        </div>
        <p className="mt-2 text-sm leading-6 text-[#62685f]">
          This project needs a quick scope review before it can be approved as a
          final price. Reply to Dante&apos;s text or call to set the survey.
        </p>
        <a
          href="tel:+16318503601"
          className="mt-4 inline-flex h-12 items-center justify-center rounded-md bg-[#1d211c] px-4 text-sm font-semibold text-white transition hover:bg-[#30372e]"
        >
          Call Dante
        </a>
      </div>
    );
  }

  if (approval) {
    return (
      <div className="rounded-lg border border-[#cbe0c2] bg-[#f4fbef] p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#315b22]">
          <CheckCircle2 size={16} />
          Approved at {formatMoney(approval.selectedPrice)}
        </div>
        <p className="mt-2 text-sm leading-6 text-[#3a6c2c]">
          {message || "Dante will confirm your booking window shortly."}
        </p>
        {approval.acceptedUpsellIds.length > 0 ? (
          <p className="mt-2 text-xs text-[#3a6c2c]">
            Added on this visit: {approval.acceptedUpsellIds.length} same-trip
            add-on{approval.acceptedUpsellIds.length === 1 ? "" : "s"} (+
            {formatMoney(approval.acceptedUpsellsLift)}).
          </p>
        ) : null}
        {approval.depositRequired ? (
          <div className="mt-3 rounded-md border border-[#d7e8c7] bg-white px-3 py-3 text-sm">
            <div className="font-semibold">
              Deposit: {formatMoney(approval.depositAmount)}{" "}
              {approval.depositPaid ? "paid" : "pending"}
            </div>
            {!approval.depositPaid && approval.depositCheckoutUrl ? (
              <a
                href={approval.depositCheckoutUrl}
                className="mt-3 inline-flex h-10 items-center justify-center rounded-md bg-[#1d211c] px-3 text-xs font-semibold text-white transition hover:bg-[#30372e]"
              >
                Open secure deposit payment
              </a>
            ) : (
              <p className="mt-1 text-xs leading-5 text-[#62685f]">
                Dante will confirm the deposit step before scheduling.
              </p>
            )}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#d8d4c7] bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold tracking-tight">
        Choose your package
      </h2>
      <div className="mt-4 grid gap-3">
        {packageOptions.map((option) => {
          const selected = option.id === selectedPackageId;
          const upgradeAboveRange = Math.max(0, option.price - estimateRangeHigh);
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setSelectedPackageId(option.id)}
              className={`rounded-md border p-4 text-left transition ${
                selected
                  ? "border-[#1d211c] bg-[#f3f7df]"
                  : "border-[#e4e0d5] bg-[#fbfaf7] hover:border-[#1d211c]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-semibold">{option.name}</div>
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
                <div className="shrink-0 text-right font-semibold">
                  {formatMoney(option.price)}
                  {upgradeAboveRange > 0 ? (
                    <div className="mt-1 text-[11px] font-semibold leading-4 text-[#7a5400]">
                      +{formatMoney(upgradeAboveRange)} upgrade
                    </div>
                  ) : (
                    <div className="mt-1 text-[11px] font-semibold leading-4 text-[#547a25]">
                      in estimate band
                    </div>
                  )}
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
              {selected ? (
                <div className="mt-3 inline-flex items-center gap-1 rounded-md bg-[#1d211c] px-2 py-1 text-xs font-semibold text-white">
                  <Check size={12} />
                  Selected
                </div>
              ) : null}
              {option.bundleSavings > 0 ? (
                <div className="mt-2 text-xs font-semibold text-[#547a25]">
                  Same-visit value: {formatMoney(option.bundleSavings)}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>

      {availableUpsells.length > 0 ? (
        <div className="mt-5 rounded-md border border-[#cbe0c2] bg-[#f4fbef] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#315b22]">
            <Sparkles size={14} />
            While we&apos;re there
          </div>
          <p className="mt-1 text-xs leading-5 text-[#3a6c2c]">
            Crew is already on site for the {selectedPackage?.name} scope.
            Same-trip add-ons skip the second mobilization fee.
          </p>
          <div className="mt-3 grid gap-2">
            {availableUpsells.map((bundle) => {
              const active = acceptedUpsells.has(bundle.id);
              return (
                <button
                  key={bundle.id}
                  type="button"
                  onClick={() => toggleUpsell(bundle.id)}
                  aria-pressed={active}
                  className={`flex items-start justify-between gap-3 rounded-md border p-3 text-left transition ${
                    active
                      ? "border-[#3a6c2c] bg-white"
                      : "border-[#cbe0c2] bg-white hover:border-[#3a6c2c]"
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      {active ? (
                        <Check size={14} className="text-[#3a6c2c]" />
                      ) : (
                        <Plus size={14} className="text-[#3a6c2c]" />
                      )}
                      {bundle.title}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-[#62685f]">
                      {bundle.reason}
                    </p>
                  </div>
                  <div className="text-sm font-semibold text-[#1d211c]">
                    +{formatMoney(bundle.estimatedLift)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="mt-5 rounded-md border border-[#e4e0d5] bg-[#fbfaf7] p-4">
        <div className="text-sm font-semibold">Preferred booking windows</div>
        <p className="mt-1 text-xs leading-5 text-[#62685f]">
          Pick up to three. Final date confirmed by text within 1 business day.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {preferredWindowOptions.map((window) => {
            const active = preferredDates.some(
              (item) => item.day === window.day && item.time === window.time,
            );
            return (
              <button
                key={`${window.day}-${window.time}`}
                type="button"
                aria-pressed={active}
                onClick={() => togglePreferredDate(window)}
                className={`min-h-12 rounded-md border px-3 py-2 text-left text-sm font-semibold transition ${
                  active
                    ? "border-[#1d211c] bg-[#1d211c] text-white"
                    : "border-[#cbc7bb] bg-white hover:border-[#1d211c]"
                }`}
              >
                <span className="block leading-5">{window.day}</span>
                {window.time !== "flexible" ? (
                  <span
                    className={`block text-xs font-medium ${
                      active ? "text-white/75" : "text-[#62685f]"
                    }`}
                  >
                    {window.time}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <label className="mt-4 block text-sm font-semibold">
          Anything we should know before booking?{" "}
          <span className="font-normal text-[#62685f]">(optional)</span>
          <textarea
            value={customerNote}
            onChange={(event) => setCustomerNote(event.target.value)}
            className="mt-2 min-h-20 w-full rounded-md border border-[#cbc7bb] bg-white px-3 py-2 text-sm outline-none ring-[#1d211c]/20 focus:ring-4"
            placeholder="Gate code, parking, fragile paint, scheduling constraint..."
          />
        </label>
      </div>

      {selectedDepositRequired ? (
        <div className="mt-4 rounded-md border border-[#f1d18a] bg-[#fff8e5] px-3 py-3 text-sm font-medium text-[#7a5400]">
          {`A ${formatMoney(selectedDepositAmount)} deposit is needed after approval to lock the route window. We'll open or send the secure deposit step next.`}
        </div>
      ) : null}

      <label className="mt-4 flex items-start gap-3 rounded-md border border-[#cbc7bb] bg-[#fbfaf7] p-3 text-sm">
        <input
          type="checkbox"
          checked={scopeAccepted}
          onChange={(event) => setScopeAccepted(event.target.checked)}
          className="mt-1 h-4 w-4 rounded border-[#cbc7bb] text-[#1d211c]"
        />
        <span className="leading-6 text-[#1d211c]">
          I&apos;ve reviewed what&apos;s included and not included above and
          accept the {selectedPackage?.name ?? "package"} scope at{" "}
          <span className="font-semibold">{formatMoney(selectedTotal)}</span>
          {acceptedUpsells.size > 0
            ? ` (includes ${acceptedUpsells.size} same-trip add-on${acceptedUpsells.size === 1 ? "" : "s"})`
            : ""}
          . Final scheduling and any survey-required scope is confirmed by{" "}
          {"Dante"} before crew dispatch.
        </span>
      </label>

      {message ? (
        <p
          className={`mt-4 rounded-md border px-3 py-2 text-sm font-medium ${
            status === "error"
              ? "border-[#f5c2c0] bg-[#fff5f5] text-[#b42318]"
              : "border-[#dedbd1] bg-[#fbfaf7]"
          }`}
        >
          {message}
        </p>
      ) : null}

      <button
        type="button"
        onClick={approve}
        disabled={
          status === "saving" ||
          status === "redirecting" ||
          !canApprove ||
          !scopeAccepted
        }
        className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#2f6a1f] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#3b8027] disabled:cursor-not-allowed disabled:bg-[#1d211c] disabled:opacity-50"
      >
        {status === "saving" || status === "redirecting" ? (
          <Loader2 size={16} className="animate-spin" />
        ) : null}
        {status === "redirecting"
          ? "Opening secure deposit page…"
          : `Approve ${selectedPackage?.name ?? "package"} · ${formatMoney(selectedTotal)}`}
      </button>
      {!canApprove ? (
        <p className="mt-3 text-sm text-[#62685f]">
          This quote is still being reviewed. Dante will send the final link
          when it is ready.
        </p>
      ) : !scopeAccepted ? (
        <p className="mt-3 text-sm text-[#62685f]">
          Check the scope box above to enable approval.
        </p>
      ) : null}
    </div>
  );
}
