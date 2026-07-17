import { describe, expect, it } from "vitest";

import { guardTypedReflection, isPlainObservationLanguage } from "../src/lib/runtime/reflection-guard";

describe("typed reflection privacy guard", () => {
  it("clears a short event report without rewriting it", () => {
    expect(guardTypedReflection("  They copied two taps and asked to try again.  ")).toEqual({
      safe: true, text: "They copied two taps and asked to try again.",
    });
  });

  it.each([
    "Email me at parent@example.com",
    "Call 907-555-0134",
    "We live at 123 Birch Street",
    "My child's name is Rowan",
    "Her school is North Star Preschool",
    "Date of birth is 2022-03-01",
    "See https://example.com/private",
    "My daughter Rowan copied two taps",
    "She goes to North Star Elementary",
    "We live in Anchorage at apartment 4B",
    "She has asthma and allergies",
  ])("blocks likely identifying text: %s", (text) => {
    expect(guardTypedReflection(text)).toEqual({ safe: false, code: "pii_risk" });
  });

  it("enforces character and UTF-8 byte bounds", () => {
    expect(guardTypedReflection("a".repeat(401))).toEqual({ safe: false, code: "too_long" });
    expect(guardTypedReflection("🙂".repeat(301))).toEqual({ safe: false, code: "too_long" });
  });

  it("rejects assessment language from output", () => {
    expect(isPlainObservationLanguage("They copied the pattern twice.")).toBe(true);
    expect(isPlainObservationLanguage("They have mastered sound discrimination.")).toBe(false);
    expect(isPlainObservationLanguage("They are gifted.")).toBe(false);
  });
});
