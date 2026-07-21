import { z } from "zod";

import { ActivityContextSchema, QuestSpecSchema, type ActivityContext, type AllowedMaterialCategory, type ExperienceSpec, type QuestSpec } from "../schemas";
import {
  createInfantNoticingMoment,
  createKindergartenNoticingQuest,
  createToddlerCoPlayMoment,
  isUnderThreeCategory,
} from "./age-band-fallbacks";
import {
  BALL_PREDICT_TEMPLATE_ID,
  ballPredictQuest,
  canUseBallPredictTemplate,
  parseBallPredictQuest,
} from "./ball-predict-quest";
import {
  KITCHEN_SOUND_REQUIRED_MATERIALS,
  kitchenSoundQuest,
  parseKitchenSoundQuest,
} from "./kitchen-sound-detectives";
import type { MaterialIntakeSource } from "./material-intake";

type ApprovedWeatherTags = NonNullable<ActivityContext["weather"]>["approvedTags"];

export const ApprovedQuestTemplateIdSchema = z.enum([
  "kitchen-sound-detectives",
  BALL_PREDICT_TEMPLATE_ID,
  "everyday-object-noticing",
  "infant-noticing-moment",
  "toddler-co-play-moment",
  "kindergarten-investigation",
]);
export type ApprovedQuestTemplateId = z.infer<typeof ApprovedQuestTemplateIdSchema>;

export const ApprovedQuestTemplateSelectionSchema = z.object({
  templateId: ApprovedQuestTemplateIdSchema,
}).strict();

function hasExactKitchenSoundKit(materials: readonly AllowedMaterialCategory[]): boolean {
  return materials.length === KITCHEN_SOUND_REQUIRED_MATERIALS.length &&
    new Set(materials).size === KITCHEN_SOUND_REQUIRED_MATERIALS.length &&
    KITCHEN_SOUND_REQUIRED_MATERIALS.every((material) => materials.includes(material));
}

export type ConfirmedMaterialInput = {
  allowedMaterialCategory: AllowedMaterialCategory;
  label?: string;
};

export function createApprovedActivityContext(input: {
  ageStage?: ActivityContext["ageStage"];
  materialSource: MaterialIntakeSource;
  confirmedMaterials: readonly ConfirmedMaterialInput[];
  approvedWeatherTags: ApprovedWeatherTags;
  weatherSource?: NonNullable<ActivityContext["weather"]>["source"];
  parentConfirmedSafety: boolean;
}): ActivityContext {
  return ActivityContextSchema.parse({
    ageStage: input.ageStage ?? "3-4y",
    materialSource: input.materialSource,
    confirmedMaterials: input.confirmedMaterials.map((material) => ({
      allowedMaterialCategory: material.allowedMaterialCategory,
      parentConfirmed: true,
      ...(material.label ? { label: material.label } : {}),
    })),
    weather: {
      source: input.weatherSource ?? "seeded_demo",
      approvedTags: [...input.approvedWeatherTags],
      parentApproved: true,
      preciseLocationStored: false,
    },
    availableMinutes: 8,
    setting: "indoors",
    parentConfirmedSafety: input.parentConfirmedSafety,
  });
}

export function availableApprovedQuestTemplateIds(context: ActivityContext): ApprovedQuestTemplateId[] {
  const materials = context.confirmedMaterials.map((item) => item.allowedMaterialCategory);
  if (!context.parentConfirmedSafety) return [];
  // Under-three bands render caregiver-led moments from the smaller allowlist
  // (the context parse already rejects non-under-three materials for them).
  if (context.ageStage === "0-12m") {
    return materials.every(isUnderThreeCategory) ? ["infant-noticing-moment"] : [];
  }
  if (context.ageStage === "12-36m") {
    return materials.every(isUnderThreeCategory) ? ["toddler-co-play-moment"] : [];
  }
  if (context.ageStage === "4-6y") {
    return context.availableMinutes >= 8 ? ["kindergarten-investigation"] : [];
  }
  if (hasExactKitchenSoundKit(materials)) {
    return ["kitchen-sound-detectives"];
  }
  if (canUseBallPredictTemplate(context)) return [BALL_PREDICT_TEMPLATE_ID];
  return context.setting === "indoors" && context.availableMinutes >= 8
    ? ["everyday-object-noticing"]
    : [];
}

const materialWords: Record<AllowedMaterialCategory, string> = {
  large_empty_plastic_container: "large empty container",
  wooden_kitchen_utensil: "wooden kitchen utensil",
  silicone_kitchen_utensil: "silicone kitchen utensil",
  soft_cloth: "soft cloth",
  paper_or_cardboard: "paper or cardboard piece",
  board_book: "board book",
  large_soft_ball: "large soft ball",
  large_natural_object: "large natural object",
  other_safe_object: "everyday object",
};

/**
 * Broad fallback for an approved but not bespoke material. Its text and tool are
 * local, reviewed UI; GPT can select its ID but cannot author the activity.
 */
