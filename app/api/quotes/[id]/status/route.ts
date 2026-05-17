import { NextRequest } from "next/server";
import { requireOwnerApi } from "@/lib/server/auth";
import { updateQuoteStatus } from "@/lib/server/store";
import { quoteStatusSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = requireOwnerApi(request);
  if (gate) return gate;

  const { id } = await params;
  const parsed = quoteStatusSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid status update", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const quote = await updateQuoteStatus(id, parsed.data.status);
  if (!quote) return Response.json({ error: "Quote not found" }, { status: 404 });

  return Response.json({ quote });
}
