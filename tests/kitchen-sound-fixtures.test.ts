import { describe, expect, it } from "vitest";

import {
  ActivityContextSchema,
  MaterialInputSchema,
  ParentObservationSuggestionSchema,
  PhotoInventorySchema,
  QuestSpecSchema,
} from "../src/lib/schemas";
import {
  KITCHEN_SOUND_REQUIRED_MATERIALS,
  buildReviewedObservationSuggestion,
  createKitchenSoundActivityContext,
  createKitchenSoundNextSuggestion,
  kitchenSoundActivityContext,
  kitchenSoundMaterialInput,
  kitchenSoundObservationFixture,
  kitchenSoundPhotoInventory,
  kitchenSoundQuest,
  parseKitchenSoundQuest,
  parseParentApprovedNextActivityContext,
} from "../src/lib/demo/kitchen-sound-detectives";

describe("Kitchen Sound Detectives seeded fixtures", () => {
  it("parses every seeded boundary through its existing contract", () => {
    expect(MaterialInputSchema.parse(kitchenSoundMaterialInput)).toEqual(
      kitchenSoundMaterialInput,
    );
    expect(PhotoInventorySchema.parse(kitchenSoundPhotoInventory)).toEqual(
      kitchenSoundPhotoInventory,
    );
    expect(ActivityContextSchema.parse(kitchenSoundActivityContext)).toEqual(
      kitchenSoundActivityContext,
    );
    expect(QuestSpecSchema.parse(kitchenSoundQuest)).toEqual(kitchenSoundQuest);
    expect(
      ParentObservationSuggestionSchema.parse(
        kitchenSoundObservationFixture.unapprovedTemplate,
      ),
    ).toEqual(kitchenSoundObservationFixture.unapprovedTemplate);
    expect(kitchenSoundObservationFixture).toMatchObject({
      mode: "seeded_demo",
      requiresParentAdoption: true,
    });
  });

  it("keeps the object-only photo and confirmed context on the same exact material kit", () => {
    expect(kitchenSoundPhotoInventory.imageMode).toBe("seeded_demo");
    expect(kitchenSoundPhotoInventory.objectOnlyReminder).toBe(true);
    expect(
      kitchenSoundPhotoInventory.suggestedItems.map(
        (item) => item.allowedMaterialCategory,
      ),
    ).toEqual(KITCHEN_SOUND_REQUIRED_MATERIALS);
    expect(
      kitchenSoundActivityContext.confirmedMaterials.map(
        (item) => item.allowedMaterialCategory,
      ),
    ).toEqual(KITCHEN_SOUND_REQUIRED_MATERIALS);
  });

  it("keeps the public demo city outside every structured boundary", () => {
    const structuredBoundaries = JSON.stringify({
      material: kitchenSoundMaterialInput,
      inventory: kitchenSoundPhotoInventory,
      activity: kitchenSoundActivityContext,
      quest: kitchenSoundQuest,
      observation: kitchenSoundObservationFixture,
    });

    expect(structuredBoundaries).not.toContain("Anchorage");
    expect(structuredBoundaries).not.toContain("latitude");
    expect(structuredBoundaries).not.toContain("longitude");
  });

  it("requires all three materials and explicit safety confirmation", () => {
    expect(() =>
      createKitchenSoundActivityContext({
        confirmedMaterials: KITCHEN_SOUND_REQUIRED_MATERIALS.slice(0, 2),
        approvedWeatherTags: ["rainy"],
        parentConfirmedSafety: true,
      }),
    ).toThrow(/three Kitchen Sound Detectives material categories/);

    expect(() =>
      createKitchenSoundActivityContext({
        confirmedMaterials: [
          ...KITCHEN_SOUND_REQUIRED_MATERIALS,
          KITCHEN_SOUND_REQUIRED_MATERIALS[0],
        ],
        approvedWeatherTags: ["rainy"],
        parentConfirmedSafety: true,
      }),
    ).toThrow(/three Kitchen Sound Detectives material categories/);

    expect(() =>
      createKitchenSoundActivityContext({
        confirmedMaterials: KITCHEN_SOUND_REQUIRED_MATERIALS,
        approvedWeatherTags: ["rainy"],
        parentConfirmedSafety: false,
      }),
    ).toThrow();
  });
});

