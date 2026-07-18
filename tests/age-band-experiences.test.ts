import { describe, expect, it, vi } from "vitest";

import {
  createInfantNoticingMoment,
  createKindergartenNoticingQuest,
  createToddlerCoPlayMoment,
} from "../src/lib/demo/age-band-fallbacks";
import {
  availableApprovedQuestTemplateIds,
  canStartApprovedQuest,
  createApprovedActivityContext,
  deterministicApprovedQuestForContext,
} from "../src/lib/demo/approved-quest-templates";
import {
  createInitialKitchenSoundDemoState,
  kitchenSoundDemoReducer,
  seededCandidatesForAge,
} from "../src/lib/demo/demo-state";
import { createOpenAIExperienceProvider } from "../src/lib/runtime/openai-provider";
import { validateExperienceForContext } from "../src/lib/runtime/seeded-runtime";
import type { ActivityContext, AllowedMaterialCategory } from "../src/lib/schemas";

function bandContext(
  ageStage: ActivityContext["ageStage"],
  categories: readonly AllowedMaterialCategory[],
  labels?: readonly string[],
): ActivityContext {
  return createApprovedActivityContext({
    ageStage,
    materialSource: "photo",
    confirmedMaterials: categories.map((allowedMaterialCategory, index) => ({
      allowedMaterialCategory,
      label: labels?.[index],
    })),
    approvedWeatherTags: ["rainy"],
    parentConfirmedSafety: true,
  });
}

function responseFor(value: unknown): Response {
  return new Response(JSON.stringify({
    output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(value) }] }],
  }), { status: 200 });
}

describe("per-band reviewed fallbacks", () => {
  it("resolves a caregiver moment for 0-1, a co-play moment for 1-2, and a quest for 5-6", () => {
    const infant = deterministicApprovedQuestForContext(bandContext("0-12m", ["soft_cloth"]));
    expect(infant).toMatchObject({ id: "infant-noticing-moment", experienceMode: "caregiver_moment" });

    const toddler = deterministicApprovedQuestForContext(bandContext("12-36m", ["large_soft_ball", "board_book"]));
    expect(toddler).toMatchObject({ id: "toddler-co-play-moment", experienceMode: "co_play" });

    const kindergarten = deterministicApprovedQuestForContext(bandContext("4-6y", ["paper_or_cardboard"]));
    expect(kindergarten).toMatchObject({ id: "kindergarten-investigation", experienceMode: "guided_quest", ageStage: "4-6y" });
  });

  it("keeps every fallback within the parent-approved context validation", () => {
    for (const [context, build] of [
      [bandContext("0-12m", ["soft_cloth"]), createInfantNoticingMoment],
      [bandContext("12-36m", ["board_book"]), createToddlerCoPlayMoment],
      [bandContext("4-6y", ["large_soft_ball"]), createKindergartenNoticingQuest],
    ] as const) {
      expect(() => validateExperienceForContext(build(context), context)).not.toThrow();
    }
  });

  it("gates 5-6 on the time window and keeps the 3-4 golden path untouched", () => {
    expect(availableApprovedQuestTemplateIds(bandContext("4-6y", ["board_book"]))).toEqual(["kindergarten-investigation"]);
    expect(
      availableApprovedQuestTemplateIds({ ...bandContext("4-6y", ["board_book"]), availableMinutes: 5 }),
    ).toEqual([]);
    expect(
      availableApprovedQuestTemplateIds(
        bandContext("3-4y", ["large_empty_plastic_container", "wooden_kitchen_utensil", "soft_cloth"]),
      ),
    ).toEqual(["kitchen-sound-detectives"]);
  });

  it("returns false (not a throw) when an under-three band holds a non-approved category", () => {
    expect(
      canStartApprovedQuest({
        ageStage: "12-36m",
        confirmedObjects: [{ id: "duck", category: "other_safe_object", label: "Rubber duck" }],
        candidateIds: ["duck"],
        approvedWeatherTags: ["rainy"],
        parentApprovedWeather: true,
        parentConfirmedSafety: true,
      }),
    ).toBe(false);
    expect(
      canStartApprovedQuest({
        ageStage: "12-36m",
        confirmedObjects: [{ id: "ball", category: "large_soft_ball", label: "Large soft ball" }],
        candidateIds: ["ball"],
        approvedWeatherTags: ["rainy"],
        parentApprovedWeather: true,
        parentConfirmedSafety: true,
      }),
    ).toBe(true);
  });
});

