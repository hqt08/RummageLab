import { describe, expect, it, vi } from "vitest";

import { NextActivitySuggestionSchema } from "../src/lib/runtime/reflection-contracts";
import { suggestNextActivityLive } from "../src/lib/runtime/openai-reflection-provider";
import { createGenericNextIdea } from "../src/lib/demo/generic-next-suggestion";
import {
  createInitialKitchenSoundDemoState,
  hasValidKit,
  kitchenSoundDemoReducer,
  type KitchenSoundDemoState,
} from "../src/lib/demo/demo-state";
import { vettedCandidateId, type VettedCandidate } from "../src/lib/demo/material-intake";

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

const duck: VettedCandidate = {
  id: vettedCandidateId("Rubber duck"),
  label: "Rubber duck",
  category: "other_safe_object",
  safetyLevel: "caution",
  warnings: ["Keep it out of the mouth."],
};

describe("kit adjustment invariants", () => {
  it("opens only from the suggestion, keeps the idea, and returns to it", () => {
    const atSuggestion = suggestionState();
    const adjusting = kitchenSoundDemoReducer(atSuggestion, { type: "OPEN_KIT_ADJUST" });
    expect(adjusting.phase).toBe("kit_adjust");
    expect(adjusting.nextSuggestion).toEqual(atSuggestion.nextSuggestion);
    // Weather, safety, and age approvals are untouched by adjustment.
    expect(adjusting.parentApprovedWeather).toBe(true);
    expect(adjusting.parentConfirmedSafety).toBe(true);

    const closed = kitchenSoundDemoReducer(adjusting, { type: "CLOSE_KIT_ADJUST" });
    expect(closed.phase).toBe("next_suggestion");
    expect(closed.nextSuggestion).toEqual(atSuggestion.nextSuggestion);

    // No-ops from the wrong phase.
    const initial = createInitialKitchenSoundDemoState();
    expect(kitchenSoundDemoReducer(initial, { type: "OPEN_KIT_ADJUST" })).toBe(initial);
    expect(kitchenSoundDemoReducer(initial, { type: "CLOSE_KIT_ADJUST" })).toBe(initial);
  });

  it("adds vetted candidates without discarding confirmations, deduped, only while adjusting", () => {
    const adjusting = kitchenSoundDemoReducer(suggestionState(), { type: "OPEN_KIT_ADJUST" });
    const confirmedBefore = adjusting.confirmedObjects;

    const added = kitchenSoundDemoReducer(adjusting, {
      type: "ADD_VETTED_CANDIDATES",
      candidates: [duck, { ...duck }],
    });
    expect(added.confirmedObjects).toEqual(confirmedBefore);
    expect(added.intakeCandidates.filter((item) => item.id === duck.id)).toHaveLength(1);

    // The new object still needs an explicit parent tick.
    const confirmed = kitchenSoundDemoReducer(added, { type: "TOGGLE_OBJECT", id: duck.id });
    expect(confirmed.confirmedObjects.some((object) => object.id === duck.id)).toBe(true);

    // Outside kit_adjust the action is a no-op.
    const atSuggestion = suggestionState();
    expect(kitchenSoundDemoReducer(atSuggestion, {
      type: "ADD_VETTED_CANDIDATES",
      candidates: [duck],
    })).toBe(atSuggestion);
  });

  it("blocks continuing when removals empty the kit, and re-allows once restored", () => {
    let state = kitchenSoundDemoReducer(suggestionState(), { type: "OPEN_KIT_ADJUST" });
    expect(hasValidKit(state)).toBe(true);
    const confirmedIds = state.confirmedObjects.map((object) => object.id);
    for (const id of confirmedIds) {
      state = kitchenSoundDemoReducer(state, { type: "TOGGLE_OBJECT", id });
    }
    expect(state.confirmedObjects).toHaveLength(0);
    expect(hasValidKit(state)).toBe(false);
    state = kitchenSoundDemoReducer(state, { type: "TOGGLE_OBJECT", id: confirmedIds[0] });
    expect(hasValidKit(state)).toBe(true);
  });

  it("keeps the under-three guard during adjustment", () => {
    let state = createInitialKitchenSoundDemoState();
    state = kitchenSoundDemoReducer(state, { type: "SET_AGE_STAGE", ageStage: "12-36m" });
    // Fabricate the adjust phase directly to isolate the toggle guard.
    state = {
      ...state,
      phase: "kit_adjust",
      intakeCandidates: [...state.intakeCandidates, duck],
    };
    const toggled = kitchenSoundDemoReducer(state, { type: "TOGGLE_OBJECT", id: duck.id });
    expect(toggled.confirmedObjects).toEqual([]);
  });
});

