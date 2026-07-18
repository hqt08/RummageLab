import type {
  ActivityContext,
  NextActivityContext,
  ParentObservationSuggestion,
  QuestSpec,
} from "../schemas";
import {
  KITCHEN_SOUND_SUGGESTED_WEATHER_TAGS,
  buildReviewedObservationSuggestion,
  createKitchenSoundNextSuggestion,
  kitchenSoundObservationFixture,
  kitchenSoundPhotoInventory,
  type DemoObservationTag,
  type DemoWeatherTag,
  type KitchenSoundNextSuggestion,
} from "./kitchen-sound-detectives";
import {
  canStartApprovedQuest,
  createApprovedActivityContext,
} from "./approved-quest-templates";
import {
  dedupeVettedCandidates,
  photoInventoryToCandidates,
  type MaterialIntakeSource,
  type VettedCandidate,
} from "./material-intake";
import type { DemoAgeStage } from "./age-stage-options";

/** Prepared-kit candidates, derived from the seeded object inventory. */
function seededKitchenCandidates(): VettedCandidate[] {
  return photoInventoryToCandidates(kitchenSoundPhotoInventory);
}

export type KitchenSoundDemoPhase =
  | "kit_review"
  | "quest"
  | "reflection"
  | "observation_review"
  | "next_suggestion"
  | "complete";

export type ObservationDraft = {
  observedEvents: string[];
  parentSummary: string;
  interestTags: DemoObservationTag[];
  supportTags: DemoObservationTag[];
};

export type KitchenSoundDemoState = {
  phase: KitchenSoundDemoPhase;
  selectedAgeStage: DemoAgeStage;
  materialSource: MaterialIntakeSource;
  intakeCandidates: VettedCandidate[];
  confirmedObjects: VettedCandidate[];
  selectedWeatherTags: DemoWeatherTag[];
  parentApprovedWeather: boolean;
  parentConfirmedSafety: boolean;
  activityContext: ActivityContext | null;
  experience: QuestSpec | null;
  reflectionSkipped: boolean;
  observationDraft: ObservationDraft | null;
  reviewedObservation: ParentObservationSuggestion | null;
  approvedNextActivityContext: NextActivityContext | null;
  nextSuggestion: KitchenSoundNextSuggestion | null;
};

export type KitchenSoundDemoAction =
  | { type: "SET_AGE_STAGE"; ageStage: DemoAgeStage }
  | {
      type: "SET_MATERIAL_SOURCE";
      source: MaterialIntakeSource;
    }
  | {
      type: "SET_OBJECT_CANDIDATES";
      candidates: VettedCandidate[];
    }
  | { type: "CLEAR_MATERIAL_CONFIRMATION" }
  | {
      type: "TOGGLE_OBJECT";
      id: string;
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
  | { type: "START_QUEST"; experience?: QuestSpec }
  | { type: "FINISH_QUEST" }
  | { type: "SKIP_REFLECTION" }
  | { type: "REVIEW_SEEDED_OBSERVATION" }
  | { type: "REVIEW_OBSERVATION_DRAFT"; draft: ObservationDraft }
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
    selectedAgeStage: "3-4y",
    materialSource: "seeded_demo",
    intakeCandidates: seededKitchenCandidates(),
    confirmedObjects: [],
    selectedWeatherTags: [...KITCHEN_SOUND_SUGGESTED_WEATHER_TAGS],
    parentApprovedWeather: false,
    parentConfirmedSafety: false,
    activityContext: null,
    experience: null,
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

export function canStartKitchenSoundQuest(
  state: KitchenSoundDemoState,
): boolean {
  return state.phase === "kit_review" && state.selectedAgeStage === "3-4y" && canStartApprovedQuest({
    confirmedObjects: state.confirmedObjects.map((object) => ({
      id: object.id,
      category: object.category,
      label: object.label,
    })),
    candidateIds: state.intakeCandidates.map((candidate) => candidate.id),
    approvedWeatherTags: state.selectedWeatherTags,
    parentApprovedWeather: state.parentApprovedWeather,
    parentConfirmedSafety: state.parentConfirmedSafety,
    materialSource: state.materialSource,
  });
}

function makeObservationDraft(): ObservationDraft {
  const observationTemplate =
    kitchenSoundObservationFixture.unapprovedTemplate;

  return {
    observedEvents: [...observationTemplate.observedEvents],
    parentSummary: observationTemplate.parentSummary,
    interestTags: [
      ...observationTemplate.nextActivityContext.interestTags,
    ],
    supportTags: [
      ...observationTemplate.nextActivityContext.supportTags,
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
    case "SET_AGE_STAGE":
      return state.phase === "kit_review"
        ? {
            ...state,
            selectedAgeStage: action.ageStage,
            intakeCandidates:
              action.ageStage === "3-4y" && state.materialSource === "seeded_demo"
                ? seededKitchenCandidates()
                : [],
            confirmedObjects: [],
            parentConfirmedSafety: false,
            activityContext: null,
            experience: null,
          }
        : state;

    case "SET_MATERIAL_SOURCE":
      return state.phase === "kit_review"
        ? {
            ...state,
            materialSource: action.source,
            intakeCandidates:
              action.source === "seeded_demo" ? seededKitchenCandidates() : [],
            confirmedObjects: [],
            parentConfirmedSafety: false,
            activityContext: null,
            experience: null,
          }
        : state;

    case "SET_OBJECT_CANDIDATES":
      return state.phase === "kit_review"
        ? {
            ...state,
            intakeCandidates: dedupeVettedCandidates(action.candidates),
            confirmedObjects: [],
            parentConfirmedSafety: false,
            activityContext: null,
            experience: null,
          }
        : state;

    case "CLEAR_MATERIAL_CONFIRMATION":
      return state.phase === "kit_review"
        ? {
            ...state,
            confirmedObjects: [],
            parentConfirmedSafety: false,
            activityContext: null,
            experience: null,
          }
        : state;

    case "TOGGLE_OBJECT": {
      const candidate = state.intakeCandidates.find(
        (item) => item.id === action.id,
      );
      if (state.phase !== "kit_review" || !candidate) {
        return state;
      }
      const isConfirmed = state.confirmedObjects.some(
        (object) => object.id === action.id,
      );
      return {
        ...state,
        confirmedObjects: isConfirmed
          ? state.confirmedObjects.filter((object) => object.id !== action.id)
          : [...state.confirmedObjects, candidate],
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

      const activityContext = createApprovedActivityContext({
        ageStage: state.selectedAgeStage,
        materialSource: state.materialSource,
        confirmedMaterials: state.confirmedObjects.map((object) => ({
          allowedMaterialCategory: object.category,
          label: object.label,
        })),
        approvedWeatherTags: state.selectedWeatherTags,
        parentConfirmedSafety: state.parentConfirmedSafety,
      });

      return {
        ...state,
        phase: "quest",
        activityContext,
        experience: action.experience ?? null,
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

    case "REVIEW_OBSERVATION_DRAFT":
      return state.phase === "reflection"
        ? {
            ...state,
            phase: "observation_review",
            reflectionSkipped: false,
            observationDraft: {
              observedEvents: [...action.draft.observedEvents],
              parentSummary: action.draft.parentSummary,
              interestTags: [...action.draft.interestTags],
              supportTags: [...action.draft.supportTags],
            },
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
