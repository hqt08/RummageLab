import { describe, expect, it } from "vitest";

import {
  availableApprovedQuestTemplateIds,
  createApprovedActivityContext,
  deterministicApprovedQuestForContext,
  resolveApprovedQuestTemplate,
} from "../src/lib/demo/approved-quest-templates";
import { KITCHEN_SOUND_REQUIRED_MATERIALS } from "../src/lib/demo/kitchen-sound-detectives";
import type { AllowedMaterialCategory } from "../src/lib/schemas";

function context(categories: readonly AllowedMaterialCategory[]) {
  return createApprovedActivityContext({
    materialSource: "photo",
    confirmedMaterials: categories.map((allowedMaterialCategory) => ({
      allowedMaterialCategory,
    })),
    approvedWeatherTags: ["rainy"],
    parentConfirmedSafety: true,
  });
}

describe("reviewed activity template dispatch", () => {
  it("preserves Kitchen Sound Detectives for its exact confirmed kit", () => {
    const approved = context(KITCHEN_SOUND_REQUIRED_MATERIALS);
    expect(availableApprovedQuestTemplateIds(approved)).toEqual(["kitchen-sound-detectives"]);
    expect(resolveApprovedQuestTemplate({ templateId: "kitchen-sound-detectives" }, approved).id).toBe("kitchen-sound-detectives");
    expect(() => resolveApprovedQuestTemplate({ templateId: "ball-roll-predictions" }, approved)).toThrow(/does not match/);
  });

  it("allows the prebuilt predict quest only for a parent-confirmed large soft ball", () => {
    const approved = context(["large_soft_ball"]);
    expect(availableApprovedQuestTemplateIds(approved)).toEqual(["ball-roll-predictions"]);
    const quest = resolveApprovedQuestTemplate({ templateId: "ball-roll-predictions" }, approved);
    expect(quest).toMatchObject({ tool: { kind: "predict" }, materials: ["large_soft_ball"] });
    expect(() => resolveApprovedQuestTemplate({ templateId: "everyday-object-noticing" }, approved)).toThrow(/does not match/);
  });

  it("uses a local reviewed generic fallback for another parent-confirmed category", () => {
    const approved = context(["board_book"]);
    expect(availableApprovedQuestTemplateIds(approved)).toEqual(["everyday-object-noticing"]);
    const quest = deterministicApprovedQuestForContext(approved);
    expect(quest).toMatchObject({ id: "everyday-object-noticing", materials: ["board_book"], tool: { kind: "predict" } });
    expect(quest.parentFacingGoal).toContain("board book");
  });
});
