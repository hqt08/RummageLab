import { describe, expect, it, vi } from "vitest";

import {
  KITCHEN_SOUND_REQUIRED_MATERIALS,
  createKitchenSoundActivityContext,
  kitchenSoundPhotoInventory,
  kitchenSoundQuest,
} from "../src/lib/demo/kitchen-sound-detectives";
import { createApprovedActivityContext } from "../src/lib/demo/approved-quest-templates";
import { RuntimeProviderFailure } from "../src/lib/runtime/seeded-runtime";
import { createOpenAIExperienceProvider } from "../src/lib/runtime/openai-provider";

const context = createKitchenSoundActivityContext({
  materialSource: "photo",
  confirmedMaterials: KITCHEN_SOUND_REQUIRED_MATERIALS,
  approvedWeatherTags: ["rainy"],
  parentConfirmedSafety: true,
});

const validGeneratedQuest = {
  id: "generated-ball-roll",
  title: "Roll and notice the soccer ball",
  experienceMode: "guided_quest",
  ageStage: "3-4y",
  developmentalFocusIds: ["DEV.COG.CAUSE_EFFECT"],
  parentFacingGoal: "Roll the soft ball gently and notice together where it stops.",
  activitySummary: "A calm rolling-and-noticing game with the soft ball.",
  materials: ["large_soft_ball"],
  adultSafetyNote: "Stay within arm's reach and roll only on a clear floor.",
  stopIf: ["The ball could roll toward stairs or breakable things."],
  steps: [
    { minute: 0, instruction: "Predict together how far the soccer ball will roll." },
    { minute: 2, instruction: "A grown-up rolls it gently once and you watch where it stops." },
  ],
  evidencePrompt: "What did your child notice about where it stopped?",
  parentReflectionPrompt: "What did you notice during the ball play? You can skip this.",
  tool: {
    kind: "predict",
    title: "Where will it stop?",
    prompt: "Choose a prediction, then try one gentle grown-up roll.",
    accessibilityHint: "Each choice uses written words; choosing one records nothing.",
    question: "Where do you think the soccer ball will stop?",
    options: ["Near us", "Farther away"],
  },
  fallbackMessage: "Point to near or far, make one gentle roll, then notice together.",
} as const;

function responseFor(value: unknown): Response {
  return new Response(JSON.stringify({
    output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(value) }] }],
  }), { status: 200, headers: { "content-type": "application/json" } });
}

function provider(fetchImpl: typeof fetch, apiKey = "development-key") {
  return createOpenAIExperienceProvider({
    apiKey,
    transientImage: { mimeType: "image/jpeg", base64: "sanitized-pixels" },
    fetchImpl,
  });
}

