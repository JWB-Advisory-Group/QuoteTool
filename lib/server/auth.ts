import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";

const cookieName = "pricing_dashboard_session";

function dashboardPin() {
  return process.env.DASHBOARD_PIN?.trim() ?? "";
}

function sessionValue() {
  const pin = dashboardPin();
  if (!pin) return null;
  return createHash("sha256").update(`631-solutions:${pin}`).digest("hex");
}

function secureEquals(left: string | null | undefined, right: string | null) {
  if (!left || !right || left.length !== right.length) return false;
  return timingSafeEqual(Buffer.from(left), Buffer.from(right));
}

function secureSecretEquals(left: string, right: string) {
  if (!right) return false;
  const leftDigest = createHash("sha256").update(left).digest();
  const rightDigest = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

export function dashboardAuthEnabled() {
  return Boolean(dashboardPin());
}

export function dashboardAuthMisconfigured() {
  return process.env.NODE_ENV === "production" && !dashboardAuthEnabled();
}

export async function isDashboardAuthed() {
  if (dashboardAuthMisconfigured()) return false;
  if (!dashboardAuthEnabled()) return true;
  const cookieStore = await cookies();
  return secureEquals(cookieStore.get(cookieName)?.value, sessionValue());
}

export function requestHasDashboardAccess(request: NextRequest) {
  if (dashboardAuthMisconfigured()) return false;
  if (!dashboardAuthEnabled()) return true;
  return secureEquals(request.cookies.get(cookieName)?.value, sessionValue());
}

export function requireOwnerApi(request: NextRequest): Response | null {
  if (dashboardAuthEnabled()) {
    if (secureEquals(request.cookies.get(cookieName)?.value, sessionValue())) {
      return null;
    }
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (dashboardAuthMisconfigured()) {
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
  const value = sessionValue();
  if (!value) {
    throw new Error("DASHBOARD_PIN must be configured before setting dashboard cookies.");
  }
  response.cookies.set(cookieName, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
}

export function pinIsValid(pin: string) {
  return secureSecretEquals(pin, dashboardPin());
}
