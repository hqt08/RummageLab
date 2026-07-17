import type {
  ActivityContext,
  AllowedMaterialCategory,
  NextActivityContext,
  ParentObservationSuggestion,
} from "../schemas";
import {
  KITCHEN_SOUND_REQUIRED_MATERIALS,
  KITCHEN_SOUND_SUGGESTED_WEATHER_TAGS,
  buildReviewedObservationSuggestion,
  createKitchenSoundActivityContext,
  createKitchenSoundNextSuggestion,
  kitchenSoundObservationSuggestion,
  type DemoObservationTag,
  type DemoWeatherTag,
  type KitchenSoundNextSuggestion,
} from "./kitchen-sound-detectives";

export type KitchenSoundDemoPhase =
  | "kit_review"
  | "quest"
  | "reflection"
  | "observation_review"
  | "next_suggestion"
  | "complete";

export type ObservationDraft = {
  parentSummary: string;
  interestTags: DemoObservationTag[];
  supportTags: DemoObservationTag[];
};

export type KitchenSoundDemoState = {
  phase: KitchenSoundDemoPhase;
  confirmedMaterials: AllowedMaterialCategory[];
  selectedWeatherTags: DemoWeatherTag[];
  parentApprovedWeather: boolean;
  parentConfirmedSafety: boolean;
  activityContext: ActivityContext | null;
  reflectionSkipped: boolean;
  observationDraft: ObservationDraft | null;
  reviewedObservation: ParentObservationSuggestion | null;
  approvedNextActivityContext: NextActivityContext | null;
  nextSuggestion: KitchenSoundNextSuggestion | null;
};

export type KitchenSoundDemoAction =
  | {
      type: "TOGGLE_MATERIAL";
      material: AllowedMaterialCategory;
    }
  | {
      type: "TOGGLE_WEATHER_TAG";
      tag: DemoWeatherTag;
    }
  | {
      type: "SET_WEATHER_APPROVED";
      approved: boolean;
    }
  | {
      type: "SET_SAFETY_CONFIRMED";
      confirmed: boolean;
    }
  | { type: "START_QUEST" }
  | { type: "FINISH_QUEST" }
  | { type: "SKIP_REFLECTION" }
  | { type: "REVIEW_SEEDED_OBSERVATION" }
  | {
      type: "EDIT_OBSERVATION_SUMMARY";
      parentSummary: string;
    }
  | {
      type: "TOGGLE_INTEREST_TAG";
      tag: DemoObservationTag;
    }
  | {
      type: "TOGGLE_SUPPORT_TAG";
      tag: DemoObservationTag;
    }
  | { type: "CREATE_NEXT_SUGGESTION" }
  | { type: "RESET" };

export function createInitialKitchenSoundDemoState(): KitchenSoundDemoState {
  return {
    phase: "kit_review",
    confirmedMaterials: [],
    selectedWeatherTags: [...KITCHEN_SOUND_SUGGESTED_WEATHER_TAGS],
    parentApprovedWeather: false,
    parentConfirmedSafety: false,
    activityContext: null,
    reflectionSkipped: false,
    observationDraft: null,
    reviewedObservation: null,
    approvedNextActivityContext: null,
    nextSuggestion: null,
  };
}

function toggleValue<T>(values: readonly T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((candidate) => candidate !== value)
    : [...values, value];
}

function hasExactMaterialKit(
  materials: readonly AllowedMaterialCategory[],
): boolean {
  const selected = new Set(materials);

  return (
    selected.size === KITCHEN_SOUND_REQUIRED_MATERIALS.length &&
    KITCHEN_SOUND_REQUIRED_MATERIALS.every((material) => selected.has(material))
  );
}

export function canStartKitchenSoundQuest(
  state: KitchenSoundDemoState,
): boolean {
  return (
    state.phase === "kit_review" &&
    hasExactMaterialKit(state.confirmedMaterials) &&
    state.selectedWeatherTags.length >= 1 &&
    state.selectedWeatherTags.length <= 4 &&
    state.parentApprovedWeather &&
    state.parentConfirmedSafety
  );
}

function makeObservationDraft(): ObservationDraft {
  return {
    parentSummary: kitchenSoundObservationSuggestion.parentSummary,
    interestTags: [
      ...kitchenSoundObservationSuggestion.nextActivityContext.interestTags,
    ],
    supportTags: [
      ...kitchenSoundObservationSuggestion.nextActivityContext.supportTags,
    ],
  };
}

function tryBuildReviewedObservation(
  state: KitchenSoundDemoState,
): ParentObservationSuggestion | null {
  if (state.phase !== "observation_review" || !state.observationDraft) {
    return null;
  }

  try {
    return buildReviewedObservationSuggestion(state.observationDraft);
  } catch {
    return null;
  }
}

export function canCreateKitchenSoundNextSuggestion(
  state: KitchenSoundDemoState,
): boolean {
  return tryBuildReviewedObservation(state) !== null;
}

