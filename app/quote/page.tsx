import { loadStore } from "@/lib/server/store";
import { QuoteForm, QuoteTrustRail } from "@/app/quote/quote-form";
import { businessProfile } from "@/lib/business";

export const dynamic = "force-dynamic";

export default async function QuotePage() {
  const store = await loadStore();

  return (
    <main className="min-h-screen bg-[#f7f6f2] px-4 py-5 text-[#1d211c] sm:px-6 lg:px-8">
      <header className="mx-auto mb-4 flex w-full max-w-6xl items-center justify-between lg:mb-6">
        <div className="text-lg font-semibold tracking-tight">
          {businessProfile.name}
        </div>
        <a
          href={businessProfile.phoneHref}
          className="text-sm font-semibold text-[#1d211c] underline-offset-2 hover:underline"
        >
          {businessProfile.phone}
        </a>
      </header>
      <section className="mx-auto mb-4 w-full max-w-6xl lg:hidden">
        <h1 className="text-2xl font-semibold leading-tight tracking-tight">
          Fast, photo-confirmed quotes for Long Island homes.
        </h1>
        <p className="mt-2 text-sm leading-6 text-[#62685f]">
          Three short steps. Most homeowners are done in under a minute.
        </p>
      </section>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 lg:flex-row-reverse lg:items-start">
        <section
          className="w-full flex-1"
          aria-labelledby="quote-form-heading"
        >
          <h2 id="quote-form-heading" className="sr-only">
            Quote intake form
          </h2>
          <QuoteForm services={store.services} />
        </section>
        <aside className="flex-1 lg:sticky lg:top-6">
          <div className="max-w-xl">
            <h1 className="hidden text-3xl font-semibold leading-tight tracking-tight sm:text-4xl lg:block lg:text-5xl">
              Fast, clear exterior cleaning quotes for Long Island homes.
            </h1>
            <p className="mt-3 hidden text-base leading-7 text-[#62685f] lg:block">
              Send the details once, upload a few photos, and get real package
              options with scope, scheduling, and a one-tap approval.
            </p>
            <div className="hidden lg:block">
              <QuoteTrustRail />
            </div>
          </div>
        </aside>
      </div>
      <div className="mx-auto mt-6 w-full max-w-6xl lg:hidden">
        <QuoteTrustRail />
      </div>
    </main>
  );
}
