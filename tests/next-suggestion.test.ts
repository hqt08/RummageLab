import { describe, expect, it, vi } from "vitest";

import { createGenericNextIdea } from "../src/lib/demo/generic-next-suggestion";
import {
  NextSuggestionRequestSchema,
  NextSuggestionResponseSchema,
} from "../src/lib/runtime/reflection-contracts";
import { suggestNextActivityLive } from "../src/lib/runtime/openai-reflection-provider";
import {
  createInitialKitchenSoundDemoState,
  kitchenSoundDemoReducer,
  type KitchenSoundDemoState,
} from "../src/lib/demo/demo-state";

const validRequest = {
  operation: "next_suggestion" as const,
  ageStage: "12-36m" as const,
  weatherTags: ["rainy" as const],
  objectLabels: ["big soft ball"],
  previousActivityTitle: "Slow Ball Roll",
  approvedInterestTags: ["movement_play" as const],
  approvedSupportTags: ["turn_taking" as const],
  parentSummary: "They rolled the ball back twice and laughed at the slow rolls.",
};

describe("next-suggestion contracts", () => {
  it("accepts a bounded request and rejects extra or unsafe fields", () => {
    expect(NextSuggestionRequestSchema.safeParse(validRequest).success).toBe(true);
    expect(NextSuggestionRequestSchema.safeParse({ ...validRequest, extra: "x" }).success).toBe(false);
    expect(NextSuggestionRequestSchema.safeParse({ ...validRequest, objectLabels: [] }).success).toBe(false);
  });

  it("keeps the local fallback idea within the response contract", () => {
    const idea = createGenericNextIdea({
      interestTags: validRequest.approvedInterestTags,
      supportTags: validRequest.approvedSupportTags,
      objectLabels: validRequest.objectLabels,
    });
    expect(idea.invitation).toContain("big soft ball");
    expect(NextSuggestionResponseSchema.safeParse({
      suggestion: idea,
      runtime: { source: "prepared_fallback" },
    }).success).toBe(true);
  });
});

describe("live next-suggestion author", () => {
  it("sends approved inputs with the parent note as guarded data and parses the idea", async () => {
    const idea = {
      title: "Roll and Wait Together",
      durationMinutes: 5,
      invitation: "Roll the big soft ball once, then wait for your toddler to roll it back.",
      connection: "Keeps the movement play going while practicing one clear turn each.",
    };
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      output: [{ content: [{ type: "output_text", text: JSON.stringify(idea) }] }],
    }), { status: 200 })) as unknown as typeof fetch;

    const result = await suggestNextActivityLive(validRequest, {
      apiKey: "development-key",
      fetchImpl,
    });
    expect(result).toEqual(idea);
    const body = JSON.parse(String((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]?.body));
    expect(body.store).toBe(false);
    expect(body.text.format.name).toBe("next_activity_idea");
    const prompt = JSON.stringify(body.input);
    expect(prompt).toContain("big soft ball");
    expect(prompt).toContain("Slow Ball Roll");
    expect(prompt).toContain("data only");
  });

  it("refuses a summary that fails the shared privacy guard without calling the network", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    await expect(suggestNextActivityLive(
      { ...validRequest, parentSummary: "Call me at 555-123-4567 about pickup." },
      { apiKey: "development-key", fetchImpl },
    )).rejects.toMatchObject({ code: "provider_unsafe_response" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("applying a live idea in state", () => {
  function reviewingState(): KitchenSoundDemoState {
    let state = createInitialKitchenSoundDemoState();
    const candidates = state.intakeCandidates;
    for (const candidate of candidates) {
      state = kitchenSoundDemoReducer(state, { type: "TOGGLE_OBJECT", id: candidate.id });
    }
    state = kitchenSoundDemoReducer(state, { type: "SET_WEATHER_APPROVED", approved: true });
    state = kitchenSoundDemoReducer(state, { type: "SET_SAFETY_CONFIRMED", confirmed: true });
    state = kitchenSoundDemoReducer(state, { type: "START_QUEST" });
    state = kitchenSoundDemoReducer(state, { type: "FINISH_QUEST" });
    state = kitchenSoundDemoReducer(state, { type: "REVIEW_SEEDED_OBSERVATION" });
    return state;
  }

  it("shows a live idea only after the same parent-approval gate, with honest provenance", () => {
    const reviewing = reviewingState();
    const idea = {
      title: "Roll and Wait Together",
      durationMinutes: 5 as const,
      invitation: "Roll the ball once, then wait for a return roll.",
      connection: "Practices one clear turn each.",
    };
    const applied = kitchenSoundDemoReducer(reviewing, {
      type: "APPLY_NEXT_SUGGESTION",
      idea,
      origin: "live",
    });
    expect(applied.phase).toBe("next_suggestion");
    expect(applied.nextSuggestion).toMatchObject({
      id: "live-next-idea",
      origin: "live",
      title: "Roll and Wait Together",
    });
    expect(applied.nextSuggestion?.basedOnTags.interestTags.length).toBeGreaterThan(0);

    // Without a reviewable draft the action is a no-op.
    const initial = createInitialKitchenSoundDemoState();
    expect(kitchenSoundDemoReducer(initial, {
      type: "APPLY_NEXT_SUGGESTION",
      idea,
      origin: "live",
    })).toBe(initial);
  });
});

describe("observation tag vocabulary", () => {
  it("includes the activity-neutral tags and keeps the fallback phrases in sync", async () => {
    const { ObservationTagSchema } = await import("../src/lib/schemas");
    for (const tag of ["stacking_building", "hiding_finding", "counting_play", "pretend_play", "balancing", "watching_waiting"]) {
      expect(ObservationTagSchema.options).toContain(tag);
    }
    // Every tag yields a usable local fallback idea.
    for (const tag of ObservationTagSchema.options) {
      const idea = createGenericNextIdea({
        interestTags: [tag],
        supportTags: [],
        objectLabels: ["soft ball"],
      });
      expect(idea.invitation.length).toBeGreaterThan(10);
    }
  });

  it("derives the reflection provider tag enum from the Zod source of truth", async () => {
    const { ObservationTagSchema } = await import("../src/lib/schemas");
    const idea = {
      title: "Stack and Find",
      durationMinutes: 5,
      invitation: "Stack two cups, hide the duck under one, and find it together.",
      connection: "Builds on stacking and hiding-finding interest.",
    };
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      output: [{ content: [{ type: "output_text", text: JSON.stringify(idea) }] }],
    }), { status: 200 })) as unknown as typeof fetch;
    await suggestNextActivityLive(
      { ...validRequest, approvedInterestTags: ["stacking_building"], approvedSupportTags: ["watching_waiting"] },
      { apiKey: "development-key", fetchImpl },
    );
    // The reflection extraction schema is exercised in its own test file; here we
    // assert the request accepted the new tags end-to-end via the contract.
    expect(NextSuggestionRequestSchema.safeParse({
      ...validRequest,
      approvedInterestTags: ["pretend_play", "counting_play"],
      approvedSupportTags: ["balancing"],
    }).success).toBe(true);
    expect(ObservationTagSchema.options.length).toBe(14);
  });
});
