import "server-only";

import { mkdir, appendFile } from "node:fs/promises";
import path from "node:path";
import type {
  ApprovalRecord,
  FollowUpTask,
  NotificationHealth,
  Quote,
} from "@/lib/types";
import { formatMoney } from "@/lib/format";
import { businessProfile, getPublicAppUrl } from "@/lib/business";
import { preferredContactLabels, propertyTypeLabels } from "@/lib/pricing-config";

const logPath = path.join(process.cwd(), ".data", "notification-log.jsonl");

async function logNotification(payload: Record<string, unknown>) {
  await mkdir(path.dirname(logPath), { recursive: true });
  await appendFile(
    logPath,
    `${JSON.stringify({ ...payload, createdAt: new Date().toISOString() })}\n`,
    "utf8",
  );
}

export function getNotificationHealth(): NotificationHealth {
  const smsReady = Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_PHONE,
  );
  const emailReady = Boolean(process.env.RESEND_API_KEY);
  const ownerSmsReady = Boolean(process.env.DANTE_PHONE);
  const ownerEmailReady = Boolean(process.env.DANTE_EMAIL);
  const appUrlReady = Boolean(process.env.NEXT_PUBLIC_APP_URL);

  const missing: string[] = [];
  if (!process.env.TWILIO_ACCOUNT_SID) missing.push("TWILIO_ACCOUNT_SID");
  if (!process.env.TWILIO_AUTH_TOKEN) missing.push("TWILIO_AUTH_TOKEN");
  if (!process.env.TWILIO_FROM_PHONE) missing.push("TWILIO_FROM_PHONE");
  if (!process.env.RESEND_API_KEY) missing.push("RESEND_API_KEY");
  if (!process.env.DANTE_PHONE) missing.push("DANTE_PHONE");
  if (!process.env.DANTE_EMAIL) missing.push("DANTE_EMAIL");
  if (!process.env.NEXT_PUBLIC_APP_URL) missing.push("NEXT_PUBLIC_APP_URL");

  const ready = smsReady && emailReady && ownerSmsReady && ownerEmailReady;
  return {
    ready,
    smsReady,
    emailReady,
    ownerSmsReady,
    ownerEmailReady,
    appUrlReady,
    missing,
  };
}

async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from =
    process.env.RESEND_FROM || `${businessProfile.name} <quotes@631solutions.com>`;

  if (!to) {
    await logNotification({ channel: "email", skipped: true, reason: "missing_to", subject, html });
    return { skipped: true };
  }

  if (!apiKey) {
    await logNotification({ channel: "email", skipped: true, to, subject, html });
    return { skipped: true };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!response.ok) {
    const body = await response.text();
    await logNotification({ channel: "email", failed: true, to, subject, body });
    throw new Error(`Resend failed: ${response.status}`);
  }

  return response.json();
}

async function sendSms(to: string, body: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_PHONE;

  if (!to) {
    await logNotification({ channel: "sms", skipped: true, reason: "missing_to", body });
    return { skipped: true };
  }

  if (!sid || !token || !from) {
    await logNotification({ channel: "sms", skipped: true, to, body });
    return { skipped: true };
  }

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    await logNotification({ channel: "sms", failed: true, to, body, error });
    throw new Error(`Twilio failed: ${response.status}`);
  }

  return response.json();
}

function quoteAddress(quote: Quote) {
  return `${quote.addressStreet}, ${quote.addressCity} ${quote.addressZip}`;
}

function serviceSummary(quote: Quote) {
  const names = quote.estimate.serviceBreakdowns.map((line) => line.serviceName);
  return names.length > 0 ? names.join(" + ") : quote.serviceSlug;
}

export async function notifyDanteOfQuote(quote: Quote) {
  const toEmail = process.env.DANTE_EMAIL;
  const toPhone = process.env.DANTE_PHONE;
  const subject = `New quote: ${quote.customerName} ${formatMoney(
    quote.estimate.rangeLow,
  )}-${formatMoney(quote.estimate.rangeHigh)}`;
  const dashboardUrl = `${getPublicAppUrl()}/dashboard/quotes/${quote.id}`;

  const html = `
    <h1>New ${businessProfile.name} quote request</h1>
    <p><strong>${quote.customerName}</strong> requested ${serviceSummary(quote)} at ${quoteAddress(quote)}.</p>
    <p>Lead: ${quote.estimate.leadQuality} (${quote.estimate.closeProbability}% close)<br />
    Photos: ${quote.photoAttachments.length}<br />
    Property: ${propertyTypeLabels[quote.propertyType] ?? quote.propertyType}<br />
    Preferred contact: ${preferredContactLabels[quote.preferredContactMethod] ?? quote.preferredContactMethod}<br />
    Route: ${quote.estimate.routeZone}<br />
    Crew: ${quote.estimate.crewBlock}</p>
    <p>Protected floor: ${formatMoney(quote.estimate.floorBandHigh)}<br />
    Suggested ask: ${formatMoney(quote.estimate.recommendedAsk)}</p>
    <p><a href="${dashboardUrl}">Review quote</a></p>
  `;

  await Promise.all([
    toEmail ? sendEmail(toEmail, subject, html) : logNotification({ channel: "email", skipped: true, reason: "missing_DANTE_EMAIL", subject }),
    toPhone
      ? sendSms(
          toPhone,
          `New ${quote.estimate.leadQuality} lead from ${quote.customerName}: ${serviceSummary(quote)}, ${quote.photoAttachments.length} photos, prefers ${preferredContactLabels[quote.preferredContactMethod] ?? quote.preferredContactMethod}, ${formatMoney(quote.estimate.rangeLow)}-${formatMoney(quote.estimate.rangeHigh)}. ${dashboardUrl}`,
        )
      : logNotification({ channel: "sms", skipped: true, reason: "missing_DANTE_PHONE", subject }),
  ]);
}

