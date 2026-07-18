import {
  ExperienceRequestSchema,
  PhotoInventoryRequestSchema,
  type ExperienceRuntimeProvider,
} from "./contracts";
import {
  ApprovedQuestTemplateSelectionSchema,
  availableApprovedQuestTemplateIds,
  resolveApprovedQuestTemplate,
} from "../demo/approved-quest-templates";
import { AllowedMaterialCategorySchema, PhotoInventorySchema } from "../schemas";
import { RuntimeProviderFailure } from "./seeded-runtime";

/** Single source of truth for the model-facing category enum (no hand copy). */
const ALLOWED_MATERIAL_CATEGORY_ENUM = [...AllowedMaterialCategorySchema.options];

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
};

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

const EXPERIENCE_TEMPLATE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["templateId"],
  properties: {
    templateId: { type: "string", enum: ["kitchen-sound-detectives", "ball-roll-predictions", "everyday-object-noticing"] },
  },
} as const;

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
  ): Promise<unknown> {
    if (!options.apiKey?.trim()) {
      throw new RuntimeProviderFailure("provider_unavailable");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          authorization: `Bearer ${options.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-5.6",
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
      if (parsed.ageStage !== "3-4y") {
        throw new RuntimeProviderFailure("provider_context_mismatch");
      }
      if (parsed.mode === "live_typed_object_labels") {
        const result = PhotoInventorySchema.parse(await requestStructured(
          "typed_object_inventory",
          PHOTO_INVENTORY_JSON_SCHEMA,
          [{
            type: "input_text",
            text: `Interpret these transient, parent-entered everyday-object labels. For each distinct object give a short label, a coarse category (use "other_safe_object" if none fits), a safetyLevel of "ok" or "caution", and up to three short parent cautions in warnings (empty if none). Do not repeat objects, infer identity, or make the final safety decision — a parent confirms every suggestion. Labels: ${JSON.stringify(parsed.objectLabels)}`,
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
        PHOTO_INVENTORY_JSON_SCHEMA,
        [
          { type: "input_text", text: "Identify clearly visible household objects a parent might use for supervised toddler play. For each object give a short label, a coarse category (use \"other_safe_object\" if none fits), a safetyLevel of \"ok\" or \"caution\", and up to three short parent cautions in warnings (empty if none). Do not identify people or make the final safety decision — a parent confirms every suggestion." },
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
      const allowedTemplateIds = availableApprovedQuestTemplateIds(parsed.activityContext);
      if (allowedTemplateIds.length === 0) throw new RuntimeProviderFailure("provider_context_mismatch");
      const result = ApprovedQuestTemplateSelectionSchema.parse(await requestStructured(
        "reviewed_activity_template_selection",
        EXPERIENCE_TEMPLATE_JSON_SCHEMA,
        [{ type: "input_text", text: `Select exactly one reviewed activity template ID from ${JSON.stringify(allowedTemplateIds)} for this already validated, parent-approved context. Do not create instructions, objects, or a new template. Context: ${JSON.stringify(parsed.activityContext)}` }],
      ));
      return resolveApprovedQuestTemplate(result, parsed.activityContext);
    },
  };
}
