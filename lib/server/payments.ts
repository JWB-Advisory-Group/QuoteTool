import "server-only";

import { mkdir, appendFile } from "node:fs/promises";
import { createHmac, timingSafeEqual } from "node:crypto";
import path from "node:path";
import { businessProfile, getPublicAppUrl } from "@/lib/business";
import type { ApprovalRecord, Quote } from "@/lib/types";

const logPath = path.join(process.cwd(), ".data", "payment-log.jsonl");

async function logPayment(payload: Record<string, unknown>) {
  await mkdir(path.dirname(logPath), { recursive: true });
  await appendFile(
    logPath,
    `${JSON.stringify({ ...payload, createdAt: new Date().toISOString() })}\n`,
    "utf8",
  );
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export type DepositCheckoutResult =
  | { ok: true; url: string }
  | { ok: false; reason: "stripe_not_configured" | "stripe_error"; message: string };

export async function createDepositCheckout(
  quote: Quote,
  approval: ApprovalRecord,
): Promise<DepositCheckoutResult> {
  if (!isStripeConfigured()) {
    await logPayment({
      event: "checkout_skipped",
      reason: "stripe_not_configured",
      quoteId: quote.id,
    });
    return {
      ok: false,
      reason: "stripe_not_configured",
      message: "Stripe is not configured — manual deposit hold required.",
    };
  }

  const amountCents = Math.round(approval.depositAmount * 100);
  if (amountCents <= 0) {
    return {
      ok: false,
      reason: "stripe_error",
      message: "Deposit amount must be greater than zero.",
    };
  }

  const baseUrl = getPublicAppUrl();
  const returnUrl = `${baseUrl}/quote/${quote.id}?deposit=`;
  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("success_url", `${returnUrl}paid`);
  params.set("cancel_url", `${returnUrl}cancelled`);
  params.set("payment_method_types[0]", "card");
  params.set("line_items[0][price_data][currency]", "usd");
  params.set("line_items[0][price_data][unit_amount]", String(amountCents));
  params.set(
    "line_items[0][price_data][product_data][name]",
    `${businessProfile.name} deposit hold`,
  );
  params.set(
    "line_items[0][price_data][product_data][description]",
    `Deposit for ${quote.customerName} at ${quote.addressStreet}, ${quote.addressCity} ${quote.addressZip}.`,
  );
  params.set("line_items[0][quantity]", "1");
  params.set("metadata[quoteId]", quote.id);
  params.set("metadata[approvedAt]", approval.approvedAt);
  if (quote.customerEmail) {
    params.set("customer_email", quote.customerEmail);
  }
  params.set("client_reference_id", quote.id);

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    await logPayment({
      event: "checkout_error",
      quoteId: quote.id,
      status: response.status,
      body: errorBody,
    });
    return {
      ok: false,
      reason: "stripe_error",
      message: "Stripe Checkout could not be created. Please contact us to take the deposit.",
    };
  }

  const session = (await response.json()) as { id: string; url: string };
  await logPayment({
    event: "checkout_created",
    quoteId: quote.id,
    sessionId: session.id,
    amount: approval.depositAmount,
  });
  return { ok: true, url: session.url };
}

export function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | null,
  tolerance = 300,
): { ok: boolean; reason?: string } {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return { ok: false, reason: "missing_secret" };
  if (!signatureHeader) return { ok: false, reason: "missing_signature" };

  const parts = signatureHeader.split(",").reduce<Record<string, string[]>>(
    (acc, segment) => {
      const [key, value] = segment.split("=");
      if (!key || !value) return acc;
      acc[key] = acc[key] ?? [];
      acc[key].push(value);
      return acc;
    },
    {},
  );

  const timestamp = parts.t?.[0];
  const signatures = parts.v1 ?? [];
  if (!timestamp || signatures.length === 0) {
    return { ok: false, reason: "malformed_signature" };
  }

  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(ageSeconds) || ageSeconds > tolerance) {
    return { ok: false, reason: "stale_timestamp" };
  }

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");

  const matched = signatures.some((sig) => {
    const sigBuf = Buffer.from(sig, "utf8");
    if (sigBuf.length !== expectedBuf.length) return false;
    return timingSafeEqual(sigBuf, expectedBuf);
  });

  return matched ? { ok: true } : { ok: false, reason: "signature_mismatch" };
}

export async function logWebhookEvent(payload: Record<string, unknown>) {
  await logPayment({ event: "webhook", ...payload });
}
