import { NextRequest, NextResponse } from "next/server";
import { pinIsValid, setDashboardCookie } from "@/lib/server/auth";

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const pin = String(form.get("pin") ?? "");

  if (!pinIsValid(pin)) {
    return NextResponse.redirect(new URL("/dashboard?error=pin", request.url), {
      status: 303,
    });
  }

  const response = NextResponse.redirect(new URL("/dashboard", request.url), {
    status: 303,
  });
  setDashboardCookie(response);
  return response;
}
