import { NextRequest } from "next/server";
import { notifyDanteOfPhotoUpload } from "@/lib/server/notifications";
import { addQuotePhotos } from "@/lib/server/store";
import { quotePhotosSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = quotePhotosSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid photo upload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const quote = await addQuotePhotos(id, parsed.data.photoAttachments);
  if (!quote) return Response.json({ error: "Quote not found" }, { status: 404 });

  await Promise.allSettled([
    notifyDanteOfPhotoUpload(quote, parsed.data.photoAttachments.length),
  ]);

  return Response.json({
    quote,
    estimate: quote.estimate,
    photoCount: quote.photoAttachments.length,
  });
}
