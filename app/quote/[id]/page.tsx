import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  DollarSign,
  Plus,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { businessProfile } from "@/lib/business";
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
  const headline = surveyRequired
    ? "Scope review needed"
    : quote.finalQuoteAmount
      ? `${formatMoney(quote.finalQuoteAmount)} confirmed quote`
      : `${formatMoney(quote.estimate.rangeLow)}-${formatMoney(
          quote.estimate.rangeHigh,
        )} estimate`;
  const needsPhotoConfirmation =
    !quote.finalQuoteAmount && !surveyRequired && quote.photoAttachments.length === 0;

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
                {`Service address: ${formatAddressLine(quote.addressStreet, quote.addressCity, quote.addressZip)}. Review the scope, package choices, and booking window before approving.`}
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
              {!surveyRequired && !expired && bestBundle && bundleLift > 0 ? (
                <div className="mt-5 flex items-start gap-3 rounded-md border border-[#cbe0c2] bg-[#f4fbef] p-4">
                  <div className="mt-0.5 text-[#3a6c2c]">
                    <Sparkles size={18} />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-[#315b22]">
                      Add {bestBundle.title} for {formatMoney(bundleLift)}
                      {bundleSavings > 0
                        ? ` — saves ${formatMoney(bundleSavings)} vs separate visits`
                        : ""}
                    </div>
                    <p className="mt-1 text-sm leading-6 text-[#3a6c2c]">
                      {bestBundle.reason} Already in the{" "}
                      <span className="font-semibold">{recommendedPackage?.name ?? "Best Value"}</span>{" "}
                      package below.
                    </p>
                  </div>
                  <a
                    href="#choose-package"
                    className="inline-flex items-center gap-1 self-start rounded-md bg-[#1d211c] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#30372e]"
                  >
                    <Plus size={13} />
                    Add it
                  </a>
                </div>
              ) : null}
            </div>

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
                value={
                  quote.estimate.depositRequired
                    ? `${formatMoney(quote.estimate.depositAmount)} at approval`
                    : quote.estimate.packageOptions.some(
                          (option) => option.price >= quote.estimate.depositThreshold,
                        )
                      ? `May apply above ${formatMoney(quote.estimate.depositThreshold)}`
                    : "Not required"
                }
              />
            </div>

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

            <div className="rounded-lg border border-[#d8d4c7] bg-white p-5 shadow-sm">
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
              initialPackageId={initialPackageId}
              initialApproval={quote.approval}
              surveyRequired={surveyRequired}
              canApprove={canApprove}
              expired={expired}
              bundleRecommendations={quote.estimate.bundleRecommendations}
              serviceSlugs={quote.serviceLines.map((line) => line.serviceSlug)}
            />
            <div className="rounded-lg border border-[#d8d4c7] bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <CheckCircle2 size={16} />
                Local, insured, photo-confirmed
              </div>
              <p className="mt-2 text-sm leading-6 text-[#62685f]">
                {businessProfile.ownerName} confirms final scope before
                scheduling so the work, price, and expectations stay clear.
              </p>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
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
    packageOptions.find((option) => option.id === "best_value")?.id ??
    packageOptions[0]?.id ??
    "essential"
  );
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
