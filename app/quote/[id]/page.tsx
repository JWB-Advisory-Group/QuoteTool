/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  DollarSign,
  FileText,
  MapPinned,
  Phone,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { businessProfile } from "@/lib/business";
import {
  buildCustomerServicePlan,
  type CustomerPlanActionIntent,
  type CustomerPlanState,
  type CustomerServicePlan,
} from "@/lib/customer-service-plan";
import { formatAddressLine, formatMoney } from "@/lib/format";
import {
  getQuote,
  hasSurveyRequiredService,
  isQuoteExpired,
} from "@/lib/server/store";
import type { Quote, QuotePackageOption } from "@/lib/types";
import { PhotoUploadPanel } from "./photo-upload-panel";
import { PublicQuoteActions } from "./public-quote-actions";

export const dynamic = "force-dynamic";

export default async function PublicQuotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { store, quote } = await getQuote(id);
  if (!quote) notFound();

  const expired = isQuoteExpired(quote);
  return (
    <PublicQuoteView
      quote={quote}
      surveyRequired={hasSurveyRequiredService(store, quote)}
      expired={expired}
    />
  );
}

const SOURCE_PARAM_MAP: Record<string, string> = {
  nextdoor: "nextdoor",
  google: "google",
  referral: "referral",
  "repeat customer": "repeat",
  "truck qr": "truck",
  "yard sign": "sign",
};

function quoteBackLink(source: string | null | undefined): string {
  const tag = SOURCE_PARAM_MAP[(source ?? "").trim().toLowerCase()];
  return tag ? `/quote?src=${tag}` : "/quote";
}

function hoursUntil(iso: string | null) {
  if (!iso) return null;
  const diff = (new Date(iso).getTime() - Date.now()) / 1000 / 60 / 60;
  return Math.round(diff);
}

