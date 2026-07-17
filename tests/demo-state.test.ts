import { describe, expect, it } from "vitest";

import {
  canCreateKitchenSoundNextSuggestion,
  canStartKitchenSoundQuest,
  createInitialKitchenSoundDemoState,
  kitchenSoundDemoReducer,
  type KitchenSoundDemoAction,
  type KitchenSoundDemoState,
} from "../src/lib/demo/demo-state";
import { KITCHEN_SOUND_REQUIRED_MATERIALS } from "../src/lib/demo/kitchen-sound-detectives";
import { NextActivityContextSchema } from "../src/lib/schemas";

function reduce(
  state: KitchenSoundDemoState,
  ...actions: KitchenSoundDemoAction[]
): KitchenSoundDemoState {
  return actions.reduce(kitchenSoundDemoReducer, state);
}

function readyKitState(): KitchenSoundDemoState {
  const materialActions: KitchenSoundDemoAction[] =
    KITCHEN_SOUND_REQUIRED_MATERIALS.map((material) => ({
      type: "TOGGLE_MATERIAL",
      material,
    }));

  return reduce(
    createInitialKitchenSoundDemoState(),
    ...materialActions,
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

    expect(
      canStartKitchenSoundQuest({
        ...ready,
        confirmedMaterials: [
          ...ready.confirmedMaterials,
          ready.confirmedMaterials[0],
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
    expect(reset.confirmedMaterials).not.toBe(fresh.confirmedMaterials);
    expect(reset.selectedWeatherTags).not.toBe(fresh.selectedWeatherTags);
  });
});