export async function notifyDanteOfPhotoUpload(
  quote: Quote,
  uploadedCount: number,
) {
  const toEmail = process.env.DANTE_EMAIL;
  const toPhone = process.env.DANTE_PHONE;
  const dashboardUrl = `${getPublicAppUrl()}/dashboard/quotes/${quote.id}`;
  const subject = `${uploadedCount} photo${uploadedCount === 1 ? "" : "s"} uploaded: ${quote.customerName}`;
  const html = `
    <h1>Photos uploaded for ${quote.customerName}</h1>
    <p><strong>${serviceSummary(quote)}</strong> at ${quoteAddress(quote)}</p>
    <p>Total photos now attached: ${quote.photoAttachments.length}<br />
    Confidence: ${quote.estimate.estimateConfidence}<br />
    Suggested ask: ${formatMoney(quote.estimate.recommendedAsk)}</p>
    <p><a href="${dashboardUrl}">Review the lead</a></p>
  `;
  const sms = `${quote.customerName} uploaded ${uploadedCount} photo${uploadedCount === 1 ? "" : "s"} for ${serviceSummary(quote)}. Confidence now ${quote.estimate.estimateConfidence}. ${dashboardUrl}`;

  await Promise.allSettled([
    toEmail
      ? sendEmail(toEmail, subject, html)
      : logNotification({ channel: "email", skipped: true, reason: "missing_DANTE_EMAIL", subject }),
    toPhone
      ? sendSms(toPhone, sms)
      : logNotification({ channel: "sms", skipped: true, reason: "missing_DANTE_PHONE", body: sms }),
  ]);
}

export async function notifyCustomerReceived(quote: Quote) {
  const reviewUrl = `${getPublicAppUrl()}/quote/${quote.id}`;
  const services = serviceSummary(quote);
  const headline = `Hi ${quote.customerName}, this is ${businessProfile.ownerName} at ${businessProfile.name}.`;
  const range = `${formatMoney(quote.estimate.rangeLow)}-${formatMoney(quote.estimate.rangeHigh)}`;
  const photoNudge =
    quote.photoAttachments.length === 0
      ? ` Photos are optional: upload 2-4 for an actual quote, or skip and I will follow up on the estimate: ${reviewUrl}`
      : ` Thanks for sending photos. I will confirm the actual quote from here: ${reviewUrl}`;
  const message = `${headline} Got your ${services} request. Estimated range is ${range}.${photoNudge} Reply STOP to opt out.`;
  const emailPhotoLine =
    quote.photoAttachments.length === 0
      ? `<p>Photos are optional. Upload 2-4 clear shots if you want Dante to turn this estimated quote into an actual quote faster. If you skip them, he can still follow up with the estimate or a quick visit.</p>`
      : `<p>Thanks for sending photos. Dante can use them to confirm the actual quote and next booking window.</p>`;

  await Promise.all([
    sendEmail(
      quote.customerEmail,
      `Your ${businessProfile.name} quote: ${range}`,
      `<p>${headline}</p><p>Got your <strong>${services}</strong> request. Estimated range is <strong>${range}</strong>.</p>${emailPhotoLine}<p><a href="${reviewUrl}">Review your packages, scope, and optional photo upload here</a>.</p>`,
    ),
    quote.customerPhone ? sendSms(quote.customerPhone, message) : Promise.resolve(),
  ]);
}

