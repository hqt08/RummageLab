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
import {
  canCreateKitchenSoundNextSuggestion,
  canStartKitchenSoundQuest,
  createInitialKitchenSoundDemoState,
  kitchenSoundDemoReducer,
  type KitchenSoundDemoAction,
  type KitchenSoundDemoPhase,
} from "../lib/demo/demo-state";
import {
  KITCHEN_SOUND_DEMO_LOCATION_LABEL,
  KITCHEN_SOUND_AVAILABLE_WEATHER_TAGS,
  KITCHEN_SOUND_REQUIRED_MATERIALS,
  createKitchenSoundActivityContext,
  kitchenSoundPhotoInventory,
  kitchenSoundQuest,
  type DemoObservationTag,
  type DemoWeatherTag,
} from "../lib/demo/kitchen-sound-detectives";
import { findLearningFocus } from "../lib/data/learning-focuses";
import {
  createLocalPhotoPreview,
  normalizeKitchenSoundTypedMaterials,
  readLocalObjectPhotoDimensions,
  releaseLocalPhotoPreview,
  validateLocalObjectPhoto,
  validateLocalObjectPhotoContent,
  validateLocalObjectPhotoDimensions,
  type MaterialIntakeSource,
} from "../lib/demo/material-intake";
import type { AllowedMaterialCategory, PhotoInventory, QuestSpec } from "../lib/schemas";
import {
  ExperienceResponseSchema,
  LiveExperienceCapabilitySchema,
  PhotoInventoryResponseSchema,
} from "../lib/runtime/contracts";
import type { PhotoInventoryResponse } from "../lib/runtime/contracts";
import { ReflectionResponseSchema } from "../lib/runtime/reflection-contracts";
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
};

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
};

