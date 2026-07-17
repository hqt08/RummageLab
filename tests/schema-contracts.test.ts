import { describe, expect, it } from "vitest";

import {
  ActivityContextSchema,
  PhotoInventoryItemSchema,
  QuestSpecSchema,
  RummageMomentSpecSchema,
  RummageToolSpecSchema,
} from "../src/lib/schemas";

const validActivityContext = {
  ageStage: "3-4y",
  materialSource: "photo",
  confirmedMaterials: [
    {
      allowedMaterialCategory: "large_empty_plastic_container",
      parentConfirmed: true,
    },
  ],
  weather: {
    source: "weather_lookup",
    approvedTags: ["rainy"],
    parentApproved: true,
    preciseLocationStored: false,
  },
  availableMinutes: 8,
  setting: "indoors",
  parentConfirmedSafety: true,
} as const;

const validQuest = {
  id: "kitchen-sound-detectives",
  title: "Kitchen Sound Detectives",
  experienceMode: "guided_quest",
  ageStage: "3-4y",
  developmentalFocusIds: ["DEV.COG.CAUSE_EFFECT"],
  parentFacingGoal: "Compare sounds made by familiar materials.",
  materials: ["large_empty_plastic_container", "soft_cloth"],
  adultSafetyNote: "Use room-temperature, intact objects with an adult.",
  stopIf: ["An item cracks or the child becomes uncomfortable."],
  steps: [
    { minute: 0, instruction: "Choose one container together." },
    { minute: 2, instruction: "Gently compare two sounds." },
  ],
  evidencePrompt: "What sounded different?",
  parentReflectionPrompt: "What did your child notice?",
  tool: {
    kind: "sound_mix",
    title: "Sound mixer",
    prompt: "Choose two sounds to compare.",
    accessibilityHint: "Every choice has a visible label.",
    soundLabels: ["container", "cloth"],
  },
  fallbackMessage: "Use the included sound pattern instead.",
} as const;

describe("activity context safety boundary", () => {
  it("accepts only normalized, parent-confirmed material categories", () => {
    expect(ActivityContextSchema.safeParse(validActivityContext).success).toBe(true);
    expect(
      ActivityContextSchema.safeParse({
        ...validActivityContext,
        materialInput: {
          source: "typed",
          items: ["raw parent text"],
        },
      }).success,
    ).toBe(false);
  });

  it("rejects non-allowlisted and age-inappropriate material categories", () => {
    expect(
      PhotoInventoryItemSchema.safeParse({
        suggestedLabel: "magnet",
        allowedMaterialCategory: "magnet",
        needsParentConfirmation: true,
      }).success,
    ).toBe(false);

    expect(
      ActivityContextSchema.safeParse({
        ...validActivityContext,
        ageStage: "12-36m",
        confirmedMaterials: [
          {
            allowedMaterialCategory: "wooden_kitchen_utensil",
            parentConfirmed: true,
          },
        ],
      }).success,
    ).toBe(false);
  });
});

describe("age-banded experience contracts", () => {
  it("rejects kindergarten standards for the 3-4 age band", () => {
    expect(QuestSpecSchema.safeParse(validQuest).success).toBe(true);
    expect(
      QuestSpecSchema.safeParse({
        ...validQuest,
        kindergartenStandardId: "CCSS.MATH.K.CC.A.1",
      }).success,
    ).toBe(false);
  });

  it("couples infant and toddler stages to their approved experience modes", () => {
    expect(
      RummageMomentSpecSchema.safeParse({
        id: "soft-texture-moment",
        title: "Soft texture moment",
        ageStage: "0-12m",
        experienceMode: "co_play",
        developmentalFocusIds: ["DEV.ATL.CURIOSITY"],
        parentFacingGoal: "Notice one soft texture together.",
        adultSupervision: true,
        approvedMaterialCategories: ["soft_cloth"],
        forbiddenMaterialCategories: ["small or detachable objects"],
        adultScript: ["Place the cloth nearby.", "Let the baby look or reach."],
        stopIf: ["The baby turns away or becomes uncomfortable."],
        parentObservationPrompt: "What did the baby notice?",
        fallbackMessage: "Pause and try another time.",
      }).success,
    ).toBe(false);
  });
});

describe("RummageTool contract", () => {
  it("rejects unrecognized tool kinds", () => {
    expect(
      RummageToolSpecSchema.safeParse({
        kind: "generated_code",
        title: "Unsafe tool",
        prompt: "Run arbitrary code.",
        accessibilityHint: "None",
      }).success,
    ).toBe(false);
  });
});