export async function notifyCustomerQuoteSent(quote: Quote) {
  const amount = formatMoney(quote.finalQuoteAmount);
  const reviewUrl = `${getPublicAppUrl()}/quote/${quote.id}`;
  const body = `Hi ${quote.customerName}, your ${businessProfile.name} quote is ready. Review packages, scope, and booking windows here: ${reviewUrl}`;

  await Promise.all([
    sendEmail(
      quote.customerEmail,
      `Your ${businessProfile.name} quote: ${amount}`,
      `<p>${body}</p><p>Service address: ${quoteAddress(quote)}</p><p><a href="${reviewUrl}">Review and approve quote</a></p>`,
    ),
    quote.customerPhone ? sendSms(quote.customerPhone, body) : Promise.resolve(),
  ]);
}

export async function notifyDanteOfApproval(
  quote: Quote,
  approval: ApprovalRecord,
) {
  const toEmail = process.env.DANTE_EMAIL;
  const toPhone = process.env.DANTE_PHONE;
  const dashboardUrl = `${getPublicAppUrl()}/dashboard/quotes/${quote.id}`;
  const dateLine = approval.preferredDates
    .map((d) => `${d.day} (${d.time})`)
    .join(", ") || "Flexible — customer did not pick a window.";
  const depositLine = approval.depositRequired
    ? `Deposit required: ${formatMoney(approval.depositAmount)}.`
    : "No deposit required.";

  const subject = `APPROVED: ${quote.customerName} - ${formatMoney(
    approval.selectedPrice,
  )} (${quote.estimate.routeZone})`;
  const html = `
    <h1>Quote approved by ${quote.customerName}</h1>
    <p><strong>${serviceSummary(quote)}</strong> at ${quoteAddress(quote)}</p>
    <p>Selected: ${approval.selectedPackageId} - ${formatMoney(approval.selectedPrice)}<br/>
    Preferred windows: ${dateLine}<br/>
    ${depositLine}</p>
    ${approval.customerNote ? `<p>Customer note: ${approval.customerNote}</p>` : ""}
    <p><a href="${dashboardUrl}">Confirm booking</a></p>
  `;

  const sms = `APPROVED ${quote.customerName} ${formatMoney(
    approval.selectedPrice,
  )} ${serviceSummary(quote)}. ${depositLine} Windows: ${dateLine}. ${dashboardUrl}`;

  await Promise.allSettled([
    toEmail
      ? sendEmail(toEmail, subject, html)
      : logNotification({ channel: "email", skipped: true, reason: "missing_DANTE_EMAIL", subject }),
    toPhone
      ? sendSms(toPhone, sms)
      : logNotification({ channel: "sms", skipped: true, reason: "missing_DANTE_PHONE", body: sms }),
  ]);
}

export async function notifyCustomerPhotoRequest(
  quote: Quote,
  channel: "sms" | "email" | "both",
) {
  const link = `${getPublicAppUrl()}/quote/${quote.id}#photos`;
  const body = `Hi ${quote.customerName}, this is ${businessProfile.name}. To lock in your final price for ${serviceSummary(
    quote,
  )}, photos are optional but they help us move from an estimate to an actual quote. Upload 2-4 photos here: ${link}`;
  const tasks: Promise<unknown>[] = [];
  if (channel === "email" || channel === "both") {
    tasks.push(
      sendEmail(
        quote.customerEmail,
        "Optional photos for your actual 631 Solutions quote",
        `<p>${body}</p>`,
      ),
    );
  }
  if ((channel === "sms" || channel === "both") && quote.customerPhone) {
    tasks.push(sendSms(quote.customerPhone, body));
  }
  await Promise.allSettled(tasks);
}

export async function notifyCustomerFollowUp(
  quote: Quote,
  task: FollowUpTask,
  messageOverride = "",
) {
  const message = messageOverride.trim() || task.message;
  const body = `Hi ${quote.customerName}, ${message} Reply STOP to opt out.`;

  if (task.channel === "call") {
    await logNotification({
      channel: "call",
      skipped: true,
      reason: "manual_call_required",
      quoteId: quote.id,
      body,
    });
    return;
  }

  await Promise.allSettled([
    task.channel === "email"
      ? sendEmail(
          quote.customerEmail,
          `${businessProfile.name} follow-up`,
          `<p>${body}</p>`,
        )
      : Promise.resolve(),
    task.channel === "sms" && quote.customerPhone
      ? sendSms(quote.customerPhone, body)
      : Promise.resolve(),
  ]);
}

export async function sendOutcomePrompt(quote: Quote) {
  const toPhone = process.env.DANTE_PHONE;
  const amount = quote.finalQuoteAmount ?? quote.estimate.recommendedAsk;
  const formattedAmount = formatMoney(amount);
  const body = `[${quote.id.slice(0, 6)}] ${quote.customerName} (${formattedAmount}) — Reply WON (uses ${formattedAmount}), WON 625 (override), LOST, NO RESPONSE, or LATER.`;

  if (!toPhone) {
    await logNotification({ channel: "sms", skipped: true, reason: "missing_DANTE_PHONE", body });
    return;
  }
  await sendSms(toPhone, body);
}
