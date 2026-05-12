import "server-only";

import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";

const cookieName = "pricing_dashboard_session";

function sessionValue() {
  const pin = process.env.DASHBOARD_PIN;
  if (!pin) return "";
  return createHash("sha256").update(`631-solutions:${pin}`).digest("hex");
}

export function dashboardAuthEnabled() {
  return Boolean(process.env.DASHBOARD_PIN);
}

export async function isDashboardAuthed() {
  if (!dashboardAuthEnabled()) return true;
  const cookieStore = await cookies();
  return cookieStore.get(cookieName)?.value === sessionValue();
}

export function requestHasDashboardAccess(request: NextRequest) {
  if (!dashboardAuthEnabled()) return true;
  return request.cookies.get(cookieName)?.value === sessionValue();
}

export function requireOwnerApi(request: NextRequest): Response | null {
  if (dashboardAuthEnabled()) {
    if (request.cookies.get(cookieName)?.value === sessionValue()) return null;
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (process.env.NODE_ENV === "production") {
    return Response.json(
      {
        error:
          "Owner API not protected — set DASHBOARD_PIN to enable, or expose the dashboard only behind a private network.",
      },
      { status: 503 },
    );
  }
  return null;
}

export function setDashboardCookie(response: NextResponse) {
  response.cookies.set(cookieName, sessionValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
}

export function pinIsValid(pin: string) {
  if (!dashboardAuthEnabled()) return true;
  return pin === process.env.DASHBOARD_PIN;
}
