import { describe, expect, it, vi } from "vitest";

import {
  KITCHEN_SOUND_REQUIRED_MATERIALS,
  createKitchenSoundActivityContext,
  kitchenSoundPhotoInventory,
  kitchenSoundQuest,
} from "../src/lib/demo/kitchen-sound-detectives";
import { RuntimeProviderFailure } from "../src/lib/runtime/seeded-runtime";
import { createOpenAIExperienceProvider } from "../src/lib/runtime/openai-provider";

const context = createKitchenSoundActivityContext({
  materialSource: "photo",
  confirmedMaterials: KITCHEN_SOUND_REQUIRED_MATERIALS,
  approvedWeatherTags: ["rainy"],
  parentConfirmedSafety: true,
});

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

  it("validates an experience against the parent-approved context", async () => {
    const fetchImpl = vi.fn(async () => responseFor(kitchenSoundQuest)) as unknown as typeof fetch;
    await expect(provider(fetchImpl).selectExperience({ activityContext: context })).resolves.toEqual(kitchenSoundQuest);

    const unsafe = { ...kitchenSoundQuest, materials: ["board_book"] };
    const unsafeFetch = vi.fn(async () => responseFor(unsafe)) as unknown as typeof fetch;
    await expect(provider(unsafeFetch).selectExperience({ activityContext: context })).rejects.toThrow(/not parent-confirmed/);
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