function expiryLabel(hours: number) {
  if (hours <= 0) return "Expired";
  if (hours < 24) return `Expires in ${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  return `Expires in ${days} day${days === 1 ? "" : "s"}`;
}

export function PublicQuoteView({
  quote,
  surveyRequired,
  expired,
}: {
  quote: Quote;
  surveyRequired: boolean;
  expired: boolean;
}) {
  const packageOptions = quote.estimate.packageOptions;
  const initialPackageId = pickInitialPackage(packageOptions, quote);
  const canApprove = quote.status === "sent" && !expired;
  const hoursLeft = hoursUntil(quote.expiresAt);
  const expirySoon =
    !expired && hoursLeft !== null && hoursLeft > 0 && hoursLeft <= 72;
  const servicePlan = buildCustomerServicePlan(quote, {
    surveyRequired,
    expired,
  });
  const bestBundle = quote.estimate.bundleRecommendations[0];
  const recommendedPackage =
    packageOptions.find((option) => option.id === "best_value") ?? packageOptions[0];
  const essentialPackage =
    packageOptions.find((option) => option.id === "essential") ?? recommendedPackage;
  const bundleLift =
    recommendedPackage && essentialPackage && recommendedPackage.id !== essentialPackage.id
      ? recommendedPackage.price - essentialPackage.price
      : 0;
  const bundleSavings = recommendedPackage?.bundleSavings ?? 0;
  const depositSummary = customerDepositSummary(quote, surveyRequired);
  const headline = surveyRequired
    ? "Scope review needed"
    : quote.finalQuoteAmount
      ? `${formatMoney(quote.finalQuoteAmount)} confirmed quote`
      : `${formatMoney(quote.estimate.rangeLow)}-${formatMoney(
          quote.estimate.rangeHigh,
        )} estimate`;
  const needsPhotoConfirmation =
    !quote.finalQuoteAmount && !surveyRequired && quote.photoAttachments.length === 0;
  const addressLine = formatAddressLine(
    quote.addressStreet,
    quote.addressCity,
    quote.addressZip,
  );
  const introCopy = surveyRequired
    ? `Service address: ${addressLine}. Review the visit plan and upload photos if helpful. ${businessProfile.ownerName} will confirm the scope before a final booking.`
    : expired
      ? `Service address: ${addressLine}. This quote needs a refresh before booking because price windows and route capacity move.`
      : `Service address: ${addressLine}. Review the visit plan, scope, package choices, and booking window before approving.`;

  return (
    <main className="min-h-screen bg-[#f7f6f2] px-4 py-5 text-[#1d211c] sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-6 flex items-center justify-between">
          <Link
            href={quoteBackLink(quote.source)}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#62685f] transition hover:text-[#1d211c]"
          >
            <ArrowLeft size={16} />
            New quote
          </Link>
          <a
            href={businessProfile.phoneHref}
            className="text-sm font-semibold underline-offset-2 hover:underline"
          >
            {businessProfile.phone}
          </a>
        </header>

        <section className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <div className="space-y-5">
            <div className="rounded-lg border border-[#d8d4c7] bg-white p-5 shadow-sm sm:p-6">
              <p className="text-sm font-semibold text-[#62685f]">
                {businessProfile.name} quote for {quote.customerName}
              </p>
              <h1 className="mt-2 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
                {headline}
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-[#62685f]">
                {introCopy}
              </p>
              {surveyRequired ? (
                <div className="mt-5 rounded-md border border-[#f1d18a] bg-[#fff8e5] px-3 py-3 text-sm font-medium text-[#7a5400]">
                  This is a budgetary range. {businessProfile.ownerName} will do a
                  quick scope review before confirming the final price — painting
                  and permanent lighting always need a brief on-site walk.
                </div>
              ) : null}
              {needsPhotoConfirmation ? (
                <div className="mt-5 rounded-md border border-[#f1d18a] bg-[#fff8e5] px-3 py-3 text-sm font-medium leading-6 text-[#7a5400]">
                  This is an estimated quote. Photos are optional, but 2-4 clear
                  shots usually let {businessProfile.ownerName} turn it into an
                  actual quote without a site visit.{" "}
                  <a href="#photos" className="underline underline-offset-2">
                    Upload photos
                  </a>
                  , or skip them and he will follow up.
                </div>
              ) : null}
              {expired ? (
                <div className="mt-5 flex items-start gap-2 rounded-md border border-[#f5b3b0] bg-[#fff5f5] px-3 py-3 text-sm font-medium text-[#b42318]">
                  <Clock size={16} className="mt-0.5" />
                  <div>
                    This quote has expired. Reply to {businessProfile.ownerName}{" "}
                    or call {businessProfile.phone} for a refreshed price — peak
                    season demand changes the number.
                  </div>
                </div>
              ) : expirySoon ? (
                <div className="mt-5 flex items-start gap-2 rounded-md border border-[#f1d18a] bg-[#fff8e5] px-3 py-3 text-sm font-medium text-[#7a5400]">
                  <Clock size={16} className="mt-0.5" />
                  <div>
                    {expiryLabel(hoursLeft ?? 0)} — lock in the package before the
                    route window releases.
                  </div>
                </div>
              ) : null}
            </div>

            <ServiceVisitPlan plan={servicePlan} />

            {!surveyRequired && !expired && bestBundle && bundleLift > 0 ? (
              <div className="flex items-start gap-3 rounded-lg border border-[#cbe0c2] bg-[#f4fbef] p-4 shadow-sm">
                <div className="mt-0.5 text-[#3a6c2c]">
                  <Sparkles size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-[#315b22]">
                    {recommendedPackage?.name ?? "Best Value"} includes{" "}
                    {bestBundle.title} for {formatMoney(bundleLift)}
                    {bundleSavings > 0
                      ? `, saving ${formatMoney(bundleSavings)} vs separate visits`
                      : ""}
                  </div>
                  <p className="mt-1 text-sm leading-6 text-[#3a6c2c]">
                    {bestBundle.reason}
                  </p>
                </div>
                <a
                  href="#choose-package"
                  className="inline-flex min-h-10 shrink-0 items-center gap-1 self-start rounded-md bg-[#1d211c] px-3 text-xs font-semibold text-white transition hover:bg-[#30372e]"
                >
                  <FileText size={13} />
                  See package
                </a>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-3">
              <InfoTile
                icon={<CalendarDays size={16} />}
                label="Scheduling"
                value={quote.estimate.earliestAvailability}
              />
              <InfoTile
                icon={<Users size={16} />}
                label="Crew"
                value={quote.estimate.crewBlock}
              />
              <InfoTile
                icon={<DollarSign size={16} />}
                label="Deposit"
                value={depositSummary}
              />
            </div>

            <CustomerProofPanel quote={quote} surveyRequired={surveyRequired} />

            <div className="rounded-lg border border-[#d8d4c7] bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold tracking-tight">
                Best booking windows
              </h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {quote.estimate.scheduleWindows.slice(0, 4).map((window) => (
                  <div
                    key={window.id}
                    className="rounded-md border border-[#e4e0d5] bg-[#fbfaf7] p-3 text-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold">
                          {window.customerLabel}
                        </div>
                        <div className="mt-1 text-[#62685f]">
                          Earliest {window.earliestDate}
                        </div>
                      </div>
                      {window.urgencyPremiumPct > 0 ? (
                        <span className="rounded-md bg-[#fff1ce] px-2 py-1 text-xs font-semibold text-[#7c5b00]">
                          priority
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div
              id="service-scope"
              className="scroll-mt-6 rounded-lg border border-[#d8d4c7] bg-white p-5 shadow-sm"
            >
              <h2 className="text-lg font-semibold tracking-tight">
                Service scope
              </h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {quote.estimate.serviceBreakdowns.map((line) => (
                  <div
                    key={line.serviceSlug}
                    className="rounded-md border border-[#e4e0d5] bg-[#fbfaf7] p-3 text-sm"
                  >
                    <div className="font-semibold">{line.serviceName}</div>
                    <div className="mt-1 text-[#62685f]">
                      {line.jobSizeLabel} · {line.jobSize}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-[#d8d4c7] bg-white p-5 shadow-sm">
              <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                <ShieldCheck size={18} />
                Included and excluded
              </h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <ScopeList title="Included" items={quote.estimate.scopeInclusions} />
                <ScopeList
                  title="Not included unless added"
                  items={quote.estimate.scopeExclusions}
                />
              </div>
            </div>
          </div>

          <aside id="choose-package" className="space-y-5">
            <div id="photos">
              <PhotoUploadPanel
                quoteId={quote.id}
                existingPhotoCount={quote.photoAttachments.length}
                requiredPhotos={quote.estimate.intakeRequirements.requiredPhotos}
                estimateConfidence={quote.estimate.estimateConfidence}
                surveyRequired={surveyRequired}
              />
            </div>
            <PublicQuoteActions
              quoteId={quote.id}
              packageOptions={packageOptions}
              scheduleWindows={quote.estimate.scheduleWindows}
              depositThreshold={quote.estimate.depositThreshold}
              estimateRangeHigh={quote.estimate.rangeHigh}
              initialPackageId={initialPackageId}
              initialApproval={quote.approval}
              surveyRequired={surveyRequired}
              canApprove={canApprove}
              expired={expired}
              bundleRecommendations={quote.estimate.bundleRecommendations}
              serviceSlugs={quote.serviceLines.map((line) => line.serviceSlug)}
            />
          </aside>
        </section>
      </div>
    </main>
  );
}

function CustomerProofPanel({
  quote,
  surveyRequired,
}: {
  quote: Quote;
  surveyRequired: boolean;
}) {
  const proofPhoto = quote.photoAttachments[0];
  const photoCount = quote.photoAttachments.length;
  const photoLabel =
    photoCount > 0
      ? `${photoCount} uploaded reference photo${photoCount === 1 ? "" : "s"}`
      : "No reference photos yet";
  const photoSummary =
    photoCount > 0
      ? "Used to check visible scope before the crew is scheduled."
      : "Upload photos any time to tighten the scope and reduce back-and-forth.";
  const statusCopy = surveyRequired
    ? "For this service, proof supports the scope review before a final quote."
    : "For this quote, proof is focused on clear scope, documented expectations, and a reachable owner before approval.";

  return (
    <section
      aria-labelledby="customer-proof-title"
      className="overflow-hidden rounded-lg border border-[#d8d4c7] bg-white shadow-sm"
    >
      <div className="grid lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.4fr)]">
        <div className="min-h-[220px] bg-[#1d211c] p-4 text-white">
          {proofPhoto ? (
            <figure className="h-full">
              <div className="aspect-[4/3] overflow-hidden rounded-md bg-[#30372e] lg:h-full lg:aspect-auto">
                <img
                  src={proofPhoto.dataUrl}
                  alt={`Uploaded property reference: ${proofPhoto.name}`}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              </div>
              <figcaption className="mt-3 text-xs font-semibold uppercase tracking-wide text-[#d8d4c7]">
                Customer reference photo
              </figcaption>
            </figure>
          ) : (
            <div className="flex h-full min-h-[190px] flex-col justify-between rounded-md border border-white/20 bg-white/10 p-4">
              <Camera size={26} />
              <div>
                <div className="text-sm font-semibold">Photo proof ready</div>
                <p className="mt-2 text-sm leading-6 text-[#d8d4c7]">
                  Add front, access, staining, or obstacle shots when you want the
                  quote tightened before booking.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="p-5 sm:p-6">
          <div className="inline-flex items-center gap-2 rounded-md bg-[#eef6e3] px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-[#315b22]">
            <ShieldCheck size={14} />
            Proof before booking
          </div>
          <h2
            id="customer-proof-title"
            className="mt-3 text-2xl font-semibold tracking-tight"
          >
            Clear scope, documented work, reachable owner
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#62685f]">
            {statusCopy}
          </p>

          <div className="mt-5 grid gap-4 border-y border-[#e4e0d5] py-4">
            <ProofPoint
              icon={<Camera size={16} />}
              title={photoLabel}
              body={photoSummary}
            />
            <ProofPoint
              icon={<ClipboardCheck size={16} />}
              title="Before/after record"
              body="Key areas can be documented before work starts and after rinse-down when photos help verify the result."
            />
            <ProofPoint
              icon={<ShieldCheck size={16} />}
              title="Insurance/license check"
              body={`${businessProfile.ownerName} can confirm insurance and any required local license details before scheduling.`}
            />
          </div>

          <div className="mt-5">
            <div className="text-sm font-semibold">Review-proof signals</div>
            <div className="mt-3 grid gap-3">
              {[
                "Clear price before approval.",
                "Scope and exclusions shown in writing.",
                `${businessProfile.ownerName} reachable by phone before booking.`,
              ].map((item) => (
                <div
                  key={item}
                  className="border-l-2 border-[#b6d491] pl-3 text-sm font-medium leading-6 text-[#4f574b]"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProofPoint({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </div>
      <p className="mt-2 text-sm leading-6 text-[#62685f]">{body}</p>
    </div>
  );
}

function ServiceVisitPlan({ plan }: { plan: CustomerServicePlan }) {
  return (
    <div className="rounded-lg border border-[#d8d4c7] bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-md bg-[#eef6e3] px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-[#315b22]">
            <ClipboardCheck size={14} />
            {plan.statusLabel}
          </div>
          <h2 className="mt-3 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
            {plan.headline}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#62685f] sm:text-base">
            {plan.summary}
          </p>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row md:flex-col">
          <a
            href={plan.primaryAction.href}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#1d211c] px-4 text-sm font-semibold text-white transition hover:bg-[#30372e]"
          >
            <PlanActionIcon intent={plan.primaryAction.intent} />
            {plan.primaryAction.label}
          </a>
          {plan.secondaryAction ? (
            <a
              href={plan.secondaryAction.href}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[#cbc7bb] bg-white px-4 text-sm font-semibold text-[#1d211c] transition hover:border-[#1d211c]"
            >
              <PlanActionIcon intent={plan.secondaryAction.intent} />
              {plan.secondaryAction.label}
            </a>
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid gap-4 border-y border-[#e4e0d5] py-4 md:grid-cols-3">
        <PlanStateBlock
          icon={<FileText size={16} />}
          label="Price clarity"
          state={{
            label: "Price",
            detail: plan.priceConfidence,
            tone: "neutral",
          }}
        />
        <PlanStateBlock
          icon={<Camera size={16} />}
          label="Photos"
          state={plan.photoState}
        />
        <PlanStateBlock
          icon={<DollarSign size={16} />}
          label="Deposit"
          state={plan.depositState}
        />
      </div>

      <ol className="mt-5 grid border-y border-[#e4e0d5] md:grid-cols-4 md:divide-x md:divide-[#e4e0d5]">
        {plan.timeline.map((step, index) => (
          <li
            key={`${step.label}-${index}`}
            className="border-b border-[#e4e0d5] py-3 last:border-b-0 md:border-b-0 md:px-4 md:first:pl-0 md:last:pr-0"
          >
            <div className="text-xs font-semibold uppercase tracking-wide text-[#62685f]">
              Step {index + 1}
            </div>
            <div className="mt-1 text-sm font-semibold">{step.label}</div>
            <p className="mt-1 text-sm leading-5 text-[#62685f]">{step.detail}</p>
          </li>
        ))}
      </ol>

      <div className="mt-5">
        <PlanList
          id="visit-prep"
          title="Before we arrive"
          icon={<CheckCircle2 size={17} />}
          items={plan.prepChecklist}
        />
      </div>

      <details className="group mt-5 rounded-md border border-[#e4e0d5] bg-[#fbfaf7]">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
          <ShieldCheck size={17} />
          Scope and trust details
        </summary>
        <div className="space-y-4 border-t border-[#e4e0d5] px-3 py-4">
          <PlanList
            title="What we'll handle"
            icon={<ShieldCheck size={17} />}
            items={plan.scopeHighlights}
          />
          <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-[#e4e0d5] pt-4">
            {plan.trustSignals.map((signal) => (
              <div
                key={signal}
                className="inline-flex max-w-full items-start gap-2 text-xs font-semibold leading-5 text-[#62685f]"
              >
                <MapPinned size={14} className="mt-0.5 shrink-0 text-[#547a25]" />
                <span>{signal}</span>
              </div>
            ))}
          </div>
        </div>
      </details>
    </div>
  );
}

function PlanStateBlock({
  icon,
  label,
  state,
}: {
  icon: React.ReactNode;
  label: string;
  state: CustomerPlanState;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#62685f]">
        {icon}
        {label}
      </div>
      <div className={`mt-2 text-sm font-semibold ${stateToneClass(state.tone)}`}>
        {state.label}
      </div>
      <p className="mt-1 text-sm leading-5 text-[#62685f]">{state.detail}</p>
    </div>
  );
}

function PlanList({
  id,
  title,
  icon,
  items,
}: {
  id?: string;
  title: string;
  icon: React.ReactNode;
  items: string[];
}) {
  return (
    <div id={id} className={id ? "scroll-mt-6" : undefined}>
      <div className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </div>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div key={item} className="flex gap-2 text-sm leading-6 text-[#62685f]">
            <CheckCircle2 size={15} className="mt-1 shrink-0 text-[#547a25]" />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlanActionIcon({ intent }: { intent: CustomerPlanActionIntent }) {
  if (intent === "photos") return <Camera size={15} />;
  if (intent === "approve") return <CheckCircle2 size={15} />;
  if (intent === "call") return <Phone size={15} />;
  if (intent === "deposit") return <DollarSign size={15} />;
  if (intent === "prep") return <ClipboardCheck size={15} />;
  return <FileText size={15} />;
}

function stateToneClass(tone: CustomerPlanState["tone"]) {
  if (tone === "green") return "text-[#315b22]";
  if (tone === "amber") return "text-[#7a5400]";
  if (tone === "red") return "text-[#b42318]";
  return "text-[#1d211c]";
}

function pickInitialPackage(
  packageOptions: QuotePackageOption[],
  quote: Quote,
): QuotePackageOption["id"] {
  const finalAmount = quote.finalQuoteAmount;
  if (finalAmount) {
    const exact = packageOptions.find(
      (option) => Math.abs(option.price - finalAmount) < 1,
    );
    if (exact) return exact.id;
  }
  return (
    packageOptions.find((option) => option.id === "essential")?.id ??
    packageOptions[0]?.id ??
    "essential"
  );
}

function customerDepositSummary(quote: Quote, surveyRequired: boolean): string {
  if (quote.approval?.depositRequired) {
    return quote.approval.depositPaid
      ? `${formatMoney(quote.approval.depositAmount)} paid`
      : `${formatMoney(quote.approval.depositAmount)} pending`;
  }

  if (surveyRequired && quote.estimate.depositRequired) {
    return "After final quote";
  }

  if (quote.estimate.depositRequired) {
    return "Shown with selected package";
  }

  if (
    quote.estimate.packageOptions.some(
      (option) => option.price >= quote.estimate.depositThreshold,
    )
  ) {
    return `May apply above ${formatMoney(quote.estimate.depositThreshold)}`;
  }

  return "Not required";
}

function InfoTile({
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
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#62685f]">
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
