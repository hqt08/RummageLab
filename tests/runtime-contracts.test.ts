import { describe, expect, it, vi } from "vitest";

import {
  KITCHEN_SOUND_REQUIRED_MATERIALS,
  createKitchenSoundActivityContext,
  kitchenSoundPhotoInventory,
  kitchenSoundQuest,
} from "../src/lib/demo/kitchen-sound-detectives";
import {
  ExperienceRequestSchema,
  PhotoInventoryRequestSchema,
  type ExperienceRuntimeProvider,
} from "../src/lib/runtime/contracts";
import {
  RuntimeProviderFailure,
  resolveExperience,
  resolvePhotoInventory,
  SeededKitchenSoundExperienceRequestSchema,
  SeededKitchenSoundPhotoInventoryRequestSchema,
  seededRuntimeProvider,
} from "../src/lib/runtime/seeded-runtime";

const validContext = createKitchenSoundActivityContext({
  confirmedMaterials: KITCHEN_SOUND_REQUIRED_MATERIALS,
  approvedWeatherTags: ["rainy"],
  parentConfirmedSafety: true,
});

const validExperienceRequest = {
  fixtureId: "kitchen-sound-detectives",
  activityContext: validContext,
} as const;
const validPhotoRequest = {
  mode: "seeded_demo",
  fixtureId: "kitchen-sound-detectives",
  ageStage: "3-4y",
  objectOnly: true,
} as const;

function providerWith(
  selectExperience: ExperienceRuntimeProvider["selectExperience"],
): ExperienceRuntimeProvider {
  return {
    getPhotoInventory: async () => kitchenSoundPhotoInventory,
    selectExperience,
  };
}

describe("server-safe runtime request contracts", () => {
  it("rejects raw upload fields and unexpected nested context content", () => {
    expect(
      PhotoInventoryRequestSchema.safeParse({
        ...validPhotoRequest,
        imageBytes: "private-photo-data",
      }).success,
    ).toBe(false);
    expect(
      ExperienceRequestSchema.safeParse({
        activityContext: {
          ...validContext,
          confirmedMaterials: validContext.confirmedMaterials.map((material) => ({
            ...material,
            rawTypedMaterials: ["private parent text"],
          })),
        },
      }).success,
    ).toBe(false);
    expect(
      ExperienceRequestSchema.safeParse({
        activityContext: {
          ...validContext,
          weather: { ...validContext.weather, rawWeatherQuery: "private" },
        },
      }).success,
    ).toBe(false);
  });

  it("limits automatic fallback to the reviewed Kitchen Sound fixture", () => {
    expect(
      SeededKitchenSoundExperienceRequestSchema.safeParse({
        ...validExperienceRequest,
        activityContext: { ...validContext, ageStage: "4-6y" },
      }).success,
    ).toBe(false);
    expect(
      SeededKitchenSoundPhotoInventoryRequestSchema.safeParse({
        ...validPhotoRequest,
        ageStage: "12-36m",
      }).success,
    ).toBe(false);
    expect(
      SeededKitchenSoundPhotoInventoryRequestSchema.safeParse({
        mode: "future_transient_object_upload",
        ageStage: "3-4y",
        objectOnly: true,
      }).success,
    ).toBe(false);
  });

  it("uses the deterministic provider without calling fetch", async () => {
    const fetchSpy = vi.fn();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchSpy;

    try {
      const [photo, experience] = await Promise.all([
        resolvePhotoInventory(validPhotoRequest, seededRuntimeProvider),
        resolveExperience(validExperienceRequest, seededRuntimeProvider),
      ]);
      expect(photo.runtime.source).toBe("seeded_provider");
      expect(experience.runtime.source).toBe("seeded_provider");
      expect(experience.experience).toEqual(kitchenSoundQuest);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("runtime fallback and no-content diagnostics", () => {
  it("falls back when a provider response is malformed", async () => {
    const result = await resolveExperience(
      validExperienceRequest,
      providerWith(async () => ({ unexpected: "provider payload" })),
    );

    expect(result.runtime).toEqual({
      source: "seeded_fallback",
      diagnostic: {
        operation: "experience_selection",
        code: "provider_malformed_response",
        fallbackUsed: true,
        retryable: true,
      },
    });
    expect(result.experience).toEqual(kitchenSoundQuest);
  });

  it("falls back when nested provider output includes unrecognized content", async () => {
    const result = await resolveExperience(
      validExperienceRequest,
      providerWith(async () => ({
        ...kitchenSoundQuest,
        tool: { ...kitchenSoundQuest.tool, unexpectedProviderData: "private" },
        steps: kitchenSoundQuest.steps.map((step) => ({
          ...step,
          unexpectedProviderData: "private",
        })),
      })),
    );

    expect(result.runtime.diagnostic?.code).toBe("provider_malformed_response");
  });

  it("falls back for mismatched age, materials, and time", async () => {
    const wrongAge = { ...kitchenSoundQuest, ageStage: "4-6y" };
    const wrongMaterial = {
      ...kitchenSoundQuest,
      materials: ["board_book"],
    };
    const overlong = {
      ...kitchenSoundQuest,
      steps: kitchenSoundQuest.steps.map((step, index) =>
        index === kitchenSoundQuest.steps.length - 1
          ? { ...step, minute: 15 }
          : step,
      ),
    };

    for (const output of [wrongAge, wrongMaterial, overlong]) {
      const result = await resolveExperience(
        validExperienceRequest,
        providerWith(async () => output),
      );
      expect(result.runtime.diagnostic?.code).toBe("provider_context_mismatch");
    }
  });

  it("maps timeout and unavailable failures to public, content-free diagnostics", async () => {
    const timeout = new Error("private provider response");
    timeout.name = "TimeoutError";
    const timeoutResult = await resolveExperience(
      validExperienceRequest,
      providerWith(async () => {
        throw timeout;
      }),
    );
    const unavailableResult = await resolveExperience(
      validExperienceRequest,
      providerWith(async () => {
        throw new RuntimeProviderFailure("provider_unavailable");
      }),
    );

    expect(timeoutResult.runtime.diagnostic?.code).toBe("provider_timeout");
    expect(unavailableResult.runtime.diagnostic?.code).toBe("provider_unavailable");
    expect(JSON.stringify(timeoutResult.runtime)).not.toContain("private provider response");
    expect(JSON.stringify(unavailableResult.runtime)).not.toContain("private provider response");
    expect(Object.keys(timeoutResult.runtime.diagnostic ?? {})).toEqual([
      "operation",
      "code",
      "fallbackUsed",
      "retryable",
    ]);
  });
});
