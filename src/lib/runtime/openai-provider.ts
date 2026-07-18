import {
  ExperienceRequestSchema,
  PhotoInventoryRequestSchema,
  type ExperienceRuntimeProvider,
} from "./contracts";
import {
  availableApprovedQuestTemplateIds,
  deterministicApprovedQuestForContext,
} from "../demo/approved-quest-templates";
import { learningFocusCatalog } from "../data/learning-focuses";
import {
  AllowedMaterialCategorySchema,
  PhotoInventorySchema,
  QuestSpecSchema,
  RummageMomentSpecSchema,
  UnderThreeMaterialCategorySchema,
} from "../schemas";
import { RuntimeProviderFailure } from "./seeded-runtime";

/** Single source of truth for the model-facing category enum (no hand copy). */
const ALLOWED_MATERIAL_CATEGORY_ENUM = [...AllowedMaterialCategorySchema.options];
/** Smaller category enum for under-three bands, derived from the Zod source. */
const UNDER_THREE_CATEGORY_ENUM = [...UnderThreeMaterialCategorySchema.options];

function categoryEnumForAge(ageStage: string): readonly string[] {
  return ageStage === "0-12m" || ageStage === "12-36m"
    ? UNDER_THREE_CATEGORY_ENUM
    : ALLOWED_MATERIAL_CATEGORY_ENUM;
}
/** Only human-curated developmental focus IDs may be authored by the model. */
const DEVELOPMENTAL_FOCUS_ID_ENUM = learningFocusCatalog.map((focus) => focus.id);
/** Authoring a full activity reasons longer than a simple object inventory. */
const GENERATION_TIMEOUT_MS = 45_000;

export type TransientObjectImage = {
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  /** Base64 for already validated, decoded, and metadata-stripped image bytes. */
  base64: string;
};

export type OpenAIProviderOptions = {
  apiKey: string | undefined;
  transientImage: TransientObjectImage;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /** Model id for the Responses API. Owner-configurable to select a faster tier. */
  model?: string;
};

export const DEFAULT_OPENAI_MODEL = "gpt-5.6";

export const PHOTO_INVENTORY_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "imageMode",
    "objectOnlyReminder",
    "suggestedItems",
    "unsafeOrUncertainNotice",
    "requiresAdultSupervision",
  ],
  properties: {
    imageMode: { type: "string", enum: ["live"] },
    objectOnlyReminder: { type: "boolean", const: true },
    suggestedItems: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "suggestedLabel",
          "allowedMaterialCategory",
          "safetyLevel",
          "warnings",
          "needsParentConfirmation",
        ],
        properties: {
          suggestedLabel: { type: "string", minLength: 1, maxLength: 80 },
          allowedMaterialCategory: {
            type: "string",
            // Derived from AllowedMaterialCategorySchema so this can never drift
            // from the Zod source of truth (asserted by an enum-sync test).
            enum: ALLOWED_MATERIAL_CATEGORY_ENUM,
          },
          safetyLevel: { type: "string", enum: ["ok", "caution"] },
          warnings: {
            type: "array",
            maxItems: 3,
            items: { type: "string", minLength: 1, maxLength: 120 },
          },
          needsParentConfirmation: { type: "boolean", const: true },
        },
      },
    },
    unsafeOrUncertainNotice: { type: "string", minLength: 1, maxLength: 240 },
    requiresAdultSupervision: { type: "boolean", const: true },
  },
} as const;

/** Per-age inventory schema: under-three bands vet against the smaller enum. */
function photoInventoryJsonSchemaForAge(ageStage: string): object {
  const enumForAge = categoryEnumForAge(ageStage);
  if (enumForAge === ALLOWED_MATERIAL_CATEGORY_ENUM) return PHOTO_INVENTORY_JSON_SCHEMA;
  return {
    ...PHOTO_INVENTORY_JSON_SCHEMA,
    properties: {
      ...PHOTO_INVENTORY_JSON_SCHEMA.properties,
      suggestedItems: {
        ...PHOTO_INVENTORY_JSON_SCHEMA.properties.suggestedItems,
        items: {
          ...PHOTO_INVENTORY_JSON_SCHEMA.properties.suggestedItems.items,
          properties: {
            ...PHOTO_INVENTORY_JSON_SCHEMA.properties.suggestedItems.items.properties,
            allowedMaterialCategory: { type: "string", enum: enumForAge },
          },
        },
      },
    },
  };
}

