export type LearningFocus = {
  id: string;
  category: "approaches" | "language" | "cognition" | "social" | "physical";
  title: string;
  description: string;
};

/**
 * Internal, human-curated developmental focus tags. These are intentionally not
 * represented as formal standards, milestone assessments, or mastery scores.
 */
export const learningFocusCatalog: readonly LearningFocus[] = [
  {
    id: "DEV.ATL.CURIOSITY",
    category: "approaches",
    title: "Curiosity and flexible exploration",
    description: "Trying a different surface after a surprising sound.",
  },
  {
    id: "DEV.LANG.DESCRIPTIVE_WORDS",
    category: "language",
    title: "Descriptive language",
    description: "Using words such as loud, quiet, fast, slow, same, or different.",
  },
  {
    id: "DEV.COG.CAUSE_EFFECT",
    category: "cognition",
    title: "Cause and effect",
    description: "Noticing that different materials change a sound.",
  },
  {
    id: "DEV.COG.PATTERN",
    category: "cognition",
    title: "Early patterning",
    description: "Copying or extending a two-beat rhythm.",
  },
  {
    id: "DEV.SOC.TURN_TAKING",
    category: "social",
    title: "Shared attention and turn-taking",
    description: "Taking turns making and copying a sound.",
  },
  {
    id: "DEV.PMP.CONTROLLED_MOVEMENT",
    category: "physical",
    title: "Controlled movement",
    description: "Gently tapping with an adult-approved object.",
  },
] as const;

export function findLearningFocus(id: string): LearningFocus | undefined {
  return learningFocusCatalog.find((focus) => focus.id === id);
}
