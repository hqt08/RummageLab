import type { z } from "zod";

import { findLearningFocus } from "../data/learning-focuses";
import {
  ActivityContextSchema,
  MaterialInputSchema,
  NextActivityContextSchema,
  ObservationTagSchema,
  ParentObservationSuggestionSchema,
  PhotoInventorySchema,
  QuestSpecSchema,
  WeatherTagSchema,
  type ActivityContext,
  type AllowedMaterialCategory,
  type NextActivityContext,
  type ParentObservationSuggestion,
  type QuestSpec,
  type RummageToolSpec,
} from "../schemas";

export const KITCHEN_SOUND_DEMO_ID = "kitchen-sound-detectives" as const;
export const KITCHEN_SOUND_DEMO_LOCATION_LABEL = "Anchorage, Alaska" as const;

export const KITCHEN_SOUND_REQUIRED_MATERIALS = [
  "large_empty_plastic_container",
  "wooden_kitchen_utensil",
  "soft_cloth",
] as const satisfies readonly AllowedMaterialCategory[];

export type DemoWeatherTag = z.infer<typeof WeatherTagSchema>;
export type DemoObservationTag = z.infer<typeof ObservationTagSchema>;

export const KITCHEN_SOUND_SUGGESTED_WEATHER_TAGS = [
  "rainy",
  "cold",
] as const satisfies readonly DemoWeatherTag[];

export const KITCHEN_SOUND_AVAILABLE_WEATHER_TAGS = [
  "sunny",
  "cloudy",
  "rainy",
  "snowy",
  "windy",
  "hot",
  "cold",
  "unknown",
] as const satisfies readonly DemoWeatherTag[];

export const kitchenSoundMaterialInput = MaterialInputSchema.parse({
  source: "seeded_demo",
  fixtureId: KITCHEN_SOUND_DEMO_ID,
});

export const kitchenSoundPhotoInventory = PhotoInventorySchema.parse({
  imageMode: "seeded_demo",
  objectOnlyReminder: true,
  suggestedItems: [
    {
      suggestedLabel: "Two empty plastic containers",
      allowedMaterialCategory: "large_empty_plastic_container",
      needsParentConfirmation: true,
    },
    {
      suggestedLabel: "Wooden spoon",
      allowedMaterialCategory: "wooden_kitchen_utensil",
      needsParentConfirmation: true,
    },
    {
      suggestedLabel: "Clean, folded dish towel",
      allowedMaterialCategory: "soft_cloth",
      needsParentConfirmation: true,
    },
  ],
  unsafeOrUncertainNotice:
    "A parent must confirm that every item is intact, room-temperature, and safe before play.",
  requiresAdultSupervision: true,
});

function hasExactlyRequiredMaterials(
  materials: readonly AllowedMaterialCategory[],
): boolean {
  const selected = new Set(materials);

  return (
    materials.length === KITCHEN_SOUND_REQUIRED_MATERIALS.length &&
    selected.size === KITCHEN_SOUND_REQUIRED_MATERIALS.length &&
    KITCHEN_SOUND_REQUIRED_MATERIALS.every((material) => selected.has(material))
  );
}

function assertExactlyRequiredMaterials(
  materials: readonly AllowedMaterialCategory[],
  boundary: string,
): void {
  if (!hasExactlyRequiredMaterials(materials)) {
    throw new Error(`${boundary} must contain the three Kitchen Sound Detectives material categories`);
  }
}

assertExactlyRequiredMaterials(
  kitchenSoundPhotoInventory.suggestedItems.map(
    (item) => item.allowedMaterialCategory,
  ),
  "Seeded photo inventory",
);

export type KitchenSoundContextSelection = {
  materialSource?: ActivityContext["materialSource"];
  confirmedMaterials: readonly AllowedMaterialCategory[];
  approvedWeatherTags: readonly DemoWeatherTag[];
  parentConfirmedSafety: boolean;
};

export function createKitchenSoundActivityContext(
  selection: KitchenSoundContextSelection,
): ActivityContext {
  assertExactlyRequiredMaterials(
    selection.confirmedMaterials,
    "Confirmed activity context",
  );

  return ActivityContextSchema.parse({
    ageStage: "3-4y",
    materialSource: selection.materialSource ?? "seeded_demo",
    confirmedMaterials: selection.confirmedMaterials.map(
      (allowedMaterialCategory) => ({
        allowedMaterialCategory,
        parentConfirmed: true,
      }),
    ),
    weather: {
      source: "seeded_demo",
      approvedTags: [...selection.approvedWeatherTags],
      parentApproved: true,
      preciseLocationStored: false,
    },
    availableMinutes: 8,
    setting: "indoors",
    parentConfirmedSafety: selection.parentConfirmedSafety,
  });
}

