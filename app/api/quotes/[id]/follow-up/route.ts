import { NextRequest } from "next/server";
import { followUpTasksForQuote } from "@/lib/follow-ups";
import { requireOwnerApi } from "@/lib/server/auth";
import { notifyCustomerFollowUp } from "@/lib/server/notifications";
import { getQuote, recordFollowUp } from "@/lib/server/store";
import { followUpSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = requireOwnerApi(request);
  if (gate) return gate;

  const { id } = await params;
  const parsed = followUpSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid follow-up request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { quote } = await getQuote(id);
  if (!quote) return Response.json({ error: "Quote not found" }, { status: 404 });

  const task = followUpTasksForQuote(quote).find(
    (item) => item.id === parsed.data.taskId,
  );
  if (!task) {
    return Response.json(
      { error: "Follow-up task is no longer available for this quote." },
      { status: 400 },
    );
  }

  if (parsed.data.channel !== "call") {
    await notifyCustomerFollowUp(quote, task, parsed.data.message);
  }

  const updated = await recordFollowUp(id, {
    taskId: task.id,
    channel: parsed.data.channel,
    message: parsed.data.message || task.message,
    sentBy: "dashboard",
  });

  return Response.json({ quote: updated, task });
}
