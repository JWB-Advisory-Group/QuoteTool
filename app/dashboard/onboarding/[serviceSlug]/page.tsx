import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DashboardLogin } from "@/components/dashboard-login";
import {
  dashboardAuthMisconfigured,
  isDashboardAuthed,
} from "@/lib/server/auth";
import { loadStore } from "@/lib/server/store";
import { getOnboardingBuckets } from "@/lib/onboarding";
import { OnboardingForm } from "./onboarding-form";

export const dynamic = "force-dynamic";

export default async function OnboardingServicePage({
  params,
}: {
  params: Promise<{ serviceSlug: string }>;
}) {
  if (!(await isDashboardAuthed())) {
    return <DashboardLogin misconfigured={dashboardAuthMisconfigured()} />;
  }

  const { serviceSlug } = await params;
  const store = await loadStore();
  const service = store.services.find((s) => s.slug === serviceSlug);
  const cost = store.costInputs.find(
    (input) => input.serviceSlug === serviceSlug,
  );
  if (!service || !cost) notFound();

  const buckets = getOnboardingBuckets(service);

  return (
    <main className="min-h-screen bg-[#f7f6f2] px-4 py-6 text-[#1d211c] sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-2xl">
        <Link
          href="/dashboard/onboarding"
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-[#62685f] transition hover:text-[#1d211c]"
        >
          <ArrowLeft size={16} />
          Back
        </Link>

        <header className="mb-7">
          <p className="text-sm font-medium text-[#62685f]">{service.name}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Tell me about a normal {service.name.toLowerCase()}
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#62685f]">
            Picture a job that felt typical — not your easiest, not your
            hardest. Four quick questions, then real jobs sharpen the rest.
          </p>
        </header>

        <OnboardingForm serviceSlug={service.slug} buckets={buckets} />
      </div>
    </main>
  );
}
