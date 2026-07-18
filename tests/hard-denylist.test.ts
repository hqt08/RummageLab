import { describe, expect, it } from "vitest";

import {
  HARD_DENYLIST_WORDS,
  containsHardDenylistedTerm,
} from "../src/lib/demo/hard-denylist";

describe("hard denylist floor", () => {
  it("flags whole-word hazards regardless of case, spacing, or surrounding words", () => {
    expect(containsHardDenylistedTerm("glass jar")).toBe(true);
    expect(containsHardDenylistedTerm("A small MAGNET")).toBe(true);
    expect(containsHardDenylistedTerm("kitchen-knife")).toBe(true);
    expect(containsHardDenylistedTerm("button battery")).toBe(true);
  });

  it("does not flag ordinary safe objects", () => {
    expect(containsHardDenylistedTerm("rubber duck")).toBe(false);
    expect(containsHardDenylistedTerm("cardboard box")).toBe(false);
    expect(containsHardDenylistedTerm("wooden spoon")).toBe(false);
    expect(containsHardDenylistedTerm("large soft ball")).toBe(false);
  });

  it("matches whole tokens only, not substrings", () => {
    // "cording" contains "cord" as a substring but is a different word.
    expect(containsHardDenylistedTerm("cording ribbon toy")).toBe(false);
    expect(containsHardDenylistedTerm("a cord")).toBe(true);
  });

  it("covers the documented hazard families", () => {
    for (const word of ["coin", "knife", "string", "battery", "glass"]) {
      expect(HARD_DENYLIST_WORDS).toContain(word);
    }
  });
});
