import { NextRequest } from "next/server";
import { requireOwnerApi } from "@/lib/server/auth";
import { applyOnboarding, loadStore } from "@/lib/server/store";
import { onboardingSchema } from "@/lib/validation";
import { computeCostInputFromOnboarding } from "@/lib/onboarding";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ serviceSlug: string }> },
) {
  const gate = requireOwnerApi(request);
  if (gate) return gate;

  const { serviceSlug } = await params;
  const parsed = onboardingSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid onboarding data", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const store = await loadStore();
  const service = store.services.find((s) => s.slug === serviceSlug);
  const current = store.costInputs.find(
    (input) => input.serviceSlug === serviceSlug,
  );
  if (!service || !current) {
    return Response.json({ error: "Service not found" }, { status: 404 });
  }

  const next = computeCostInputFromOnboarding(service, current, parsed.data);
  const saved = await applyOnboarding(serviceSlug, next);
  if (!saved) {
    return Response.json(
      { error: "Could not save onboarding" },
      { status: 500 },
    );
  }
  return Response.json({ costInput: saved });
}
