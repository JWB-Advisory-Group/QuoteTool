/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  DollarSign,
  ExternalLink,
  FileText,
  MapPin,
  MessageSquareText,
  Navigation,
  Phone,
  ShieldCheck,
  Users,
} from "lucide-react";
import { DashboardLogin } from "@/components/dashboard-login";
import { followUpTasksForQuote, isTaskDue } from "@/lib/follow-ups";
import { buildJobBrief, type JobBrief } from "@/lib/job-brief";
import { formatAddressLine, formatDate, formatMoney } from "@/lib/format";
import { buildOwnerMessageTemplates } from "@/lib/message-templates";
import { getMarketRows } from "@/lib/pricing";
import { preferredContactLabels, propertyTypeLabels } from "@/lib/pricing-config";
import { isDashboardAuthed } from "@/lib/server/auth";
import { getQuote } from "@/lib/server/store";
import { QuoteActions } from "@/app/dashboard/quotes/[id]/quote-actions";
import { ActualsBackfill } from "@/app/dashboard/quotes/[id]/actuals-backfill";
import { RequestPhotosButton } from "@/app/dashboard/quotes/[id]/request-photos-button";
import { MarkDepositButton } from "@/app/dashboard/quotes/[id]/mark-deposit-button";
import { FollowUpButton } from "@/app/dashboard/quotes/[id]/follow-up-button";
import { MessageTemplatesPanel } from "@/app/dashboard/quotes/[id]/message-templates-panel";
import { StatusControl } from "@/app/dashboard/quotes/[id]/status-control";

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isDashboardAuthed())) {
    return <DashboardLogin />;
  }

  const { id } = await params;
  const { store, quote } = await getQuote(id);
  if (!quote) notFound();

  const service = store.services.find((item) => item.slug === quote.serviceSlug);
  const outcomes = store.outcomes.filter((outcome) => outcome.quoteId === quote.id);
  const marketRows = getMarketRows(
    store.competitorPrices,
    quote.serviceSlug,
    quote.addressZip,
  ).slice(0, 5);
  const floorAboveMarket =
    quote.estimate.marketAnchor !== null &&
    quote.estimate.floorBandHigh > quote.estimate.marketAnchor;
  const followUpTasks = followUpTasksForQuote(quote);
  const messageTemplates = buildOwnerMessageTemplates(quote);
  const jobBrief = buildJobBrief(quote);

  return (
    <main className="min-h-screen bg-[#f7f6f2] px-4 py-6 text-[#1d211c] sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-5xl">
        <nav
          aria-label="Breadcrumb"
          className="mb-6 flex items-center gap-2 text-sm text-[#62685f]"
        >
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 font-semibold transition hover:text-[#1d211c]"
          >
            <ArrowLeft size={14} />
            All leads
          </Link>
          <span aria-hidden="true">/</span>
          <span className="font-semibold text-[#1d211c]">{quote.customerName}</span>
        </nav>

        <div className="mb-5 lg:hidden">
          <JobBriefPanel brief={jobBrief} />
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <section className="space-y-5">
            <div className="rounded-lg border border-[#d8d4c7] bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-[#62685f]">
                    {service?.name ?? quote.serviceSlug}
                  </p>
                  <h1 className="mt-1 text-3xl font-semibold tracking-tight">
                    {quote.customerName}
                  </h1>
                  <p className="mt-2 text-sm leading-6 text-[#62685f]">
                    {formatAddressLine(
                      quote.addressStreet,
                      quote.addressCity,
                      quote.addressZip,
                    )}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <LeadBadge quality={quote.estimate.leadQuality} />
                    <span className="rounded-md bg-[#eef0ea] px-2.5 py-1 text-xs font-semibold text-[#545b4f]">
                      {quote.photoAttachments.length} photos
                    </span>
                    <span className="rounded-md bg-[#eef0ea] px-2.5 py-1 text-xs font-semibold text-[#545b4f]">
                      {quote.estimate.closeProbability}% close probability
                    </span>
                  </div>
                </div>
                <span className="rounded-md bg-[#eef0ea] px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-[#545b4f]">
                  {quote.status.replaceAll("_", " ")}
                </span>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <NumberBlock
                  label="Recommended ask"
                  value={formatMoney(quote.estimate.recommendedAsk)}
                />
                <NumberBlock
                  label="Protected floor"
                  value={formatMoney(quote.estimate.floorBandHigh)}
                />
                <NumberBlock
                  label="Customer range"
                  value={`${formatMoney(quote.estimate.rangeLow)}-${formatMoney(
                    quote.estimate.rangeHigh,
                  )}`}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-[#d8d4c7] bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold tracking-tight">
                  Operating read
                </h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <IconDetail
                    icon={<MapPin size={16} />}
                    label="Route"
                    value={`${quote.estimate.routeZone} · ${quote.estimate.estimatedDriveMinutes} min`}
                  />
                  <IconDetail
                    icon={<Users size={16} />}
                    label="Crew block"
                    value={quote.estimate.crewBlock}
                  />
                  <IconDetail
                    icon={<CalendarDays size={16} />}
                    label="Earliest"
                    value={quote.estimate.earliestAvailability}
                  />
                  <IconDetail
                    icon={<DollarSign size={16} />}
                    label="Deposit"
                    value={
                      quote.approval
                        ? quote.approval.depositRequired
                          ? `${formatMoney(quote.approval.depositAmount)} ${
                              quote.approval.depositPaid ? "paid" : "pending"
                            }`
                          : "Not required"
                        : quote.estimate.depositRequired
                          ? formatMoney(quote.estimate.depositAmount)
                        : "Not required"
                    }
                  />
                </div>
              </div>

              <div className="rounded-lg border border-[#d8d4c7] bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold tracking-tight">
                  Service bundle
                </h2>
                <div className="mt-4 space-y-3">
                  {quote.estimate.serviceBreakdowns.map((line) => (
                    <div
                      key={line.serviceSlug}
                      className="rounded-md border border-[#e4e0d5] bg-[#fbfaf7] p-3 text-sm"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold">{line.serviceName}</span>
                        <span className="text-[#62685f]">
                          {line.jobSizeLabel} · {line.jobSize}
                        </span>
                      </div>
                      <div className="mt-2 grid gap-2 text-[#62685f] sm:grid-cols-3">
                        <span>{line.laborHours} labor hr</span>
                        <span>{formatMoney(line.materials)} materials</span>
                        <span>{line.riskMultiplier}x risk</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-[#d8d4c7] bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold tracking-tight">Pricing basis</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Detail label="Job size" value={`${quote.jobSizeLabel} · ${quote.jobSize}`} />
                <Detail
                  label="Property"
                  value={propertyTypeLabels[quote.propertyType] ?? quote.propertyType}
                />
                <Detail label="Stories" value={`${quote.stories}`} />
                <Detail label="Urgency" value={quote.urgency.replace("_", " ")} />
                <Detail label="Source" value={quote.source} />
                <Detail
                  label="Preferred contact"
                  value={
                    preferredContactLabels[quote.preferredContactMethod] ??
                    quote.preferredContactMethod
                  }
                />
                <Detail
                  label="Market median"
                  value={formatMoney(quote.estimate.marketMedian)}
                />
                <Detail
                  label="Market-adjusted anchor"
                  value={formatMoney(quote.estimate.marketAnchor)}
                />
                <Detail
                  label="Follow-up date"
                  value={formatDate(quote.outcomeCheckDate)}
                />
                <Detail
                  label="Follow-up stage"
                  value={quote.estimate.followUpStage}
                />
                <Detail
                  label="Lead score"
                  value={`${quote.estimate.leadScore}/100`}
                />
                <Detail
                  label="Price confidence"
                  value={quote.estimate.estimateConfidence}
                />
                <Detail
                  label="Risk multiplier"
                  value={`${quote.estimate.riskMultiplier}x`}
                />
                <Detail
                  label="Gross profit"
                  value={`${formatMoney(
                    quote.estimate.profitability.grossProfit,
                  )} · ${quote.estimate.profitability.grossMarginPct}%`}
                />
                <Detail
                  label="Above floor"
                  value={formatMoney(quote.estimate.profitability.floorDelta)}
                />
              </div>

              <div
                className={`mt-5 rounded-md border p-4 ${
                  floorAboveMarket
                    ? "border-[#f1d18a] bg-[#fff8e5]"
                    : "border-[#d7e8c7] bg-[#f4fbef]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    <AlertTriangle size={17} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">
                      {floorAboveMarket
                        ? "Valid but floor-driven"
                        : "Valid and market-aligned"}
                    </div>
                    <p className="mt-1 text-sm leading-6 text-[#62685f]">
                      {floorAboveMarket
                        ? `The protected floor is ${formatMoney(
                            quote.estimate.floorBandHigh,
                          )}, which is above the current market-adjusted anchor of ${formatMoney(
                            quote.estimate.marketAnchor,
                          )}. Send it only if the labor, drive/setup, material, overhead, and margin assumptions feel true for this job.`
                        : `The recommended ask is supported by both the protected floor and the current market-adjusted anchor of ${formatMoney(
                            quote.estimate.marketAnchor,
                          )}.`}
                    </p>
                    <Link
                      href="/dashboard/costs"
                      className="mt-3 inline-flex text-sm font-semibold underline underline-offset-4"
                    >
                      Tune cost assumptions
                    </Link>
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-md border border-[#e4e0d5] bg-[#fbfaf7] p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <ShieldCheck size={16} />
                  Floor line items
                </div>
                <div className="space-y-2">
                  {quote.estimate.lineItems.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-[#62685f]">{item.label}</span>
                      <span className="font-semibold">{formatMoney(item.value)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 rounded-md border border-[#e4e0d5] bg-white p-4">
                <div className="mb-3 text-sm font-semibold">
                  Assumption snapshot
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Detail
                    label="Estimated labor hours"
                    value={`${quote.estimate.laborHours}`}
                  />
                  <Detail
                    label="Service lines"
                    value={`${quote.estimate.serviceBreakdowns.length}`}
                  />
                  <Detail
                    label="Story multiplier"
                    value={`${quote.estimate.storyMultiplier}x`}
                  />
                  <Detail
                    label="Drive/setup reserve"
                    value={`${quote.estimate.driveReserveMinutes} min`}
                  />
                  <Detail
                    label="Safety buffer"
                    value={quote.estimate.bufferActive ? "15% active" : "off"}
                  />
                  <Detail
                    label="Cost subtotal"
                    value={formatMoney(quote.estimate.costSubtotal)}
                  />
                  <Detail
                    label="Estimated gross margin"
                    value={`${quote.estimate.profitability.grossMarginPct}%`}
                  />
                  <Detail
                    label="Measurement confidence"
                    value={quote.estimate.intakeRequirements.measurementConfidence}
                  />
                </div>
              </div>

              {quote.estimate.pricingNotes.length > 0 ? (
                <div className="mt-5 rounded-md border border-[#e4e0d5] bg-white p-4">
                  <div className="mb-3 text-sm font-semibold">Pricing notes</div>
                  <div className="space-y-2">
                    {quote.estimate.pricingNotes.map((note) => (
                      <p key={note} className="text-sm leading-6 text-[#62685f]">
                        {note}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-5 rounded-md border border-[#e4e0d5] bg-white p-4">
                <div className="mb-3 text-sm font-semibold">
                  Intake requirements
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <ScopeList
                    title="Photo checklist"
                    items={quote.estimate.intakeRequirements.requiredPhotos}
                  />
                  <ScopeList
                    title="Missing or risky details"
                    items={
                      quote.estimate.intakeRequirements.missingDetails.length > 0
                        ? quote.estimate.intakeRequirements.missingDetails
                        : ["No missing detail flags."]
                    }
                  />
                </div>
                <p className="mt-4 rounded-md bg-[#fbfaf7] px-3 py-2 text-sm font-semibold text-[#62685f]">
                  {quote.estimate.intakeRequirements.ownerAction}
                </p>
              </div>

              {quote.sendReview ? (
                <div className="mt-5 rounded-md border border-[#f1d18a] bg-[#fff8e5] p-4">
                  <div className="text-sm font-semibold">Send review record</div>
                  <p className="mt-2 text-sm leading-6 text-[#62685f]">
                    {quote.sendReview.overrideReason}
                  </p>
                  <div className="mt-3 space-y-1">
                    {quote.sendReview.reasons.map((reason) => (
                      <div key={reason} className="text-xs leading-5 text-[#7a5400]">
                        {reason}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-5 rounded-md border border-[#e4e0d5] bg-white p-4">
                <div className="mb-3 text-sm font-semibold">Market context</div>
                <div className="space-y-2">
                  {marketRows.map((row) => (
                    <div
                      key={row.id}
                      className="grid gap-2 border-b border-[#ece8dd] pb-2 text-sm last:border-b-0 sm:grid-cols-[1fr_100px_90px]"
                    >
                      <div>
                        <div className="font-medium">{row.competitorName}</div>
                        <div className="text-[#62685f]">{row.zipOrRegion}</div>
                      </div>
                      <div className="text-[#62685f]">{row.unit}</div>
                      <div className="font-semibold">
                        {formatMoney(row.priceMedian)}
                      </div>
                    </div>
                  ))}
                  {marketRows.length === 0 ? (
                    <p className="text-sm text-[#62685f]">
                      No local market rows are available yet for this service.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-[#d8d4c7] bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold tracking-tight">
                Customer package options
              </h2>
              <div className="mt-4 grid gap-3">
                {quote.estimate.packageOptions.map((option) => (
                  <div
                    key={option.id}
                    className="rounded-md border border-[#e4e0d5] bg-[#fbfaf7] p-4"
                  >
                    <div className="text-sm font-semibold">{option.name}</div>
                    {option.badge ? (
                      <div className="mt-1 inline-flex rounded-md bg-[#d8f269] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#1d211c]">
                        {option.badge}
                      </div>
                    ) : null}
                    <div className="mt-1 text-2xl font-semibold tracking-tight">
                      {formatMoney(option.price)}
                    </div>
                    {option.bundleSavings > 0 ? (
                      <div className="mt-1 text-xs font-semibold text-[#547a25]">
                        Same-visit value: {formatMoney(option.bundleSavings)}
                      </div>
                    ) : null}
                    <p className="mt-2 text-xs leading-5 text-[#62685f]">
                      {option.description}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-[#62685f]">
                      {option.ownerNote}
                    </p>
                    <div className="mt-3 space-y-1">
                      {option.includedServices.slice(0, 4).map((item) => (
                        <div key={item} className="text-xs text-[#62685f]">
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {quote.estimate.bundleRecommendations.length > 0 ? (
              <div className="rounded-lg border border-[#d8d4c7] bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold tracking-tight">
                  Money opportunities
                </h2>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {quote.estimate.bundleRecommendations.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-md border border-[#e4e0d5] bg-[#fbfaf7] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">
                            {item.title}
                          </div>
                          <p className="mt-1 text-xs leading-5 text-[#62685f]">
                            {item.reason}
                          </p>
                        </div>
                        <div className="text-sm font-semibold">
                          +{formatMoney(item.estimatedLift)}
                        </div>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-[#62685f]">
                        {item.ownerNote}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="rounded-lg border border-[#d8d4c7] bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold tracking-tight">
                Scope protection
              </h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <ScopeList
                  title="Included"
                  items={quote.estimate.scopeInclusions}
                />
                <ScopeList
                  title="Excluded unless added"
                  items={quote.estimate.scopeExclusions}
                />
              </div>
              {quote.estimate.manualReviewReasons.length > 0 ? (
                <div className="mt-4 rounded-md border border-[#f1d18a] bg-[#fff8e5] p-4">
                  <div className="text-sm font-semibold">Manual review flags</div>
                  <div className="mt-2 space-y-1">
                    {quote.estimate.manualReviewReasons.map((reason) => (
                      <div key={reason} className="text-sm leading-6 text-[#62685f]">
                        {reason}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="rounded-lg border border-[#d8d4c7] bg-white p-5 shadow-sm">
              <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                <Camera size={18} />
                Photos
              </h2>
              {quote.photoAttachments.length > 0 ? (
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {quote.photoAttachments.map((photo) => (
                    <div
                      key={photo.id}
                      className="aspect-square overflow-hidden rounded-md border border-[#d8d4c7] bg-[#fbfaf7]"
                    >
                      <img
                        src={photo.dataUrl}
                        alt={photo.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  <p className="text-sm leading-6 text-[#62685f]">
                    No photos yet. Send a one-tap reminder before pricing — keeps
                    this lead in needs-photos until access, surfaces, and problem
                    areas are visible.
                  </p>
                  <RequestPhotosButton quoteId={quote.id} />
                  {quote.photosRequestedAt ? (
                    <p className="text-xs font-medium text-[#7a806f]">
                      Last photo request: {formatDate(quote.photosRequestedAt)}
                    </p>
                  ) : null}
                </div>
              )}
            </div>

            {quote.approval ? (
              <div className="rounded-lg border border-[#cbe0c2] bg-[#f4fbef] p-5 shadow-sm">
                <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-[#1d211c]">
                  <CheckCircle2 size={18} className="text-[#315b22]" />
                  Customer approved
                </h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Detail
                    label="Selected package"
                    value={quote.approval.selectedPackageId}
                  />
                  <Detail
                    label="Approved price"
                    value={formatMoney(quote.approval.selectedPrice)}
                  />
                  <Detail
                    label="Approved at"
                    value={formatDate(quote.approval.approvedAt)}
                  />
                  <Detail
                    label="Deposit"
                    value={
                      quote.approval.depositRequired
                        ? `${formatMoney(quote.approval.depositAmount)} ${
                            quote.approval.depositPaid ? "paid" : "pending"
                          }`
                        : "Not required"
                    }
                  />
                </div>
                {quote.approval.depositRequired && !quote.approval.depositPaid ? (
                  <div className="mt-4">
                    <MarkDepositButton quoteId={quote.id} />
                  </div>
                ) : null}
                {quote.approval.preferredDates.length > 0 ? (
                  <div className="mt-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-[#7a806f]">
                      Preferred windows
                    </div>
                    <div className="mt-1 text-sm leading-6">
                      {quote.approval.preferredDates
                        .map((d) => `${d.day} (${d.time})`)
                        .join(" · ")}
                    </div>
                  </div>
                ) : null}
                {quote.approval.customerNote ? (
                  <p className="mt-3 text-sm leading-6 text-[#3a6c2c]">
                    {quote.approval.customerNote}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="rounded-lg border border-[#d8d4c7] bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold tracking-tight">Customer notes</h2>
              <p className="mt-3 min-h-12 text-sm leading-6 text-[#62685f]">
                {quote.notes || "No notes entered."}
              </p>
              <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                <Detail label="Email" value={quote.customerEmail} />
                <Detail label="Phone" value={quote.customerPhone || "Not provided"} />
                <Detail
                  label="Preferred contact"
                  value={
                    preferredContactLabels[quote.preferredContactMethod] ??
                    quote.preferredContactMethod
                  }
                />
                <Detail
                  label="Property"
                  value={propertyTypeLabels[quote.propertyType] ?? quote.propertyType}
                />
              </div>
            </div>
          </section>

          <aside className="space-y-5">
            <div className="hidden lg:block">
              <JobBriefPanel brief={jobBrief} />
            </div>
            <StatusControl
              key={quote.status}
              quoteId={quote.id}
              status={quote.status}
            />
            <MessageTemplatesPanel templates={messageTemplates} />
            <QuoteActions quote={quote} />

            <div className="rounded-lg border border-[#d8d4c7] bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold tracking-tight">
                Follow-up plan
              </h2>
              <div className="mt-4 space-y-3">
                {followUpTasks.length > 0 ? (
                  followUpTasks.map((task) => (
                    <div
                      key={task.id}
                      className={`rounded-md border p-3 ${
                        isTaskDue(task)
                          ? "border-[#f1d18a] bg-[#fff8e5]"
                          : "border-[#e4e0d5] bg-[#fbfaf7]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">
                            {task.label}
                          </div>
                          <div className="mt-1 text-xs font-medium uppercase tracking-wide text-[#7a806f]">
                            {task.channel} · due {formatDate(task.dueDate)}
                          </div>
                        </div>
                        <FollowUpButton quoteId={quote.id} task={task} />
                      </div>
                      <p className="mt-2 text-sm leading-6 text-[#62685f]">
                        {task.ownerNote}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[#62685f]">
                    No follow-up task is open for this status.
                  </p>
                )}
              </div>
              {quote.followUps.length > 0 ? (
                <div className="mt-4 border-t border-[#ece8dd] pt-4">
                  <div className="text-sm font-semibold">History</div>
                  <div className="mt-2 space-y-2">
                    {quote.followUps.map((item) => (
                      <div key={item.id} className="text-xs leading-5 text-[#62685f]">
                        {item.label} · {item.channel} · {formatDate(item.sentAt)}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="rounded-lg border border-[#d8d4c7] bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold tracking-tight">Outcomes</h2>
              <div className="mt-4 space-y-3">
                {outcomes.length === 0 ? (
                  <div className="rounded-md border border-dashed border-[#dedbd1] bg-[#fbfaf7] p-4">
                    <p className="text-sm text-[#62685f]">
                      No outcome logged for this quote yet. Log how the job went
                      to sharpen the next quote.
                    </p>
                    <a
                      href="#log-outcome"
                      className="mt-3 inline-flex h-9 items-center gap-2 rounded-md bg-[#1d211c] px-3 text-xs font-semibold text-white transition hover:bg-[#30372e]"
                    >
                      <CheckCircle2 size={13} />
                      Log outcome
                    </a>
                  </div>
                ) : (
                  outcomes.map((outcome) => {
                    const hasActuals =
                      outcome.actuals !== null &&
                      outcome.actuals.hours !== null;
                    const showBackfill =
                      outcome.outcome === "won" && !hasActuals;
                    return (
                      <div
                        key={outcome.id}
                        className="rounded-md border border-[#e4e0d5] bg-[#fbfaf7] p-3"
                      >
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <CheckCircle2 size={15} />
                          {outcome.outcome.replace("_", " ")}
                        </div>
                        <div className="mt-1 text-sm text-[#62685f]">
                          {formatMoney(outcome.amount)} · {outcome.source} ·{" "}
                          {formatDate(outcome.createdAt)}
                        </div>
                        {hasActuals && outcome.actuals ? (
                          <div className="mt-2 space-y-1 text-sm text-[#62685f]">
                            <div>
                              On site {outcome.actuals.hours} hr ·{" "}
                              {outcome.actuals.crewCount ?? "?"} tech
                              {outcome.actuals.crewCount === 1 ? "" : "s"} ·{" "}
                              {outcome.actuals.materialUsage ?? "material n/a"}
                            </div>
                            {outcome.actuals.addedRevenue ? (
                              <div>
                                Add-ons logged:{" "}
                                {formatMoney(outcome.actuals.addedRevenue)}
                              </div>
                            ) : null}
                            {outcome.actuals.reasonCodes.length > 0 ? (
                              <div>
                                Reasons:{" "}
                                {outcome.actuals.reasonCodes
                                  .map((tag) => tag.replaceAll("_", " "))
                                  .join(", ")}
                              </div>
                            ) : null}
                            {outcome.actuals.materialNotes ? (
                              <div>{outcome.actuals.materialNotes}</div>
                            ) : null}
                          </div>
                        ) : null}
                        {showBackfill ? (
                          <div className="mt-3">
                            <ActualsBackfill
                              outcomeId={outcome.id}
                              estimatedHours={quote.estimate.laborHours}
                            />
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function JobBriefPanel({ brief }: { brief: JobBrief }) {
  const tone = briefTone(brief.tone);
  return (
    <div className={`rounded-lg border p-5 shadow-sm ${tone.card}`}>
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${tone.iconBox}`}
        >
          <ClipboardCheck size={18} />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Job brief</h2>
          <p className="mt-1 text-sm font-semibold">{brief.headline}</p>
          <p className="mt-1 text-sm leading-5 text-[#62685f]">{brief.subhead}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {brief.callHref ? (
          <BriefAction href={brief.callHref} icon={<Phone size={14} />} label="Call" />
        ) : null}
        {brief.smsHref ? (
          <BriefAction
            href={brief.smsHref}
            icon={<MessageSquareText size={14} />}
            label="Text"
          />
        ) : null}
        {brief.mapsHref ? (
          <BriefAction
            href={brief.mapsHref}
            icon={<Navigation size={14} />}
            label="Map"
            external
          />
        ) : null}
        <BriefAction
          href={brief.publicQuoteHref}
          icon={<ExternalLink size={14} />}
          label="Public quote"
        />
      </div>

      <div className="mt-4 grid gap-2">
        {brief.checks.map((check) => (
          <BriefCheck key={check.label} check={check} />
        ))}
      </div>

      <div className="mt-4 rounded-md bg-white/70 p-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#7a806f]">
          <Users size={13} />
          Crew plan
        </div>
        <div className="mt-2 space-y-2">
          {brief.crewPlan.map((item) => (
            <p key={item} className="text-sm leading-5 text-[#62685f]">
              {item}
            </p>
          ))}
        </div>
      </div>

      {brief.riskFlags.length > 0 ? (
        <div className="mt-4 rounded-md border border-[#f1d18a] bg-[#fff8e5] p-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#7a5400]">
            <AlertTriangle size={13} />
            Watch before dispatch
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {brief.riskFlags.map((flag) => (
              <span
                key={flag}
                className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-[#7a5400]"
              >
                {flag}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-4 rounded-md border border-[#e4e0d5] bg-white p-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#7a806f]">
          <FileText size={13} />
          Every job checklist
        </div>
        <div className="mt-2 space-y-2">
          {brief.dayOfChecklist.map((item) => (
            <div key={item} className="flex gap-2 text-sm leading-5 text-[#62685f]">
              <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-[#315b22]" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BriefAction({
  href,
  icon,
  label,
  external = false,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md border border-[#d8d4c7] bg-white px-2 text-xs font-semibold text-[#1d211c] transition hover:border-[#1d211c]"
    >
      {icon}
      {label}
    </a>
  );
}

function BriefCheck({ check }: { check: JobBrief["checks"][number] }) {
  const tone = briefTone(check.tone);
  return (
    <div className={`rounded-md border px-3 py-2 ${tone.pill}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wide">
        {check.label}
      </div>
      <div className="mt-1 text-sm font-semibold">{check.value}</div>
    </div>
  );
}

function briefTone(tone: JobBrief["tone"]) {
  if (tone === "green") {
    return {
      card: "border-[#cbe0c2] bg-[#f4fbef]",
      iconBox: "bg-[#315b22] text-white",
      pill: "border-[#cbe0c2] bg-white text-[#315b22]",
    };
  }
  if (tone === "amber") {
    return {
      card: "border-[#f1d18a] bg-[#fff8e5]",
      iconBox: "bg-[#8a6100] text-white",
      pill: "border-[#f1d18a] bg-white text-[#7a5400]",
    };
  }
  if (tone === "red") {
    return {
      card: "border-[#f2b8b5] bg-[#fff5f5]",
      iconBox: "bg-[#b42318] text-white",
      pill: "border-[#f2b8b5] bg-white text-[#9f2b22]",
    };
  }
  return {
    card: "border-[#d8d4c7] bg-white",
    iconBox: "bg-[#545b4f] text-white",
    pill: "border-[#e4e0d5] bg-white text-[#545b4f]",
  };
}

function NumberBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#e4e0d5] bg-[#fbfaf7] p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-[#62685f]">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

function IconDetail({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-[#e4e0d5] bg-[#fbfaf7] p-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#7a806f]">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold">{value}</div>
    </div>
  );
}

function ScopeList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-2 space-y-2">
        {items.map((item) => (
          <div key={item} className="text-sm leading-6 text-[#62685f]">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function LeadBadge({ quality }: { quality: string }) {
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
      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold ${tone}`}
    >
      {icon}
      {quality} lead
    </span>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-[#7a806f]">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}
