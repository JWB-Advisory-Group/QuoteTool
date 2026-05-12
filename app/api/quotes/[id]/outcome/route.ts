import { NextRequest } from "next/server";
import { requireOwnerApi } from "@/lib/server/auth";
import { recordOutcome } from "@/lib/server/store";
import { outcomeSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = requireOwnerApi(request);
  if (gate) return gate;

  const { id } = await params;
  const parsed = outcomeSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid outcome request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await recordOutcome(
      id,
      parsed.data.outcome,
      parsed.data.amount ?? null,
      "dashboard",
      parsed.data.notes,
      parsed.data.actuals
        ? {
            hours: parsed.data.actuals.hours,
            crewCount: parsed.data.actuals.crewCount,
            materialUsage: parsed.data.actuals.materialUsage,
            addedRevenue: parsed.data.actuals.addedRevenue,
            materialNotes: parsed.data.actuals.materialNotes,
            reasonCodes: parsed.data.actuals.reasonCodes,
            tags: parsed.data.actuals.tags ?? [],
          }
        : null,
    );
    if (!result) return Response.json({ error: "Quote not found" }, { status: 404 });
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not log outcome" },
      { status: 400 },
    );
  }
}
