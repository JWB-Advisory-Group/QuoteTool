import { NextRequest } from "next/server";
import { notifyCustomerReceived, notifyDanteOfQuote } from "@/lib/server/notifications";
import { createQuote, loadStore } from "@/lib/server/store";
import { quoteRequestSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET() {
  const store = await loadStore();
  return Response.json({ quotes: store.quotes });
}

export async function POST(request: NextRequest) {
  const json = await request.json();
  const parsed = quoteRequestSchema.safeParse(json);

  if (!parsed.success) {
    return Response.json(
      { error: "Invalid quote request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const quote = await createQuote({
    ...data,
    serviceLines:
      data.serviceLines ??
      [
        {
          serviceSlug: data.serviceSlug,
          jobSize: data.jobSize,
          jobSizeLabel: data.jobSizeLabel,
        },
      ],
  });

  await Promise.allSettled([
    notifyDanteOfQuote(quote),
    notifyCustomerReceived(quote),
  ]);

  return Response.json({
    quoteId: quote.id,
    rangeLow: quote.estimate.rangeLow,
    rangeHigh: quote.estimate.rangeHigh,
    estimate: quote.estimate,
    message: `Estimated $${quote.estimate.rangeLow}-$${quote.estimate.rangeHigh}. We will confirm scope, package, and schedule next.`,
  });
}
