import { businessProfile } from "@/lib/business";
import { formatAddressLine, formatMoney } from "@/lib/format";
import type { Quote } from "@/lib/types";

export type OwnerMessageTemplate = {
  id: string;
  label: string;
  intent: string;
  body: string;
};

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "there";
}

export function quoteServiceSummary(quote: Quote) {
  const names = quote.estimate.serviceBreakdowns.map((line) => line.serviceName);
  if (names.length > 0) return names.join(" + ");
  return quote.serviceSlug.replaceAll("-", " ");
}

export function buildOwnerMessageTemplates(quote: Quote): OwnerMessageTemplate[] {
  const name = firstName(quote.customerName);
  const service = quoteServiceSummary(quote);
  const range = `${formatMoney(quote.estimate.rangeLow)}-${formatMoney(
    quote.estimate.rangeHigh,
  )}`;
  const final =
    quote.finalQuoteAmount !== null
      ? formatMoney(quote.finalQuoteAmount)
      : formatMoney(quote.estimate.recommendedAsk);
  const address = formatAddressLine(
    quote.addressStreet,
    quote.addressCity,
    quote.addressZip,
  );
  const photoLine =
    quote.photoAttachments.length > 0
      ? "I have enough to review the scope."
      : "Photos are optional, but 2-4 clear shots of the front, sides, and worst areas usually let me turn the estimate into an actual quote.";

  return [
    {
      id: "first_response",
      label: "First response",
      intent: "Fast text after a new lead lands",
      body: `Hey ${name}, this is ${businessProfile.ownerName} from ${businessProfile.name}. Thanks for reaching out about ${service}. I saw the request for ${address}. ${photoLine} I can give you a rough range of ${range}, then lock the final number once I confirm the details.`,
    },
    {
      id: "request_photos",
      label: "Request photos",
      intent: "Use when the lead is missing photos",
      body: `Hey ${name}, photos are optional, but if you want an actual quote instead of an estimate, 2-4 clear shots usually do it. Front, sides, access, and the dirtiest/problem area are perfect. If you prefer to skip photos, no problem - I can keep it as an estimate or take a quick look.`,
    },
    {
      id: "range_explanation",
      label: "Range explanation",
      intent: "Explain why the estimate is a range",
      body: `Based on what you sent, ${service} is roughly ${range}. I keep it as a range until I confirm access, height, condition, and photos. Once those are clear, I can send the final package price and booking window.`,
    },
    {
      id: "schedule_visit",
      label: "Schedule visit",
      intent: "Use when manual review is the smart move",
      body: `Hey ${name}, this one is worth a quick look before I promise a final price. I can swing by for a short scope check and then send the quote. Are you around today or tomorrow?`,
    },
    {
      id: "no_response",
      label: "No-response follow-up",
      intent: "Recover or close the loop",
      body: `Hey ${name}, just checking whether you still want me to quote the ${service}. Happy to help, but I do not want to keep bugging you if timing changed.`,
    },
    {
      id: "appointment_confirmation",
      label: "Appointment confirmation",
      intent: "Send before a booked job",
      body: `Hey ${name}, confirming your ${service} with ${businessProfile.name}. Please make sure water access, gates, parking, and any pets are handled before we arrive. If anything changed at the property, text me here.`,
    },
    {
      id: "quote_ready",
      label: "Quote ready",
      intent: "Send after reviewing and choosing a final ask",
      body: `Hey ${name}, I reviewed the ${service} details and the quote is ready at ${final}. It includes the scope we discussed, with anything outside that listed separately. Want me to send the approval link?`,
    },
  ];
}
