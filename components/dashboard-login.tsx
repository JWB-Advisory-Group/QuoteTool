import { AlertTriangle, LockKeyhole } from "lucide-react";

export function DashboardLogin({
  error,
  misconfigured = false,
}: {
  error?: string;
  misconfigured?: boolean;
}) {
  if (misconfigured) {
    return (
      <main className="min-h-screen bg-[#f7f6f2] px-5 py-10 text-[#1d211c]">
        <section className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center">
          <div className="rounded-lg border border-[#f1d18a] bg-white p-6 shadow-sm">
            <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-md bg-[#fff8e5] text-[#8a6200]">
              <AlertTriangle size={20} />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Dashboard locked
            </h1>
            <p className="mt-2 text-sm leading-6 text-[#62685f]">
              Owner dashboard access is disabled until `DASHBOARD_PIN` is set in
              the production environment.
            </p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f6f2] px-5 py-10 text-[#1d211c]">
      <section className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center">
        <div className="rounded-lg border border-[#dedbd1] bg-white p-6 shadow-sm">
          <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-md bg-[#1d211c] text-white">
            <LockKeyhole size={20} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Dante dashboard
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#62685f]">
            Enter the dashboard PIN configured in `DASHBOARD_PIN`.
          </p>
          <form action="/api/dashboard/login" method="post" className="mt-6">
            <label className="text-sm font-medium" htmlFor="pin">
              PIN
            </label>
            <input
              id="pin"
              name="pin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              className="mt-2 h-12 w-full rounded-md border border-[#cbc7bb] bg-white px-3 text-base outline-none ring-[#1d211c]/20 focus:ring-4"
            />
            {error ? (
              <p className="mt-3 text-sm font-medium text-[#b42318]">
                That PIN did not match.
              </p>
            ) : null}
            <button className="mt-5 h-12 w-full rounded-md bg-[#1d211c] px-4 text-sm font-semibold text-white transition hover:bg-[#30372e]">
              Open dashboard
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