describe("OpenAI server-only experience provider", () => {
  it("uses the verified stateless Responses API image and Structured Outputs parameters", async () => {
    const liveInventory = { ...kitchenSoundPhotoInventory, imageMode: "live" as const };
    const fetchImpl = vi.fn(async () => responseFor(liveInventory)) as unknown as typeof fetch;

    const result = await provider(fetchImpl).getPhotoInventory({
      mode: "live_transient_object_upload",
      ageStage: "3-4y",
      objectOnly: true,
    });

    expect(result).toEqual(liveInventory);
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/responses");
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("gpt-5.6");
    expect(body.store).toBe(false);
    expect(body.text.format).toMatchObject({ type: "json_schema", strict: true });
    expect(body.input[0].content[1]).toEqual({
      type: "input_image",
      image_url: "data:image/jpeg;base64,sanitized-pixels",
      detail: "low",
    });
  });

  it("does not call the network without a key", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    await expect(provider(fetchImpl, " ").getPhotoInventory({
      mode: "live_transient_object_upload", ageStage: "3-4y", objectOnly: true,
    })).rejects.toMatchObject({ code: "provider_unavailable" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("maps bounded typed object labels into the same constrained inventory contract", async () => {
    const liveInventory = { ...kitchenSoundPhotoInventory, imageMode: "live" as const };
    const fetchImpl = vi.fn(async () => responseFor(liveInventory)) as unknown as typeof fetch;
    await expect(provider(fetchImpl).getPhotoInventory({
      mode: "live_typed_object_labels", ageStage: "3-4y", objectLabels: ["duck", "soft ball"],
    })).resolves.toEqual(liveInventory);
    const body = JSON.parse(String((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]?.body));
    expect(body.text.format.name).toBe("typed_object_inventory");
    expect(body.store).toBe(false);
    expect(JSON.stringify(body)).toContain("duck");
  });

  it("records only status and request id for a non-OK provider response", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fetchImpl = vi.fn(async () => new Response("private provider body", {
      status: 429,
      headers: { "x-request-id": "req_safe_id" },
    })) as unknown as typeof fetch;
    await expect(provider(fetchImpl).getPhotoInventory({
      mode: "live_typed_object_labels", ageStage: "3-4y", objectLabels: ["ball"],
    })).rejects.toMatchObject({ code: "provider_http_error" });
    expect(warnSpy).toHaveBeenCalledWith("rummagelab_openai_http_failure", {
      status: 429, requestId: "req_safe_id",
    });
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain("private provider body");
  });

  it("strictly rejects malformed, duplicate, and non-live inventories", async () => {
    const badOutputs = [
      { ...kitchenSoundPhotoInventory, imageMode: "seeded_demo" },
      { ...kitchenSoundPhotoInventory, imageMode: "live", unexpected: "raw" },
      { ...kitchenSoundPhotoInventory, imageMode: "live", suggestedItems: [kitchenSoundPhotoInventory.suggestedItems[0], kitchenSoundPhotoInventory.suggestedItems[0]] },
    ];
    for (const output of badOutputs) {
      const fetchImpl = vi.fn(async () => responseFor(output)) as unknown as typeof fetch;
      await expect(provider(fetchImpl).getPhotoInventory({
        mode: "live_transient_object_upload", ageStage: "3-4y", objectOnly: true,
      })).rejects.toBeInstanceOf(Error);
    }
  });

  it("returns the deterministic reviewed activity for the seeded prepared kit without any model call", async () => {
    const seededContext = createKitchenSoundActivityContext({
      materialSource: "seeded_demo",
      confirmedMaterials: KITCHEN_SOUND_REQUIRED_MATERIALS,
      approvedWeatherTags: ["rainy"],
      parentConfirmedSafety: true,
    });
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    await expect(provider(fetchImpl).selectExperience({ activityContext: seededContext })).resolves.toEqual(kitchenSoundQuest);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("authors a validated activity for a live photo/typed context, passing object labels to the model", async () => {
    const liveContext = createApprovedActivityContext({
      materialSource: "photo",
      confirmedMaterials: [{ allowedMaterialCategory: "large_soft_ball", label: "soccer ball" }],
      approvedWeatherTags: ["rainy"],
      parentConfirmedSafety: true,
    });
    const fetchImpl = vi.fn(async () => responseFor(validGeneratedQuest)) as unknown as typeof fetch;
    await expect(provider(fetchImpl).selectExperience({ activityContext: liveContext })).resolves.toMatchObject({
      experienceMode: "guided_quest", ageStage: "3-4y", tool: { kind: "predict" },
    });
    const body = JSON.parse(String((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]?.body));
    expect(body.text.format.name).toBe("generated_activity");
    expect(body.store).toBe(false);
    expect(JSON.stringify(body)).toContain("soccer ball");
  });

  it("rejects a generated activity that is not a valid quest", async () => {
    const liveContext = createApprovedActivityContext({
      materialSource: "photo",
      confirmedMaterials: [{ allowedMaterialCategory: "large_soft_ball", label: "ball" }],
      approvedWeatherTags: ["rainy"],
      parentConfirmedSafety: true,
    });
    const fetchImpl = vi.fn(async () => responseFor({ templateId: "ball-roll-predictions" })) as unknown as typeof fetch;
    await expect(provider(fetchImpl).selectExperience({ activityContext: liveContext })).rejects.toBeInstanceOf(Error);
  });

  it("maps transport and provider response failures to closed errors", async () => {
    const privateCause = "raw private provider payload";
    const fetchImpl = vi.fn(async () => { throw new Error(privateCause); }) as unknown as typeof fetch;
    let caught: unknown;
    try {
      await provider(fetchImpl).selectExperience({ activityContext: context });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(RuntimeProviderFailure);
    expect(caught).toMatchObject({ code: "provider_unavailable" });
    expect(JSON.stringify(caught)).not.toContain(privateCause);
  });
});
