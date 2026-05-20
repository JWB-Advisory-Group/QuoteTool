import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { DashboardLogin } from "@/components/dashboard-login";
import {
  dashboardAuthMisconfigured,
  isDashboardAuthed,
} from "@/lib/server/auth";
import { loadStore } from "@/lib/server/store";
import { getCalibrationStats } from "@/lib/calibration";
import { CostEditor } from "@/app/dashboard/costs/cost-editor";

export const dynamic = "force-dynamic";

export default async function CostsPage() {
  if (!(await isDashboardAuthed())) {
    return <DashboardLogin misconfigured={dashboardAuthMisconfigured()} />;
  }

  const store = await loadStore();
  const calibrationByService: Record<
    string,
    { jobsWithActuals: number; jobsNeededForFit: number; fitReady: boolean }
  > = {};
  for (const service of store.services) {
    const stats = getCalibrationStats(store, service.slug);
    calibrationByService[service.slug] = {
      jobsWithActuals: stats.jobsWithActuals,
      jobsNeededForFit: stats.jobsNeededForFit,
      fitReady: stats.fitReady,
    };
  }

  return (
    <main className="min-h-screen bg-[#f7f6f2] px-4 py-6 text-[#1d211c] sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <Link
          href="/dashboard"
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-[#62685f] transition hover:text-[#1d211c]"
        >
          <ArrowLeft size={16} />
          Back to queue
        </Link>
        <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Cost assumptions
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#62685f]">
              You don&apos;t have to touch this page. The system tailors itself
              from your onboarding answers and from the jobs you complete. This
              view is here when you want to see what the model believes.
            </p>
          </div>
          <Link
            href="/dashboard/onboarding"
            className="inline-flex h-11 items-center gap-2 rounded-md border border-[#cbc7bb] bg-white px-4 text-sm font-semibold transition hover:border-[#1d211c]"
          >
            <Sparkles size={15} />
            Re-tailor
          </Link>
        </header>
        <CostEditor
          services={store.services}
          costInputs={store.costInputs}
          calibrationByService={calibrationByService}
        />
      </div>
    </main>
  );
}