describe("per-band state model", () => {
  it("offers an under-three prepared kit and blocks non-approved toggles for babies", () => {
    const initial = createInitialKitchenSoundDemoState();
    const infant = kitchenSoundDemoReducer(initial, { type: "SET_AGE_STAGE", ageStage: "0-12m" });
    expect(infant.intakeCandidates.map((candidate) => candidate.category)).toEqual([
      "soft_cloth",
      "board_book",
      "large_soft_ball",
    ]);

    // Simulate an open-object candidate slipping in, then a toggle attempt.
    const withOpenObject = {
      ...infant,
      intakeCandidates: [
        ...infant.intakeCandidates,
        { id: "duck", label: "Rubber duck", category: "other_safe_object" as const, safetyLevel: "caution" as const, warnings: [] },
      ],
    };
    const toggled = kitchenSoundDemoReducer(withOpenObject, { type: "TOGGLE_OBJECT", id: "duck" });
    expect(toggled.confirmedObjects).toEqual([]);

    // 5-6 reuses the full kitchen prepared kit.
    expect(seededCandidatesForAge("4-6y").map((candidate) => candidate.category)).toContain("wooden_kitchen_utensil");
  });
});

describe("per-band live generation", () => {
  function provider(fetchImpl: typeof fetch) {
    return createOpenAIExperienceProvider({
      apiKey: "development-key",
      transientImage: { mimeType: "image/jpeg", base64: "" },
      fetchImpl,
    });
  }

  const validGeneratedMoment = {
    id: "generated-toddler-moment",
    title: "Peek and pat with the soft ball",
    ageStage: "12-36m",
    experienceMode: "co_play",
    developmentalFocusIds: ["DEV.ATL.CURIOSITY"],
    parentFacingGoal: "Take gentle turns patting the soft ball under the cloth.",
    adultSupervision: true,
    approvedMaterialCategories: ["large_soft_ball"],
    forbiddenMaterialCategories: ["small or detachable objects"],
    adultScript: [
      "Hide the large soft ball under the cloth and ask where it went.",
      "Let your toddler pull the cloth away; name what appears.",
    ],
    stopIf: ["The play stops feeling calm."],
    parentObservationPrompt: "What did your toddler look for or say?",
    fallbackMessage: "Hide and reveal the ball once, naming what happens.",
  };

  it("authors a screen-free moment for an under-three live context", async () => {
    const fetchImpl = vi.fn(async () => responseFor(validGeneratedMoment)) as unknown as typeof fetch;
    const context = bandContext("12-36m", ["large_soft_ball"], ["big soft ball"]);
    const result = await provider(fetchImpl).selectExperience({ activityContext: context });
    expect(result).toMatchObject({ experienceMode: "co_play", ageStage: "12-36m" });
    const body = JSON.parse(String((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]?.body));
    expect(body.text.format.name).toBe("generated_moment");
    // The under-three schema constrains materials to the smaller allowlist.
    expect(JSON.stringify(body.text.format.schema)).not.toContain("other_safe_object");
    expect(JSON.stringify(body)).toContain("big soft ball");
  });

  it("authors a 4-6y quest with the matching age enum", async () => {
    const generated = {
      ...validGeneratedMoment,
      id: "generated-k-quest",
      experienceMode: "guided_quest",
      ageStage: "4-6y",
      materials: ["large_soft_ball"],
      activitySummary: "A prediction-and-test game with the soft ball.",
      adultSafetyNote: "Stay nearby and keep every test gentle.",
      steps: [
        { minute: 0, instruction: "Predict how far the ball rolls." },
        { minute: 3, instruction: "Test it and explain the difference." },
      ],
      evidencePrompt: "What did your child predict and explain?",
      parentReflectionPrompt: "What did you notice? You can skip this.",
      tool: {
        kind: "measure",
        title: "Count the rolls",
        prompt: "Tally each test roll.",
        accessibilityHint: "Large buttons with written labels; records nothing.",
        unit: "observations",
        targetLabel: "gentle test rolls",
      },
      fallbackMessage: "Predict, test once, and explain together.",
    } as Record<string, unknown>;
    delete generated.adultSupervision;
    delete generated.approvedMaterialCategories;
    delete generated.forbiddenMaterialCategories;
    delete generated.adultScript;
    delete generated.parentObservationPrompt;

    const fetchImpl = vi.fn(async () => responseFor(generated)) as unknown as typeof fetch;
    const context = bandContext("4-6y", ["large_soft_ball"], ["soccer ball"]);
    const result = await provider(fetchImpl).selectExperience({ activityContext: context });
    expect(result).toMatchObject({ ageStage: "4-6y", tool: { kind: "measure" } });
    const body = JSON.parse(String((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]?.body));
    expect(body.text.format.schema.properties.ageStage.enum).toEqual(["4-6y"]);
  });

  it("keeps every band's seeded prepared kit deterministic with no model call", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    for (const [ageStage, categories] of [
      ["0-12m", ["soft_cloth"]],
      ["12-36m", ["board_book"]],
      ["4-6y", ["paper_or_cardboard"]],
    ] as const) {
      const context = createApprovedActivityContext({
        ageStage,
        materialSource: "seeded_demo",
        confirmedMaterials: categories.map((allowedMaterialCategory) => ({ allowedMaterialCategory })),
        approvedWeatherTags: ["rainy"],
        parentConfirmedSafety: true,
      });
      await expect(provider(fetchImpl).selectExperience({ activityContext: context })).resolves.toBeTruthy();
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