export const kitchenSoundActivityContext = createKitchenSoundActivityContext({
  confirmedMaterials: KITCHEN_SOUND_REQUIRED_MATERIALS,
  approvedWeatherTags: KITCHEN_SOUND_SUGGESTED_WEATHER_TAGS,
  parentConfirmedSafety: true,
});

const rawKitchenSoundQuest = {
  id: KITCHEN_SOUND_DEMO_ID,
  title: "Kitchen Sound Detectives",
  experienceMode: "guided_quest",
  ageStage: "3-4y",
  developmentalFocusIds: [
    "DEV.LANG.DESCRIPTIVE_WORDS",
    "DEV.COG.CAUSE_EFFECT",
    "DEV.COG.PATTERN",
    "DEV.SOC.TURN_TAKING",
  ],
  parentFacingGoal:
    "Compare gentle kitchen sounds, copy a short pattern, and practice taking turns together.",
  materials: [...KITCHEN_SOUND_REQUIRED_MATERIALS],
  adultSafetyNote:
    "Stay within arm's reach. Use only intact, empty, room-temperature items and tap gently on a stable surface.",
  stopIf: [
    "An item cracks, splinters, or becomes loose.",
    "The sound feels uncomfortable or play stops feeling calm.",
  ],
  steps: [
    {
      minute: 0,
      instruction:
        "Predict together: which material might sound boomy, quiet, or scratchy?",
    },
    {
      minute: 2,
      instruction:
        "Tap each parent-confirmed material gently and choose a sound word.",
    },
    {
      minute: 5,
      instruction:
        "Make a two-beat pattern, pause, and invite your child to copy it before switching roles.",
    },
    {
      minute: 7,
      instruction:
        "Build a tiny sound story together: rain, thunder, then quiet.",
    },
  ],
  evidencePrompt:
    "What sound word, comparison, pattern, or turn did your child choose?",
  parentReflectionPrompt:
    "What did you notice during the sound play? You can skip this step.",
  tool: {
    kind: "sound_mix",
    title: "Sound story mixer",
    prompt: "Choose a sound card, make it together, then pause for the next turn.",
    accessibilityHint:
      "Each large control has a written sound label; no audio or color-only cue is required.",
    soundLabels: ["Rain taps", "Boomy thunder", "Quiet hush"],
  },
  fallbackMessage:
    "Use the picture prompts in order—rain taps, boomy thunder, quiet hush—and take turns leading.",
};

export type SoundMixToolSpec = Extract<
  RummageToolSpec,
  { kind: "sound_mix" }
>;

export type KitchenSoundQuest = QuestSpec & {
  ageStage: "3-4y";
  tool: SoundMixToolSpec;
};

export function parseKitchenSoundQuest(
  input: unknown,
  activityContext: ActivityContext,
): KitchenSoundQuest {
  const quest = QuestSpecSchema.parse(input);

  if (quest.id !== KITCHEN_SOUND_DEMO_ID || quest.ageStage !== "3-4y") {
    throw new Error("Kitchen Sound Detectives must remain the seeded 3–4 year quest");
  }

  if (quest.ageStage !== activityContext.ageStage) {
    throw new Error("Quest age stage must match the parent-approved activity context");
  }

  if (quest.tool.kind !== "sound_mix") {
    throw new Error("Kitchen Sound Detectives may render only the approved sound_mix tool");
  }

  const unapprovedFocus = quest.developmentalFocusIds.find(
    (id) => findLearningFocus(id) === undefined,
  );

  if (unapprovedFocus) {
    throw new Error(`Unapproved developmental focus: ${unapprovedFocus}`);
  }

  const uniqueQuestMaterials = new Set(quest.materials);
  if (uniqueQuestMaterials.size !== quest.materials.length) {
    throw new Error("Quest materials must not contain duplicate categories");
  }

  const confirmedMaterials = new Set(
    activityContext.confirmedMaterials.map(
      (material) => material.allowedMaterialCategory,
    ),
  );
  const unconfirmedMaterial = quest.materials.find(
    (material) => !confirmedMaterials.has(material),
  );

  if (unconfirmedMaterial) {
    throw new Error(`Quest material was not parent-confirmed: ${unconfirmedMaterial}`);
  }

  if (quest.steps.some((step) => step.minute > activityContext.availableMinutes)) {
    throw new Error("Quest steps must fit inside the parent-approved time window");
  }

  return quest as KitchenSoundQuest;
}

