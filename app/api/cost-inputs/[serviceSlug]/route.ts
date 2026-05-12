import { NextRequest } from "next/server";
import { requireOwnerApi } from "@/lib/server/auth";
import { updateCostInput } from "@/lib/server/store";
import { costInputUpdateSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ serviceSlug: string }> },
) {
  const gate = requireOwnerApi(request);
  if (gate) return gate;

  const { serviceSlug } = await params;
  const parsed = costInputUpdateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid cost inputs", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const input = await updateCostInput(serviceSlug, parsed.data);
  if (!input) {
    return Response.json({ error: "Service not found" }, { status: 404 });
  }

  return Response.json({ costInput: input });
}