function createEverydayObjectNoticingQuest(context: ActivityContext): QuestSpec {
  const materials = context.confirmedMaterials.map((item) => item.allowedMaterialCategory);
  const firstMaterial = materialWords[materials[0]];
  return QuestSpecSchema.parse({
    id: "everyday-object-noticing",
    title: `Notice our ${firstMaterial}`,
    experienceMode: "guided_quest",
    ageStage: "3-4y",
    developmentalFocusIds: ["DEV.COG.CAUSE_EFFECT", "DEV.LANG.DESCRIPTIVE_WORDS", "DEV.SOC.TURN_TAKING"],
    parentFacingGoal: `Use the parent-confirmed ${firstMaterial} for one short, grown-up-led noticing activity: predict, try, and describe what happens.`,
    materials,
    adultSafetyNote: "Stay within arm’s reach. Use only the parent-confirmed, intact, room-temperature items in a clear space; do not add new objects or change the item’s ordinary safe use.",
    stopIf: ["An item becomes damaged, loose, uncomfortable, or no longer feels safe.", "The play stops feeling calm or the grown-up cannot stay close."],
    steps: [
      { minute: 0, instruction: "Choose one parent-confirmed object. Ask what your child thinks they might notice first." },
      { minute: 2, instruction: "A grown-up helps try one gentle, ordinary action with the object in the clear play space." },
      { minute: 4, instruction: "Pause and name one detail together: how it feels, what it does, or where it ends up." },
      { minute: 6, instruction: "Switch turns: let your child point to a prediction and the grown-up helps with one more gentle try." },
    ],
    evidencePrompt: "What did your child point to, say, or notice about the object?",
    parentReflectionPrompt: "What did you notice during this object play? You can skip this step.",
    tool: {
      kind: "predict",
      title: "What will we notice?",
      prompt: "Choose one idea, then try one gentle grown-up-led action with the real object.",
      accessibilityHint: "Each large choice uses written words; choosing one records nothing.",
      question: "What might we notice first?",
      options: ["How it feels", "What it does", "Where it goes"],
    },
    fallbackMessage: "Choose one parent-confirmed object, make one gentle grown-up-led try, and name one thing you notice together.",
  });
}

export function canStartApprovedQuest(input: {
  confirmedObjects: readonly { id: string; category: AllowedMaterialCategory; label: string }[];
  candidateIds: readonly string[];
  approvedWeatherTags: ApprovedWeatherTags;
  parentApprovedWeather: boolean;
  parentConfirmedSafety: boolean;
  materialSource?: MaterialIntakeSource;
  ageStage?: ActivityContext["ageStage"];
}): boolean {
  if (!input.parentApprovedWeather || input.approvedWeatherTags.length < 1 || input.approvedWeatherTags.length > 4 || !input.parentConfirmedSafety) return false;
  if (input.confirmedObjects.length === 0 || input.candidateIds.length === 0) return false;
  const ids = input.confirmedObjects.map((object) => object.id);
  if (new Set(ids).size !== ids.length) return false;
  if (!ids.every((id) => input.candidateIds.includes(id))) return false;
  let context: ActivityContext;
  try {
    context = createApprovedActivityContext({
      ageStage: input.ageStage,
      materialSource: input.materialSource ?? "typed",
      confirmedMaterials: input.confirmedObjects.map((object) => ({
        allowedMaterialCategory: object.category,
        label: object.label,
      })),
      approvedWeatherTags: input.approvedWeatherTags,
      parentConfirmedSafety: input.parentConfirmedSafety,
    });
  } catch {
    // e.g. a material category that is not approved for an under-three band.
    return false;
  }
  // A reviewed fallback template must exist for this context so a failed live
  // generation is always recoverable; the live path still authors a fresh one.
  return availableApprovedQuestTemplateIds(context).length === 1;
}

export function resolveApprovedQuestTemplate(
  selection: unknown,
  context: ActivityContext,
): ExperienceSpec {
  const { templateId } = ApprovedQuestTemplateSelectionSchema.parse(selection);
  if (!availableApprovedQuestTemplateIds(context).includes(templateId)) {
    throw new Error("The selected reviewed template does not match the parent-approved context");
  }
  if (templateId === "kitchen-sound-detectives") return parseKitchenSoundQuest(kitchenSoundQuest, context);
  if (templateId === BALL_PREDICT_TEMPLATE_ID) return parseBallPredictQuest(ballPredictQuest, context);
  if (templateId === "infant-noticing-moment") return createInfantNoticingMoment(context);
  if (templateId === "toddler-co-play-moment") return createToddlerCoPlayMoment(context);
  if (templateId === "kindergarten-investigation") return createKindergartenNoticingQuest(context);
  return createEverydayObjectNoticingQuest(context);
}

export function deterministicApprovedQuestForContext(context: ActivityContext): ExperienceSpec {
  const [templateId] = availableApprovedQuestTemplateIds(context);
  if (!templateId) throw new Error("No reviewed activity template matches this parent-approved context");
  return resolveApprovedQuestTemplate({ templateId }, context);
}
