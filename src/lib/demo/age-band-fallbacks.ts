import {
  QuestSpecSchema,
  RummageMomentSpecSchema,
  UnderThreeMaterialCategorySchema,
  type ActivityContext,
  type AllowedMaterialCategory,
  type QuestSpec,
  type RummageMomentSpec,
  type UnderThreeMaterialCategory,
} from "../schemas";

/**
 * Reviewed, locally authored fallback experiences for the age bands beyond the
 * 3–4 demo. Like the 3–4 generic fallback, each is built from the parent's own
 * confirmed context so the materials-subset re-validation always holds, and the
 * model can never author these — they are the safety net beneath live
 * generation and the deterministic result for the seeded prepared kit.
 */

const materialPhrases: Record<AllowedMaterialCategory, string> = {
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

export function isUnderThreeCategory(
  category: AllowedMaterialCategory,
): category is UnderThreeMaterialCategory {
  return UnderThreeMaterialCategorySchema.safeParse(category).success;
}

function underThreeMaterials(context: ActivityContext): UnderThreeMaterialCategory[] {
  return context.confirmedMaterials
    .map((item) => item.allowedMaterialCategory)
    .filter(isUnderThreeCategory);
}

/** Caregiver-narrated sensory moment for 0–12 months. No child screen use. */
export function createInfantNoticingMoment(context: ActivityContext): RummageMomentSpec {
  const materials = underThreeMaterials(context);
  const firstPhrase = materialPhrases[materials[0]];
  return RummageMomentSpecSchema.parse({
    id: "infant-noticing-moment",
    title: `Gentle noticing with our ${firstPhrase}`,
    ageStage: "0-12m",
    experienceMode: "caregiver_moment",
    developmentalFocusIds: ["DEV.ATL.CURIOSITY", "DEV.LANG.DESCRIPTIVE_WORDS"],
    parentFacingGoal: `Hold your baby close and narrate one gentle look-and-touch moment with the parent-confirmed ${firstPhrase}.`,
    adultSupervision: true,
    approvedMaterialCategories: materials,
    forbiddenMaterialCategories: [
      "small or detachable objects",
      "anything that fits in the mouth",
      "cords, strings, or bags",
    ],
    adultScript: [
      `Hold the ${firstPhrase} where your baby can see it and name it slowly.`,
      "Let your baby look, reach, or touch while you describe one texture word.",
      "Follow your baby's gaze; pause and repeat whatever they seem drawn to.",
      "End while it still feels calm; put the item away and cuddle.",
    ],
    stopIf: [
      "Your baby turns away, fusses, or seems overwhelmed.",
      "Any item becomes damaged or unsafe to mouth-level play.",
    ],
    parentObservationPrompt: "What did your baby look at, reach for, or react to?",
    fallbackMessage: "Hold one confirmed soft item near your baby, name it, and follow their gaze.",
  });
}

/** Grown-up-led co-play moment for 12–36 months. */
export function createToddlerCoPlayMoment(context: ActivityContext): RummageMomentSpec {
  const materials = underThreeMaterials(context);
  const firstPhrase = materialPhrases[materials[0]];
  return RummageMomentSpecSchema.parse({
    id: "toddler-co-play-moment",
    title: `Together play with our ${firstPhrase}`,
    ageStage: "12-36m",
    experienceMode: "co_play",
    developmentalFocusIds: [
      "DEV.ATL.CURIOSITY",
      "DEV.COG.CAUSE_EFFECT",
      "DEV.SOC.TURN_TAKING",
    ],
    parentFacingGoal: `Take short turns doing one simple action with the parent-confirmed ${firstPhrase} and name what happens together.`,
    adultSupervision: true,
    approvedMaterialCategories: materials,
    forbiddenMaterialCategories: [
      "small or detachable objects",
      "sharp, breakable, or heavy items",
    ],
    adultScript: [
      `Show one gentle action with the ${firstPhrase} — pat it, stack it, or peek under it — and name the action.`,
      "Offer a turn: \"your turn\" — and wait while your toddler tries any version of it.",
      "Copy whatever your toddler does and add one describing word.",
      "Trade one more turn each, then finish with a tidy-up together.",
    ],
    stopIf: [
      "The play stops feeling calm or turns into throwing.",
      "An item cracks, tears, or becomes small enough to mouth.",
    ],
    parentObservationPrompt: "What action, word, or turn did your toddler try?",
    fallbackMessage: "Take one gentle turn each with a confirmed item and name what happens.",
  });
}

/** Guided quest fallback for ages 5–6, built from the confirmed materials. */
export function createKindergartenNoticingQuest(context: ActivityContext): QuestSpec {
  const materials = context.confirmedMaterials.map((item) => item.allowedMaterialCategory);
  const firstPhrase = materialPhrases[materials[0]];
  return QuestSpecSchema.parse({
    id: "kindergarten-investigation",
    title: `Investigate our ${firstPhrase}`,
    experienceMode: "guided_quest",
    ageStage: "4-6y",
    developmentalFocusIds: [
      "DEV.COG.CAUSE_EFFECT",
      "DEV.LANG.DESCRIPTIVE_WORDS",
      "DEV.COG.PATTERN",
    ],
    parentFacingGoal: `Run one short prediction-test-explain investigation with the parent-confirmed ${firstPhrase}.`,
    materials,
    adultSafetyNote:
      "Stay nearby. Use only the parent-confirmed, intact items in a clear space and keep every test gentle and on the floor or table.",
    stopIf: [
      "An item becomes damaged or the test stops feeling safe.",
      "The play stops feeling calm or focused.",
    ],
    steps: [
      { minute: 0, instruction: "Ask for a prediction: what will happen when we try one gentle test with the object?" },
      { minute: 2, instruction: "Run the test together once, exactly as predicted or child-adjusted." },
      { minute: 4, instruction: "Compare the result with the prediction and let your child explain the difference." },
      { minute: 6, instruction: "Invite one changed variable — a different surface, height, or order — and test once more." },
    ],
    evidencePrompt: "What did your child predict, test, and explain in their own words?",
    parentReflectionPrompt: "What did you notice during the investigation? You can skip this step.",
    tool: {
      kind: "predict",
      title: "What will our test show?",
      prompt: "Choose a prediction, then run one gentle test with a grown-up nearby.",
      accessibilityHint: "Each large choice uses written words; choosing one records nothing.",
      question: "What do you think will happen?",
      options: ["What I predicted", "Something different", "Not sure yet"],
    },
    fallbackMessage: "Make one prediction, run one gentle test, and let your child explain what changed.",
  });
}
