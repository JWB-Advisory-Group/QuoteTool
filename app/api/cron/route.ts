import { NextRequest } from "next/server";
import { notifyCustomerFollowUp, sendOutcomePrompt } from "@/lib/server/notifications";
import {
  getDueCustomerFollowUps,
  getDueOutcomeQuotes,
  recordFollowUp,
} from "@/lib/server/store";

export const runtime = "nodejs";

type CronGate =
  | { ok: true }
  | { ok: false; status: number; error: string };

function cronAllowed(request: NextRequest): CronGate {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      return {
        ok: false,
        status: 503,
        error: "CRON_SECRET not configured on this deployment.",
      };
    }
    return { ok: true };
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  return { ok: true };
}

export async function GET(request: NextRequest) {
  return runCron(request);
}

export async function POST(request: NextRequest) {
  return runCron(request);
}

async function runCron(request: NextRequest) {
  const gate = cronAllowed(request);
  if (!gate.ok) {
    return Response.json({ error: gate.error }, { status: gate.status });
  }

  const due = await getDueOutcomeQuotes();
  const results = await Promise.allSettled(due.map((quote) => sendOutcomePrompt(quote)));
  const automationEnabled = process.env.FOLLOW_UP_AUTOMATION_ENABLED === "true";
  const customerFollowUps = automationEnabled ? await getDueCustomerFollowUps() : [];
  const followUpResults = await Promise.allSettled(
    customerFollowUps.map(async ({ quote, task }) => {
      await notifyCustomerFollowUp(quote, task);
      await recordFollowUp(quote.id, {
        taskId: task.id,
        channel: task.channel,
        message: task.message,
        sentBy: "cron",
      });
    }),
  );
  return Response.json({
    prompted: due.length,
    failures: results.filter((result) => result.status === "rejected").length,
    customerFollowUps: customerFollowUps.length,
    customerFollowUpFailures: followUpResults.filter(
      (result) => result.status === "rejected",
    ).length,
    customerFollowUpAutomation: automationEnabled ? "enabled" : "disabled",
  });
}
