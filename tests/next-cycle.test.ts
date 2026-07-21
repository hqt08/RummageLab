import { describe, expect, it, vi } from "vitest";

import { NextIdeaGuidanceSchema } from "../src/lib/runtime/contracts";
import { createApprovedActivityContext } from "../src/lib/demo/approved-quest-templates";
import { createOpenAIExperienceProvider } from "../src/lib/runtime/openai-provider";
import {
  createInitialKitchenSoundDemoState,
  kitchenSoundDemoReducer,
  type KitchenSoundDemoState,
} from "../src/lib/demo/demo-state";
import { kitchenSoundQuest } from "../src/lib/demo/kitchen-sound-detectives";

const guidance = {
  ideaTitle: "Pause-and-Roll Turns",
  ideaInvitation: "Roll the soft ball back and forth, pausing to say whose turn it is.",
  interestTags: ["movement_play" as const],
  supportTags: ["turn_taking" as const],
};

function responseFor(value: unknown): Response {
  return new Response(JSON.stringify({
    output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(value) }] }],
  }), { status: 200 });
}

describe("next-cycle guidance contract", () => {
  it("accepts a bounded parent-accepted idea and rejects extras and overlong fields", () => {
    expect(NextIdeaGuidanceSchema.safeParse(guidance).success).toBe(true);
    expect(NextIdeaGuidanceSchema.safeParse({ ...guidance, extra: "x" }).success).toBe(false);
    expect(NextIdeaGuidanceSchema.safeParse({ ...guidance, ideaTitle: "x".repeat(81) }).success).toBe(false);
    expect(NextIdeaGuidanceSchema.safeParse({ ...guidance, interestTags: [] }).success).toBe(false);
  });
});

