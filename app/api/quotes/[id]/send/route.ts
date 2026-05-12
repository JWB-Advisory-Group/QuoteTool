import { NextRequest } from "next/server";
import { requireOwnerApi } from "@/lib/server/auth";
import { notifyCustomerQuoteSent } from "@/lib/server/notifications";
import { sendQuote } from "@/lib/server/store";
import { sendQuoteSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = requireOwnerApi(request);
  if (gate) return gate;

  const { id } = await params;
  const parsed = sendQuoteSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid send request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const quote = await sendQuote(id, parsed.data.amount, {
      reviewConfirmed: parsed.data.reviewConfirmed,
      overrideReason: parsed.data.overrideReason,
    });
    if (!quote) return Response.json({ error: "Quote not found" }, { status: 404 });
    await Promise.allSettled([notifyCustomerQuoteSent(quote)]);
    return Response.json({ quote });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not send quote" },
      { status: 400 },
    );
  }
}
