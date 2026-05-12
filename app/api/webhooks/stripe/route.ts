import { NextRequest } from "next/server";
import {
  logWebhookEvent,
  verifyStripeSignature,
} from "@/lib/server/payments";
import { markDepositPaid } from "@/lib/server/store";

export const runtime = "nodejs";

type StripeEvent = {
  id: string;
  type: string;
  data: {
    object: {
      id: string;
      metadata?: Record<string, string>;
      client_reference_id?: string | null;
    };
  };
};

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  const verification = verifyStripeSignature(rawBody, signature);
  if (!verification.ok) {
    await logWebhookEvent({
      ok: false,
      reason: verification.reason ?? "unknown",
    });
    return Response.json(
      { error: `Signature verification failed: ${verification.reason}` },
      { status: 400 },
    );
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(rawBody) as StripeEvent;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    await logWebhookEvent({ ok: true, ignored: true, type: event.type, id: event.id });
    return Response.json({ ok: true, ignored: true });
  }

  const quoteId =
    event.data.object.metadata?.quoteId ??
    event.data.object.client_reference_id ??
    null;
  if (!quoteId) {
    await logWebhookEvent({ ok: false, reason: "missing_quote_id", id: event.id });
    return Response.json({ error: "Missing quoteId" }, { status: 400 });
  }

  try {
    const quote = await markDepositPaid(quoteId);
    await logWebhookEvent({
      ok: true,
      type: event.type,
      eventId: event.id,
      quoteId,
      status: quote?.status ?? "unknown",
    });
    return Response.json({ ok: true });
  } catch (error) {
    await logWebhookEvent({
      ok: false,
      reason: "mark_failed",
      eventId: event.id,
      quoteId,
      message: error instanceof Error ? error.message : String(error),
    });
    return Response.json({ ok: false }, { status: 200 });
  }
}
