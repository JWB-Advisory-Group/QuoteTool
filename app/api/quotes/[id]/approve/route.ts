import { NextRequest } from "next/server";
import { notifyDanteOfApproval } from "@/lib/server/notifications";
import {
  approveQuote,
  setDepositCheckoutUrl,
} from "@/lib/server/store";
import { createDepositCheckout } from "@/lib/server/payments";
import { approveQuoteSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = approveQuoteSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid approval request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await approveQuote(id, parsed.data);
    if (!result) {
      return Response.json({ error: "Quote not found" }, { status: 404 });
    }

    let checkoutUrl: string | null = null;
    let depositMessage: string | null = null;
    if (result.approval.depositRequired) {
      const checkout = await createDepositCheckout(result.quote, result.approval);
      if (checkout.ok) {
        checkoutUrl = checkout.url;
        await setDepositCheckoutUrl(id, checkout.url);
      } else if (checkout.reason !== "stripe_not_configured") {
        depositMessage = checkout.message;
      }
    }

    await notifyDanteOfApproval(result.quote, result.approval);

    const nextStep = result.approval.depositRequired
      ? checkoutUrl
        ? "Redirecting to secure deposit payment…"
        : depositMessage ??
          "Approved. Dante will text a deposit link to lock in your booking window."
      : "We will reach out within 1 business day to lock in your preferred booking window.";

    return Response.json({
      quote: result.quote,
      approval: result.approval,
      depositRequired: result.approval.depositRequired,
      depositAmount: result.approval.depositAmount,
      checkoutUrl,
      nextStep,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not approve quote" },
      { status: 400 },
    );
  }
}