describe("Kitchen Sound Detectives quest guard", () => {
  it("accepts only the narrowed sound_mix quest with allowlisted focuses", () => {
    expect(kitchenSoundQuest.tool.kind).toBe("sound_mix");
    expect(
      parseKitchenSoundQuest(kitchenSoundQuest, kitchenSoundActivityContext),
    ).toEqual(kitchenSoundQuest);

    expect(() =>
      parseKitchenSoundQuest(
        {
          ...kitchenSoundQuest,
          developmentalFocusIds: ["DEV.UNREVIEWED.SCORE"],
        },
        kitchenSoundActivityContext,
      ),
    ).toThrow(/Unapproved developmental focus/);

    expect(() =>
      parseKitchenSoundQuest(
        {
          ...kitchenSoundQuest,
          tool: {
            kind: "predict",
            title: "Prediction",
            prompt: "Pick one.",
            accessibilityHint: "Choices use text labels.",
            question: "Which sound?",
            options: ["One", "Two"],
          },
        },
        kitchenSoundActivityContext,
      ),
    ).toThrow(/only the approved sound_mix tool/);
  });

  it("rejects quest materials that were not parent-confirmed", () => {
    const partialContext = ActivityContextSchema.parse({
      ...kitchenSoundActivityContext,
      confirmedMaterials: kitchenSoundActivityContext.confirmedMaterials.slice(
        0,
        2,
      ),
    });

    expect(() =>
      parseKitchenSoundQuest(kitchenSoundQuest, partialContext),
    ).toThrow(/not parent-confirmed/);
  });
});

describe("parent-approved next activity boundary", () => {
  it("returns one deterministic suggestion from allowlisted tags alone", () => {
    const editedObservation = buildReviewedObservationSuggestion({
      parentSummary:
        "The parent changed this session-only wording before approving the tags.",
      interestTags: ["sound_play", "two_beat_pattern"],
      supportTags: ["turn_taking"],
    });

    const reviewedSeededTemplate = buildReviewedObservationSuggestion({
      parentSummary:
        kitchenSoundObservationFixture.unapprovedTemplate.parentSummary,
      interestTags: ["sound_play", "two_beat_pattern"],
      supportTags: ["turn_taking"],
    });
    const fromSeededSummary = createKitchenSoundNextSuggestion(
      reviewedSeededTemplate.nextActivityContext,
    );
    const fromEditedSummary = createKitchenSoundNextSuggestion(
      editedObservation.nextActivityContext,
    );

    expect(fromEditedSummary).toEqual(fromSeededSummary);
    expect(fromEditedSummary).not.toHaveProperty("parentSummary");
    expect(fromEditedSummary.basedOnTags).toEqual({
      interestTags: ["sound_play", "two_beat_pattern"],
      supportTags: ["turn_taking"],
    });
  });

  it("rejects empty, duplicate, overlapping, and non-allowlisted tags", () => {
    const baseContext = buildReviewedObservationSuggestion({
      parentSummary: "Parent-reviewed demo wording.",
      interestTags: ["sound_play", "two_beat_pattern"],
      supportTags: ["turn_taking"],
    }).nextActivityContext;

    expect(() =>
      parseParentApprovedNextActivityContext({
        ...baseContext,
        interestTags: [],
      }),
    ).toThrow(/at least one interest tag/);

    expect(() =>
      parseParentApprovedNextActivityContext({
        ...baseContext,
        interestTags: ["sound_play", "sound_play"],
      }),
    ).toThrow(/must not contain duplicates/);

    expect(() =>
      parseParentApprovedNextActivityContext({
        ...baseContext,
        supportTags: ["sound_play"],
      }),
    ).toThrow(/cannot be both/);

    expect(() =>
      parseParentApprovedNextActivityContext({
        ...baseContext,
        interestTags: ["diagnosis_label"],
      }),
    ).toThrow();
  });
});
