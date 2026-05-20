import { describe, expect, test } from "vitest";
import { formatMultiplier } from "@/lib/format";

describe("formatMultiplier", () => {
  test("rounds multiplier noise without forcing trailing zeros", () => {
    expect(formatMultiplier(1)).toBe("1x");
    expect(formatMultiplier(1.2)).toBe("1.2x");
    expect(formatMultiplier(1.234)).toBe("1.23x");
    expect(formatMultiplier(1.2100000000000002)).toBe("1.21x");
  });

  test("handles missing multiplier values", () => {
    expect(formatMultiplier(null)).toBe("n/a");
    expect(formatMultiplier(undefined)).toBe("n/a");
    expect(formatMultiplier(Number.NaN)).toBe("n/a");
  });
});