const TOOL_BASE_PROPS = {
  title: { type: "string", minLength: 1, maxLength: 80 },
  prompt: { type: "string", minLength: 1, maxLength: 240 },
  accessibilityHint: { type: "string", minLength: 1, maxLength: 180 },
} as const;

/** Mirrors RummageToolSpecSchema — one approved, non-executable renderer. */
const TOOL_JSON_SCHEMA = {
  anyOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["kind", "title", "prompt", "accessibilityHint", "categories", "items"],
      properties: {
        ...TOOL_BASE_PROPS,
        kind: { type: "string", enum: ["sort"] },
        categories: { type: "array", minItems: 2, maxItems: 4, items: { type: "string", minLength: 1, maxLength: 40 } },
        items: { type: "array", minItems: 2, maxItems: 8, items: { type: "string", minLength: 1, maxLength: 60 } },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["kind", "title", "prompt", "accessibilityHint", "unit", "targetLabel"],
      properties: {
        ...TOOL_BASE_PROPS,
        kind: { type: "string", enum: ["measure"] },
        unit: { type: "string", enum: ["cm", "in", "seconds", "grams", "observations"] },
        targetLabel: { type: "string", minLength: 1, maxLength: 80 },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["kind", "title", "prompt", "accessibilityHint", "question", "options"],
      properties: {
        ...TOOL_BASE_PROPS,
        kind: { type: "string", enum: ["predict"] },
        question: { type: "string", minLength: 1, maxLength: 180 },
        options: { type: "array", minItems: 2, maxItems: 4, items: { type: "string", minLength: 1, maxLength: 80 } },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["kind", "title", "prompt", "accessibilityHint", "soundLabels"],
      properties: {
        ...TOOL_BASE_PROPS,
        kind: { type: "string", enum: ["sound_mix"] },
        soundLabels: { type: "array", minItems: 2, maxItems: 4, items: { type: "string", minLength: 1, maxLength: 40 } },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["kind", "title", "prompt", "accessibilityHint", "journalPrompt"],
      properties: {
        ...TOOL_BASE_PROPS,
        kind: { type: "string", enum: ["field_journal"] },
        journalPrompt: { type: "string", minLength: 1, maxLength: 240 },
      },
    },
  ],
} as const;

/**
 * Mirrors the quest branch of QuestSpecSchema. The model authors the full
 * activity, but every field is bounded, the tool is one of five approved
 * renderers, materials/focus IDs are enum-constrained, and the result is
 * re-validated against the parent-approved context server-side before render.
 * The ageStage enum is swapped per request (3-4y or 4-6y).
 */
const QUEST_GENERATION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "title",
    "experienceMode",
    "ageStage",
    "developmentalFocusIds",
    "parentFacingGoal",
    "activitySummary",
    "materials",
    "adultSafetyNote",
    "stopIf",
    "steps",
    "evidencePrompt",
    "parentReflectionPrompt",
    "tool",
    "fallbackMessage",
  ],
  properties: {
    id: { type: "string", minLength: 1, maxLength: 80 },
    title: { type: "string", minLength: 1, maxLength: 100 },
    experienceMode: { type: "string", enum: ["guided_quest"] },
    ageStage: { type: "string", enum: ["3-4y"] },
    developmentalFocusIds: {
      type: "array",
      minItems: 1,
      maxItems: 4,
      items: { type: "string", enum: DEVELOPMENTAL_FOCUS_ID_ENUM },
    },
    parentFacingGoal: { type: "string", minLength: 1, maxLength: 240 },
    activitySummary: { type: "string", minLength: 1, maxLength: 240 },
    materials: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: { type: "string", enum: ALLOWED_MATERIAL_CATEGORY_ENUM },
    },
    adultSafetyNote: { type: "string", minLength: 1, maxLength: 280 },
    stopIf: { type: "array", minItems: 1, maxItems: 4, items: { type: "string", minLength: 1, maxLength: 160 } },
    steps: {
      type: "array",
      minItems: 2,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["minute", "instruction"],
        properties: {
          minute: { type: "integer", minimum: 0, maximum: 15 },
          instruction: { type: "string", minLength: 1, maxLength: 280 },
        },
      },
    },
    evidencePrompt: { type: "string", minLength: 1, maxLength: 240 },
    parentReflectionPrompt: { type: "string", minLength: 1, maxLength: 240 },
    tool: TOOL_JSON_SCHEMA,
    fallbackMessage: { type: "string", minLength: 1, maxLength: 240 },
  },
} as const;