describe("suggested-object ideas stay text until vetted", () => {
  it("bounds the contract and defaults the local fallback to none", () => {
    const base = {
      title: "One More Round",
      durationMinutes: 5,
      invitation: "Try one more gentle round together.",
      connection: "Keeps the interest going.",
    };
    expect(NextActivitySuggestionSchema.safeParse({ ...base, optionalObjectIdeas: ["cardboard box", "large pot"] }).success).toBe(true);
    expect(NextActivitySuggestionSchema.safeParse({ ...base, optionalObjectIdeas: ["a", "b", "c"] }).success).toBe(false);
    expect(NextActivitySuggestionSchema.safeParse({ ...base, optionalObjectIdeas: ["x".repeat(41)] }).success).toBe(false);
    expect(createGenericNextIdea({ interestTags: ["movement_play"], supportTags: [], objectLabels: ["ball"] }).optionalObjectIdeas).toEqual([]);
  });

  it("drops hard-denylisted suggested objects before a parent sees them", async () => {
    const idea = {
      title: "Roll and Find",
      durationMinutes: 5,
      invitation: "Roll the ball and find it together.",
      connection: "Continues movement play.",
      optionalObjectIdeas: ["glass jar", "cardboard box"],
    };
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      output: [{ content: [{ type: "output_text", text: JSON.stringify(idea) }] }],
    }), { status: 200 })) as unknown as typeof fetch;
    const result = await suggestNextActivityLive({
      operation: "next_suggestion",
      ageStage: "12-36m",
      weatherTags: ["rainy"],
      objectLabels: ["big soft ball"],
      previousActivityTitle: "Slow Ball Roll",
      approvedInterestTags: ["movement_play"],
      approvedSupportTags: [],
      parentSummary: "They loved rolling the ball back and forth.",
    }, { apiKey: "development-key", fetchImpl });
    expect(result.optionalObjectIdeas).toEqual(["cardboard box"]);
  });
});

describe("idea refresh after kit changes", () => {
  it("snapshots the object set the idea was authored against", () => {
    const atSuggestion = suggestionState();
    expect(atSuggestion.nextSuggestion?.basedOnObjectIds.slice().sort()).toEqual(
      atSuggestion.confirmedObjects.map((object) => object.id).sort(),
    );
  });

  it("replaces the idea content for the new kit while keeping approved-tag provenance", () => {
    let state = kitchenSoundDemoReducer(suggestionState(), { type: "OPEN_KIT_ADJUST" });
    // Remove one object, add and confirm the duck.
    const removedId = state.confirmedObjects[0].id;
    state = kitchenSoundDemoReducer(state, { type: "TOGGLE_OBJECT", id: removedId });
    state = kitchenSoundDemoReducer(state, { type: "ADD_VETTED_CANDIDATES", candidates: [duck] });
    state = kitchenSoundDemoReducer(state, { type: "TOGGLE_OBJECT", id: duck.id });
    state = kitchenSoundDemoReducer(state, { type: "CLOSE_KIT_ADJUST" });
    expect(state.phase).toBe("next_suggestion");

    // The stale snapshot no longer matches the confirmed set (mismatch visible).
    expect(state.nextSuggestion?.basedOnObjectIds.slice().sort()).not.toEqual(
      state.confirmedObjects.map((object) => object.id).sort(),
    );

    const priorTags = state.nextSuggestion!.basedOnTags;
    const refreshed = kitchenSoundDemoReducer(state, {
      type: "REFRESH_NEXT_SUGGESTION",
      idea: {
        title: "Duck Peek Rounds",
        durationMinutes: 5,
        invitation: "Hide the rubber duck under the towel and reveal it together.",
        connection: "Keeps the pattern interest with the new duck.",
        optionalObjectIdeas: ["cardboard box"],
      },
      origin: "live",
    });
    expect(refreshed.nextSuggestion).toMatchObject({
      id: "live-next-idea",
      origin: "live",
      title: "Duck Peek Rounds",
      optionalObjectIdeas: ["cardboard box"],
    });
    // Tag provenance preserved; snapshot now matches the adjusted kit.
    expect(refreshed.nextSuggestion?.basedOnTags).toEqual(priorTags);
    expect(refreshed.nextSuggestion?.basedOnObjectIds.slice().sort()).toEqual(
      refreshed.confirmedObjects.map((object) => object.id).sort(),
    );
  });

  it("is a no-op outside the suggestion phase", () => {
    const adjusting = kitchenSoundDemoReducer(suggestionState(), { type: "OPEN_KIT_ADJUST" });
    expect(kitchenSoundDemoReducer(adjusting, {
      type: "REFRESH_NEXT_SUGGESTION",
      idea: { title: "X", durationMinutes: 5, invitation: "Y", connection: "Z" },
      origin: "live",
    })).toBe(adjusting);
  });
});
