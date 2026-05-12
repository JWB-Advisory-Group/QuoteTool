import { describe, expect, test, beforeEach, afterEach, vi } from "vitest";
import type { NextRequest } from "next/server";

const originalEnv = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  process.env = { ...originalEnv };
});

afterEach(() => {
  process.env = { ...originalEnv };
});

function makeRequest(opts: { cookie?: string; auth?: string } = {}): NextRequest {
  return {
    cookies: {
      get(name: string) {
        return opts.cookie ? { name, value: opts.cookie } : undefined;
      },
    },
    headers: {
      get(name: string) {
        if (name.toLowerCase() === "authorization") return opts.auth ?? null;
        return null;
      },
    },
  } as unknown as NextRequest;
}

describe("requireOwnerApi", () => {
  test("dev mode (no PIN) — allows anonymous", async () => {
    delete process.env.DASHBOARD_PIN;
    process.env.NODE_ENV = "development";
    const { requireOwnerApi } = await import("@/lib/server/auth");
    expect(requireOwnerApi(makeRequest())).toBeNull();
  });

  test("production mode (no PIN) — refuses with 503", async () => {
    delete process.env.DASHBOARD_PIN;
    process.env.NODE_ENV = "production";
    const { requireOwnerApi } = await import("@/lib/server/auth");
    const res = requireOwnerApi(makeRequest());
    expect(res).not.toBeNull();
    expect(res!.status).toBe(503);
  });

  test("PIN set, no cookie — returns 401", async () => {
    process.env.DASHBOARD_PIN = "1234";
    process.env.NODE_ENV = "development";
    const { requireOwnerApi } = await import("@/lib/server/auth");
    const res = requireOwnerApi(makeRequest());
    expect(res!.status).toBe(401);
  });

  test("PIN set, wrong cookie — returns 401", async () => {
    process.env.DASHBOARD_PIN = "1234";
    process.env.NODE_ENV = "development";
    const { requireOwnerApi } = await import("@/lib/server/auth");
    const res = requireOwnerApi(makeRequest({ cookie: "wrong-session-value" }));
    expect(res!.status).toBe(401);
  });

  test("PIN set, correct cookie — passes", async () => {
    process.env.DASHBOARD_PIN = "1234";
    process.env.NODE_ENV = "development";
    const { requireOwnerApi } = await import("@/lib/server/auth");
    // Re-implement the cookie hash to construct a valid one
    const { createHash } = await import("node:crypto");
    const value = createHash("sha256").update("631-solutions:1234").digest("hex");
    const res = requireOwnerApi(makeRequest({ cookie: value }));
    expect(res).toBeNull();
  });
});
