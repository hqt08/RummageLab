import {
  ExperienceRequestSchema,
  PhotoInventoryRequestSchema,
  type ExperienceRuntimeProvider,
} from "./contracts";
import { parseKitchenSoundQuest } from "../demo/kitchen-sound-detectives";
import { PhotoInventorySchema } from "../schemas";
import { RuntimeProviderFailure } from "./seeded-runtime";

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

const PHOTO_INVENTORY_JSON_SCHEMA = {
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
          "needsParentConfirmation",
        ],
        properties: {
          suggestedLabel: { type: "string", minLength: 1, maxLength: 80 },
          allowedMaterialCategory: {
            type: "string",
            enum: [
              "large_empty_plastic_container",
              "wooden_kitchen_utensil",
              "silicone_kitchen_utensil",
              "soft_cloth",
              "paper_or_cardboard",
              "board_book",
              "large_soft_ball",
              "large_natural_object",
            ],
          },
          needsParentConfirmation: { type: "boolean", const: true },
        },
      },
    },
    unsafeOrUncertainNotice: { type: "string", minLength: 1, maxLength: 240 },
    requiresAdultSupervision: { type: "boolean", const: true },
  },
} as const;

const EXPERIENCE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "id", "title", "experienceMode", "ageStage", "developmentalFocusIds",
    "parentFacingGoal", "materials", "adultSafetyNote", "stopIf", "steps",
    "evidencePrompt", "parentReflectionPrompt", "tool", "fallbackMessage",
  ],
  properties: {
    id: { type: "string", const: "kitchen-sound-detectives" },
    title: { type: "string", minLength: 1, maxLength: 100 },
    experienceMode: { type: "string", const: "guided_quest" },
    ageStage: { type: "string", const: "3-4y" },
    developmentalFocusIds: { type: "array", minItems: 1, maxItems: 4, items: { type: "string", minLength: 1, maxLength: 80 } },
    parentFacingGoal: { type: "string", minLength: 1, maxLength: 240 },
    materials: { type: "array", minItems: 1, maxItems: 5, items: PHOTO_INVENTORY_JSON_SCHEMA.properties.suggestedItems.items.properties.allowedMaterialCategory },
    adultSafetyNote: { type: "string", minLength: 1, maxLength: 280 },
    stopIf: { type: "array", minItems: 1, maxItems: 4, items: { type: "string", minLength: 1, maxLength: 160 } },
    steps: {
      type: "array", minItems: 2, maxItems: 6,
      items: {
        type: "object", additionalProperties: false, required: ["minute", "instruction"],
        properties: { minute: { type: "integer", minimum: 0, maximum: 15 }, instruction: { type: "string", minLength: 1, maxLength: 280 } },
      },
    },
    evidencePrompt: { type: "string", minLength: 1, maxLength: 240 },
    parentReflectionPrompt: { type: "string", minLength: 1, maxLength: 240 },
    tool: {
      type: "object", additionalProperties: false,
      required: ["kind", "title", "prompt", "accessibilityHint", "soundLabels"],
      properties: {
        kind: { type: "string", const: "sound_mix" },
        title: { type: "string", minLength: 1, maxLength: 80 },
        prompt: { type: "string", minLength: 1, maxLength: 240 },
        accessibilityHint: { type: "string", minLength: 1, maxLength: 180 },
        soundLabels: { type: "array", minItems: 2, maxItems: 4, items: { type: "string", minLength: 1, maxLength: 40 } },
      },
    },
    fallbackMessage: { type: "string", minLength: 1, maxLength: 240 },
  },
} as const;

type ResponsesBody = { output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }> };

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
      if (!response.ok) throw new RuntimeProviderFailure("provider_unavailable");
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
      if (parsed.mode !== "live_transient_object_upload" || parsed.ageStage !== "3-4y") {
        throw new RuntimeProviderFailure("provider_context_mismatch");
      }
      const result = PhotoInventorySchema.parse(await requestStructured(
        "photo_inventory",
        PHOTO_INVENTORY_JSON_SCHEMA,
        [
          { type: "input_text", text: "Identify only clearly visible, large household objects that map to the allowed categories. Do not identify people or infer safety. Every suggestion requires parent confirmation." },
          { type: "input_image", image_url: `data:${options.transientImage.mimeType};base64,${options.transientImage.base64}`, detail: "low" },
        ],
      ));
      if (result.imageMode !== "live" || new Set(result.suggestedItems.map((item) => item.allowedMaterialCategory)).size !== result.suggestedItems.length) {
        throw new RuntimeProviderFailure("provider_malformed_response");
      }
      return result;
    },
    async selectExperience(request) {
      const parsed = ExperienceRequestSchema.parse(request);
      const result = await requestStructured(
        "kitchen_sound_experience",
        EXPERIENCE_JSON_SCHEMA,
        [{ type: "input_text", text: `Create the Kitchen Sound Detectives parent-led activity using only this validated parent-approved context: ${JSON.stringify(parsed.activityContext)}` }],
      );
      return parseKitchenSoundQuest(result, parsed.activityContext);
    },
  };
}
