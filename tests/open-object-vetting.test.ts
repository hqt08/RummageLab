import { describe, expect, it } from "vitest";

import { AllowedMaterialCategorySchema } from "../src/lib/schemas";
import { PHOTO_INVENTORY_JSON_SCHEMA } from "../src/lib/runtime/openai-provider";
import {
  RuntimeProviderFailure,
  validateLivePhotoInventory,
} from "../src/lib/runtime/seeded-runtime";

type Item = {
  suggestedLabel: string;
  allowedMaterialCategory: string;
  safetyLevel: "ok" | "caution";
  warnings: string[];
  needsParentConfirmation: true;
};

function liveInventory(items: Item[]) {
  return {
    imageMode: "live" as const,
    objectOnlyReminder: true as const,
    suggestedItems: items,
    unsafeOrUncertainNotice: "A parent confirms every object before play.",
    requiresAdultSupervision: true as const,
  };
}

const rubberDuck: Item = {
  suggestedLabel: "Rubber duck",
  allowedMaterialCategory: "other_safe_object",
  safetyLevel: "caution",
  warnings: ["Keep it out of the mouth during play."],
  needsParentConfirmation: true,
};

describe("open object vetting", () => {
  it("accepts an open other_safe_object with a caution and warnings", () => {
    const result = validateLivePhotoInventory(liveInventory([rubberDuck]));
    expect(result.suggestedItems[0].allowedMaterialCategory).toBe("other_safe_object");
    expect(result.suggestedItems[0].safetyLevel).toBe("caution");
    expect(result.suggestedItems[0].warnings).toHaveLength(1);
  });

  it("allows several distinct open objects that share the open category", () => {
    const result = validateLivePhotoInventory(
      liveInventory([
        rubberDuck,
        { ...rubberDuck, suggestedLabel: "Plush bear", warnings: [] },
      ]),
    );
    expect(result.suggestedItems).toHaveLength(2);
  });

  it("drops a hard-denylisted label server-side but keeps safe siblings", () => {
    const result = validateLivePhotoInventory(
      liveInventory([
        rubberDuck,
        {
          suggestedLabel: "Glass jar",
          allowedMaterialCategory: "large_empty_plastic_container",
          safetyLevel: "ok",
          warnings: [],
          needsParentConfirmation: true,
        },
      ]),
    );
    expect(result.suggestedItems).toHaveLength(1);
    expect(result.suggestedItems[0].suggestedLabel).toBe("Rubber duck");
  });

  it("fails closed when every object is denylisted", () => {
    expect(() =>
      validateLivePhotoInventory(
        liveInventory([
          {
            suggestedLabel: "Kitchen knife",
            allowedMaterialCategory: "other_safe_object",
            safetyLevel: "caution",
            warnings: [],
            needsParentConfirmation: true,
          },
        ]),
      ),
    ).toThrow(RuntimeProviderFailure);
  });

  it("rejects duplicate labels as malformed", () => {
    expect(() =>
      validateLivePhotoInventory(liveInventory([rubberDuck, { ...rubberDuck }])),
    ).toThrow(RuntimeProviderFailure);
  });
});

describe("model-facing category enum", () => {
  it("is derived from the Zod source of truth and never hand-copied", () => {
    const jsonEnum =
      PHOTO_INVENTORY_JSON_SCHEMA.properties.suggestedItems.items.properties
        .allowedMaterialCategory.enum;
    expect([...jsonEnum]).toEqual([...AllowedMaterialCategorySchema.options]);
    expect(jsonEnum).toContain("other_safe_object");
  });
});
