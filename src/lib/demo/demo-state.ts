import type {
  ActivityContext,
  ExperienceSpec,
  NextActivityContext,
  ParentObservationSuggestion,
} from "../schemas";
import {
  KITCHEN_SOUND_SUGGESTED_WEATHER_TAGS,
  buildReviewedObservationSuggestion,
  createKitchenSoundNextSuggestion,
  kitchenSoundObservationFixture,
  kitchenSoundPhotoInventory,
  type DemoObservationTag,
  type DemoWeatherTag,
} from "./kitchen-sound-detectives";
import {
  canStartApprovedQuest,
  createApprovedActivityContext,
} from "./approved-quest-templates";
import {
  dedupeVettedCandidates,
  photoInventoryToCandidates,
  vettedCandidateId,
  type MaterialIntakeSource,
  type VettedCandidate,
} from "./material-intake";
import { isUnderThreeCategory } from "./age-band-fallbacks";
import type { NextIdeaDraft } from "./generic-next-suggestion";
import type { DemoAgeStage } from "./age-stage-options";

/** Prepared-kit candidates, derived from the seeded object inventory. */
function seededKitchenCandidates(): VettedCandidate[] {
  return photoInventoryToCandidates(kitchenSoundPhotoInventory);
}

/** Prepared large, soft under-three kit for the 0–1 and 1–2 bands. */
function seededUnderThreeCandidates(): VettedCandidate[] {
  return [
    { id: vettedCandidateId("Clean, folded dish towel"), label: "Clean, folded dish towel", category: "soft_cloth", safetyLevel: "ok", warnings: [] },
    { id: vettedCandidateId("Board book"), label: "Board book", category: "board_book", safetyLevel: "ok", warnings: [] },
    { id: vettedCandidateId("Large soft ball"), label: "Large soft ball", category: "large_soft_ball", safetyLevel: "ok", warnings: [] },
  ];
}

/** Prepared-kit candidates appropriate to the selected age band. */
export function seededCandidatesForAge(ageStage: DemoAgeStage): VettedCandidate[] {
  return ageStage === "0-12m" || ageStage === "12-36m"
    ? seededUnderThreeCandidates()
    : seededKitchenCandidates();
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
  weatherSource: "seeded_demo" | "weather_lookup" | "parent_selected";
  parentApprovedWeather: boolean;
  parentConfirmedSafety: boolean;
  activityContext: ActivityContext | null;
  experience: ExperienceSpec | null;
  reflectionSkipped: boolean;
  observationDraft: ObservationDraft | null;
  reviewedObservation: ParentObservationSuggestion | null;
  approvedNextActivityContext: NextActivityContext | null;
  nextSuggestion: NextActivitySuggestionState | null;
};

/** The one session-only try-next idea, with honest provenance. */
export type NextActivitySuggestionState = {
  id: string;
  title: string;
  durationMinutes: number;
  invitation: string;
  connection: string;
  basedOnTags: {
    interestTags: DemoObservationTag[];
    supportTags: DemoObservationTag[];
  };
  origin: "prepared" | "live" | "fallback";
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
      type: "SET_WEATHER_TAGS";
      tags: DemoWeatherTag[];
      source: "weather_lookup";
    }
  | {
      type: "SET_WEATHER_APPROVED";
      approved: boolean;
    }
  | {
      type: "SET_SAFETY_CONFIRMED";
      confirmed: boolean;
    }
  | { type: "START_QUEST"; experience?: ExperienceSpec }
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
  | {
      type: "APPLY_NEXT_SUGGESTION";
      idea: NextIdeaDraft;
      origin: "live" | "fallback";
    }
  | { type: "RESET" };

export function createInitialKitchenSoundDemoState(): KitchenSoundDemoState {
  return {
    phase: "kit_review",
    selectedAgeStage: "3-4y",
    materialSource: "seeded_demo",
    intakeCandidates: seededKitchenCandidates(),
    confirmedObjects: [],
    selectedWeatherTags: [...KITCHEN_SOUND_SUGGESTED_WEATHER_TAGS],
    weatherSource: "seeded_demo",
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
  return state.phase === "kit_review" && canStartApprovedQuest({
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
    ageStage: state.selectedAgeStage,
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
              state.materialSource === "seeded_demo"
                ? seededCandidatesForAge(action.ageStage)
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
              action.source === "seeded_demo"
                ? seededCandidatesForAge(state.selectedAgeStage)
                : [],
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
      // Under-three bands may confirm only the smaller approved allowlist.
      const underThreeBand =
        state.selectedAgeStage === "0-12m" || state.selectedAgeStage === "12-36m";
      if (underThreeBand && !isUnderThreeCategory(candidate.category)) {
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
        weatherSource: "parent_selected",
        parentApprovedWeather: false,
      };
    }

    case "SET_WEATHER_TAGS": {
      if (state.phase !== "kit_review" || action.tags.length < 1 || action.tags.length > 4) {
        return state;
      }
      return {
        ...state,
        selectedWeatherTags: [...new Set(action.tags)],
        weatherSource: action.source,
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
        weatherSource: state.weatherSource,
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
      const nextSuggestion = {
        ...createKitchenSoundNextSuggestion(approvedNextActivityContext),
        origin: "prepared" as const,
      };

      return {
        ...state,
        phase: "next_suggestion",
        reviewedObservation,
        approvedNextActivityContext,
        nextSuggestion,
      };
    }

    case "APPLY_NEXT_SUGGESTION": {
      // Same parent-approval gate as the prepared path: a valid reviewed
      // observation with approved tags must exist before any idea is shown.
      const reviewedObservation = tryBuildReviewedObservation(state);
      if (!reviewedObservation) {
        return state;
      }
      const approvedNextActivityContext =
        reviewedObservation.nextActivityContext;
      return {
        ...state,
        phase: "next_suggestion",
        reviewedObservation,
        approvedNextActivityContext,
        nextSuggestion: {
          id: action.origin === "live" ? "live-next-idea" : "fallback-next-idea",
          ...action.idea,
          basedOnTags: {
            interestTags: [...approvedNextActivityContext.interestTags],
            supportTags: [...approvedNextActivityContext.supportTags],
          },
          origin: action.origin,
        },
      };
    }
  }
}