export const kitchenSoundQuest = parseKitchenSoundQuest(
  rawKitchenSoundQuest,
  kitchenSoundActivityContext,
);

const parsedKitchenSoundObservationTemplate =
  ParentObservationSuggestionSchema.parse({
    source: "parent_reported",
    observedEvents: [
      "Copied a two-tap pattern.",
      "Chose “boomy” to describe a container sound.",
      "Needed a reminder while waiting for the next turn.",
    ],
    parentSummary:
      "They copied two taps, chose “boomy,” and needed a little help waiting for the next turn.",
    nextActivityContext: {
      source: "parent_approved",
      interestTags: ["sound_play", "two_beat_pattern"],
      supportTags: ["turn_taking"],
      useFor: "next_activity_only",
      expires: "end_of_demo_session",
      parentEditable: true,
    },
    ephemeralOnly: true,
    requiresParentReview: true,
    notAnAssessment: true,
  });

/**
 * Local fixture metadata prevents the contract-shaped preview from being
 * mistaken for an already parent-reported or parent-approved observation.
 * The nested suggestion is a template only; the reducer creates an authorized
 * contract value after the parent explicitly reviews the draft and tags.
 */
export const kitchenSoundObservationFixture = {
  mode: "seeded_demo",
  requiresParentAdoption: true,
  unapprovedTemplate: parsedKitchenSoundObservationTemplate,
} as const;

export function parseParentApprovedNextActivityContext(
  input: unknown,
): NextActivityContext {
  const context = NextActivityContextSchema.parse(input);

  if (context.interestTags.length === 0) {
    throw new Error("Choose at least one interest tag before creating a next activity");
  }

  const uniqueInterestTags = new Set(context.interestTags);
  const uniqueSupportTags = new Set(context.supportTags);
  if (
    uniqueInterestTags.size !== context.interestTags.length ||
    uniqueSupportTags.size !== context.supportTags.length
  ) {
    throw new Error("Next-activity tags must not contain duplicates");
  }

  const overlappingTag = context.interestTags.find((tag) =>
    uniqueSupportTags.has(tag),
  );
  if (overlappingTag) {
    throw new Error(`A tag cannot be both an interest and support tag: ${overlappingTag}`);
  }

  return context;
}

export type KitchenSoundNextSuggestion = {
  id: "pass-the-sound";
  title: string;
  durationMinutes: 5;
  invitation: string;
  connection: string;
  basedOnTags: {
    interestTags: DemoObservationTag[];
    supportTags: DemoObservationTag[];
  };
};

/**
 * Returns one app-authored suggestion from the approved tag contract alone.
 * Observation prose, location, weather, and interaction history cannot enter.
 */
export function createKitchenSoundNextSuggestion(
  input: unknown,
): KitchenSoundNextSuggestion {
  const context = parseParentApprovedNextActivityContext(input);
  const followsPattern = context.interestTags.includes("two_beat_pattern");
  const supportsTurns = context.supportTags.includes("turn_taking");

  return {
    id: "pass-the-sound",
    title: followsPattern ? "Pass-the-Pattern Picnic" : "Pass-the-Sound Picnic",
    durationMinutes: 5,
    invitation: followsPattern
      ? "Tap a two-beat pattern on one safe container, pass the spoon, and invite the next person to copy it."
      : "Choose one gentle kitchen sound, pass the spoon, and invite the next person to answer with a different sound.",
    connection: supportsTurns
      ? "Keeps the sound play while making the pause-and-pass turn cue extra clear."
      : "Keeps the sound play short and gives each person one clear sound-making turn.",
    basedOnTags: {
      interestTags: [...context.interestTags],
      supportTags: [...context.supportTags],
    },
  };
}

export function buildReviewedObservationSuggestion(input: {
  observedEvents?: readonly string[];
  parentSummary: string;
  interestTags: readonly DemoObservationTag[];
  supportTags: readonly DemoObservationTag[];
}): ParentObservationSuggestion {
  const nextActivityContext = parseParentApprovedNextActivityContext({
    source: "parent_approved",
    interestTags: [...input.interestTags],
    supportTags: [...input.supportTags],
    useFor: "next_activity_only",
    expires: "end_of_demo_session",
    parentEditable: true,
  });

  return ParentObservationSuggestionSchema.parse({
    ...kitchenSoundObservationFixture.unapprovedTemplate,
    observedEvents: input.observedEvents
      ? [...input.observedEvents]
      : kitchenSoundObservationFixture.unapprovedTemplate.observedEvents,
    parentSummary: input.parentSummary,
    nextActivityContext,
  });
}