function questGenerationJsonSchemaForAge(ageStage: "3-4y" | "4-6y"): object {
  return {
    ...QUEST_GENERATION_JSON_SCHEMA,
    properties: {
      ...QUEST_GENERATION_JSON_SCHEMA.properties,
      ageStage: { type: "string", enum: [ageStage] },
    },
  };
}

/**
 * Mirrors RummageMomentSpecSchema for the under-three bands: a caregiver-led,
 * screen-free moment with no child tool, bounded text, the smaller material
 * enum, and the band's fixed experience mode. Re-validated server-side.
 */
function momentGenerationJsonSchemaForAge(ageStage: "0-12m" | "12-36m"): object {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "id",
      "title",
      "ageStage",
      "experienceMode",
      "developmentalFocusIds",
      "parentFacingGoal",
      "adultSupervision",
      "approvedMaterialCategories",
      "forbiddenMaterialCategories",
      "adultScript",
      "stopIf",
      "parentObservationPrompt",
      "fallbackMessage",
    ],
    properties: {
      id: { type: "string", minLength: 1, maxLength: 80 },
      title: { type: "string", minLength: 1, maxLength: 100 },
      ageStage: { type: "string", enum: [ageStage] },
      experienceMode: {
        type: "string",
        enum: [ageStage === "0-12m" ? "caregiver_moment" : "co_play"],
      },
      developmentalFocusIds: {
        type: "array",
        minItems: 1,
        maxItems: 3,
        items: { type: "string", enum: DEVELOPMENTAL_FOCUS_ID_ENUM },
      },
      parentFacingGoal: { type: "string", minLength: 1, maxLength: 240 },
      adultSupervision: { type: "boolean", const: true },
      approvedMaterialCategories: {
        type: "array",
        minItems: 1,
        maxItems: 5,
        items: { type: "string", enum: UNDER_THREE_CATEGORY_ENUM },
      },
      forbiddenMaterialCategories: {
        type: "array",
        minItems: 1,
        maxItems: 6,
        items: { type: "string", minLength: 1, maxLength: 100 },
      },
      adultScript: {
        type: "array",
        minItems: 2,
        maxItems: 5,
        items: { type: "string", minLength: 1, maxLength: 280 },
      },
      stopIf: { type: "array", minItems: 1, maxItems: 4, items: { type: "string", minLength: 1, maxLength: 160 } },
      parentObservationPrompt: { type: "string", minLength: 1, maxLength: 240 },
      fallbackMessage: { type: "string", minLength: 1, maxLength: 240 },
    },
  };
}

type ResponsesBody = { output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }> };

function recordProviderHttpFailure(response: Response) {
  // Deliberately operational-only: never log the request, prompt, labels,
  // image, provider body, authorization header, or any user content.
  console.warn("rummagelab_openai_http_failure", {
    status: response.status,
    requestId: response.headers.get("x-request-id") ?? response.headers.get("request-id") ?? null,
  });
}

/**
 * Objects are now deduplicated by label, not category: several distinct
 * everyday objects can share the open `other_safe_object` category, so only a
 * repeated label indicates a malformed response.
 */
function hasUniqueSuggestedLabels(
  items: ReadonlyArray<{ suggestedLabel: string }>,
): boolean {
  const labels = items.map((item) => item.suggestedLabel.trim().toLowerCase());
  return new Set(labels).size === labels.length;
}

