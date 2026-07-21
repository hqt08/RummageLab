import { describe, expect, it } from "vitest";

import {
  canCreateKitchenSoundNextSuggestion,
  canStartKitchenSoundQuest,
  createInitialKitchenSoundDemoState,
  kitchenSoundDemoReducer,
  type KitchenSoundDemoAction,
  type KitchenSoundDemoState,
} from "../src/lib/demo/demo-state";
import {
  vettedCandidateId,
  type VettedCandidate,
} from "../src/lib/demo/material-intake";
import { NextActivityContextSchema } from "../src/lib/schemas";

function reduce(
  state: KitchenSoundDemoState,
  ...actions: KitchenSoundDemoAction[]
): KitchenSoundDemoState {
  return actions.reduce(kitchenSoundDemoReducer, state);
}

/** The three seeded prepared-kit candidates, as the reducer builds them. */
const KITCHEN_CANDIDATES = createInitialKitchenSoundDemoState().intakeCandidates;

const BALL_CANDIDATE: VettedCandidate = {
  id: vettedCandidateId("Large soft ball"),
  label: "Large soft ball",
  category: "large_soft_ball",
  safetyLevel: "ok",
  warnings: [],
};

function confirmAll(candidates: readonly VettedCandidate[]): KitchenSoundDemoAction[] {
  return candidates.map((candidate) => ({ type: "TOGGLE_OBJECT", id: candidate.id }));
}

function readyKitState(): KitchenSoundDemoState {
  return reduce(
    createInitialKitchenSoundDemoState(),
    ...confirmAll(KITCHEN_CANDIDATES),
    { type: "SET_WEATHER_APPROVED", approved: true },
    { type: "SET_SAFETY_CONFIRMED", confirmed: true },
  );
}

function reflectionState(): KitchenSoundDemoState {
  return reduce(
    readyKitState(),
    { type: "START_QUEST" },
    { type: "FINISH_QUEST" },
  );
}

