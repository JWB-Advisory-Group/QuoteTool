import { NextRequest } from "next/server";
import { requireOwnerApi } from "@/lib/server/auth";
import { notifyCustomerPhotoRequest } from "@/lib/server/notifications";
import { markPhotosRequested } from "@/lib/server/store";
import { requestPhotosSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = requireOwnerApi(request);
  if (gate) return gate;

  const { id } = await params;
  const parsed = requestPhotosSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const quote = await markPhotosRequested(id);
  if (!quote) {
    return Response.json({ error: "Quote not found" }, { status: 404 });
  }

  await notifyCustomerPhotoRequest(quote, parsed.data.channel);
  return Response.json({ quote });
}
