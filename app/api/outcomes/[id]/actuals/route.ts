import { NextRequest } from "next/server";
import { requireOwnerApi } from "@/lib/server/auth";
import { updateJobActuals } from "@/lib/server/store";
import { jobActualsSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = requireOwnerApi(request);
  if (gate) return gate;

  const { id } = await params;
  const parsed = jobActualsSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid actuals", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const updated = await updateJobActuals(id, {
    hours: parsed.data.hours,
    crewCount: parsed.data.crewCount,
    materialUsage: parsed.data.materialUsage,
    addedRevenue: parsed.data.addedRevenue,
    materialNotes: parsed.data.materialNotes,
    reasonCodes: parsed.data.reasonCodes,
    tags: parsed.data.tags,
  });
  if (!updated) {
    return Response.json({ error: "Outcome not found" }, { status: 404 });
  }
  return Response.json({ outcome: updated });
}
