"use client";

import Image from "next/image";
import React, {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";

import { SoundMixTool } from "./sound-mix-tool";
import { PredictTool } from "./predict-tool";
import { SortTool } from "./sort-tool";
import { MeasureTool } from "./measure-tool";
import { FieldJournalTool } from "./field-journal-tool";
import {
  canCreateKitchenSoundNextSuggestion,
  canStartKitchenSoundQuest,
  createInitialKitchenSoundDemoState,
  kitchenSoundDemoReducer,
  type KitchenSoundDemoAction,
  type KitchenSoundDemoPhase,
} from "../lib/demo/demo-state";
import {
  KITCHEN_SOUND_AVAILABLE_WEATHER_TAGS,
  KITCHEN_SOUND_DEMO_ID,
  KITCHEN_SOUND_REQUIRED_MATERIALS,
  kitchenSoundQuest,
  type DemoObservationTag,
  type DemoWeatherTag,
} from "../lib/demo/kitchen-sound-detectives";
import {
  demoAgeStageOptions,
  findDemoAgeStageOption,
  type DemoAgeStage,
} from "../lib/demo/age-stage-options";
import {
  createApprovedActivityContext,
  deterministicApprovedQuestForContext,
} from "../lib/demo/approved-quest-templates";
import { findLearningFocus } from "../lib/data/learning-focuses";
import { isUnderThreeCategory } from "../lib/demo/age-band-fallbacks";
import { DEFAULT_DEMO_CITY_LABEL, demoCities, findDemoCity } from "../lib/demo/demo-cities";
import { fetchLiveWeatherTags } from "../lib/demo/weather-lookup";
import { createGenericNextIdea } from "../lib/demo/generic-next-suggestion";
import {
  LOCAL_OBJECT_PHOTO_DECODE_MAX_BYTES,
  LOCAL_OBJECT_PHOTO_DECODE_MAX_DIMENSION,
  LOCAL_OBJECT_PHOTO_DECODE_MAX_PIXELS,
  createLocalPhotoPreview,
  downscaleLocalObjectPhoto,
  guardTypedObjectLabels,
  normalizeKitchenSoundTypedMaterials,
  photoInventoryToCandidates,
  readLocalObjectPhotoDimensions,
  releaseLocalPhotoPreview,
  typedMatchesToCandidates,
  validateLocalObjectPhoto,
  validateLocalObjectPhotoContent,
  validateLocalObjectPhotoDimensions,
  type MaterialIntakeSource,
  type VettedCandidate,
} from "../lib/demo/material-intake";
import { ObservationTagSchema } from "../lib/schemas";
import type { AllowedMaterialCategory, ExperienceSpec, PhotoInventory } from "../lib/schemas";
import {
  ExperienceResponseSchema,
  LiveExperienceCapabilitySchema,
  PhotoInventoryResponseSchema,
} from "../lib/runtime/contracts";
import type { PhotoInventoryResponse } from "../lib/runtime/contracts";
import {
  NextSuggestionResponseSchema,
  ReflectionResponseSchema,
  type ReflectionSuggestionDraft,
} from "../lib/runtime/reflection-contracts";
import { guardTypedReflection } from "../lib/runtime/reflection-guard";
import { ReflectionRequestLifecycle } from "../lib/runtime/reflection-request-lifecycle";

const materialDetails: Record<AllowedMaterialCategory, string> = {
  large_empty_plastic_container: "Large, empty, and unbreakable",
  wooden_kitchen_utensil: "Smooth, intact, and room-temperature",
  silicone_kitchen_utensil: "Intact and room-temperature",
  soft_cloth: "Clean, soft, and folded",
  paper_or_cardboard: "Large and free of staples",
  board_book: "Intact, sturdy pages",
  large_soft_ball: "Too large to fit in a child’s mouth",
  large_natural_object: "Large, clean, and adult-checked",
  other_safe_object: "Parent-checked and safe for supervised play",
};

const materialNames: Record<AllowedMaterialCategory, string> = {
  large_empty_plastic_container: "empty plastic container(s)",
  wooden_kitchen_utensil: "wooden spoon or utensil",
  silicone_kitchen_utensil: "silicone kitchen utensil",
  soft_cloth: "clean dish towel or soft cloth",
  paper_or_cardboard: "paper or cardboard",
  board_book: "board book",
  large_soft_ball: "large soft ball",
  large_natural_object: "large natural object",
  other_safe_object: "everyday object",
};

/**
 * The server never returns raw parent text. After one guarded request, keep
 * that text only in this React session for the immediate parent-review field;
 * GPT-derived observed events and tags remain the adaptive inputs.
 */
export function parentReviewDraftFromTypedReflection(
  typedNote: string,
  suggestion: ReflectionSuggestionDraft,
) {
  return {
    observedEvents: [...suggestion.observedEvents],
    parentSummary: typedNote,
    interestTags: [...suggestion.suggestedInterestTags],
    supportTags: [...suggestion.suggestedSupportTags],
  };
}

const intakeChoiceCopy: Record<
  MaterialIntakeSource,
  { label: string; detail: string }
> = {
  seeded_demo: {
    label: "Use the prepared kit",
    detail: "Fast, reliable judge path",
  },
  photo: {
    label: "Take or choose an object photo",
    detail: "Optional transient GPT-5.6 analysis",
  },
  typed: {
    label: "Type what you have",
    detail: "Small on-device allowlist",
  },
};

const weatherLabels: Record<DemoWeatherTag, string> = {
  sunny: "Sunny",
  cloudy: "Cloudy",
  rainy: "Rainy",
  snowy: "Snowy",
  windy: "Windy",
  hot: "Hot",
  cold: "Cold",
  unknown: "Not sure",
};

const observationTagLabels: Record<DemoObservationTag, string> = {
  sound_play: "Sound play",
  loud_quiet_contrast: "Loud / quiet contrast",
  two_beat_pattern: "Two-beat pattern",
  turn_taking: "Turn taking",
  descriptive_words: "Descriptive words",
  cause_and_effect: "Cause and effect",
  movement_play: "Movement play",
  texture_exploration: "Texture exploration",
  stacking_building: "Stacking & building",
  hiding_finding: "Hiding & finding",
  counting_play: "Counting play",
  pretend_play: "Pretend play",
  balancing: "Balancing",
  watching_waiting: "Watching & waiting",
};

const phaseProgress: Record<KitchenSoundDemoPhase, string> = {
  kit_review: "Start with your child’s stage",
  quest: "Case file 2 of 4 · Follow the sounds",
  reflection: "Case file 3 of 4 · Parent choice",
  observation_review: "Case file 3 of 4 · Review what you noticed",
  next_suggestion: "Case file 4 of 4 · One try-next idea",
  complete: "Case file 4 of 4 · All done",
};

type RuntimePreviewStatus = "idle" | "loading" | "fallback" | "error";
type ReflectionStatus = "idle" | "loading" | "fallback" | "error";

export function canSendPhotoForLiveAnalysis(
  livePhotoAnalysisAvailable: boolean,
  file: File | null,
  objectOnlyConsent: boolean,
) {
  return livePhotoAnalysisAvailable && file !== null && objectOnlyConsent;
}

export function photoAnalysisResult(payload: PhotoInventoryResponse) {
  if (payload.runtime.diagnostic?.code === "provider_disabled") {
    return {
      livePhotoAnalysisAvailable: false,
      inventory: null,
      source: null,
      candidates: [] as VettedCandidate[],
    };
  }

  return {
    livePhotoAnalysisAvailable: true,
    inventory: payload.inventory,
    source: payload.runtime.source === "live_provider" ? "live_provider" as const : "seeded_fallback" as const,
    candidates: photoInventoryToCandidates(payload.inventory),
  };
}

function StageHeader({
  eyebrow,
  title,
  deck,
  headingRef,
}: {
  eyebrow: string;
  title: string;
  deck: string;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <header className="stage-header">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="stage-title" ref={headingRef} tabIndex={-1}>
        {title}
      </h1>
      <p className="stage-deck">{deck}</p>
    </header>
  );
}

export function KitchenSoundDemo() {
  const [state, dispatch] = useReducer(
    kitchenSoundDemoReducer,
    createInitialKitchenSoundDemoState(),
  );
  const [demoCityLabel, setDemoCityLabel] = useState<string>(
    DEFAULT_DEMO_CITY_LABEL,
  );
  const [weatherLookupStatus, setWeatherLookupStatus] = useState<
    "idle" | "loading" | "done" | "error"
  >("idle");
  const [weatherLookupMessage, setWeatherLookupMessage] = useState<string | null>(null);
  const [nextIdeaStatus, setNextIdeaStatus] = useState<"idle" | "loading">("idle");
  const [nextCycleStatus, setNextCycleStatus] = useState<"idle" | "loading">("idle");
  const [soundTrail, setSoundTrail] = useState<string[]>([]);
  const [predictionChoice, setPredictionChoice] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [resetVersion, setResetVersion] = useState(0);
  const [typedMaterialText, setTypedMaterialText] = useState("");
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [photoFileName, setPhotoFileName] = useState("");
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [runtimePreviewStatus, setRuntimePreviewStatus] =
    useState<RuntimePreviewStatus>("idle");
  const [, setLiveInventory] = useState<PhotoInventory | null>(null);
  const [typedLiveInventory, setTypedLiveInventory] = useState<PhotoInventory | null>(null);
  const [typedInventoryStatus, setTypedInventoryStatus] = useState<RuntimePreviewStatus>("idle");
  const [typedInventoryMessage, setTypedInventoryMessage] = useState<string | null>(null);
  const [livePhotoAnalysisAvailable, setLivePhotoAnalysisAvailable] = useState(false);
  const [activeQuest, setActiveQuest] = useState<ExperienceSpec>(kitchenSoundQuest);
  const [objectOnlyConsent, setObjectOnlyConsent] = useState(false);
  const [liveSource, setLiveSource] = useState<"live_provider" | "seeded_fallback" | null>(null);
  const [typedReflection, setTypedReflection] = useState("");
  const [reflectionStatus, setReflectionStatus] = useState<ReflectionStatus>("idle");
  const [reflectionMessage, setReflectionMessage] = useState<string | null>(null);
  const demoMainRef = useRef<HTMLElement>(null);
  const stageHeadingRef = useRef<HTMLHeadingElement>(null);
  const shouldFocusStageRef = useRef(false);
  const photoPreviewUrlRef = useRef<string | null>(null);
  const photoSelectionVersionRef = useRef(0);
  const runtimeRequestVersionRef = useRef(0);
  const reflectionRequestRef = useRef(new ReflectionRequestLifecycle());
  const photoInputRef = useRef<HTMLInputElement>(null);
  const photoFileRef = useRef<File | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const typedMaterialNormalization = useMemo(
    () => normalizeKitchenSoundTypedMaterials(typedMaterialText),
    [typedMaterialText],
  );

  // The reducer keeps `intakeCandidates` in sync across every intake source
  // (seeded, live photo, live typed, offline typed allowlist), so the parent
  // confirmation desk renders from one unified, per-object list.
  const suggestedMaterialItems = state.intakeCandidates;

  const materialSuggestionsReady = state.intakeCandidates.length > 0;

  useEffect(() => {
    if (!shouldFocusStageRef.current) {
      return;
    }

    shouldFocusStageRef.current = false;
    stageHeadingRef.current?.focus();
  }, [state.phase, resetVersion]);

  useEffect(
    () => () => {
      photoSelectionVersionRef.current += 1;
      runtimeRequestVersionRef.current += 1;
      reflectionRequestRef.current.cancel();
      releaseLocalPhotoPreview(photoPreviewUrlRef.current);
      photoPreviewUrlRef.current = null;
    },
    [],
  );

  useEffect(() => {
    let active = true;
    void fetch("/api/live-experience")
      .then(async (response) => LiveExperienceCapabilitySchema.parse(await response.json()))
      .then((capability) => {
        if (active) setLivePhotoAnalysisAvailable(capability.livePhotoAnalysisAvailable);
      })
      .catch(() => {
        if (active) setLivePhotoAnalysisAvailable(false);
      });
    return () => { active = false; };
  }, []);

  function transitionDemo(action: KitchenSoundDemoAction) {
    shouldFocusStageRef.current = true;
    dispatch(action);
  }

  function focusMainContent(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    demoMainRef.current?.focus();
    demoMainRef.current?.scrollIntoView({ block: "start" });
  }

  function resetDemo() {
    photoSelectionVersionRef.current += 1;
    runtimeRequestVersionRef.current += 1;
    reflectionRequestRef.current.cancel();
    releaseLocalPhotoPreview(photoPreviewUrlRef.current);
    photoPreviewUrlRef.current = null;
    shouldFocusStageRef.current = true;
    dispatch({ type: "RESET" });
    setDemoCityLabel(DEFAULT_DEMO_CITY_LABEL);
    setWeatherLookupStatus("idle");
    setWeatherLookupMessage(null);
    setNextIdeaStatus("idle");
    setNextCycleStatus("idle");
    setSoundTrail([]);
    setTypedMaterialText("");
    setPhotoPreviewUrl(null);
    setPhotoFileName("");
    setPhotoError(null);
    setPredictionChoice(null);
    setRuntimePreviewStatus("idle");
    setLiveInventory(null);
    setTypedLiveInventory(null);
    setTypedInventoryStatus("idle");
    setTypedInventoryMessage(null);
    setActiveQuest(kitchenSoundQuest);
    setObjectOnlyConsent(false);
    setLiveSource(null);
    setTypedReflection("");
    setReflectionStatus("idle");
    setReflectionMessage(null);
    photoFileRef.current = null;
    if (photoInputRef.current) {
      photoInputRef.current.value = "";
    }
    setAnnouncement("Demo reset; session data cleared.");
    setResetVersion((version) => version + 1);
  }

  function clearPhotoSelection() {
    photoSelectionVersionRef.current += 1;
    runtimeRequestVersionRef.current += 1;
    releaseLocalPhotoPreview(photoPreviewUrlRef.current);
    photoPreviewUrlRef.current = null;
    setPhotoPreviewUrl(null);
    setPhotoFileName("");
    setPhotoError(null);
    setLiveInventory(null);
    setObjectOnlyConsent(false);
    setLiveSource(null);
    photoFileRef.current = null;
    if (photoInputRef.current) {
      photoInputRef.current.value = "";
    }
    dispatch({ type: "SET_OBJECT_CANDIDATES", candidates: [] });
  }

  function chooseMaterialSource(source: MaterialIntakeSource) {
    runtimeRequestVersionRef.current += 1;
    if (state.materialSource === "photo" && source !== "photo") {
      clearPhotoSelection();
    }
    if (state.materialSource === "typed" && source !== "typed") {
      setTypedMaterialText("");
      setTypedLiveInventory(null);
      setTypedInventoryStatus("idle");
      setTypedInventoryMessage(null);
    }
    dispatch({ type: "SET_MATERIAL_SOURCE", source });
    setAnnouncement(`${intakeChoiceCopy[source].label} selected.`);
  }

  function chooseAgeStage(ageStage: DemoAgeStage) {
    runtimeRequestVersionRef.current += 1;
    releaseLocalPhotoPreview(photoPreviewUrlRef.current);
    photoPreviewUrlRef.current = null;
    setPhotoPreviewUrl(null);
    setPhotoFileName("");
    setPhotoError(null);
    setLiveInventory(null);
    setTypedMaterialText("");
    setTypedLiveInventory(null);
    setTypedInventoryStatus("idle");
    setTypedInventoryMessage(null);
    setObjectOnlyConsent(false);
    setLiveSource(null);
    photoFileRef.current = null;
    if (photoInputRef.current) photoInputRef.current.value = "";
    transitionDemo({ type: "SET_AGE_STAGE", ageStage });
    setAnnouncement(`${findDemoAgeStageOption(ageStage).label} selected.`);
  }

  async function tryIdeaNow() {
    const suggestion = state.nextSuggestion;
    if (!suggestion || nextCycleStatus === "loading") return;
    let activityContext;
    try {
      activityContext = createApprovedActivityContext({
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
    } catch {
      return;
    }
    const startCycle = (experience: ExperienceSpec, source: "live_provider" | "seeded_fallback") => {
      setActiveQuest(experience);
      setLiveSource(source);
      setSoundTrail([]);
      setPredictionChoice(null);
      setTypedReflection("");
      setReflectionStatus("idle");
      setReflectionMessage(null);
      setRuntimePreviewStatus("idle");
      setAnnouncement(source === "live_provider"
        ? "A new activity was generated live from your accepted idea."
        : "The prepared fallback activity is ready for another round.");
      transitionDemo({ type: "START_NEXT_CYCLE", experience });
    };
    setNextCycleStatus("loading");
    try {
      const response = await fetch("/api/live-experience", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          operation: "experience_selection",
          fixtureId: "kitchen-sound-detectives",
          activityContext,
          guidance: {
            ideaTitle: suggestion.title.slice(0, 80),
            ideaInvitation: suggestion.invitation.slice(0, 240),
            interestTags: suggestion.basedOnTags.interestTags,
            supportTags: suggestion.basedOnTags.supportTags,
          },
        }),
      });
      const payload = ExperienceResponseSchema.parse(await response.json());
      startCycle(
        payload.experience,
        payload.runtime.source === "live_provider" ? "live_provider" : "seeded_fallback",
      );
    } catch {
      // Any failure (including rate limiting) falls back to the deterministic
      // reviewed activity for the unchanged parent-approved context.
      try {
        const experience = deterministicApprovedQuestForContext(activityContext);
        startCycle(experience, "seeded_fallback");
      } catch {
        setAnnouncement("The next activity could not be prepared. Reset to start over.");
      }
    } finally {
      setNextCycleStatus("idle");
    }
  }

  async function approveTagsForIdea() {
    // Golden path: the Kitchen Sound quest keeps its deterministic, tag-only
    // prepared suggestion.
    if (activeQuest.id === KITCHEN_SOUND_DEMO_ID) {
      transitionDemo({ type: "CREATE_NEXT_SUGGESTION" });
      return;
    }
    const draft = state.observationDraft;
    if (!draft || nextIdeaStatus === "loading") return;
    setNextIdeaStatus("loading");
    const fallbackIdea = createGenericNextIdea({
      interestTags: draft.interestTags,
      supportTags: draft.supportTags,
      objectLabels: state.confirmedObjects.map((object) => object.label),
    });
    try {
      const response = await fetch("/api/reflection", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          operation: "next_suggestion",
          ageStage: state.selectedAgeStage,
          weatherTags: state.selectedWeatherTags,
          objectLabels: state.confirmedObjects.map((object) => object.label.slice(0, 60)),
          previousActivityTitle: activeQuest.title,
          approvedInterestTags: draft.interestTags,
          approvedSupportTags: draft.supportTags,
          parentSummary: draft.parentSummary,
        }),
      });
      const payload = NextSuggestionResponseSchema.parse(await response.json());
      transitionDemo({
        type: "APPLY_NEXT_SUGGESTION",
        idea: payload.suggestion,
        origin: payload.runtime.source === "live_provider" ? "live" : "fallback",
      });
    } catch {
      transitionDemo({ type: "APPLY_NEXT_SUGGESTION", idea: fallbackIdea, origin: "fallback" });
    } finally {
      setNextIdeaStatus("idle");
    }
  }

  async function suggestWeatherTags() {
    const city = findDemoCity(demoCityLabel);
    if (!city || state.phase !== "kit_review") return;
    setWeatherLookupStatus("loading");
    setWeatherLookupMessage(null);
    try {
      const suggestion = await fetchLiveWeatherTags(city);
      dispatch({ type: "SET_WEATHER_TAGS", tags: suggestion.tags, source: "weather_lookup" });
      setWeatherLookupStatus("done");
      setWeatherLookupMessage(
        `Live weather for ${city.label}: ${suggestion.conditionSummary}. Suggested tags are selected below — approve or adjust them yourself.`,
      );
      setAnnouncement("Live weather tags suggested. Review and approve the final set.");
    } catch {
      setWeatherLookupStatus("error");
      setWeatherLookupMessage("The live weather lookup was unavailable. Choose tags manually.");
    }
  }

  function updateTypedMaterials(value: string) {
    runtimeRequestVersionRef.current += 1;
    const normalization = normalizeKitchenSoundTypedMaterials(value);
    setTypedMaterialText(value);
    setTypedLiveInventory(null);
    setTypedInventoryStatus("idle");
    setTypedInventoryMessage(null);
    dispatch({
      type: "SET_OBJECT_CANDIDATES",
      candidates:
        normalization.inputError === null
          ? typedMatchesToCandidates(normalization.accepted)
          : [],
    });
  }

  async function suggestTypedCategories() {
    const guarded = guardTypedObjectLabels(typedMaterialText);
    if (!guarded.safe) {
      setTypedInventoryMessage(
        guarded.code === "empty" ? "List one to five everyday object names first."
          : guarded.code === "too_many" ? "List up to five object names."
            : guarded.code === "too_long" ? "Keep each object name to 80 characters or fewer."
              : "Remove possible private details or unsafe items before live analysis.",
      );
      return;
    }
    if (!livePhotoAnalysisAvailable) {
      setTypedInventoryMessage("More credits required for OpenAI analysis. The local allowlist remains available.");
      return;
    }
    const requestVersion = ++runtimeRequestVersionRef.current;
    setTypedInventoryStatus("loading");
    setTypedInventoryMessage(null);
    try {
      const response = await fetch("/api/live-experience", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-rummagelab-operation": "typed_object_inventory",
        },
        body: JSON.stringify({ operation: "typed_object_inventory", objectLabels: guarded.objectLabels, ageStage: state.selectedAgeStage }),
      });
      if (response.status === 429) {
        if (runtimeRequestVersionRef.current !== requestVersion) return;
        setTypedInventoryStatus("error");
        setTypedInventoryMessage("Live requests are briefly rate-limited for this public demo. The prepared paths still work; try live again in a few minutes.");
        return;
      }
      const payload = PhotoInventoryResponseSchema.parse(await response.json());
      if (runtimeRequestVersionRef.current !== requestVersion) return;
      const result = photoAnalysisResult(payload);
      setLivePhotoAnalysisAvailable(result.livePhotoAnalysisAvailable);
      if (!result.inventory) {
        setTypedInventoryStatus("idle");
        setTypedInventoryMessage("More credits required for OpenAI analysis. The local allowlist remains available.");
        return;
      }
      setTypedLiveInventory(result.inventory);
      dispatch({ type: "SET_OBJECT_CANDIDATES", candidates: result.candidates });
      setTypedInventoryStatus(payload.runtime.source === "seeded_fallback" ? "fallback" : "idle");
      setTypedInventoryMessage(payload.runtime.source === "live_provider"
        ? "GPT-5.6 suggested safe categories. Confirm every category yourself."
        : "Live suggestions were unavailable. A prepared fallback is ready for your confirmation.");
    } catch {
      if (runtimeRequestVersionRef.current !== requestVersion) return;
      setTypedInventoryStatus("error");
      setTypedInventoryMessage("Live suggestions could not be prepared. The local allowlist remains available.");
    }
  }

  async function selectLocalPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    const selectionVersion = photoSelectionVersionRef.current + 1;
    photoSelectionVersionRef.current = selectionVersion;
    runtimeRequestVersionRef.current += 1;
    releaseLocalPhotoPreview(photoPreviewUrlRef.current);
    photoPreviewUrlRef.current = null;
    setPhotoPreviewUrl(null);
    setPhotoFileName("");
    setPhotoError(null);
    setLiveInventory(null);
    setObjectOnlyConsent(false);
    setLiveSource(null);
    photoFileRef.current = null;
    dispatch({ type: "SET_OBJECT_CANDIDATES", candidates: [] });

    if (!file) {
      return;
    }

    const validation = validateLocalObjectPhoto(file);
    // An over-8MB image is not rejected outright: if it is still within the
    // on-device decode ceiling it will be downscaled locally after decoding.
    const oversizedButResizable =
      !validation.ok &&
      validation.code === "too_large" &&
      file.size <= LOCAL_OBJECT_PHOTO_DECODE_MAX_BYTES;
    if (!validation.ok && !oversizedButResizable) {
      releaseLocalPhotoPreview(photoPreviewUrlRef.current);
      photoPreviewUrlRef.current = null;
      setPhotoPreviewUrl(null);
      setPhotoFileName("");
      setPhotoError(validation.message);
      input.value = "";
      setAnnouncement(validation.message);
      return;
    }

    const contentValidation = await validateLocalObjectPhotoContent(file);
    if (photoSelectionVersionRef.current !== selectionVersion) {
      return;
    }
    if (!contentValidation.ok) {
      setPhotoError(contentValidation.message);
      input.value = "";
      setAnnouncement(contentValidation.message);
      return;
    }

    // Galleries (iOS especially) can hand back valid image bytes with an empty
    // or wrong MIME type. Rebuild the file with the sniffed type so the preview
    // and the server upload carry a correct, supported content type.
    const detectedType = contentValidation.detectedType;
    const uploadFile =
      file.type === detectedType
        ? file
        : new File(
            [file],
            file.name || `object-photo.${detectedType.split("/")[1]}`,
            { type: detectedType },
          );

    const nextPreviewUrl = createLocalPhotoPreview(
      uploadFile,
      null,
    );
    photoPreviewUrlRef.current = nextPreviewUrl;

    let dimensions: { width: number; height: number };
    try {
      dimensions = await readLocalObjectPhotoDimensions(nextPreviewUrl);
    } catch {
      if (photoSelectionVersionRef.current !== selectionVersion) {
        return;
      }
      releaseLocalPhotoPreview(nextPreviewUrl);
      photoPreviewUrlRef.current = null;
      const message = "That image could not be decoded. Choose another object photo.";
      setPhotoError(message);
      input.value = "";
      setAnnouncement(message);
      return;
    }

    if (photoSelectionVersionRef.current !== selectionVersion) {
      return;
    }
    const dimensionValidation = validateLocalObjectPhotoDimensions(dimensions);
    let finalFile = uploadFile;
    let finalPreviewUrl = nextPreviewUrl;
    let resizedLocally = false;
    if (!dimensionValidation.ok || !validation.ok) {
      // Modern phone cameras (24/48MP, especially portrait) exceed the demo's
      // review limits. Downscale entirely on this device — nothing is uploaded
      // — and let the parent review and confirm the resized photo as usual.
      const withinDecodeCeiling =
        dimensions.width <= LOCAL_OBJECT_PHOTO_DECODE_MAX_DIMENSION &&
        dimensions.height <= LOCAL_OBJECT_PHOTO_DECODE_MAX_DIMENSION &&
        dimensions.width * dimensions.height <= LOCAL_OBJECT_PHOTO_DECODE_MAX_PIXELS;
      let resizedFile: File | null = null;
      if (withinDecodeCeiling) {
        try {
          resizedFile = await downscaleLocalObjectPhoto({
            previewUrl: nextPreviewUrl,
            width: dimensions.width,
            height: dimensions.height,
          });
        } catch {
          resizedFile = null;
        }
      }
      if (photoSelectionVersionRef.current !== selectionVersion) {
        return;
      }
      if (!resizedFile) {
        releaseLocalPhotoPreview(nextPreviewUrl);
        photoPreviewUrlRef.current = null;
        const message = dimensionValidation.ok
          ? "Choose an object photo smaller than 8 MB."
          : dimensionValidation.message;
        setPhotoError(message);
        input.value = "";
        setAnnouncement(message);
        return;
      }
      finalFile = resizedFile;
      finalPreviewUrl = createLocalPhotoPreview(resizedFile, nextPreviewUrl);
      photoPreviewUrlRef.current = finalPreviewUrl;
      resizedLocally = true;
    }

    setPhotoPreviewUrl(finalPreviewUrl);
    setPhotoFileName(finalFile.name);
    photoFileRef.current = finalFile;
    setPhotoError(null);
    setAnnouncement(
      resizedLocally
        ? "Large photo resized on this device to fit the demo limits; nothing was uploaded. Review and confirm as usual."
        : "Object photo ready as a local preview. Confirm the object-only boundary before live analysis.",
    );
  }

  async function analyzePhoto() {
    const file = photoFileRef.current;
    if (!file || !canSendPhotoForLiveAnalysis(livePhotoAnalysisAvailable, file, objectOnlyConsent)) {
      setLiveInventory(null);
      setLiveSource(null);
      dispatch({ type: "SET_OBJECT_CANDIDATES", candidates: [] });
      return;
    }
    const requestVersion = ++runtimeRequestVersionRef.current;
    setRuntimePreviewStatus("loading");
    setPhotoError(null);
    setLiveInventory(null);
    setLiveSource(null);
    dispatch({ type: "SET_OBJECT_CANDIDATES", candidates: [] });
    const body = new FormData();
    body.set("operation", "photo_inventory");
    body.set("objectOnlyConfirmed", "true");
    body.set("ageStage", state.selectedAgeStage);
    body.set("photo", file);
    try {
      const response = await fetch("/api/live-experience", { method: "POST", body });
      if (response.status === 429) {
        if (runtimeRequestVersionRef.current !== requestVersion) return;
        setRuntimePreviewStatus("error");
        setPhotoError("Live requests are briefly rate-limited for this public demo. The prepared paths still work; try live again in a few minutes.");
        return;
      }
      const payload = PhotoInventoryResponseSchema.parse(await response.json());
      if (runtimeRequestVersionRef.current !== requestVersion) return;
      const result = photoAnalysisResult(payload);
      setLivePhotoAnalysisAvailable(result.livePhotoAnalysisAvailable);
      setLiveInventory(result.inventory);
      setLiveSource(result.source);
      dispatch({
        type: "SET_OBJECT_CANDIDATES",
        candidates: result.candidates,
      });
      if (!result.livePhotoAnalysisAvailable) {
        setRuntimePreviewStatus("idle");
        return;
      }
      setRuntimePreviewStatus(payload.runtime.source === "seeded_fallback" ? "fallback" : "idle");
      setAnnouncement(payload.runtime.source === "live_provider" ? "GPT-5.6 suggested a constrained inventory. Confirm every item yourself." : "Live analysis was unavailable; the prepared inventory is ready for your confirmation.");
    } catch {
      if (runtimeRequestVersionRef.current !== requestVersion) return;
      setRuntimePreviewStatus("error");
      setLiveInventory(null);
      setLiveSource(null);
      dispatch({ type: "SET_OBJECT_CANDIDATES", candidates: [] });
      setPhotoError("Live analysis could not prepare a safe inventory. Retry or use the prepared kit.");
    }
  }

  async function startQuest() {
    if (!canStart) {
      return;
    }
    if (!livePhotoAnalysisAvailable) {
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
      runtimeRequestVersionRef.current += 1;
      setRuntimePreviewStatus("idle");
      setLiveSource("seeded_fallback");
      if (state.materialSource === "typed") setTypedMaterialText("");
      const quest = deterministicApprovedQuestForContext(activityContext);
      setActiveQuest(quest);
      transitionDemo({ type: "START_QUEST", experience: quest });
      return;
    }
    const requestVersion = runtimeRequestVersionRef.current + 1;
    runtimeRequestVersionRef.current = requestVersion;
    setRuntimePreviewStatus("loading");
    setAnnouncement("Preparing a validated activity from parent-confirmed context.");
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
    try {
      const response = await fetch("/api/live-experience", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ operation: "experience_selection", fixtureId: "kitchen-sound-detectives", activityContext }),
      });
      const payload = ExperienceResponseSchema.parse(await response.json());
      const current = stateRef.current;
      const contextStillMatches =
        current.materialSource === activityContext.materialSource &&
        current.parentConfirmedSafety === activityContext.parentConfirmedSafety &&
        JSON.stringify(current.confirmedObjects) === JSON.stringify(state.confirmedObjects) &&
        JSON.stringify(current.selectedWeatherTags) === JSON.stringify(state.selectedWeatherTags) &&
        current.parentApprovedWeather;
      // Accept every validated spec kind: guided quests for 3-6 and
      // caregiver-led moments for the under-three bands.
      if (runtimeRequestVersionRef.current !== requestVersion || !contextStillMatches) return;
      setActiveQuest(payload.experience);
      setLiveSource(payload.runtime.source === "live_provider" ? "live_provider" : "seeded_fallback");
      setRuntimePreviewStatus("idle");
      if (state.materialSource === "typed") setTypedMaterialText("");
      transitionDemo({ type: "START_QUEST", experience: payload.experience });
    } catch {
      if (runtimeRequestVersionRef.current !== requestVersion) return;
      setRuntimePreviewStatus("error");
      setAnnouncement("The activity could not be safely validated. Retry or use the prepared demo.");
    }
  }

  function openPreparedFallback() {
    setRuntimePreviewStatus("idle");
    if (state.materialSource === "typed") {
      setTypedMaterialText("");
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
    const quest = deterministicApprovedQuestForContext(activityContext);
    setAnnouncement("Opening the prepared, validated fallback quest.");
    setActiveQuest(quest);
    transitionDemo({ type: "START_QUEST", experience: quest });
  }

  function addSound(soundLabel: string) {
    setSoundTrail((trail) =>
      trail.length >= 3 ? [...trail.slice(1), soundLabel] : [...trail, soundLabel],
    );
  }

  function skipReflection() {
    reflectionRequestRef.current.cancel();
    setTypedReflection("");
    setReflectionStatus("idle");
    setReflectionMessage(null);
    transitionDemo({ type: "SKIP_REFLECTION" });
  }

  function reviewPreparedObservation() {
    reflectionRequestRef.current.cancel();
    setTypedReflection("");
    setReflectionStatus("idle");
    setReflectionMessage(null);
    transitionDemo({ type: "REVIEW_SEEDED_OBSERVATION" });
  }

  async function submitTypedReflection() {
    const guarded = guardTypedReflection(typedReflection);
    if (!guarded.safe) {
      setReflectionMessage(
        guarded.code === "empty"
          ? "Add a short parent observation, or choose Skip reflection."
          : guarded.code === "too_long"
            ? "Shorten the note to 400 characters within the byte limit."
            : "Remove possible names, contact, school, location, account, or health details before sending.",
      );
      return;
    }

    const request = reflectionRequestRef.current.begin();
    setReflectionStatus("loading");
    setReflectionMessage(null);
    try {
      const response = await fetch("/api/reflection", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          operation: "reflection_suggestion",
          fixtureId: "kitchen-sound-detectives",
          reflection: {
            source: "typed",
            text: guarded.text,
            childVoiceIncluded: false,
          },
        }),
        signal: request.signal,
      });
      const payload = ReflectionResponseSchema.parse(await response.json());
      if (!reflectionRequestRef.current.isCurrent(request.version) || stateRef.current.phase !== "reflection") return;
      setTypedReflection("");
      setReflectionStatus(payload.runtime.source === "prepared_fallback" ? "fallback" : "idle");
      setReflectionMessage(
        payload.runtime.source === "prepared_fallback"
          ? payload.runtime.diagnostic?.code === "provider_disabled"
            ? "More credits required for OpenAI analysis. A prepared suggestion is ready for your review."
            : "Live reflection help was unavailable. A prepared suggestion is ready for your review."
          : "A short suggestion is ready. Edit it and approve the tags yourself.",
      );
      transitionDemo({
        type: "REVIEW_OBSERVATION_DRAFT",
        draft: parentReviewDraftFromTypedReflection(guarded.text, payload.suggestion),
      });
    } catch {
      if (!reflectionRequestRef.current.isCurrent(request.version) || request.signal.aborted) return;
      setReflectionStatus("error");
      setReflectionMessage("A safe suggestion could not be prepared. Retry, use the prepared example, or skip.");
    } finally {
      reflectionRequestRef.current.finish(request.version);
    }
  }

  const selectedAgeOption = findDemoAgeStageOption(state.selectedAgeStage);
  const underThreeSelected =
    state.selectedAgeStage === "0-12m" || state.selectedAgeStage === "12-36m";
  const confirmedCategories = state.confirmedObjects.map((object) => object.category);
  const hasKitchenSoundKit =
    confirmedCategories.length === KITCHEN_SOUND_REQUIRED_MATERIALS.length &&
    KITCHEN_SOUND_REQUIRED_MATERIALS.every((material) =>
      confirmedCategories.includes(material),
    );
  const canStart = canStartKitchenSoundQuest(state);
  const gateParts = [
    underThreeSelected &&
    state.confirmedObjects.some((object) => !isUnderThreeCategory(object.category))
      ? "only under-three-approved items for this band"
      : null,
    state.materialSource === "photo" && !photoPreviewUrl
      ? "an object-only photo"
      : null,
    state.materialSource === "typed" &&
    typedMaterialNormalization.accepted.length === 0 && !typedLiveInventory
      ? "recognized material names"
      : null,
    state.materialSource === "typed" &&
    typedMaterialNormalization.inputError !== null
      ? "a shorter material list"
      : null,
    state.confirmedObjects.length === 0
      ? "one parent-confirmed material"
      : null,
    state.selectedWeatherTags.length === 0 ? "one weather tag" : null,
    !state.parentApprovedWeather ? "weather approval" : null,
    !state.parentConfirmedSafety ? "the safety check" : null,
  ].filter(Boolean);

  const learningFocuses = activeQuest.developmentalFocusIds
    .map((id) => findLearningFocus(id))
    .filter((focus) => focus !== undefined);

  // How the current activity was produced, for an honest parent-facing badge.
  const activityOrigin: "prepared" | "live" | "fallback" =
    liveSource === "live_provider"
      ? "live"
      : state.materialSource === "seeded_demo"
        ? "prepared"
        : "fallback";
  const activityOriginLabel = {
    prepared: "Prepared demo activity",
    live: "Generated live for your objects, weather & age",
    fallback: "Prepared fallback activity",
  }[activityOrigin];

  const canCreateNextSuggestion =
    canCreateKitchenSoundNextSuggestion(state);
  const nextSuggestionGateParts = state.observationDraft
    ? [
        state.observationDraft.parentSummary.trim().length === 0
          ? "a short reviewed summary (kept out of the suggestion)"
          : null,
        state.observationDraft.interestTags.length === 0
          ? "at least one interest tag"
          : null,
      ].filter(Boolean)
    : [];

  const availableObservationTags: readonly DemoObservationTag[] =
    ObservationTagSchema.options;

  return (
    <div className="demo-shell">
      <a className="skip-link" href="#demo-content" onClick={focusMainContent}>
        Skip to the case file
      </a>

      <header className="demo-header">
        <div className="brand" aria-label="RummageLab">
          <span aria-hidden="true" className="brand-mark">
            R
          </span>
          <p className="wordmark">RummageLab</p>
        </div>

        <div className="seeded-banner" role="note">
          <strong>
            {liveSource === "live_provider" ? "Live GPT-5.6" : state.materialSource === "seeded_demo" ? "Seeded demo" : "Safe intake"}
          </strong>
          <span>
            {state.materialSource === "seeded_demo"
              ? "Prepared example—no live photo, weather, voice, or GPT analysis."
              : state.materialSource === "photo"
                ? livePhotoAnalysisAvailable
                  ? "A confirmed object-only photo may be transiently re-encoded and analyzed; it is not stored."
                  : "Local photo preview only—choose the prepared kit or typed materials to continue."
                : livePhotoAnalysisAvailable
                  ? "Typed names can use the local allowlist or transient GPT-5.6 category suggestions; only confirmed categories reach planning."
                  : "Typed names use the local allowlist; only confirmed categories may reach planning."}
          </span>
        </div>

        <div className="header-actions">
          <button className="text-button" onClick={resetDemo} type="button">
            Reset demo
          </button>
        </div>
      </header>

      <main
        className="demo-main"
        id="demo-content"
        ref={demoMainRef}
        tabIndex={-1}
      >
        <p className="sr-only" aria-live="polite" role="status">
          {announcement}
        </p>

        {state.phase === "kit_review" ? (
          <section className="stage" data-phase="kit-review">
            <StageHeader
              deck="Choose an age band first. Then use ordinary objects to unlock a short, parent-led activity that fits this public demo."
              eyebrow={phaseProgress[state.phase]}
              headingRef={stageHeadingRef}
              title="What kind of discovery fits today?"
            />

            <section className="age-stage-desk" aria-labelledby="age-stage-title">
              <div>
                <p className="panel-kicker">Choose a starting stage</p>
                <h2 className="intake-title" id="age-stage-title">Your child sets the lens.</h2>
              </div>
              <label className="age-stage-field">
                <span>Age band</span>
                <select
                  aria-describedby="age-stage-description"
                  onChange={(event) => chooseAgeStage(event.currentTarget.value as DemoAgeStage)}
                  value={state.selectedAgeStage}
                >
                  {demoAgeStageOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <div className="age-focus-card" id="age-stage-description">
                <span className="specimen-label">Learning focus</span>
                <strong>{selectedAgeOption.focusLabel}</strong>
                <p>{selectedAgeOption.description}</p>
              </div>
            </section>

            {underThreeSelected ? (
              <aside className="age-stage-note" role="status">
                <p className="panel-kicker">Under-three boundary</p>
                <h2>Only large, soft, mouth-safe items can enter this band.</h2>
                <p>
                  For ages 0–2, activities are caregiver-led and screen-free for
                  the child, and only the smaller under-three material allowlist
                  (large containers, soft cloth, board books, large soft balls)
                  can be confirmed.
                </p>
              </aside>
            ) : null}
            {(
              <>

            <section className="intake-desk" aria-labelledby="intake-title">
              <div>
                <p className="panel-kicker">Pick your starting clue</p>
                <h2 className="intake-title" id="intake-title">
                  Rummage your way in.
                </h2>
                <p className="intake-copy">
                  All three paths end at the same grown-up confirmation desk.
                  Nothing becomes activity context just because it was pictured
                  or typed.
                </p>
              </div>
              <fieldset>
                <legend className="sr-only">Choose a material input method</legend>
                <div className="intake-options">
                  {(Object.keys(intakeChoiceCopy) as MaterialIntakeSource[]).map(
                    (source) => (
                      <label className="intake-option" key={source}>
                        <input
                          checked={state.materialSource === source}
                          name="material-intake-source"
                          onChange={() => chooseMaterialSource(source)}
                          type="radio"
                          value={source}
                        />
                        <span>
                          <strong>{intakeChoiceCopy[source].label}</strong>
                          <small>{intakeChoiceCopy[source].detail}</small>
                        </span>
                      </label>
                    ),
                  )}
                </div>
              </fieldset>
            </section>

            <div className="kit-grid">
              <div className="photo-card">
                {state.materialSource === "seeded_demo" ? (
                  <>
                    <Image
                      alt="Two empty plastic containers, a wooden spoon, and a folded teal dish towel arranged on a plain table."
                      className="demo-photo"
                      height={1086}
                      priority
                      src="/demo/kitchen-sound-detectives.jpg"
                      width={1448}
                    />
                    <div className="photo-caption">
                      <span className="specimen-label">Object-only demo photo</span>
                      <span>
                        Prepared local fixture · no people, faces, mail, or
                        identifying details. Nothing was uploaded or analyzed.
                      </span>
                    </div>
                  </>
                ) : null}

                {state.materialSource === "photo" ? (
                  <div className="local-photo-intake">
                    {photoPreviewUrl ? (
                      <Image
                        alt="Parent-selected object-only materials preview."
                        className="demo-photo"
                        height={900}
                        src={photoPreviewUrl}
                        unoptimized
                        width={1200}
                      />
                    ) : (
                      <div className="photo-drop-placeholder" aria-hidden="true">
                        <span>01</span>
                        <strong>Objects only</strong>
                        <small>No people, mail, labels, or screens</small>
                      </div>
                    )}
                    <div className="photo-caption">
                      <span className="specimen-label">Object-only photo</span>
                      <span>
                        {photoFileName
                          ? `${photoFileName} is ready for your review.`
                          : "Choose a JPEG, PNG, or WebP under 8 MB."}
                      </span>
                    </div>
                    <label className="file-field">
                      <span>{photoPreviewUrl ? "Replace photo" : "Take or choose photo"}</span>
                      <input
                        accept="image/jpeg,image/png,image/webp"
                        aria-describedby="photo-boundary"
                        onChange={selectLocalPhoto}
                        ref={photoInputRef}
                        type="file"
                      />
                    </label>
                    {!livePhotoAnalysisAvailable ? (
                      <p className="privacy-note">More credits required for OpenAI analysis.</p>
                    ) : null}
                    {photoPreviewUrl ? (
                      <>
                        <label className="approval-row">
                          <input checked={objectOnlyConsent} onChange={(event) => { const checked = event.currentTarget.checked; setObjectOnlyConsent(checked); if (!checked) { runtimeRequestVersionRef.current += 1; setLiveInventory(null); setLiveSource(null); dispatch({ type: "SET_OBJECT_CANDIDATES", candidates: [] }); } }} type="checkbox" />
                          <span className="check-copy">I confirm this photo shows objects only<span className="check-detail">No people, faces, mail, labels, screens, or identifying details.</span></span>
                        </label>
                        <div className="button-row">
                          {livePhotoAnalysisAvailable ? (
                            <button className="primary-button" disabled={!objectOnlyConsent || runtimePreviewStatus === "loading"} onClick={analyzePhoto} type="button">{runtimePreviewStatus === "loading" ? (<><span className="loading-spinner loading-spinner--inline" aria-hidden="true" />Analyzing objects…</>) : "Analyze objects with GPT-5.6"}</button>
                          ) : null}
                          <button className="text-button photo-remove" onClick={() => { clearPhotoSelection(); setAnnouncement("Photo removed and confirmations cleared."); }} type="button">Remove photo</button>
                        </div>
                      </>
                    ) : null}
                    <p className="privacy-note" id="photo-boundary">
                      Objects only: no people, faces, mail, labels, or screens.
                      Live analysis is optional. After your confirmation, the server
                      decodes and freshly re-encodes the photo to remove metadata,
                      sends it once with <code>store: false</code>, and does not save
                      the upload or provider response. Reset or page exit clears the preview.
                    </p>
                    {photoError ? (
                      <p className="input-error" role="alert">
                        {photoError}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {state.materialSource === "typed" ? (
                  <div className="typed-material-intake">
                    <span className="specimen-label">Typed material desk</span>
                    <label className="typed-material-field">
                      <span>List up to five materials</span>
                      <textarea
                        aria-describedby="typed-material-boundary"
                        maxLength={404}
                        onChange={(event) =>
                          updateTypedMaterials(event.currentTarget.value)
                        }
                        placeholder={"plastic containers\nwooden spoon\ndish towel"}
                        rows={6}
                        value={typedMaterialText}
                      />
                    </label>
                    <p className="privacy-note" id="typed-material-boundary">
                      Use object names only—no names, phone numbers, email,
                      address, school, or daycare. You can keep using the small
                      on-device allowlist, or ask GPT-5.6 to map up to five
                      transient everyday-object labels into safe categories. Neither
                      path can promise perfect PII detection.
                    </p>

                    {livePhotoAnalysisAvailable ? (
                      <div className="button-row">
                        <button
                          className="primary-button"
                          disabled={!typedMaterialText.trim() || typedInventoryStatus === "loading"}
                          onClick={suggestTypedCategories}
                          type="button"
                        >
                          {typedInventoryStatus === "loading" ? (<><span className="loading-spinner loading-spinner--inline" aria-hidden="true" />Suggesting safe categories…</>) : "Suggest safe categories with GPT-5.6"}
                        </button>
                      </div>
                    ) : (
                      <p className="privacy-note">More credits required for OpenAI analysis. The local allowlist remains available.</p>
                    )}
                    {typedInventoryMessage ? (
                      <p className={typedInventoryStatus === "error" ? "input-error" : "privacy-note"} role={typedInventoryStatus === "error" ? "alert" : undefined}>
                        {typedInventoryMessage}
                      </p>
                    ) : null}

                    {typedMaterialNormalization.inputError ? (
                      <p className="input-error" role="alert">
                        {typedMaterialNormalization.inputError}
                      </p>
                    ) : null}

                    {typedMaterialNormalization.accepted.length > 0 ? (
                      <div className="normalization-group">
                        <h3>Ready for your check</h3>
                        <ul className="normalization-list accepted-list">
                          {typedMaterialNormalization.accepted.map((item) => (
                            <li key={item.category}>{item.displayLabel}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {typedMaterialNormalization.excluded.length > 0 ? (
                      <div className="normalization-group">
                        <h3>Kept out of the kit</h3>
                        <ul className="normalization-list excluded-list">
                          {typedMaterialNormalization.excluded.map((item, index) => (
                            <li key={`${item.reason}-${index}`}>
                              <strong>
                                {item.reason === "private_information"
                                  ? "Contact-like entry"
                                  : item.inputLabel}
                              </strong>{" "}
                              — {item.message}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {typedMaterialText.trim() &&
                    typedMaterialNormalization.missing.length > 0 ? (
                      <div className="normalization-group missing-group">
                        <h3>Still needed for the Kitchen Sound kit</h3>
                        <p>
                          Kitchen Sound Detectives uses {typedMaterialNormalization.missing
                            .map((category) => materialNames[category])
                            .join(", ")}. You can also ask GPT-5.6 for a different reviewed activity based on your confirmed objects.
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <section className="confirmation-panel" aria-labelledby="kit-title">
                <p className="panel-kicker">Parent checkpoint</p>
                <h2 className="panel-title" id="kit-title">
                  You decide what enters the quest.
                </h2>
                <p className="panel-copy">
                  {state.materialSource === "seeded_demo"
                    ? "These three suggestions came from a prepared fixture. Confirm what is present and safe before any activity context is built."
                    : state.materialSource === "photo"
                      ? liveSource === "live_provider"
                        ? "GPT-5.6 suggested these constrained categories. It cannot determine safety; confirm only what is really present and safe."
                        : livePhotoAnalysisAvailable
                          ? "Waiting for a constrained inventory. Confirm only what is really present and safe."
                          : "Choose the prepared kit or typed materials to create confirmation cards."
                      : typedLiveInventory
                        ? "GPT-5.6 suggested constrained categories from transient object labels. Confirm only what is really present and safe."
                      : "Only exact matches from the small demo allowlist appear here. Confirm what is present and safe before it enters context."}
                </p>

                {hasKitchenSoundKit && canStart ? (
                  <aside className="activity-unlocked" aria-label="Unlocked activity">
                    <span className="specimen-label">Activity unlocked</span>
                    <h3>Kitchen Sound Detectives</h3>
                    <p>
                      Three familiar kitchen materials are ready for a short,
                      grown-up-led sound investigation.
                    </p>
                    <ul className="case-meta" aria-label="Unlocked activity details">
                      <li>8 minutes</li>
                      <li>Indoors</li>
                    </ul>
                  </aside>
                ) : null}

                <fieldset disabled={!materialSuggestionsReady}>
                  <legend>Confirm the material kit</legend>
                  <div className="check-list">
                    {suggestedMaterialItems.map((item) => {
                      const checked = state.confirmedObjects.some(
                        (object) => object.id === item.id,
                      );
                      const blockedForUnderThree =
                        underThreeSelected && !isUnderThreeCategory(item.category);

                      return (
                        <label className="check-row" key={item.id}>
                          <input
                            checked={checked}
                            disabled={blockedForUnderThree}
                            onChange={() =>
                              dispatch({ type: "TOGGLE_OBJECT", id: item.id })
                            }
                            type="checkbox"
                          />
                          <span className="check-copy">
                            {item.label}
                            <span className="check-detail">
                              {materialDetails[item.category]}
                            </span>
                            {blockedForUnderThree ? (
                              <span className="check-warning" role="note">
                                <strong>Not for under-three:</strong>{" "}
                                Only large containers, soft cloth, board books, and large soft balls can be confirmed for this band.
                              </span>
                            ) : null}
                            {item.warnings.length > 0 ? (
                              <span className="check-warning" role="note">
                                <strong>
                                  {item.safetyLevel === "caution" ? "Caution" : "Note"}:
                                </strong>{" "}
                                {item.warnings.join(" ")} A grown-up decides whether to include it.
                              </span>
                            ) : null}
                          </span>
                        </label>
                      );
                    })}
                    {suggestedMaterialItems.length === 0 ? (
                      <p className="empty-inventory">
                        Type a recognized container, wooden utensil, or soft cloth
                        to create confirmation cards.
                      </p>
                    ) : null}
                  </div>
                </fieldset>

                <div className="context-block">
                  <fieldset>
                    <legend>Confirm the demo weather tags</legend>
                    <div className="city-card">
                      <label className="city-field">
                        <span className="city-label">
                          Public demo city
                        </span>
                        <select
                          aria-describedby="demo-city-boundary"
                          className="city-input"
                          onChange={(event) => {
                            setDemoCityLabel(event.currentTarget.value);
                            setWeatherLookupStatus("idle");
                            setWeatherLookupMessage(null);
                          }}
                          value={demoCityLabel}
                        >
                          {demoCities.map((city) => (
                            <option key={city.label} value={city.label}>
                              {city.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <p className="city-note" id="demo-city-boundary">
                        A curated public city—not your location. Only the
                        approved tags below enter the activity context. The
                        optional lookup sends this public city&apos;s fixed
                        coordinates directly to Open-Meteo (no key, no account)
                        and maps the conditions to tags on this device.
                      </p>
                      <div className="button-row">
                        <button
                          className="secondary-button"
                          disabled={weatherLookupStatus === "loading"}
                          onClick={() => void suggestWeatherTags()}
                          type="button"
                        >
                          {weatherLookupStatus === "loading" ? (
                            <>
                              <span className="loading-spinner loading-spinner--inline" aria-hidden="true" />
                              Checking city weather…
                            </>
                          ) : (
                            "Suggest tags from city weather"
                          )}
                        </button>
                      </div>
                      {weatherLookupMessage ? (
                        <p
                          className={weatherLookupStatus === "error" ? "input-error" : "privacy-note"}
                          role={weatherLookupStatus === "error" ? "alert" : "status"}
                        >
                          {weatherLookupMessage}
                        </p>
                      ) : null}
                    </div>

                    <div className="chip-row">
                      {KITCHEN_SOUND_AVAILABLE_WEATHER_TAGS.map((tag) => {
                        const selected =
                          state.selectedWeatherTags.includes(tag);
                        const maximumSelected =
                          state.selectedWeatherTags.length >= 4;

                        return (
                          <label className="chip-check" key={tag}>
                            <input
                              checked={selected}
                              disabled={maximumSelected && !selected}
                              onChange={() =>
                                dispatch({ type: "TOGGLE_WEATHER_TAG", tag })
                              }
                              type="checkbox"
                            />
                            <span>{weatherLabels[tag]}</span>
                          </label>
                        );
                      })}
                    </div>
                    <p className="chip-note">
                      Rainy and cold are prepared suggestions. Choose 1–4 broad
                      tags, then approve the final set.
                    </p>

                    <label className="approval-row">
                      <input
                        checked={state.parentApprovedWeather}
                        disabled={state.selectedWeatherTags.length === 0}
                        onChange={(event) =>
                          dispatch({
                            type: "SET_WEATHER_APPROVED",
                            approved: event.currentTarget.checked,
                          })
                        }
                        type="checkbox"
                      />
                      <span className="check-copy">
                        Approve these demo weather tags
                        <span className="check-detail">
                          Only the selected tags—not the city—enter the activity
                          context.
                        </span>
                      </span>
                    </label>
                  </fieldset>
                </div>

                <div className="context-block">
                  <label className="approval-row">
                    <input
                      checked={state.parentConfirmedSafety}
                      onChange={(event) =>
                        dispatch({
                          type: "SET_SAFETY_CONFIRMED",
                          confirmed: event.currentTarget.checked,
                        })
                      }
                      type="checkbox"
                    />
                    <span className="check-copy">
                      I checked the kit and we’ll play together
                      <span className="check-detail">
                        Items are empty, intact, room-temperature, unbreakable,
                        and used with a grown-up within arm’s reach.
                      </span>
                    </span>
                  </label>
                  <p className="safety-callout">
                    Stop if anything cracks, splinters, comes loose, feels
                    uncomfortable, or the play stops feeling calm.
                  </p>
                </div>

                <p className="gate-note" aria-live="polite">
                  {canStart
                    ? "Ready: the validated activity context can now be built."
                    : `Still needed: ${gateParts.join(", ")}.`}
                </p>

                <div className="button-row">
                  {runtimePreviewStatus === "idle" ? (
                    <>
                      <button
                        className="primary-button"
                        disabled={!canStart}
                        onClick={() => startQuest()}
                        type="button"
                      >
                        Make our activity
                      </button>
                    </>
                  ) : null}
                  {runtimePreviewStatus === "loading" && canStart ? (
                    <p className="gate-note runtime-loading" role="status">
                      <span className="loading-spinner" aria-hidden="true" />
                      Generating a strictly validated activity… Raw photo and typed text are not included in this planning request.
                    </p>
                  ) : null}
                  {runtimePreviewStatus === "fallback" || runtimePreviewStatus === "error" ? (
                    <div className="runtime-fallback" role="alert">
                      <p>
                        Live mode was unavailable or rejected, so the prepared safe path remains available. Raw content is not shown or logged.
                      </p>
                      <div className="button-row">
                        <button
                          className="primary-button"
                          disabled={!canStart}
                          onClick={openPreparedFallback}
                          type="button"
                        >
                          Open prepared fallback
                        </button>
                        <button
                          className="secondary-button"
                          onClick={() => void startQuest()}
                          type="button"
                        >
                          Retry live planner
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </section>
            </div>
              </>
            )}
          </section>
        ) : null}

        {state.phase === "quest" ? (
          <section className="stage" data-phase="quest">
            <StageHeader
              deck={activeQuest.experienceMode === "guided_quest"
                ? "The real objects lead the play. This approved screen only guides prediction, noticing, and turns."
                : "This is a caregiver-led, screen-free moment. The script below is for the grown-up; the real objects lead the play."}
              eyebrow={phaseProgress[state.phase]}
              headingRef={stageHeadingRef}
              title={activeQuest.title}
            />

            <div className={`activity-origin activity-origin--${activityOrigin}`} role="note">
              <span className="activity-origin-badge">{activityOriginLabel}</span>
              <p className="activity-summary">
                {activeQuest.experienceMode === "guided_quest"
                  ? activeQuest.activitySummary ?? activeQuest.parentFacingGoal
                  : activeQuest.parentFacingGoal}
              </p>
            </div>

            {activeQuest.experienceMode === "guided_quest" ? (
            <div className="quest-layout">
              <div>
                <article className="notebook-card">
                  <p className="panel-kicker">Validated quest · {activeQuest.steps.length > 0 ? `${Math.max(...activeQuest.steps.map((step) => step.minute)) + 2} minutes` : "short"}</p>
                  <h2 className="panel-title">Follow the clues</h2>
                  <p className="parent-cue">
                    Stay close and follow the grown-up safety note. Let your child
                    point, copy, or choose a word—there is no right answer to score.
                  </p>

                  <ol className="quest-steps">
                    {activeQuest.steps.map((step) => (
                      <li className="quest-step" key={`${step.minute}-${step.instruction}`}>
                        <div>
                          <span className="step-minute">Minute {step.minute}</span>
                          <p className="step-copy">{step.instruction}</p>
                        </div>
                      </li>
                    ))}
                  </ol>

                  <div className="focus-strip" aria-label="Developmental focus">
                    {learningFocuses.map((focus) => (
                      <span className="focus-chip" key={focus.id}>
                        {focus.title}
                      </span>
                    ))}
                  </div>

                  <p className="safety-callout">
                    <strong>Grown-up safety note:</strong>{" "}
                    {activeQuest.adultSafetyNote}
                  </p>
                </article>
              </div>

              <div>
                {activeQuest.tool.kind === "sound_mix" ? (
                  <SoundMixTool
                    onAdd={addSound}
                    onClear={() => setSoundTrail([])}
                    spec={activeQuest.tool}
                    trail={soundTrail}
                  />
                ) : activeQuest.tool.kind === "predict" ? (
                  <PredictTool
                    onChoose={setPredictionChoice}
                    selectedOption={predictionChoice}
                    spec={activeQuest.tool}
                  />
                ) : activeQuest.tool.kind === "sort" ? (
                  <SortTool spec={activeQuest.tool} />
                ) : activeQuest.tool.kind === "measure" ? (
                  <MeasureTool spec={activeQuest.tool} />
                ) : activeQuest.tool.kind === "field_journal" ? (
                  <FieldJournalTool spec={activeQuest.tool} />
                ) : null}

                <div className="button-row">
                  <button
                    className="primary-button"
                    onClick={() => transitionDemo({ type: "FINISH_QUEST" })}
                    type="button"
                  >
                    We finished this activity
                  </button>
                </div>
              </div>
            </div>
            ) : (
            <div className="quest-layout">
              <div>
                <article className="notebook-card">
                  <p className="panel-kicker">
                    Caregiver-led moment · no child screen use
                  </p>
                  <h2 className="panel-title">The grown-up script</h2>
                  <p className="parent-cue">
                    Read each line, go slowly, and follow your child&apos;s cues.
                    There is nothing to score and nothing for the child on screen.
                  </p>

                  <ol className="quest-steps">
                    {activeQuest.adultScript.map((line, index) => (
                      <li className="quest-step" key={`${index}-${line}`}>
                        <div>
                          <span className="step-minute">Step {index + 1}</span>
                          <p className="step-copy">{line}</p>
                        </div>
                      </li>
                    ))}
                  </ol>

                  <div className="focus-strip" aria-label="Developmental focus">
                    {learningFocuses.map((focus) => (
                      <span className="focus-chip" key={focus.id}>
                        {focus.title}
                      </span>
                    ))}
                  </div>

                  <p className="safety-callout">
                    <strong>Keep away:</strong>{" "}
                    {activeQuest.forbiddenMaterialCategories.join("; ")}.
                  </p>
                  <p className="safety-callout">
                    <strong>Stop if:</strong>{" "}
                    {activeQuest.stopIf.join(" ")}
                  </p>
                </article>
              </div>

              <div>
                <article className="notebook-card">
                  <p className="panel-kicker">Afterwards</p>
                  <h2 className="panel-title">One thing to notice</h2>
                  <p className="parent-cue">{activeQuest.parentObservationPrompt}</p>
                </article>
                <div className="button-row">
                  <button
                    className="primary-button"
                    onClick={() => transitionDemo({ type: "FINISH_QUEST" })}
                    type="button"
                  >
                    We finished this moment
                  </button>
                </div>
              </div>
            </div>
            )}
          </section>
        ) : null}

        {state.phase === "reflection" ? (
          <section className="stage" data-phase="reflection">
            <StageHeader
              deck="Reflection is optional and parent-only. Skip, use a prepared example, or send one short typed note after the privacy check."
              eyebrow={phaseProgress[state.phase]}
              headingRef={stageHeadingRef}
              title="What did you notice?"
            />

            <div className="choice-grid">
              <article className="choice-card">
                <p className="panel-kicker">Finish privately</p>
                <h2 className="panel-title">Skip reflection</h2>
                <p className="panel-copy">
                  End the activity now. No observation, adaptive tags, or next
                  suggestion will be created.
                </p>
                <div className="button-row">
                  <button
                    className="secondary-button"
                    onClick={skipReflection}
                    type="button"
                  >
                    Skip reflection
                  </button>
                </div>
              </article>

              <article className="choice-card">
                <p className="panel-kicker">Optional typed note</p>
                <h2 className="panel-title">Turn your note into a draft</h2>
                <p className="panel-copy">
                  Write only what you noticed during play. Do not include names,
                  contact details, school, address, health details, or diagnoses.
                  The automatic screen is conservative and cannot guarantee detection.
                </p>
                <label className="text-field">
                  Short parent observation
                  <textarea
                    aria-describedby="typed-reflection-boundary"
                    disabled={reflectionStatus === "loading"}
                    maxLength={400}
                    onChange={(event) => {
                      setTypedReflection(event.currentTarget.value);
                      setReflectionMessage(null);
                    }}
                    value={typedReflection}
                  />
                </label>
                <p className="privacy-note" id="typed-reflection-boundary">
                  {typedReflection.length}/400 characters. Cleared after one request;
                  never saved or used directly for the next idea.
                </p>
                {reflectionMessage ? <p aria-live="polite" className="gate-note">{reflectionMessage}</p> : null}
                <div className="button-row">
                  <button
                    className="primary-button"
                    disabled={reflectionStatus === "loading"}
                    onClick={submitTypedReflection}
                    type="button"
                  >
                    {reflectionStatus === "loading" ? "Preparing safely…" : reflectionStatus === "error" ? "Retry typed reflection" : "Prepare reflection draft"}
                  </button>
                </div>
              </article>

              {activeQuest.id === KITCHEN_SOUND_DEMO_ID ? (
              <article className="choice-card">
                <p className="panel-kicker">Prepared example</p>
                <h2 className="panel-title">Review a demo observation</h2>
                <p className="panel-copy">
                  See how a parent can edit a prepared note and approve only
                  allowlisted tags for one try-next idea.
                </p>
                <div className="button-row">
                  <button
                    className="primary-button"
                    onClick={reviewPreparedObservation}
                    type="button"
                  >
                    Review demo observation
                  </button>
                </div>
              </article>
              ) : null}
            </div>
          </section>
        ) : null}

        {state.phase === "observation_review" && state.observationDraft ? (
          <section className="stage" data-phase="observation-review">
            <StageHeader
              deck={activeQuest.id === KITCHEN_SOUND_DEMO_ID
                ? "Review this wording, then choose the small tag set you approve. The note itself can never shape the next idea."
                : "Edit your note, then choose the small tag set you approve. Your reviewed note and approved tags shape one live idea."}
              eyebrow={phaseProgress[state.phase]}
              headingRef={stageHeadingRef}
              title="What you noticed"
            />

            <div className="observation-layout">
              <article className="notebook-card">
                <div className="seeded-stamp">{reflectionStatus === "fallback" ? "Prepared fallback observation" : "Parent-review draft"}</div>
                <h2 className="panel-title">Parent review</h2>
                <p className="panel-copy">
                  This editable suggestion exists only in React memory and
                  disappears on reset or reload. Voice is not implemented.
                </p>

                <label className="text-field">
                  Edit the parent summary
                  <textarea
                    aria-describedby="summary-boundary"
                    maxLength={240}
                    onChange={(event) =>
                      dispatch({
                        type: "EDIT_OBSERVATION_SUMMARY",
                        parentSummary: event.currentTarget.value,
                      })
                    }
                    value={state.observationDraft.parentSummary}
                  />
                </label>
                <p className="privacy-note" id="summary-boundary">
                  Keep private details out. This wording stays only in this
                  session until reset or reload. For Kitchen Sound Detectives,
                  only the tags you approve can shape the next idea.
                </p>
              </article>

              <article className="notebook-card">
                <p className="panel-kicker">Adaptive boundary</p>
                <h2 className="panel-title">Choose what can shape one idea</h2>
                <p className="panel-copy">
                  Only checked, allowlisted tags cross this boundary. Remove any
                  tag you do not approve; keep at least one interest tag to make
                  a try-next idea.
                </p>

                <fieldset className="tag-fieldset">
                  <legend>What held their interest</legend>
                  <div className="tag-grid">
                    {availableObservationTags.map((tag) => (
                      <label className="chip-check" key={tag}>
                        <input
                          checked={state.observationDraft?.interestTags.includes(tag)}
                          onChange={() =>
                            dispatch({ type: "TOGGLE_INTEREST_TAG", tag })
                          }
                          type="checkbox"
                        />
                        <span>{observationTagLabels[tag]}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="tag-fieldset">
                  <legend>What to support next time</legend>
                  <div className="tag-grid">
                    {availableObservationTags.map((tag) => (
                      <label className="chip-check" key={tag}>
                        <input
                          checked={state.observationDraft?.supportTags.includes(tag)}
                          onChange={() =>
                            dispatch({ type: "TOGGLE_SUPPORT_TAG", tag })
                          }
                          type="checkbox"
                        />
                        <span>{observationTagLabels[tag]}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <p className="boundary-note">
                  Reload or reset clears the note and tags. No photo, city,
                  name, voice, or history can be used.
                </p>

                <p className="gate-note" aria-live="polite">
                  {canCreateNextSuggestion
                    ? "Ready: only the checked tags can shape one suggestion."
                    : `Still needed: ${nextSuggestionGateParts.join(", ")}.`}
                </p>

                <div className="button-row">
                  <button
                    className="primary-button"
                    disabled={!canCreateNextSuggestion || nextIdeaStatus === "loading"}
                    onClick={() => void approveTagsForIdea()}
                    type="button"
                  >
                    {nextIdeaStatus === "loading" ? (
                      <>
                        <span className="loading-spinner loading-spinner--inline" aria-hidden="true" />
                        Making one idea…
                      </>
                    ) : (
                      "Approve these tags for one idea"
                    )}
                  </button>
                </div>
              </article>
            </div>
          </section>
        ) : null}

        {state.phase === "next_suggestion" && state.nextSuggestion ? (
          <section className="stage" data-phase="next-suggestion">
            <StageHeader
              deck="One app-authored, session-only invitation—connected only from the allowlisted tags you approved."
              eyebrow={phaseProgress[state.phase]}
              headingRef={stageHeadingRef}
              title="Try next"
            />

            <article className="final-card">
              <div className="final-stamp">
                {state.nextSuggestion.origin === "live"
                  ? `One-time idea · generated live · ${state.nextSuggestion.durationMinutes} minutes`
                  : `One-time idea · ${state.nextSuggestion.durationMinutes} minutes`}
              </div>
              <h2 className="panel-title">{state.nextSuggestion.title}</h2>
              <p className="panel-copy">{state.nextSuggestion.invitation}</p>
              <p className="panel-copy">
                <strong>Why this connects:</strong>{" "}
                {state.nextSuggestion.connection}
              </p>
              <div className="connection-tags" aria-label="Approved source tags">
                {[
                  ...state.nextSuggestion.basedOnTags.interestTags,
                  ...state.nextSuggestion.basedOnTags.supportTags,
                ].map((tag) => (
                  <span key={tag}>{observationTagLabels[tag]}</span>
                ))}
              </div>
              <p className="boundary-note">
                {state.nextSuggestion.origin === "live"
                  ? "Authored live from the tags you approved and your reviewed note, plus the confirmed objects, age band, and approved weather tags. Nothing was stored — one suggestion per completed activity."
                  : "Built only from the approved tags above. No note, photo, city, name, voice, score, or history was used — one suggestion per completed activity."}
              </p>
              <div className="button-row">
                {livePhotoAnalysisAvailable ? (
                  <button
                    className="primary-button"
                    disabled={nextCycleStatus === "loading"}
                    onClick={() => void tryIdeaNow()}
                    type="button"
                  >
                    {nextCycleStatus === "loading" ? (
                      <>
                        <span className="loading-spinner loading-spinner--inline" aria-hidden="true" />
                        Making this activity…
                      </>
                    ) : (
                      "Try this idea now"
                    )}
                  </button>
                ) : null}
                <button className="secondary-button" onClick={resetDemo} type="button">
                  Reset demo
                </button>
              </div>
              {livePhotoAnalysisAvailable ? (
                <p className="privacy-note">
                  Trying the idea generates a full activity live from this accepted
                  idea and your unchanged confirmed objects, age band, and weather.
                  Your other confirmations carry forward; nothing new is collected.
                </p>
              ) : null}
            </article>
          </section>
        ) : null}

        {state.phase === "complete" ? (
          <section className="stage" data-phase="complete">
            <StageHeader
              deck="The play can end without sharing anything. No observation or next-activity context was created."
              eyebrow={phaseProgress[state.phase]}
              headingRef={stageHeadingRef}
              title="Case closed—nothing saved."
            />
            <article className="final-card">
              <div className="final-stamp">Reflection skipped</div>
              <h2 className="panel-title">All done</h2>
              <p className="panel-copy">
                The sound hunt is complete. Reset whenever you want to start the
                prepared example from a clean in-memory state.
              </p>
              <div className="button-row">
                <button className="primary-button" onClick={resetDemo} type="button">
                  Reset demo
                </button>
              </div>
            </article>
          </section>
        ) : null}
      </main>

      <footer className="privacy-footer">
        Seeded path needs no key · no login · no analytics · no browser storage ·
        live mode uses transient server processing with no app storage.
        Reset or reload starts over.
      </footer>
    </div>
  );
}
