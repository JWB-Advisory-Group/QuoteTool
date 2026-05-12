import { NextRequest } from "next/server";
import { previewEstimate } from "@/lib/server/store";
import { previewRequestSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const json = await request.json();
  const parsed = previewRequestSchema.safeParse(json);

  if (!parsed.success) {
    return Response.json(
      { error: "Invalid preview request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const estimate = await previewEstimate(parsed.data);
  return Response.json({ estimate });
}
