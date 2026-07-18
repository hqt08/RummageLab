import type { ActivityContext } from "../schemas";

export type DemoAgeStage = ActivityContext["ageStage"];

export type DemoAgeStageOption = {
  value: DemoAgeStage;
  label: string;
  focusLabel: string;
  description: string;
};

/**
 * Parent-facing language for the first screen. These are invitations, not
 * assessments; the canonical stages remain the validated ActivityContext IDs.
 */
export const demoAgeStageOptions: readonly DemoAgeStageOption[] = [
  {
    value: "0-12m",
    label: "Ages 0–1",
    focusLabel: "Guided sensory",
    description: "A caregiver narrates gentle sensory contrasts. No child device use.",
  },
  {
    value: "12-36m",
    label: "Ages 1–2",
    focusLabel: "Grown-up co-play",
    description: "Parent and child explore curated, large everyday objects together.",
  },
  {
    value: "3-4y",
    label: "Ages 3–4",
    focusLabel: "Prediction & noticing",
    description: "Picture-led prompts invite simple predictions, noticing, and turns.",
  },
  {
    value: "4-6y",
    label: "Ages 5–6",
    focusLabel: "Prediction, testing & making",
    description: "Guided quests invite testing, making, and explaining, with optional reviewed K links.",
  },
];

export function findDemoAgeStageOption(ageStage: DemoAgeStage): DemoAgeStageOption {
  const option = demoAgeStageOptions.find((candidate) => candidate.value === ageStage);
  if (!option) throw new Error(`Missing parent-facing age option for ${ageStage}`);
  return option;
}
