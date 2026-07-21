import type { DemoObservationTag } from "./kitchen-sound-detectives";

export type NextIdeaDraft = {
  title: string;
  durationMinutes: 5 | 8 | 10;
  invitation: string;
  connection: string;
};

const interestPhrases: Partial<Record<DemoObservationTag, string>> = {
  sound_play: "one gentle sound to make and copy",
  loud_quiet_contrast: "one loud-then-quiet contrast to try",
  two_beat_pattern: "one two-beat pattern to copy",
  turn_taking: "one clear my-turn-your-turn trade",
  descriptive_words: "one new describing word to hunt for",
  cause_and_effect: "one tiny change to test and watch",
  movement_play: "one slow, gentle movement to repeat",
  texture_exploration: "one texture to touch and name",
  stacking_building: "one small tower to stack and gently topple",
  hiding_finding: "one hide-and-reveal peek to play",
  counting_play: "one tiny count-together moment",
  pretend_play: "one little pretend scene to act out",
  balancing: "one gentle balance to try and hold",
  watching_waiting: "one slow watch-and-wait pause",
};

/**
 * Locally reviewed, tag-only fallback for the next-activity idea when the live
 * author is unavailable. Built from the approved tags and the parent-confirmed
 * object labels; nothing model-authored.
 */
export function createGenericNextIdea(input: {
  interestTags: readonly DemoObservationTag[];
  supportTags: readonly DemoObservationTag[];
  objectLabels: readonly string[];
}): NextIdeaDraft {
  const firstObject = input.objectLabels[0] ?? "the same confirmed objects";
  const focus =
    interestPhrases[input.interestTags[0]] ?? "one small thing to notice together";
  const support = input.supportTags[0];
  return {
    title: "One More Small Round",
    durationMinutes: 5,
    invitation: `Bring back ${firstObject} for one short encore: choose ${focus}, try it once, and name what happens.`,
    connection: support
      ? `Repeats what caught their interest while giving one extra gentle practice at ${support.replace(/_/g, " ")}.`
      : "Repeats what caught their interest one more time while it still feels fun.",
  };
}