describe("guidance-aware generation", () => {
  function provider(fetchImpl: typeof fetch) {
    return createOpenAIExperienceProvider({
      apiKey: "development-key",
      transientImage: { mimeType: "image/jpeg", base64: "" },
      fetchImpl,
    });
  }

  const generatedMoment = {
    id: "generated-follow-up",
    title: "Pause and Roll",
    ageStage: "12-36m",
    experienceMode: "co_play",
    developmentalFocusIds: ["DEV.SOC.TURN_TAKING"],
    parentFacingGoal: "Practice one clear turn each with the soft ball.",
    adultSupervision: true,
    approvedMaterialCategories: ["large_soft_ball"],
    forbiddenMaterialCategories: ["small or detachable objects"],
    adultScript: [
      "Roll the soft ball slowly and say, 'My turn.'",
      "Pause, then say, 'Your turn,' and wait for the return roll.",
    ],
    stopIf: ["The play stops feeling calm."],
    parentObservationPrompt: "How did the turns go?",
    fallbackMessage: "Take one slow rolling turn each.",
  };

  it("feeds the accepted idea and approved tags into the generation prompt", async () => {
    const fetchImpl = vi.fn(async () => responseFor(generatedMoment)) as unknown as typeof fetch;
    const context = createApprovedActivityContext({
      ageStage: "12-36m",
      materialSource: "photo",
      confirmedMaterials: [{ allowedMaterialCategory: "large_soft_ball", label: "big soft ball" }],
      approvedWeatherTags: ["rainy"],
      parentConfirmedSafety: true,
    });
    await provider(fetchImpl).selectExperience({ activityContext: context, guidance });
    const body = JSON.parse(String((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]?.body));
    const prompt = JSON.stringify(body.input);
    expect(prompt).toContain("Pause-and-Roll Turns");
    expect(prompt).toContain("accepted this follow-up idea");
    expect(prompt).toContain("turn_taking");
  });

  it("keeps the plain seeded path deterministic but generates live when guidance opts in", async () => {
    const fetchImpl = vi.fn(async () => responseFor({
      ...generatedMoment,
      id: "generated-kitchen-follow-up",
      ageStage: "3-4y",
      experienceMode: "guided_quest",
      materials: ["large_empty_plastic_container"],
      activitySummary: "A follow-up pattern game with the containers.",
      adultSafetyNote: "Stay within arm's reach and tap gently.",
      steps: [
        { minute: 0, instruction: "Tap a two-beat pattern together." },
        { minute: 3, instruction: "Trade the leader role and copy again." },
      ],
      evidencePrompt: "What pattern did your child copy?",
      parentReflectionPrompt: "What did you notice? You can skip this.",
      tool: {
        kind: "predict",
        title: "Who leads next?",
        prompt: "Choose who taps first this round.",
        accessibilityHint: "Written choices; choosing one records nothing.",
        question: "Who taps the pattern first?",
        options: ["Grown-up", "Child"],
      },
      adultSupervision: undefined,
      approvedMaterialCategories: undefined,
      forbiddenMaterialCategories: undefined,
      adultScript: undefined,
      parentObservationPrompt: undefined,
    })) as unknown as typeof fetch;
    const seededContext = createApprovedActivityContext({
      ageStage: "3-4y",
      materialSource: "seeded_demo",
      confirmedMaterials: [
        { allowedMaterialCategory: "large_empty_plastic_container" },
        { allowedMaterialCategory: "wooden_kitchen_utensil" },
        { allowedMaterialCategory: "soft_cloth" },
      ],
      approvedWeatherTags: ["rainy"],
      parentConfirmedSafety: true,
    });

    // Without guidance: deterministic, no model call (golden-path invariant).
    await expect(provider(fetchImpl).selectExperience({ activityContext: seededContext }))
      .resolves.toMatchObject({ id: "kitchen-sound-detectives" });
    expect(fetchImpl).not.toHaveBeenCalled();

    // With guidance: the explicit opt-in generates live even from the seeded kit.
    const guided = await provider(fetchImpl).selectExperience({ activityContext: seededContext, guidance });
    expect(guided).toMatchObject({ id: "generated-kitchen-follow-up" });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});

describe("START_NEXT_CYCLE invariants", () => {
  function suggestionState(): KitchenSoundDemoState {
    let state = createInitialKitchenSoundDemoState();
    for (const candidate of state.intakeCandidates) {
      state = kitchenSoundDemoReducer(state, { type: "TOGGLE_OBJECT", id: candidate.id });
    }
    state = kitchenSoundDemoReducer(state, { type: "SET_WEATHER_APPROVED", approved: true });
    state = kitchenSoundDemoReducer(state, { type: "SET_SAFETY_CONFIRMED", confirmed: true });
    state = kitchenSoundDemoReducer(state, { type: "START_QUEST" });
    state = kitchenSoundDemoReducer(state, { type: "FINISH_QUEST" });
    state = kitchenSoundDemoReducer(state, { type: "REVIEW_SEEDED_OBSERVATION" });
    state = kitchenSoundDemoReducer(state, { type: "CREATE_NEXT_SUGGESTION" });
    return state;
  }

  it("re-enters the quest phase with confirmations preserved and reflection state cleared", () => {
    const atSuggestion = suggestionState();
    expect(atSuggestion.phase).toBe("next_suggestion");

    const cycled = kitchenSoundDemoReducer(atSuggestion, {
      type: "START_NEXT_CYCLE",
      experience: kitchenSoundQuest,
    });

    expect(cycled.phase).toBe("quest");
    expect(cycled.experience).toBe(kitchenSoundQuest);
    // Parent approvals carry forward untouched.
    expect(cycled.confirmedObjects).toEqual(atSuggestion.confirmedObjects);
    expect(cycled.selectedWeatherTags).toEqual(atSuggestion.selectedWeatherTags);
    expect(cycled.selectedAgeStage).toBe(atSuggestion.selectedAgeStage);
    expect(cycled.parentConfirmedSafety).toBe(true);
    expect(cycled.parentApprovedWeather).toBe(true);
    // Reflection state from the finished cycle is cleared for the next one.
    expect(cycled.observationDraft).toBeNull();
    expect(cycled.reviewedObservation).toBeNull();
    expect(cycled.approvedNextActivityContext).toBeNull();
    expect(cycled.nextSuggestion).toBeNull();
    expect(cycled.reflectionSkipped).toBe(false);
    // The rebuilt context reflects the same approvals.
    expect(cycled.activityContext?.parentConfirmedSafety).toBe(true);
    expect(cycled.activityContext?.confirmedMaterials).toHaveLength(3);
  });

  it("is a no-op outside the next-suggestion phase, and Skip/Reset behave as before", () => {
    const initial = createInitialKitchenSoundDemoState();
    expect(kitchenSoundDemoReducer(initial, {
      type: "START_NEXT_CYCLE",
      experience: kitchenSoundQuest,
    })).toBe(initial);

    // Skip on a fresh reflection still ends privately with nothing created.
    let state = suggestionState();
    state = kitchenSoundDemoReducer(state, { type: "START_NEXT_CYCLE", experience: kitchenSoundQuest });
    state = kitchenSoundDemoReducer(state, { type: "FINISH_QUEST" });
    const skipped = kitchenSoundDemoReducer(state, { type: "SKIP_REFLECTION" });
    expect(skipped.phase).toBe("complete");
    expect(skipped.observationDraft).toBeNull();

    // Reset returns the pristine initial state from anywhere in the loop.
    const reset = kitchenSoundDemoReducer(state, { type: "RESET" });
    expect(reset).toEqual(createInitialKitchenSoundDemoState());
  });
});
