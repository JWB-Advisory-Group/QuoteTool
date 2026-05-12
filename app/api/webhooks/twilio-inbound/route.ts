import { NextRequest } from "next/server";
import {
  loadStore,
  recordOutcome,
  resolveOutstandingQuoteByShortId,
} from "@/lib/server/store";
import type { OutcomeKind, Quote } from "@/lib/types";

export const runtime = "nodejs";

type ParsedOutcome = {
  outcome: OutcomeKind;
  amount: number | null;
  amountExplicit: boolean;
  shortId: string | null;
};

function parseBody(body: string): ParsedOutcome | null {
  const normalized = body.trim().replace(/\s+/g, " ").toUpperCase();
  if (!normalized) return null;

  const shortIdMatch = normalized.match(/^\[?([0-9A-F]{4,12})\]?\s+/i);
  const shortId = shortIdMatch ? shortIdMatch[1].toLowerCase() : null;
  const trailing = shortIdMatch ? normalized.slice(shortIdMatch[0].length) : normalized;

  if (trailing.startsWith("WON")) {
    const amountMatch = trailing.match(/\d+(\.\d+)?/);
    const amount = amountMatch ? Number(amountMatch[0]) : null;
    return {
      outcome: "won",
      amount: amount !== null && Number.isFinite(amount) ? amount : null,
      amountExplicit: amount !== null && Number.isFinite(amount),
      shortId,
    };
  }
  if (trailing === "LOST" || trailing.startsWith("LOST")) {
    return { outcome: "lost", amount: null, amountExplicit: false, shortId };
  }
  if (trailing === "LATER" || trailing.startsWith("LATER")) {
    return { outcome: "later", amount: null, amountExplicit: false, shortId };
  }
  if (
    trailing === "NO RESPONSE" ||
    trailing === "NO_RESPONSE" ||
    trailing === "NR" ||
    trailing.startsWith("NO RESPONSE")
  ) {
    return { outcome: "no_response", amount: null, amountExplicit: false, shortId };
  }
  return null;
}

function nextOutstandingQuote(quotes: Quote[], loggedQuoteIds: Set<string>) {
  return quotes
    .filter((quote) => quote.status === "sent" && !loggedQuoteIds.has(quote.id))
    .sort((a, b) => {
      const aTime = a.outcomeCheckDate ? new Date(a.outcomeCheckDate).getTime() : 0;
      const bTime = b.outcomeCheckDate ? new Date(b.outcomeCheckDate).getTime() : 0;
      return aTime - bTime;
    })[0];
}

function twiml(message: string) {
  const safe = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return new Response(`<Response><Message>${safe}</Message></Response>`, {
    headers: { "Content-Type": "text/xml" },
  });
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const body = String(form.get("Body") ?? "");
  const parsed = parseBody(body);

  if (!parsed) {
    return twiml(
      "Reply with [id] WON (uses sent amount), WON 625 (override), LOST, NO RESPONSE, or LATER.",
    );
  }

  let quote: Quote | undefined;
  if (parsed.shortId) {
    quote = await resolveOutstandingQuoteByShortId(parsed.shortId);
  }
  if (!quote) {
    const store = await loadStore();
    const loggedQuoteIds = new Set(store.outcomes.map((outcome) => outcome.quoteId));
    quote = nextOutstandingQuote(store.quotes, loggedQuoteIds);
  }

  if (!quote) {
    return twiml("No outstanding sent quote found.");
  }

  const effectiveAmount =
    parsed.outcome === "won"
      ? parsed.amountExplicit
        ? parsed.amount
        : quote.finalQuoteAmount
      : null;

  if (parsed.outcome === "won" && !effectiveAmount) {
    return twiml(
      `No final amount on file for ${quote.customerName}. Reply WON 625 to override.`,
    );
  }

  try {
    await recordOutcome(quote.id, parsed.outcome, effectiveAmount, "sms", body);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not record that outcome.";
    return twiml(message);
  }

  const friendly = parsed.outcome.replace("_", " ");
  const tail = parsed.outcome === "won" ? ` $${effectiveAmount ?? 0}` : "";
  return twiml(`Logged ${friendly}${tail} for ${quote.customerName}.`);
}