const phaseProgress: Record<KitchenSoundDemoPhase, string> = {
  kit_review: "Case file 1 of 4 · Review the kit",
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
      candidates: [] as AllowedMaterialCategory[],
    };
  }

  return {
    livePhotoAnalysisAvailable: true,
    inventory: payload.inventory,
    source: payload.runtime.source === "live_provider" ? "live_provider" as const : "seeded_fallback" as const,
    candidates: payload.inventory.suggestedItems.map((item) => item.allowedMaterialCategory),
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
    KITCHEN_SOUND_DEMO_LOCATION_LABEL,
  );
  const [soundTrail, setSoundTrail] = useState<string[]>([]);
  const [announcement, setAnnouncement] = useState("");
  const [resetVersion, setResetVersion] = useState(0);
  const [typedMaterialText, setTypedMaterialText] = useState("");
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [photoFileName, setPhotoFileName] = useState("");
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [runtimePreviewStatus, setRuntimePreviewStatus] =
    useState<RuntimePreviewStatus>("idle");
  const [liveInventory, setLiveInventory] = useState<PhotoInventory | null>(null);
  const [livePhotoAnalysisAvailable, setLivePhotoAnalysisAvailable] = useState(false);
  const [activeQuest, setActiveQuest] = useState<QuestSpec>(kitchenSoundQuest);
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

  const suggestedMaterialItems =
    state.materialSource === "typed"
      ? typedMaterialNormalization.accepted.map((item) => ({
          suggestedLabel: item.displayLabel,
          allowedMaterialCategory: item.category,
        }))
      : state.materialSource === "photo"
        ? liveInventory?.suggestedItems ?? []
        : kitchenSoundPhotoInventory.suggestedItems;

  const materialSuggestionsReady =
    state.materialSource === "seeded_demo" ||
    (state.materialSource === "photo" && liveInventory !== null) ||
    (state.materialSource === "typed" &&
      typedMaterialNormalization.accepted.length > 0 &&
      typedMaterialNormalization.inputError === null);

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
    setDemoCityLabel(KITCHEN_SOUND_DEMO_LOCATION_LABEL);
    setSoundTrail([]);
    setTypedMaterialText("");
    setPhotoPreviewUrl(null);
    setPhotoFileName("");
    setPhotoError(null);
    setRuntimePreviewStatus("idle");
    setLiveInventory(null);
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
    dispatch({ type: "SET_MATERIAL_CANDIDATES", materials: [] });
  }

  function chooseMaterialSource(source: MaterialIntakeSource) {
    runtimeRequestVersionRef.current += 1;
    if (state.materialSource === "photo" && source !== "photo") {
      clearPhotoSelection();
    }
    if (state.materialSource === "typed" && source !== "typed") {
      setTypedMaterialText("");
    }
    dispatch({ type: "SET_MATERIAL_SOURCE", source });
    setAnnouncement(`${intakeChoiceCopy[source].label} selected.`);
  }

  function updateTypedMaterials(value: string) {
    runtimeRequestVersionRef.current += 1;
    const normalization = normalizeKitchenSoundTypedMaterials(value);
    setTypedMaterialText(value);
    dispatch({
      type: "SET_MATERIAL_CANDIDATES",
      materials:
        normalization.inputError === null
          ? normalization.accepted.map((item) => item.category)
          : [],
    });
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
    dispatch({ type: "SET_MATERIAL_CANDIDATES", materials: [] });

    if (!file) {
      return;
    }

    const validation = validateLocalObjectPhoto(file);
    if (!validation.ok) {
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

    const nextPreviewUrl = createLocalPhotoPreview(
      file,
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
    if (!dimensionValidation.ok) {
      releaseLocalPhotoPreview(nextPreviewUrl);
      photoPreviewUrlRef.current = null;
      setPhotoError(dimensionValidation.message);
      input.value = "";
      setAnnouncement(dimensionValidation.message);
      return;
    }

    setPhotoPreviewUrl(nextPreviewUrl);
    setPhotoFileName(file.name);
    photoFileRef.current = file;
    setPhotoError(null);
    setAnnouncement(
      "Object photo ready as a local preview. Confirm the object-only boundary before live analysis.",
    );
  }

  async function analyzePhoto() {
    const file = photoFileRef.current;
    if (!file || !canSendPhotoForLiveAnalysis(livePhotoAnalysisAvailable, file, objectOnlyConsent)) {
      setLiveInventory(null);
      dispatch({ type: "SET_MATERIAL_CANDIDATES", materials: [] });
      return;
    }
    const requestVersion = ++runtimeRequestVersionRef.current;
    setRuntimePreviewStatus("loading");
    setPhotoError(null);
    const body = new FormData();
    body.set("operation", "photo_inventory");
    body.set("objectOnlyConfirmed", "true");
    body.set("ageStage", "3-4y");
    body.set("photo", file);
    try {
      const response = await fetch("/api/live-experience", { method: "POST", body });
      const payload = PhotoInventoryResponseSchema.parse(await response.json());
      if (runtimeRequestVersionRef.current !== requestVersion) return;
      const result = photoAnalysisResult(payload);
      setLivePhotoAnalysisAvailable(result.livePhotoAnalysisAvailable);
      setLiveInventory(result.inventory);
      setLiveSource(result.source);
      dispatch({
        type: "SET_MATERIAL_CANDIDATES",
        materials: result.candidates,
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
      setPhotoError("Live analysis could not prepare a safe inventory. Retry or use the prepared kit.");
    }
  }

  async function startQuest() {
    if (!canStart) {
      return;
    }
    if (!livePhotoAnalysisAvailable) {
      runtimeRequestVersionRef.current += 1;
      setRuntimePreviewStatus("idle");
      setLiveSource("seeded_fallback");
      if (state.materialSource === "typed") setTypedMaterialText("");
      setActiveQuest(kitchenSoundQuest);
      transitionDemo({ type: "START_QUEST", experience: kitchenSoundQuest });
      return;
    }
    const requestVersion = runtimeRequestVersionRef.current + 1;
    runtimeRequestVersionRef.current = requestVersion;
    setRuntimePreviewStatus("loading");
    setAnnouncement("Preparing a validated activity from parent-confirmed context.");
    const activityContext = createKitchenSoundActivityContext({
      materialSource: state.materialSource,
      confirmedMaterials: state.confirmedMaterials,
      approvedWeatherTags: state.selectedWeatherTags,
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
        JSON.stringify(current.confirmedMaterials) === JSON.stringify(state.confirmedMaterials) &&
        JSON.stringify(current.selectedWeatherTags) === JSON.stringify(state.selectedWeatherTags) &&
        current.parentApprovedWeather;
      if (runtimeRequestVersionRef.current !== requestVersion || !contextStillMatches || payload.experience.experienceMode !== "guided_quest") return;
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
    setAnnouncement("Opening the prepared, validated fallback quest.");
    setActiveQuest(kitchenSoundQuest);
    transitionDemo({ type: "START_QUEST", experience: kitchenSoundQuest });
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
        draft: {
          observedEvents: payload.suggestion.observedEvents,
          parentSummary: payload.suggestion.parentSummary,
          interestTags: payload.suggestion.suggestedInterestTags,
          supportTags: payload.suggestion.suggestedSupportTags,
        },
      });
    } catch {
      if (!reflectionRequestRef.current.isCurrent(request.version) || request.signal.aborted) return;
      setReflectionStatus("error");
      setReflectionMessage("A safe suggestion could not be prepared. Retry, use the prepared example, or skip.");
    } finally {
      reflectionRequestRef.current.finish(request.version);
    }
  }

  const canStart = canStartKitchenSoundQuest(state);
  const missingMaterialCount =
    KITCHEN_SOUND_REQUIRED_MATERIALS.length - state.confirmedMaterials.length;
  const gateParts = [
    state.materialSource === "photo" && !photoPreviewUrl
      ? "an object-only photo"
      : null,
    state.materialSource === "typed" &&
    typedMaterialNormalization.accepted.length === 0
      ? "recognized material names"
      : null,
    state.materialSource === "typed" &&
    typedMaterialNormalization.inputError !== null
      ? "a shorter material list"
      : null,
    missingMaterialCount > 0
      ? `${missingMaterialCount} material${missingMaterialCount === 1 ? "" : "s"}`
      : null,
    state.selectedWeatherTags.length === 0 ? "one weather tag" : null,
    !state.parentApprovedWeather ? "weather approval" : null,
    !state.parentConfirmedSafety ? "the safety check" : null,
  ].filter(Boolean);

  const learningFocuses = activeQuest.developmentalFocusIds
    .map((id) => findLearningFocus(id))
    .filter((focus) => focus !== undefined);

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

  const availableObservationTags = [
    "sound_play",
    "loud_quiet_contrast",
    "two_beat_pattern",
    "turn_taking",
    "descriptive_words",
    "cause_and_effect",
    "movement_play",
    "texture_exploration",
  ] as const satisfies readonly DemoObservationTag[];

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
              deck="Turn three ordinary kitchen things into an 8-minute sound hunt—grown-up led, screen-light, and ready without an API key."
              eyebrow={phaseProgress[state.phase]}
              headingRef={stageHeadingRef}
              title="Kitchen Sound Detectives"
            />

            <ul className="case-meta" aria-label="Activity details">
              <li>Ages 3–4</li>
              <li>8 minutes</li>
              <li>Grown-up co-play</li>
              <li>Indoors</li>
            </ul>

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
                        capture="environment"
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
                          <input checked={objectOnlyConsent} onChange={(event) => { const checked = event.currentTarget.checked; setObjectOnlyConsent(checked); if (!checked) { runtimeRequestVersionRef.current += 1; setLiveInventory(null); setLiveSource(null); dispatch({ type: "SET_MATERIAL_CANDIDATES", materials: [] }); } }} type="checkbox" />
                          <span className="check-copy">I confirm this photo shows objects only<span className="check-detail">No people, faces, mail, labels, screens, or identifying details.</span></span>
                        </label>
                        <div className="button-row">
                          {livePhotoAnalysisAvailable ? (
                            <button className="primary-button" disabled={!objectOnlyConsent || runtimePreviewStatus === "loading"} onClick={analyzePhoto} type="button">Analyze objects with GPT-5.6</button>
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
                      address, school, or daycare. This small on-device allowlist
                      is not AI analysis and cannot promise perfect PII detection.
                    </p>

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
                        <h3>Still needed for this sound quest</h3>
                        <p>
                          {typedMaterialNormalization.missing
                            .map((category) => materialNames[category])
                            .join(", ")}
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
                      : "Only exact matches from the small demo allowlist appear here. Confirm what is present and safe before it enters context."}
                </p>

                <fieldset disabled={!materialSuggestionsReady}>
                  <legend>Confirm the material kit</legend>
                  <div className="check-list">
                    {suggestedMaterialItems.map((item) => {
                      const checked = state.confirmedMaterials.includes(
                        item.allowedMaterialCategory,
                      );

                      return (
                        <label className="check-row" key={item.allowedMaterialCategory}>
                          <input
                            checked={checked}
                            onChange={() =>
                              dispatch({
                                type: "TOGGLE_MATERIAL",
                                material: item.allowedMaterialCategory,
                              })
                            }
                            type="checkbox"
                          />
                          <span className="check-copy">
                            {item.suggestedLabel}
                            <span className="check-detail">
                              {materialDetails[item.allowedMaterialCategory]}
                            </span>
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
                          Public demo city label
                        </span>
                        <input
                          aria-describedby="demo-city-boundary"
                          autoComplete="off"
                          className="city-input"
                          maxLength={60}
                          onChange={(event) =>
                            setDemoCityLabel(event.currentTarget.value)
                          }
                          type="text"
                          value={demoCityLabel}
                        />
                      </label>
                      <p className="city-note" id="demo-city-boundary">
                        Editable display only—not your location. Use a public
                        city, not an address. This text never enters the activity
                        context, triggers a lookup, or leaves React memory.
                      </p>
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
                        Make our sound quest
                      </button>
                    </>
                  ) : null}
                  {runtimePreviewStatus === "loading" ? (
                    <p className="gate-note" role="status">
                      Preparing a strictly validated activity. Raw photo and typed text are not included in this planning request.
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
          </section>
        ) : null}

        {state.phase === "quest" ? (
          <section className="stage" data-phase="quest">
            <StageHeader
              deck="The real objects make the sounds. This approved screen only guides prediction, noticing, pattern play, and turns."
              eyebrow={phaseProgress[state.phase]}
              headingRef={stageHeadingRef}
              title={activeQuest.title}
            />

            <div className="quest-layout">
              <div>
                <article className="notebook-card">
                  <p className="panel-kicker">Validated quest · 8 minutes</p>
                  <h2 className="panel-title">Follow the clues</h2>
                  <p className="parent-cue">
                    Stay close. Tap gently on a stable surface and let your child
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
                <SoundMixTool
                  onAdd={addSound}
                  onClear={() => setSoundTrail([])}
                  spec={activeQuest.tool.kind === "sound_mix" ? activeQuest.tool : kitchenSoundQuest.tool}
                  trail={soundTrail}
                />

                <div className="button-row">
                  <button
                    className="primary-button"
                    onClick={() => transitionDemo({ type: "FINISH_QUEST" })}
                    type="button"
                  >
                    We finished the sound hunt
                  </button>
                </div>
              </div>
            </div>
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
            </div>
          </section>
        ) : null}

        {state.phase === "observation_review" && state.observationDraft ? (
          <section className="stage" data-phase="observation-review">
            <StageHeader
              deck="Edit the prepared wording, then choose the small tag set you approve. The note itself can never shape the next idea."
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
                  Keep private details out. The raw typed note has already been
                  discarded and is never used to make the next suggestion.
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
                    disabled={!canCreateNextSuggestion}
                    onClick={() =>
                      transitionDemo({ type: "CREATE_NEXT_SUGGESTION" })
                    }
                    type="button"
                  >
                    Approve these tags for one idea
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
              <div className="final-stamp">One-time idea · 5 minutes</div>
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
                Built only from the approved tags above. No note, photo, city,
                name, voice, score, or history was used. There is no second
                suggestion in this session.
              </p>
              <div className="button-row">
                <button className="primary-button" onClick={resetDemo} type="button">
                  Reset demo
                </button>
              </div>
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
