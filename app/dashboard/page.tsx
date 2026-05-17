import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock,
  Copy,
  Lock,
  MapPin,
  MessageSquareText,
  Navigation,
  Phone,
  Repeat,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { DashboardLogin } from "@/components/dashboard-login";
import { followUpTasksForQuote, isTaskDue } from "@/lib/follow-ups";
import { cleanCity, cleanZip, formatAddressLine, formatDate, formatMoney } from "@/lib/format";
import { getAiUnlockState } from "@/lib/pricing";
import { preferredContactLabels, propertyTypeLabels } from "@/lib/pricing-config";
import { dashboardAuthEnabled, isDashboardAuthed } from "@/lib/server/auth";
import {
  getCompliance,
  getSourceRoi,
  getStorageHealth,
  isQuoteExpired,
  loadStore,
} from "@/lib/server/store";
import { getNotificationHealth } from "@/lib/server/notifications";
import type { Quote, SourceRoiRow } from "@/lib/types";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  if (!(await isDashboardAuthed())) {
    return <DashboardLogin error={params.error} />;
  }

  const store = await loadStore();
  const renderedAt = new Date();
  const renderedAtMs = renderedAt.getTime();
  const compliance7 = getCompliance(store, 7);
  const compliance14 = getCompliance(store, 14);
  const unlock = getAiUnlockState(store);
  const notificationHealth = getNotificationHealth();
  const storageHealth = getStorageHealth();
  const sourceRoi = getSourceRoi(store);
  const pending = store.quotes.filter((quote) =>
    quote.status === "pending" || quote.status === "contacted",
  );
  const approved = store.quotes.filter(
    (quote) =>
      quote.status === "approved" ||
      quote.status === "awaiting_deposit" ||
      quote.status === "scheduled",
  );
  const today = renderedAt.toISOString().slice(0, 10);
  const needsPhotos = pending.filter(
    (quote) => quote.photoAttachments.length === 0,
  );
  const readyToQuote = pending.filter(
    (quote) => quote.photoAttachments.length > 0,
  );
  const followUpDue = store.quotes.filter((quote) =>
    followUpTasksForQuote(quote).some((task) => isTaskDue(task, today)),
  );
  const expiringSoon = store.quotes.filter((quote) => {
    if (!quote.expiresAt) return false;
    if (
      quote.status !== "sent" &&
      quote.status !== "pending" &&
      quote.status !== "contacted"
    ) {
      return false;
    }
    const hoursLeft =
      (new Date(quote.expiresAt).getTime() - renderedAtMs) / 1000 / 60 / 60;
    return hoursLeft > 0 && hoursLeft <= 72;
  });
  const duplicateAlerts = store.quotes.filter(
    (quote) => quote.duplicateContext?.isDuplicate,
  );
  const won = store.outcomes.filter(
    (outcome) => outcome.outcome === "won" && outcome.amountExplicit,
  );
  const revenue = won.reduce((sum, outcome) => sum + (outcome.amount ?? 0), 0);
  const pipelineValue = store.quotes
    .filter((quote) =>
      ["pending", "sent", "approved", "awaiting_deposit"].includes(quote.status),
    )
    .reduce(
      (sum, quote) =>
        sum +
        (quote.finalQuoteAmount ?? quote.estimate.recommendedAsk ?? 0),
      0,
    );

  const untailoredServices = store.services.filter((service) => {
    const cost = store.costInputs.find((c) => c.serviceSlug === service.slug);
    return cost?.source === "industry_default";
  });
  const wonMissingActuals = store.outcomes.filter((outcome) => {
    if (outcome.outcome !== "won") return false;
    if (outcome.actuals && outcome.actuals.hours !== null) return false;
    return true;
  });

  return (
    <main className="min-h-screen bg-[#f7f6f2] px-4 py-6 text-[#1d211c] sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-[#62685f]">631 Solutions</p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Dante operations board
            </h1>
          </div>
          <div className="flex gap-3">
            {dashboardAuthEnabled() ? (
              <span className="inline-flex h-10 items-center gap-2 rounded-md border border-[#cbc7bb] bg-white px-3 text-sm font-semibold">
                <Lock size={15} />
                PIN protected
              </span>
            ) : null}
            <Link
              href="/dashboard/costs"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-[#cbc7bb] bg-white px-4 text-sm font-semibold transition hover:border-[#1d211c]"
            >
              <SlidersHorizontal size={15} />
              Costs
            </Link>
            <Link
              href="/quote"
              className="inline-flex h-10 items-center rounded-md bg-[#1d211c] px-4 text-sm font-semibold text-white transition hover:bg-[#30372e]"
            >
              New quote
            </Link>
          </div>
        </header>

        {storageHealth.mode !== "local_file" && !storageHealth.readyForProduction ? (
          <details className="group mb-5 rounded-lg border border-[#f1d18a] bg-[#fff8e5]">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#7a5400]">
                <AlertTriangle size={16} />
                {storageHealth.durable
                  ? "Local file storage active"
                  : "Vercel storage is temporary until Supabase is configured"}
              </div>
              <ChevronRight
                size={16}
                className="text-[#7a5400] transition-transform group-open:rotate-90"
              />
            </summary>
            <div className="border-t border-[#f1d18a] px-4 py-3">
              <p className="text-sm leading-6 text-[#62685f]">
                {storageHealth.ownerAction}
              </p>
              {storageHealth.missing.length > 0 ? (
                <p className="mt-2 text-xs font-semibold text-[#7a5400]">
                  {`Missing: ${storageHealth.missing.join(", ")}`}
                </p>
              ) : null}
            </div>
          </details>
        ) : null}

        {!notificationHealth.ready ? (
          <details className="group mb-5 rounded-lg border border-[#f5b3b0] bg-[#fff5f5]">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#b42318]">
                <BellRing size={16} />
                {`Notifications partially off — ${notificationHealth.missing.length} env var${notificationHealth.missing.length === 1 ? "" : "s"} needed`}
              </div>
              <ChevronRight
                size={16}
                className="text-[#b42318] transition-transform group-open:rotate-90"
              />
            </summary>
            <div className="border-t border-[#f5b3b0] px-4 py-3">
              <p className="text-sm leading-6 text-[#62685f]">
                {`Missing env vars: ${notificationHealth.missing.join(", ")}. New leads will land but customers and Dante will not be texted/emailed. Fix this before the next live lead — silent fallback writes to `}
                <code>.data/notification-log.jsonl</code>
                {` only.`}
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-[#62685f]">
                <span className={`rounded-md px-2 py-1 ${notificationHealth.smsReady ? "bg-[#e8f8dc] text-[#315b22]" : "bg-[#ffe8e6] text-[#9f2b22]"}`}>
                  {`Customer SMS ${notificationHealth.smsReady ? "ready" : "off"}`}
                </span>
                <span className={`rounded-md px-2 py-1 ${notificationHealth.emailReady ? "bg-[#e8f8dc] text-[#315b22]" : "bg-[#ffe8e6] text-[#9f2b22]"}`}>
                  {`Customer email ${notificationHealth.emailReady ? "ready" : "off"}`}
                </span>
                <span className={`rounded-md px-2 py-1 ${notificationHealth.ownerSmsReady ? "bg-[#e8f8dc] text-[#315b22]" : "bg-[#ffe8e6] text-[#9f2b22]"}`}>
                  {`Owner SMS ${notificationHealth.ownerSmsReady ? "ready" : "off"}`}
                </span>
                <span className={`rounded-md px-2 py-1 ${notificationHealth.ownerEmailReady ? "bg-[#e8f8dc] text-[#315b22]" : "bg-[#ffe8e6] text-[#9f2b22]"}`}>
                  {`Owner email ${notificationHealth.ownerEmailReady ? "ready" : "off"}`}
                </span>
              </div>
            </div>
          </details>
        ) : null}

        {duplicateAlerts.length > 0 ? (
          <div className="mb-5 flex items-start gap-3 rounded-lg border border-[#cbd7f4] bg-[#eef2fb] p-4">
            <div className="mt-0.5 text-[#2a47a5]">
              <Repeat size={18} />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-[#1d211c]">
                {duplicateAlerts.length} possible duplicate{duplicateAlerts.length === 1 ? "" : "s"} in the pipeline
              </div>
              <p className="mt-1 text-sm leading-6 text-[#62685f]">
                Same phone, email, or address as a recent quote — confirm with the
                customer before driving out twice. Look for the duplicate flag on
                pipeline rows.
              </p>
            </div>
          </div>
        ) : null}

        {expiringSoon.length > 0 ? (
          <div className="mb-5 flex items-start gap-3 rounded-lg border border-[#f1d18a] bg-[#fff8e5] p-4">
            <div className="mt-0.5 text-[#8a6100]">
              <Clock size={18} />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold">
                {expiringSoon.length} quote{expiringSoon.length === 1 ? "" : "s"} expire within 72 hours
              </div>
              <p className="mt-1 text-sm leading-6 text-[#62685f]">
                Send a closing touch before the price window lapses — peak-season
                pricing changes after expiry.
              </p>
            </div>
          </div>
        ) : null}

        {untailoredServices.length > 0 ? (
          <Link
            href="/dashboard/onboarding"
            className="mb-5 flex items-start gap-3 rounded-lg border border-[#f1d18a] bg-[#fff8e5] p-4 transition hover:border-[#caa54a]"
          >
            <div className="mt-0.5 text-[#8a6100]">
              <Sparkles size={18} />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold">
                Tailor the model to how you actually work
              </div>
              <p className="mt-1 text-sm leading-6 text-[#62685f]">
                {untailoredServices.length === 1
                  ? `${untailoredServices[0].name} is still using industry defaults.`
                  : `${untailoredServices.length} services are still using industry defaults.`}{" "}
                Five questions, plain language, no math. Until then quotes are
                safe but generic.
              </p>
            </div>
            <ArrowRight size={16} className="mt-1 text-[#62685f]" />
          </Link>
        ) : null}

        {wonMissingActuals.length > 0 ? (
          <div className="mb-5 flex items-start gap-3 rounded-lg border border-[#cbe0c2] bg-[#f4fbef] p-4">
            <div className="mt-0.5 text-[#3a6c2c]">
              <CheckCircle2 size={18} />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold">
                {wonMissingActuals.length} won{" "}
                {wonMissingActuals.length === 1 ? "job is" : "jobs are"} waiting
                on a quick log
              </div>
              <p className="mt-1 text-sm leading-6 text-[#62685f]">
                Open the quote and tap{" "}
                <span className="font-semibold">Log how the job went</span>.
                Takes 30 seconds and makes future quotes sharper.
              </p>
            </div>
          </div>
        ) : null}

        <section className="mb-5 rounded-lg border border-[#1d211c] bg-[#1d211c] p-5 text-white shadow-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-white/60">
                Right now
              </div>
              <div className="mt-2 text-2xl font-semibold leading-tight">
                {formatMoney(pipelineValue)} in open pipeline ·{" "}
                {followUpDue.length} follow-up{followUpDue.length === 1 ? "" : "s"} due ·{" "}
                {readyToQuote.length} ready to price
              </div>
              <div className="mt-1 text-sm text-white/70">
                {pending.length > 0
                  ? `Open ${readyToQuote[0]?.customerName ?? pending[0]?.customerName} first — it is the next dollar.`
                  : "Pipeline is clean. Time for outreach or follow-ups."}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={
                  readyToQuote[0]
                    ? `/dashboard/quotes/${readyToQuote[0].id}`
                    : pending[0]
                      ? `/dashboard/quotes/${pending[0].id}`
                      : "/dashboard"
                }
                className="inline-flex h-10 items-center gap-2 rounded-md bg-[#d8f269] px-4 text-sm font-semibold text-[#1d211c] transition hover:bg-white"
              >
                Work the next lead
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Metric
            icon={<CheckCircle2 size={18} />}
            label="Ready to quote"
            value={readyToQuote.length.toString()}
          />
          <Metric
            icon={<Camera size={18} />}
            label="Need photos"
            value={needsPhotos.length.toString()}
          />
          <Metric
            icon={<Clock size={18} />}
            label="Follow-up due"
            value={followUpDue.length.toString()}
          />
          <Metric
            icon={<Target size={18} />}
            label="Approved · booking"
            value={approved.length.toString()}
          />
          <Metric
            icon={<CircleDollarSign size={18} />}
            label="Won revenue"
            value={formatMoney(revenue)}
          />
          <Metric
            icon={<TrendingUp size={18} />}
            label="Open pipeline"
            value={formatMoney(pipelineValue)}
          />
        </section>

        <section className="mt-5 grid gap-4 lg:grid-cols-[1fr_340px]">
          <aside className="space-y-4 lg:col-start-2 lg:row-start-1">
            <div className="rounded-lg border border-[#d8d4c7] bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold tracking-tight">
                Chase today
              </h2>
              <div className="mt-4 space-y-3">
                <ChaseItem
                  href={
                    readyToQuote[0]
                      ? `/dashboard/quotes/${readyToQuote[0].id}`
                      : "/dashboard"
                  }
                  icon={<CheckCircle2 size={16} />}
                  label={`${readyToQuote.length} ready to price`}
                  detail="Photos are in. Review scope and send a package."
                />
                <ChaseItem
                  href={
                    needsPhotos[0]
                      ? `/dashboard/quotes/${needsPhotos[0].id}`
                      : "/dashboard"
                  }
                  icon={<Camera size={16} />}
                  label={`${needsPhotos.length} need photos`}
                  detail="Send complete-your-quote reminder before guessing."
                />
                <ChaseItem
                  href={
                    followUpDue[0]
                      ? `/dashboard/quotes/${followUpDue[0].id}`
                      : "/dashboard"
                  }
                  icon={<Clock size={16} />}
                  label={`${followUpDue.length} follow-ups due`}
                  detail="Same-day and 72-hour touches protect conversion."
                />
              </div>
            </div>
          </aside>

          <div className="rounded-lg border border-[#d8d4c7] bg-white shadow-sm lg:col-start-1 lg:row-start-1">
            <div className="border-b border-[#e7e3d8] px-5 py-4">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-lg font-semibold tracking-tight">
                  Booking pipeline
                </h2>
                <span className="text-sm font-medium text-[#62685f]">
                  {store.quotes.length} total leads
                </span>
              </div>
            </div>
            <div className="divide-y divide-[#ece8dd]">
              {store.quotes.length === 0 ? (
                <div className="px-5 py-10">
                  <div className="text-sm font-semibold">No quote requests yet.</div>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-[#62685f]">
                    Local development seeds demo leads by default. If this is a
                    clean production store, the first live form submission will
                    appear here with service, contact, range, photos, and next
                    action.
                  </p>
                </div>
              ) : (
                store.quotes.map((quote) => (
                  <PipelineRow
                    key={quote.id}
                    quote={quote}
                    renderedAtMs={renderedAtMs}
                  />
                ))
              )}
            </div>
          </div>
        </section>

        {sourceRoi.length > 0 ? (
          <section className="mt-6 rounded-lg border border-[#d8d4c7] bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-[#ece8dd] px-5 py-4">
              <h2 className="text-lg font-semibold tracking-tight">
                Lead source ROI
              </h2>
              <span className="text-xs font-medium uppercase tracking-wide text-[#62685f]">
                Where leads come from, what they close at, what they pay
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] table-fixed text-sm">
                <thead className="bg-[#fbfaf7] text-left text-xs uppercase tracking-wide text-[#62685f]">
                  <tr>
                    <th className="px-5 py-3">Source</th>
                    <th className="px-5 py-3">Leads</th>
                    <th className="px-5 py-3">Close rate</th>
                    <th className="px-5 py-3">Avg ticket</th>
                    <th className="px-5 py-3">Revenue</th>
                    <th className="px-5 py-3">Open pipeline</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ece8dd]">
                  {sourceRoi.slice(0, 8).map((row) => (
                    <SourceRoiRowComponent key={row.source} row={row} />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <details className="group mt-6 rounded-lg border border-[#d8d4c7] bg-white shadow-sm">
          <summary className="flex cursor-pointer items-center justify-between gap-2 px-5 py-4 text-sm font-semibold text-[#1d211c] [&::-webkit-details-marker]:hidden">
            <span>Operations health (data, calibration, decision log)</span>
            <ChevronRight
              size={16}
              className="text-[#62685f] transition-transform group-open:rotate-90"
            />
          </summary>
          <div className="grid gap-4 border-t border-[#ece8dd] p-5 md:grid-cols-3">
            <div>
              <h3 className="text-sm font-semibold">Data health</h3>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Compliance label="7 days" value={compliance7} />
                <Compliance label="14 days" value={compliance14} />
              </div>
              <p className="mt-3 text-xs leading-5 text-[#62685f]">
                Actual hours, crew size, material notes, and lost reasons make
                the pricing model harder to fool over time.
              </p>
            </div>
            <div>
              <div className="flex items-start gap-2">
                <div className="mt-0.5 text-[#8a6100]">
                  <AlertTriangle size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Calibration status</h3>
                  <p className="mt-2 text-xs leading-5 text-[#62685f]">
                    {unlock.reason}
                  </p>
                </div>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold">Living decisions</h3>
              <div className="mt-3 space-y-3">
                {store.decisionLog.slice(0, 5).map((entry) => (
                  <div key={entry.id}>
                    <div className="text-xs font-semibold">{entry.event}</div>
                    <div className="mt-1 text-xs leading-5 text-[#62685f]">
                      {entry.evidence}
                    </div>
                    <div className="mt-1 text-[10px] font-medium uppercase tracking-wide text-[#7a806f]">
                      Review {entry.nextReview} · {formatDate(entry.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </details>
      </div>
    </main>
  );
}

function telHref(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  const normalized = digits.length === 10 ? `1${digits}` : digits;
  return `tel:+${normalized}`;
}

function smsHref(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  const normalized = digits.length === 10 ? `1${digits}` : digits;
  return `sms:+${normalized}`;
}

function mapsHref(quote: Quote): string {
  const line = formatAddressLine(
    quote.addressStreet,
    quote.addressCity,
    quote.addressZip,
  );
  if (!line) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(line)}`;
}

function PipelineRow({
  quote,
  renderedAtMs,
}: {
  quote: Quote;
  renderedAtMs: number;
}) {
  const tel = telHref(quote.customerPhone);
  const sms = smsHref(quote.customerPhone);
  const maps = mapsHref(quote);
  const detailHref = `/dashboard/quotes/${quote.id}`;
  const market = quote.estimate.marketComparison;
  const address = quote.estimate.addressValidation;
  const expired = isQuoteExpired(quote, new Date(renderedAtMs));
  const expiresIn = quote.expiresAt
    ? Math.round(
        (new Date(quote.expiresAt).getTime() - renderedAtMs) /
          1000 /
          60 /
          60,
      )
    : null;
  const expiresWarning =
    quote.expiresAt &&
    quote.status === "sent" &&
    expiresIn !== null &&
    expiresIn > 0 &&
    expiresIn <= 72;
  const margin = quote.estimate.profitability.grossMarginPct;
  const marginTone =
    margin >= 55
      ? "bg-[#e8f8dc] text-[#315b22]"
      : margin >= 40
        ? "bg-[#fff5ce] text-[#7c5b00]"
        : "bg-[#ffe8e6] text-[#9f2b22]";
  return (
    <div className="grid gap-3 px-5 py-4 transition hover:bg-[#fbfaf7] lg:grid-cols-[1.2fr_1fr_1fr_140px_auto]">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={detailHref}
            className="font-semibold text-[#1d211c] underline-offset-2 hover:underline"
          >
            {quote.customerName}
          </Link>
          <LeadBadge quality={quote.estimate.leadQuality} score={quote.estimate.leadScore} />
          {quote.duplicateContext?.isDuplicate ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-[#eef2fb] px-2 py-1 text-[11px] font-semibold text-[#2a47a5]">
              <Copy size={11} />
              Duplicate
            </span>
          ) : quote.duplicateContext?.isRepeat ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-[#dff0ce] px-2 py-1 text-[11px] font-semibold text-[#315b22]">
              <Repeat size={11} />
              Repeat
            </span>
          ) : null}
          {expired ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-[#ffe8e6] px-2 py-1 text-[11px] font-semibold text-[#9f2b22]">
              Expired
            </span>
          ) : expiresWarning ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-[#fff5ce] px-2 py-1 text-[11px] font-semibold text-[#7c5b00]">
              Expires in {expiresIn}h
            </span>
          ) : null}
          {address?.confidence === "out_of_area" ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-[#ffe8e6] px-2 py-1 text-[11px] font-semibold text-[#9f2b22]">
              <ShieldAlert size={11} />
              Out of area
            </span>
          ) : null}
        </div>
        <div className="mt-1 text-sm text-[#62685f]">
          {serviceBundleLabel(quote)}
        </div>
        <div className="mt-1 text-xs font-medium text-[#7a806f]">
          {propertyTypeLabels[quote.propertyType] ?? quote.propertyType} · Prefers{" "}
          {preferredContactLabels[quote.preferredContactMethod] ??
            quote.preferredContactMethod}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <TinyMeta icon={<Camera size={13} />}>
            {quote.photoAttachments.length} photos
          </TinyMeta>
          <TinyMeta icon={<Target size={13} />}>
            {quote.estimate.closeProbability}% close
          </TinyMeta>
          <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ${marginTone}`}>
            {margin}% margin
          </span>
          <span className="inline-flex items-center gap-1 rounded-md bg-[#eef0ea] px-2 py-1 text-xs font-mono font-semibold text-[#545b4f]">
            #{quote.id.slice(0, 6)}
          </span>
        </div>
      </div>
      <div className="text-sm text-[#62685f]">
        <div className="flex items-center gap-1.5">
          <MapPin size={14} />
          {`${cleanCity(quote.addressCity)}, ${cleanZip(quote.addressZip)}`}
        </div>
        <div className="mt-1">{quote.estimate.routeZone}</div>
        <div>{quote.source}</div>
      </div>
      <div className="text-sm">
        <div className="flex items-center gap-1.5 text-[#62685f]">
          <CalendarDays size={14} />
          {quote.estimate.earliestAvailability}
        </div>
        <div className="mt-1 font-semibold">{quote.estimate.crewBlock}</div>
        <div className="text-[#62685f]">
          Follow-up{" "}
          {formatDate(
            followUpTasksForQuote(quote)[0]?.dueDate ??
              quote.estimate.nextFollowUpDate,
          )}
        </div>
      </div>
      <div className="text-sm lg:text-right">
        <div className="font-semibold">
          {formatMoney(quote.estimate.recommendedAsk)}
        </div>
        <div className="text-[#62685f]">
          {formatMoney(quote.estimate.rangeLow)}-
          {formatMoney(quote.estimate.rangeHigh)}
        </div>
        <MarketDeltaBadge market={market} />
        <div className="mt-2 flex lg:justify-end">
          <StatusBadge status={quote.status} />
        </div>
      </div>
      <div className="flex items-center gap-1 lg:flex-col lg:gap-2">
        {tel ? (
          <a
            href={tel}
            aria-label={`Call ${quote.customerName}`}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[#cbc7bb] bg-white text-[#1d211c] transition hover:border-[#1d211c]"
          >
            <Phone size={16} />
          </a>
        ) : null}
        {sms ? (
          <a
            href={sms}
            aria-label={`Text ${quote.customerName}`}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[#cbc7bb] bg-white text-[#1d211c] transition hover:border-[#1d211c]"
          >
            <MessageSquareText size={16} />
          </a>
        ) : null}
        {maps ? (
          <a
            href={maps}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${quote.addressStreet} in maps`}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[#cbc7bb] bg-white text-[#1d211c] transition hover:border-[#1d211c]"
          >
            <Navigation size={16} />
          </a>
        ) : null}
        <Link
          href={detailHref}
          aria-label={`Open ${quote.customerName} quote`}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-[#1d211c] text-white transition hover:bg-[#30372e]"
        >
          <ChevronRight size={16} />
        </Link>
      </div>
    </div>
  );
}

function MarketDeltaBadge({
  market,
}: {
  market: Quote["estimate"]["marketComparison"];
}) {
  if (!market || market.position === "unknown" || market.median === null) return null;
  const sign = market.delta > 0 ? "+" : market.delta < 0 ? "" : "";
  const labelTone =
    market.position === "below"
      ? "text-[#9f2b22]"
      : market.position === "at"
        ? "text-[#62685f]"
        : market.position === "above"
          ? "text-[#315b22]"
          : "text-[#7c5b00]";
  const Icon = market.delta < 0 ? TrendingDown : TrendingUp;
  return (
    <div
      className={`mt-1 flex items-center gap-1 text-xs font-semibold lg:justify-end ${labelTone}`}
      title={market.ownerNote}
    >
      <Icon size={12} />
      {sign}
      {formatMoney(Math.abs(market.delta))} vs market
    </div>
  );
}

function serviceBundleLabel(quote: Quote) {
  const names = quote.estimate.serviceBreakdowns.map((line) => line.serviceName);
  if (names.length === 0) return `${quote.serviceSlug} · ${quote.jobSizeLabel}`;
  if (names.length <= 2) return names.join(" + ");
  return `${names.slice(0, 2).join(" + ")} + ${names.length - 2} more`;
}

function LeadBadge({ quality, score }: { quality: string; score?: number }) {
  const tone =
    quality === "good"
      ? "bg-[#e8f8dc] text-[#315b22]"
      : quality === "bad"
        ? "bg-[#ffe8e6] text-[#9f2b22]"
        : "bg-[#fff5ce] text-[#7c5b00]";
  const icon =
    quality === "good" ? (
      <CheckCircle2 size={11} aria-hidden />
    ) : quality === "bad" ? (
      <AlertTriangle size={11} aria-hidden />
    ) : (
      <Clock size={11} aria-hidden />
    );
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ${tone}`}
    >
      {icon}
      {quality} lead{typeof score === "number" ? ` · ${score}` : ""}
    </span>
  );
}

function TinyMeta({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-[#eef0ea] px-2 py-1 text-xs font-semibold text-[#545b4f]">
      {icon}
      {children}
    </span>
  );
}

function ChaseItem({
  href,
  icon,
  label,
  detail,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-md border border-[#e4e0d5] bg-[#fbfaf7] p-3 transition hover:border-[#1d211c]"
    >
      <div className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-sm leading-5 text-[#62685f]">{detail}</div>
    </Link>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-[#d8d4c7] bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-[#62685f]">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "won"
      ? "bg-[#e8f8dc] text-[#315b22]"
      : status === "contacted"
        ? "bg-[#eef2fb] text-[#2a47a5]"
      : status === "approved" || status === "scheduled"
        ? "bg-[#dff0ce] text-[#315b22]"
        : status === "awaiting_deposit"
          ? "bg-[#fff1ce] text-[#7c5b00]"
          : status === "sent"
            ? "bg-[#fff5ce] text-[#7c5b00]"
            : status === "lost"
              ? "bg-[#ffe8e6] text-[#9f2b22]"
              : "bg-[#eef0ea] text-[#545b4f]";
  return (
    <span className={`rounded-md px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}

function SourceRoiRowComponent({ row }: { row: SourceRoiRow }) {
  const closeTone =
    row.closeRatePct >= 50
      ? "text-[#315b22]"
      : row.closeRatePct >= 25
        ? "text-[#7c5b00]"
        : row.closeRatePct > 0
          ? "text-[#9f2b22]"
          : "text-[#62685f]";
  return (
    <tr>
      <td className="px-5 py-3 font-semibold">{row.source}</td>
      <td className="px-5 py-3 text-[#62685f]">
        {row.quoteCount}{" "}
        <span className="text-xs">
          ({row.wonCount} won · {row.lostCount} lost)
        </span>
      </td>
      <td className={`px-5 py-3 font-semibold ${closeTone}`}>{row.closeRatePct}%</td>
      <td className="px-5 py-3 text-[#62685f]">
        {row.averageTicket > 0 ? formatMoney(row.averageTicket) : "—"}
      </td>
      <td className="px-5 py-3 font-semibold">{formatMoney(row.totalRevenue)}</td>
      <td className="px-5 py-3 text-[#62685f]">{formatMoney(row.pipelineValue)}</td>
    </tr>
  );
}

function Compliance({
  label,
  value,
}: {
  label: string;
  value: { percent: number; logged: number; total: number };
}) {
  const risky = value.percent < 80 && value.total > 0;
  return (
    <div
      className={`rounded-md border p-3 ${
        risky ? "border-[#f2b8b5] bg-[#fff5f5]" : "border-[#e2dfd4] bg-[#fbfaf7]"
      }`}
    >
      <div className="text-xs font-semibold text-[#62685f]">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value.percent}%</div>
      <div className="mt-1 text-xs text-[#62685f]">
        {value.logged}/{value.total} logged
      </div>
    </div>
  );
}
