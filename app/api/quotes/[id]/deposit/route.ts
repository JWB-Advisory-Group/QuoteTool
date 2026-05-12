import { NextRequest } from "next/server";
import { requireOwnerApi } from "@/lib/server/auth";
import { markDepositPaid } from "@/lib/server/store";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = requireOwnerApi(request);
  if (gate) return gate;

  const { id } = await params;
  try {
    const quote = await markDepositPaid(id);
    if (!quote) {
      return Response.json({ error: "Quote not found" }, { status: 404 });
    }
    return Response.json({ quote });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Could not mark deposit paid",
      },
      { status: 400 },
    );
  }
}
