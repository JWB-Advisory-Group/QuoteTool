import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { DashboardLogin } from "@/components/dashboard-login";
import {
  dashboardAuthMisconfigured,
  isDashboardAuthed,
} from "@/lib/server/auth";
import { loadStore } from "@/lib/server/store";
import { formatDate } from "@/lib/format";
import { getCalibrationStats } from "@/lib/calibration";

export const dynamic = "force-dynamic";

export default async function OnboardingHubPage() {
  if (!(await isDashboardAuthed())) {
    return <DashboardLogin misconfigured={dashboardAuthMisconfigured()} />;
  }

  const store = await loadStore();

  return (
    <main className="min-h-screen bg-[#f7f6f2] px-4 py-6 text-[#1d211c] sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-3xl">
        <Link
          href="/dashboard"
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-[#62685f] transition hover:text-[#1d211c]"
        >
          <ArrowLeft size={16} />
          Back to dashboard
        </Link>

        <header className="mb-7">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#1d211c] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
            <Sparkles size={13} />
            Tailor the system
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Tell me how you actually work
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#62685f]">
            Four quick questions per service, plain language, no math. This
            sets a starting point that matches you. Real jobs sharpen it from
            there. Until you finish, we use safe industry defaults so you can
            quote right now.
          </p>
        </header>

        <section className="space-y-3">
          {store.services.map((service) => {
            const cost = store.costInputs.find(
              (input) => input.serviceSlug === service.slug,
            );
            if (!cost) return null;
            const stats = getCalibrationStats(store, service.slug);
            const sourceLabel =
              cost.source === "industry_default"
                ? "Using industry defaults"
                : cost.source === "dante_input"
                  ? "Tailored to you"
                  : `Calibrated from ${stats.jobsWithActuals} real jobs`;
            const tone =
              cost.source === "industry_default"
                ? "border-[#f1d18a] bg-[#fff8e5]"
                : "border-[#d7e8c7] bg-[#f4fbef]";

            return (
              <Link
                key={service.slug}
                href={`/dashboard/onboarding/${service.slug}`}
                className={`flex items-center justify-between rounded-lg border ${tone} px-5 py-4 transition hover:border-[#1d211c]`}
              >
                <div>
                  <div className="text-lg font-semibold tracking-tight">
                    {service.name}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-sm text-[#62685f]">
                    {cost.source !== "industry_default" ? (
                      <CheckCircle2 size={14} />
                    ) : null}
                    {sourceLabel}
                    {cost.source !== "industry_default" ? (
                      <span className="text-[#7a806f]">
                        · last updated {formatDate(cost.updatedAt)}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="inline-flex items-center gap-2 text-sm font-semibold">
                  {cost.source === "industry_default" ? "Tailor now" : "Re-tailor"}
                  <ArrowRight size={16} />
                </div>
              </Link>
            );
          })}
        </section>
      </div>
    </main>
  );
}