describe("Kitchen Sound Detectives confirmation gates", () => {
  it("clears the current kit when a parent changes age stage and limits this reviewed quest to ages 3–4", () => {
    const ready = readyKitState();
    const infantStage = kitchenSoundDemoReducer(ready, {
      type: "SET_AGE_STAGE",
      ageStage: "0-12m",
    });

    expect(infantStage.selectedAgeStage).toBe("0-12m");
    expect(infantStage.confirmedObjects).toEqual([]);
    expect(infantStage.parentConfirmedSafety).toBe(false);
    expect(canStartKitchenSoundQuest(infantStage)).toBe(false);
  });

  it("does not start until materials, weather, and safety are parent-confirmed", () => {
    const initial = createInitialKitchenSoundDemoState();
    const attempted = kitchenSoundDemoReducer(initial, { type: "START_QUEST" });

    expect(canStartKitchenSoundQuest(initial)).toBe(false);
    expect(attempted).toBe(initial);

    const ready = readyKitState();
    expect(canStartKitchenSoundQuest(ready)).toBe(true);

    const started = kitchenSoundDemoReducer(ready, { type: "START_QUEST" });
    expect(started.phase).toBe("quest");
    expect(started.activityContext?.parentConfirmedSafety).toBe(true);
    expect(started.activityContext?.weather?.parentApproved).toBe(true);
    expect(started.activityContext?.confirmedMaterials).toHaveLength(3);

    // A duplicated confirmed object (same id) must fail the uniqueness gate.
    expect(
      canStartKitchenSoundQuest({
        ...ready,
        confirmedObjects: [
          ...ready.confirmedObjects,
          ready.confirmedObjects[0],
        ],
      }),
    ).toBe(false);
  });

  it("requires weather reapproval whenever a suggested tag changes", () => {
    const ready = readyKitState();
    const changed = kitchenSoundDemoReducer(ready, {
      type: "TOGGLE_WEATHER_TAG",
      tag: "cold",
    });

    expect(changed.selectedWeatherTags).toEqual(["rainy"]);
    expect(changed.parentApprovedWeather).toBe(false);
    expect(canStartKitchenSoundQuest(changed)).toBe(false);
  });

  it("uses the selected intake source and clears kit approval when that source changes", () => {
    const sourceChanged = kitchenSoundDemoReducer(readyKitState(), {
      type: "SET_MATERIAL_SOURCE",
      source: "typed",
    });

    expect(sourceChanged.materialSource).toBe("typed");
    expect(sourceChanged.confirmedObjects).toEqual([]);
    expect(sourceChanged.parentConfirmedSafety).toBe(false);
    expect(sourceChanged.parentApprovedWeather).toBe(true);
    expect(canStartKitchenSoundQuest(sourceChanged)).toBe(false);

    const typedReady = reduce(
      sourceChanged,
      { type: "SET_OBJECT_CANDIDATES", candidates: [...KITCHEN_CANDIDATES] },
      ...confirmAll(KITCHEN_CANDIDATES),
      { type: "SET_SAFETY_CONFIRMED", confirmed: true },
    );
    const started = kitchenSoundDemoReducer(typedReady, {
      type: "START_QUEST",
    });

    expect(started.activityContext?.materialSource).toBe("typed");
  });

  it("accepts a parent-confirmed large soft ball only after current intake, weather, and safety gates", () => {
    const ballReady = reduce(
      kitchenSoundDemoReducer(createInitialKitchenSoundDemoState(), { type: "SET_MATERIAL_SOURCE", source: "photo" }),
      { type: "SET_OBJECT_CANDIDATES", candidates: [BALL_CANDIDATE] },
      { type: "TOGGLE_OBJECT", id: BALL_CANDIDATE.id },
      { type: "SET_WEATHER_APPROVED", approved: true },
      { type: "SET_SAFETY_CONFIRMED", confirmed: true },
    );
    expect(canStartKitchenSoundQuest(ballReady)).toBe(true);
    const started = kitchenSoundDemoReducer(ballReady, { type: "START_QUEST" });
    expect(started.activityContext?.confirmedMaterials).toEqual([
      { allowedMaterialCategory: "large_soft_ball", parentConfirmed: true, label: "Large soft ball" },
    ]);
  });

  it("carries several distinct open objects (sharing the open category) into context", () => {
    const duck: VettedCandidate = { id: vettedCandidateId("Rubber duck"), label: "Rubber duck", category: "other_safe_object", safetyLevel: "caution", warnings: ["Keep out of the mouth."] };
    const egg: VettedCandidate = { id: vettedCandidateId("Egg"), label: "Egg", category: "other_safe_object", safetyLevel: "caution", warnings: [] };
    const ready = reduce(
      kitchenSoundDemoReducer(createInitialKitchenSoundDemoState(), { type: "SET_MATERIAL_SOURCE", source: "photo" }),
      { type: "SET_OBJECT_CANDIDATES", candidates: [duck, egg] },
      { type: "TOGGLE_OBJECT", id: duck.id },
      { type: "TOGGLE_OBJECT", id: egg.id },
      { type: "SET_WEATHER_APPROVED", approved: true },
      { type: "SET_SAFETY_CONFIRMED", confirmed: true },
    );
    expect(ready.confirmedObjects).toHaveLength(2);
    expect(canStartKitchenSoundQuest(ready)).toBe(true);
    const started = kitchenSoundDemoReducer(ready, { type: "START_QUEST" });
    expect(started.activityContext?.confirmedMaterials).toEqual([
      { allowedMaterialCategory: "other_safe_object", parentConfirmed: true, label: "Rubber duck" },
      { allowedMaterialCategory: "other_safe_object", parentConfirmed: true, label: "Egg" },
    ]);
  });

  it("cannot start photo or typed provenance without a current intake result", () => {
    for (const source of ["photo", "typed"] as const) {
      const sourceChanged = kitchenSoundDemoReducer(readyKitState(), {
        type: "SET_MATERIAL_SOURCE",
        source,
      });
      // Toggling ids that are not in the (now empty) candidate list is a no-op.
      const attempted = reduce(
        sourceChanged,
        ...confirmAll(KITCHEN_CANDIDATES),
        { type: "SET_SAFETY_CONFIRMED", confirmed: true },
        { type: "START_QUEST" },
      );

      expect(attempted.phase).toBe("kit_review");
      expect(attempted.confirmedObjects).toEqual([]);
      expect(attempted.activityContext).toBeNull();
    }
  });
});

