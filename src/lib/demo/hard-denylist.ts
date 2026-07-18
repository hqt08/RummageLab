/**
 * Local, conservative hard denylist for the young-child demo. Any object label
 * that matches is rejected BEFORE a parent ever sees it, regardless of what the
 * model reports as its safety level. This is the fail-closed floor beneath the
 * open, GPT-vetted, parent-approved object flow — not a complete hazard model.
 *
 * Shared by the client typed-label prefilter and the server-side filter applied
 * to model-returned labels, so both entry points enforce the same floor.
 */
export const HARD_DENYLIST_WORDS: readonly string[] = [
  // Choking / small parts
  "balloon",
  "bead",
  "button",
  "coin",
  "marble",
  "magnet",
  // Sharp / piercing
  "blade",
  "knife",
  "needle",
  "pin",
  "razor",
  "scissors",
  "tack",
  // Strangulation / entanglement
  "cord",
  "rope",
  "string",
  "wire",
  // Electrical / chemical / heat
  "battery",
  "bleach",
  "candle",
  "chemical",
  "lighter",
  "match",
  "medicine",
  "pill",
  // Breakable
  "glass",
];

function normalizeForDenylist(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * True if any whole word in the label matches the denylist. Whole-word matching
 * (not substring) avoids false positives like "cording" objects that are safe;
 * the demo errs toward rejecting the whole item when any token matches.
 */
export function containsHardDenylistedTerm(value: string): boolean {
  const denySet = new Set(HARD_DENYLIST_WORDS);
  return normalizeForDenylist(value)
    .split(" ")
    .some((word) => denySet.has(word));
}