function toggleObservationTag(
  values: readonly DemoObservationTag[],
  tag: DemoObservationTag,
  maximum: number,
): DemoObservationTag[] {
  if (values.includes(tag)) {
    return values.filter((candidate) => candidate !== tag);
  }

  return values.length >= maximum ? [...values] : [...values, tag];
}

export function kitchenSoundDemoReducer(
  state: KitchenSoundDemoState,
  action: KitchenSoundDemoAction,
): KitchenSoundDemoState {
  if (action.type === "RESET") {
    return createInitialKitchenSoundDemoState();
  }

  switch (action.type) {
    case "TOGGLE_MATERIAL": {
      if (
        state.phase !== "kit_review" ||
        !KITCHEN_SOUND_REQUIRED_MATERIALS.some(
          (material) => material === action.material,
        )
      ) {
        return state;
      }

      return {
        ...state,
        confirmedMaterials: toggleValue(
          state.confirmedMaterials,
          action.material,
        ),
      };
    }

    case "TOGGLE_WEATHER_TAG": {
      if (state.phase !== "kit_review") {
        return state;
      }

      const selectedWeatherTags = toggleValue(
        state.selectedWeatherTags,
        action.tag,
      );
      if (selectedWeatherTags.length > 4) {
        return state;
      }

      return {
        ...state,
        selectedWeatherTags,
        parentApprovedWeather: false,
      };
    }

    case "SET_WEATHER_APPROVED":
      if (
        state.phase !== "kit_review" ||
        (action.approved && state.selectedWeatherTags.length === 0)
      ) {
        return state;
      }

      return { ...state, parentApprovedWeather: action.approved };

    case "SET_SAFETY_CONFIRMED":
      return state.phase === "kit_review"
        ? { ...state, parentConfirmedSafety: action.confirmed }
        : state;

    case "START_QUEST": {
      if (!canStartKitchenSoundQuest(state)) {
        return state;
      }

      const activityContext = createKitchenSoundActivityContext({
        confirmedMaterials: state.confirmedMaterials,
        approvedWeatherTags: state.selectedWeatherTags,
        parentConfirmedSafety: state.parentConfirmedSafety,
      });

      return {
        ...state,
        phase: "quest",
        activityContext,
      };
    }

    case "FINISH_QUEST":
      return state.phase === "quest"
        ? { ...state, phase: "reflection" }
        : state;

    case "SKIP_REFLECTION":
      return state.phase === "reflection"
        ? {
            ...state,
            phase: "complete",
            reflectionSkipped: true,
            observationDraft: null,
            reviewedObservation: null,
            approvedNextActivityContext: null,
            nextSuggestion: null,
          }
        : state;

    case "REVIEW_SEEDED_OBSERVATION":
      return state.phase === "reflection"
        ? {
            ...state,
            phase: "observation_review",
            reflectionSkipped: false,
            observationDraft: makeObservationDraft(),
          }
        : state;

    case "EDIT_OBSERVATION_SUMMARY":
      return state.phase === "observation_review" && state.observationDraft
        ? {
            ...state,
            observationDraft: {
              ...state.observationDraft,
              parentSummary: action.parentSummary,
            },
          }
        : state;

    case "TOGGLE_INTEREST_TAG": {
      if (state.phase !== "observation_review" || !state.observationDraft) {
        return state;
      }

      const interestTags = toggleObservationTag(
        state.observationDraft.interestTags,
        action.tag,
        3,
      );
      const addingToFullList =
        !state.observationDraft.interestTags.includes(action.tag) &&
        !interestTags.includes(action.tag);
      if (addingToFullList) {
        return state;
      }

      return {
        ...state,
        observationDraft: {
          ...state.observationDraft,
          interestTags,
          supportTags: interestTags.includes(action.tag)
            ? state.observationDraft.supportTags.filter(
                (tag) => tag !== action.tag,
              )
            : state.observationDraft.supportTags,
        },
      };
    }

    case "TOGGLE_SUPPORT_TAG": {
      if (state.phase !== "observation_review" || !state.observationDraft) {
        return state;
      }

      const supportTags = toggleObservationTag(
        state.observationDraft.supportTags,
        action.tag,
        2,
      );
      const addingToFullList =
        !state.observationDraft.supportTags.includes(action.tag) &&
        !supportTags.includes(action.tag);
      if (addingToFullList) {
        return state;
      }

      return {
        ...state,
        observationDraft: {
          ...state.observationDraft,
          interestTags: supportTags.includes(action.tag)
            ? state.observationDraft.interestTags.filter(
                (tag) => tag !== action.tag,
              )
            : state.observationDraft.interestTags,
          supportTags,
        },
      };
    }

    case "CREATE_NEXT_SUGGESTION": {
      const reviewedObservation = tryBuildReviewedObservation(state);
      if (!reviewedObservation) {
        return state;
      }

      const approvedNextActivityContext =
        reviewedObservation.nextActivityContext;
      const nextSuggestion = createKitchenSoundNextSuggestion(
        approvedNextActivityContext,
      );

      return {
        ...state,
        phase: "next_suggestion",
        reviewedObservation,
        approvedNextActivityContext,
        nextSuggestion,
      };
    }
  }
}