function outputText(body: ResponsesBody): string {
  const text = body.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text;
  if (!text) throw new RuntimeProviderFailure("provider_malformed_response");
  return text;
}

export function createOpenAIExperienceProvider(
  options: OpenAIProviderOptions,
): ExperienceRuntimeProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 20_000;

  async function requestStructured(
    name: string,
    schema: object,
    content: Array<Record<string, unknown>>,
    callTimeoutMs: number = timeoutMs,
  ): Promise<unknown> {
    if (!options.apiKey?.trim()) {
      throw new RuntimeProviderFailure("provider_unavailable");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), callTimeoutMs);
    try {
      const response = await fetchImpl("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          authorization: `Bearer ${options.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: options.model?.trim() || DEFAULT_OPENAI_MODEL,
          store: false,
          input: [{ role: "user", content }],
          text: { format: { type: "json_schema", name, strict: true, schema } },
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        recordProviderHttpFailure(response);
        throw new RuntimeProviderFailure("provider_http_error");
      }
      let body: ResponsesBody;
      try {
        body = (await response.json()) as ResponsesBody;
      } catch {
        throw new RuntimeProviderFailure("provider_malformed_response");
      }
      try {
        return JSON.parse(outputText(body));
      } catch (error) {
        if (error instanceof RuntimeProviderFailure) throw error;
        throw new RuntimeProviderFailure("provider_malformed_response");
      }
    } catch (error) {
      if (error instanceof RuntimeProviderFailure) throw error;
      if (controller.signal.aborted) {
        const timeoutError = new RuntimeProviderFailure("provider_timeout");
        timeoutError.name = "TimeoutError";
        throw timeoutError;
      }
      throw new RuntimeProviderFailure("provider_unavailable");
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    async getPhotoInventory(request) {
      const parsed = PhotoInventoryRequestSchema.parse(request);
      const underThree = parsed.ageStage === "0-12m" || parsed.ageStage === "12-36m";
      const inventorySchema = photoInventoryJsonSchemaForAge(parsed.ageStage);
      const categoryGuidance = underThree
        ? `map each object only to these large, under-three-approved categories ${JSON.stringify(UNDER_THREE_CATEGORY_ENUM)} and simply omit objects that do not fit them (small, hard, sharp, or mouth-size items must not appear)`
        : 'give a coarse category (use "other_safe_object" if none fits)';
      const ageNote = underThree
        ? ` The child is under three (${parsed.ageStage}): be conservative, and flag mouthing or size concerns in warnings.`
        : "";
      if (parsed.mode === "live_typed_object_labels") {
        const result = PhotoInventorySchema.parse(await requestStructured(
          "typed_object_inventory",
          inventorySchema,
          [{
            type: "input_text",
            text: `Interpret these transient, parent-entered everyday-object labels. For each distinct object give a short label, ${categoryGuidance}, a safetyLevel of "ok" or "caution", and up to three short parent cautions in warnings (empty if none). Do not repeat objects, infer identity, or make the final safety decision — a parent confirms every suggestion.${ageNote} Labels: ${JSON.stringify(parsed.objectLabels)}`,
          }],
        ));
        if (result.imageMode !== "live" || !hasUniqueSuggestedLabels(result.suggestedItems)) {
          throw new RuntimeProviderFailure("provider_malformed_response");
        }
        return result;
      }
      if (parsed.mode !== "live_transient_object_upload") {
        throw new RuntimeProviderFailure("provider_context_mismatch");
      }
      const result = PhotoInventorySchema.parse(await requestStructured(
        "photo_inventory",
        inventorySchema,
        [
          { type: "input_text", text: `Identify clearly visible household objects a parent might use for supervised play. For each object give a short label, ${categoryGuidance}, a safetyLevel of "ok" or "caution", and up to three short parent cautions in warnings (empty if none). Do not identify people or make the final safety decision — a parent confirms every suggestion.${ageNote}` },
          { type: "input_image", image_url: `data:${options.transientImage.mimeType};base64,${options.transientImage.base64}`, detail: "low" },
        ],
      ));
      if (result.imageMode !== "live" || !hasUniqueSuggestedLabels(result.suggestedItems)) {
        throw new RuntimeProviderFailure("provider_malformed_response");
      }
      return result;
    },
    async selectExperience(request) {
      const parsed = ExperienceRequestSchema.parse(request);
      const context = parsed.activityContext;
      // A reviewed fallback must exist so a failed/rejected generation is
      // always recoverable to a safe activity for this context.
      if (availableApprovedQuestTemplateIds(context).length === 0) {
        throw new RuntimeProviderFailure("provider_context_mismatch");
      }
      // The prepared kit stays fully deterministic (no model call) — the
      // reliable judge/demo golden path. Live photo/typed intake gets a
      // freshly authored, context-tailored activity instead.
      if (context.materialSource === "seeded_demo") {
        return deterministicApprovedQuestForContext(context);
      }
      const confirmed = context.confirmedMaterials.map((material) => ({
        category: material.allowedMaterialCategory,
        label: material.label ?? material.allowedMaterialCategory,
      }));
      const confirmedCategories = [...new Set(confirmed.map((item) => item.category))];
      const weatherTags = context.weather?.approvedTags ?? [];
      const objectLabels = JSON.stringify(confirmed.map((item) => item.label));

      // Under-three bands: author a caregiver-led, screen-free RummageMoment
      // (no child tool) instead of a quest.
      if (context.ageStage === "0-12m" || context.ageStage === "12-36m") {
        const mode = context.ageStage === "0-12m" ? "caregiver_moment" : "co_play";
        const raw = await requestStructured(
          "generated_moment",
          momentGenerationJsonSchemaForAge(context.ageStage),
          [{
            type: "input_text",
            text: `Author one short, gentle, caregiver-led moment for a ${context.ageStage} child using these parent-confirmed large everyday objects. This is screen-free for the child: the adultScript (2-5 short lines) tells the grown-up what to do and say, referring to the objects by their labels. Rules: ageStage "${context.ageStage}"; experienceMode "${mode}"; developmentalFocusIds only from ${JSON.stringify(DEVELOPMENTAL_FOCUS_ID_ENUM)} (1-3); approvedMaterialCategories only from ${JSON.stringify(confirmedCategories)}; list real hazards to keep away in forbiddenMaterialCategories; calm, supervised, no mouthing risks, appropriate for the weather tags ${JSON.stringify(weatherTags)} and an ${context.setting} setting. No URLs, code, brand names, or real names. Confirmed objects: ${objectLabels}. Context: ${JSON.stringify(context)}`,
          }],
          GENERATION_TIMEOUT_MS,
        );
        // Structural parse here; resolveExperience re-validates against the
        // parent-approved context (materials subset, focus catalogue).
        return RummageMomentSpecSchema.parse(raw);
      }

      const raw = await requestStructured(
        "generated_activity",
        questGenerationJsonSchemaForAge(context.ageStage),
        [{
          type: "input_text",
          text: `Author one short, safe, grown-up-led activity for a ${context.ageStage} child, tailored to these parent-confirmed everyday objects and context. Refer to the objects by their labels in the steps. Rules: experienceMode "guided_quest"; ageStage "${context.ageStage}"; 2-6 steps, each minute within 0..${context.availableMinutes}; choose developmentalFocusIds only from ${JSON.stringify(DEVELOPMENTAL_FOCUS_ID_ENUM)}; use materials only from ${JSON.stringify(confirmedCategories)}; choose exactly one tool from sort, measure, predict, sound_mix, or field_journal; keep it ${context.setting}, calm, non-recording, and appropriate for the weather tags ${JSON.stringify(weatherTags)}${context.ageStage === "4-6y" ? "; pitch the challenge for a 5-6 year old: predicting, testing, comparing, and explaining" : ""}. activitySummary is one short parent-facing sentence describing the activity. No URLs, code, brand names, or real names. Confirmed objects: ${objectLabels}. Context: ${JSON.stringify(context)}`,
        }],
        GENERATION_TIMEOUT_MS,
      );
      // Structural parse here; resolveExperience re-validates against the
      // parent-approved context (materials subset, focus catalogue, time window).
      return QuestSpecSchema.parse(raw);
    },
  };
}
