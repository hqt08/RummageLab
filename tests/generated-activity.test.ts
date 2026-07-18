import { describe, expect, it } from "vitest";

import { createApprovedActivityContext } from "../src/lib/demo/approved-quest-templates";
import {
  RuntimeProviderFailure,
  validateExperienceForContext,
} from "../src/lib/runtime/seeded-runtime";

const context = createApprovedActivityContext({
  materialSource: "photo",
  confirmedMaterials: [
    { allowedMaterialCategory: "large_soft_ball", label: "soccer ball" },
    { allowedMaterialCategory: "other_safe_object", label: "rubber duck" },
  ],
  approvedWeatherTags: ["rainy"],
  parentConfirmedSafety: true,
});

const baseGenerated = {
  id: "generated-activity",
  title: "Roll and notice",
  experienceMode: "guided_quest" as const,
  ageStage: "3-4y" as const,
  developmentalFocusIds: ["DEV.COG.CAUSE_EFFECT"],
  parentFacingGoal: "Roll the soft ball and notice where it stops.",
  activitySummary: "A calm rolling-and-noticing game.",
  materials: ["large_soft_ball"],
  adultSafetyNote: "Stay within arm's reach on a clear floor.",
  stopIf: ["The ball could roll toward stairs."],
  steps: [
    { minute: 0, instruction: "Predict how far the soccer ball rolls." },
    { minute: 2, instruction: "A grown-up rolls it gently once." },
  ],
  evidencePrompt: "What did your child notice?",
  parentReflectionPrompt: "What did you notice? You can skip this.",
  tool: {
    kind: "predict" as const,
    title: "Where will it stop?",
    prompt: "Choose a prediction, then roll gently.",
    accessibilityHint: "Written choices; choosing one records nothing.",
    question: "Where will the soccer ball stop?",
    options: ["Near us", "Far away"],
  },
  fallbackMessage: "Roll gently and notice together where it stops.",
};

describe("generated activity is re-validated against the parent-approved context", () => {
  it("accepts a well-formed generated activity using only confirmed materials", () => {
    const result = validateExperienceForContext(baseGenerated, context);
    expect(result).toMatchObject({ id: "generated-activity", ageStage: "3-4y" });
  });

  it("rejects a material the parent never confirmed", () => {
    expect(() =>
      validateExperienceForContext(
        { ...baseGenerated, materials: ["board_book"] },
        context,
      ),
    ).toThrow(RuntimeProviderFailure);
  });

  it("rejects a developmental focus outside the local catalogue", () => {
    expect(() =>
      validateExperienceForContext(
        { ...baseGenerated, developmentalFocusIds: ["DEV.MADE.UP"] },
        context,
      ),
    ).toThrow(RuntimeProviderFailure);
  });

  it("rejects a step that runs past the parent-approved time window", () => {
    expect(() =>
      validateExperienceForContext(
        { ...baseGenerated, steps: [...baseGenerated.steps, { minute: 12, instruction: "Too long." }] },
        context,
      ),
    ).toThrow(RuntimeProviderFailure);
  });
});