describe("Kitchen Sound Detectives reflection and next-step state", () => {
  it("lets the parent skip without creating an observation or adaptive context", () => {
    const skipped = kitchenSoundDemoReducer(reflectionState(), {
      type: "SKIP_REFLECTION",
    });

    expect(skipped.phase).toBe("complete");
    expect(skipped.reflectionSkipped).toBe(true);
    expect(skipped.observationDraft).toBeNull();
    expect(skipped.reviewedObservation).toBeNull();
    expect(skipped.approvedNextActivityContext).toBeNull();
    expect(skipped.nextSuggestion).toBeNull();
  });

  it("reviews an editable seeded observation and creates exactly one suggestion", () => {
    const reviewing = reduce(
      reflectionState(),
      { type: "REVIEW_SEEDED_OBSERVATION" },
      {
        type: "EDIT_OBSERVATION_SUMMARY",
        parentSummary:
          "They copied two taps and used the pause cue with a little help.",
      },
    );

    expect(reviewing.phase).toBe("observation_review");
    expect(canCreateKitchenSoundNextSuggestion(reviewing)).toBe(true);

    const created = kitchenSoundDemoReducer(reviewing, {
      type: "CREATE_NEXT_SUGGESTION",
    });

    expect(created.phase).toBe("next_suggestion");
    expect(
      NextActivityContextSchema.parse(created.approvedNextActivityContext),
    ).toEqual(created.approvedNextActivityContext);
    expect(created.nextSuggestion).toMatchObject({
      id: "pass-the-sound",
      title: "Pass-the-Pattern Picnic",
    });
    expect(created.nextSuggestion?.basedOnTags).toEqual({
      interestTags: ["sound_play", "two_beat_pattern"],
      supportTags: ["turn_taking"],
    });

    const attemptedAgain = kitchenSoundDemoReducer(created, {
      type: "CREATE_NEXT_SUGGESTION",
    });
    expect(attemptedAgain).toBe(created);
  });

  it("keeps a live reflection draft's parent wording and GPT-derived tags for review", () => {
    const reviewing = kitchenSoundDemoReducer(reflectionState(), {
      type: "REVIEW_OBSERVATION_DRAFT",
      draft: {
        observedEvents: ["Stacked containers and compared their height."],
        parentSummary: "They stacked the containers, then asked to compare the tallest one.",
        interestTags: ["stacking_building"],
        supportTags: ["watching_waiting"],
      },
    });

    expect(reviewing.phase).toBe("observation_review");
    expect(reviewing.observationDraft).toMatchObject({
      parentSummary: "They stacked the containers, then asked to compare the tallest one.",
      interestTags: ["stacking_building"],
      supportTags: ["watching_waiting"],
    });
    // The prepared example remains a separate, explicit golden-path action.
    expect(kitchenSoundDemoReducer(reflectionState(), {
      type: "REVIEW_SEEDED_OBSERVATION",
    }).observationDraft?.parentSummary).toContain("They copied two taps, chose");
  });

  it("will not create a suggestion after all interest tags are removed", () => {
    const withoutInterests = reduce(
      reflectionState(),
      { type: "REVIEW_SEEDED_OBSERVATION" },
      { type: "TOGGLE_INTEREST_TAG", tag: "sound_play" },
      { type: "TOGGLE_INTEREST_TAG", tag: "two_beat_pattern" },
    );

    expect(withoutInterests.observationDraft?.interestTags).toEqual([]);
    expect(canCreateKitchenSoundNextSuggestion(withoutInterests)).toBe(false);
    expect(
      kitchenSoundDemoReducer(withoutInterests, {
        type: "CREATE_NEXT_SUGGESTION",
      }),
    ).toBe(withoutInterests);
  });

  it("keeps interest and support tags disjoint", () => {
    const reviewing = reduce(
      reflectionState(),
      { type: "REVIEW_SEEDED_OBSERVATION" },
      { type: "TOGGLE_SUPPORT_TAG", tag: "sound_play" },
    );

    expect(reviewing.observationDraft?.interestTags).not.toContain("sound_play");
    expect(reviewing.observationDraft?.supportTags).toContain("sound_play");
  });

  it("reset returns a fresh, pristine in-memory state", () => {
    const advanced = reduce(
      reflectionState(),
      { type: "REVIEW_SEEDED_OBSERVATION" },
      { type: "CREATE_NEXT_SUGGESTION" },
    );
    const reset = kitchenSoundDemoReducer(advanced, { type: "RESET" });
    const fresh = createInitialKitchenSoundDemoState();

    expect(reset).toEqual(fresh);
    expect(reset).not.toBe(fresh);
    expect(reset.confirmedObjects).not.toBe(fresh.confirmedObjects);
    expect(reset.selectedWeatherTags).not.toBe(fresh.selectedWeatherTags);
  });
});
