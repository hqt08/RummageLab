import { z } from "zod";

import { findLearningFocus } from "../data/learning-focuses";
import { containsHardDenylistedTerm } from "../demo/hard-denylist";
import { kitchenSoundPhotoInventory, kitchenSoundQuest } from "../demo/kitchen-sound-detectives";
import {
  availableApprovedQuestTemplateIds,
  deterministicApprovedQuestForContext,
} from "../demo/approved-quest-templates";
import {
  ExperienceSpecSchema,
  PhotoInventorySchema,
  type ActivityContext,
  type ExperienceSpec,
} from "../schemas";
import {
  ExperienceRequestSchema,
  PhotoInventoryRequestSchema,
  RuntimeDiagnosticSchema,
  type ExperienceResponse,
  type ExperienceRuntimeProvider,
  type PhotoInventoryResponse,
  type RuntimeFailureCode,
  type RuntimeOperation,
} from "./contracts";

/**
 * The only implemented provider. It is deterministic, needs no credential, and
 * never makes an HTTP request. A future adapter must implement the same shape.
 */
export const seededRuntimeProvider: ExperienceRuntimeProvider = {
  async getPhotoInventory(request) {
    const parsedRequest = PhotoInventoryRequestSchema.parse(request);
    if (parsedRequest.mode !== "seeded_demo") {
      throw new RuntimeProviderFailure("provider_unavailable");
    }

    return kitchenSoundPhotoInventory;
  },
  async selectExperience(request) {
    const parsedRequest = ExperienceRequestSchema.parse(request);
    if (parsedRequest.activityContext.ageStage !== "3-4y") {
      throw new RuntimeProviderFailure("provider_unavailable");
    }

    return kitchenSoundQuest;
  },
};

/**
 * A local reviewed fallback exists only for a context that maps to exactly one
 * approved template. It never turns raw labels or model-generated instructions
 * into a learner UI.
 */
export const SeededKitchenSoundExperienceRequestSchema = z
  .object({
    fixtureId: z.literal("kitchen-sound-detectives"),
    activityContext: ExperienceRequestSchema.shape.activityContext,
  })
  .strict()
  .superRefine((request, refinementContext) => {
    const context = request.activityContext;
    if (availableApprovedQuestTemplateIds(context).length !== 1) {
      refinementContext.addIssue({
        code: z.ZodIssueCode.custom,
        message: "The fallback requires exactly one reviewed template for the parent-approved context",
      });
    }
  });

export type SeededKitchenSoundExperienceRequest = z.infer<
  typeof SeededKitchenSoundExperienceRequestSchema
>;

/** The Kitchen Sound inventory is reviewed only for the 3–4 demo fixture. */
export const SeededKitchenSoundPhotoInventoryRequestSchema = z
  .object({
    mode: z.literal("seeded_demo"),
    fixtureId: z.literal("kitchen-sound-detectives"),
    ageStage: z.literal("3-4y"),
    objectOnly: z.literal(true),
  })
  .strict();

export type SeededKitchenSoundPhotoInventoryRequest = z.infer<
  typeof SeededKitchenSoundPhotoInventoryRequestSchema
>;

export class RuntimeProviderFailure extends Error {
  constructor(readonly code: RuntimeFailureCode) {
    super(code);
    this.name = "RuntimeProviderFailure";
  }
}

function diagnostic(operation: RuntimeOperation, code: RuntimeFailureCode) {
  return RuntimeDiagnosticSchema.parse({
    operation,
    code,
    fallbackUsed: true,
    retryable: code !== "provider_context_mismatch" && code !== "provider_disabled",
  });
}

function failureCode(error: unknown): RuntimeFailureCode {
  if (error instanceof RuntimeProviderFailure) {
    return error.code;
  }

  if (error instanceof Error && error.name === "TimeoutError") {
    return "provider_timeout";
  }

  if (error instanceof z.ZodError) {
    return "provider_malformed_response";
  }

  return "provider_unexpected_failure";
}

export function validateExperienceForContext(
  input: unknown,
  context: ActivityContext,
): ExperienceSpec {
  const experience = ExperienceSpecSchema.parse(input);
  if (experience.ageStage !== context.ageStage) {
    throw new RuntimeProviderFailure("provider_context_mismatch");
  }

  const confirmedMaterials = new Set(
    context.confirmedMaterials.map((item) => item.allowedMaterialCategory),
  );
  const expectedMaterials =
    "materials" in experience
      ? experience.materials
      : experience.approvedMaterialCategories;
  if (expectedMaterials.some((material) => !confirmedMaterials.has(material))) {
    throw new RuntimeProviderFailure("provider_context_mismatch");
  }

  if (experience.developmentalFocusIds.some((id) => !findLearningFocus(id))) {
    throw new RuntimeProviderFailure("provider_malformed_response");
  }

  if ("steps" in experience && experience.steps.some((step) => step.minute > context.availableMinutes)) {
    throw new RuntimeProviderFailure("provider_context_mismatch");
  }

  return experience;
}

export function validateLivePhotoInventory(input: unknown) {
  const inventory = PhotoInventorySchema.parse(input);
  if (inventory.imageMode !== "live") {
    throw new RuntimeProviderFailure("provider_context_mismatch");
  }

  // Server-side hard-denylist floor: drop any model-surfaced object whose label
  // matches a known young-child hazard before a parent ever sees it, regardless
  // of the model's own safetyLevel.
  const safeItems = inventory.suggestedItems.filter(
    (item) => !containsHardDenylistedTerm(item.suggestedLabel),
  );

  const labels = safeItems.map((item) => item.suggestedLabel.trim().toLowerCase());
  if (safeItems.length === 0 || new Set(labels).size !== labels.length) {
    throw new RuntimeProviderFailure("provider_context_mismatch");
  }

  // Re-parse the filtered set so the returned inventory still satisfies the
  // 1..5 bound and every downstream invariant.
  return PhotoInventorySchema.parse({ ...inventory, suggestedItems: safeItems });
}

export function runtimeDiagnostic(
  operation: RuntimeOperation,
  error: unknown,
) {
  return diagnostic(operation, failureCode(error));
}

export function disabledExperienceResponse(
  request: SeededKitchenSoundExperienceRequest,
): ExperienceResponse {
  const parsedRequest = SeededKitchenSoundExperienceRequestSchema.parse(request);
  const experience = validateExperienceForContext(
    kitchenSoundQuest,
    parsedRequest.activityContext,
  );
  return {
    experience,
    runtime: {
      source: "seeded_fallback",
      diagnostic: diagnostic("experience_selection", "provider_disabled"),
    },
  };
}

export function disabledPhotoInventoryResponse(): PhotoInventoryResponse {
  return {
    inventory: kitchenSoundPhotoInventory,
    runtime: {
      source: "seeded_fallback",
      diagnostic: diagnostic("photo_inventory", "provider_disabled"),
    },
  };
}

export async function resolvePhotoInventory(
  request: SeededKitchenSoundPhotoInventoryRequest,
  provider: ExperienceRuntimeProvider = seededRuntimeProvider,
): Promise<PhotoInventoryResponse> {
  const parsedRequest = SeededKitchenSoundPhotoInventoryRequestSchema.parse(request);

  try {
    const inventory = PhotoInventorySchema.parse(
      await provider.getPhotoInventory(parsedRequest),
    );
    return { inventory, runtime: { source: "seeded_provider" } };
  } catch (error) {
    return {
      inventory: kitchenSoundPhotoInventory,
      runtime: {
        source: "seeded_fallback",
        diagnostic: diagnostic("photo_inventory", failureCode(error)),
      },
    };
  }
}

export async function resolveExperience(
  request: SeededKitchenSoundExperienceRequest,
  provider: ExperienceRuntimeProvider = seededRuntimeProvider,
): Promise<ExperienceResponse> {
  const parsedRequest = SeededKitchenSoundExperienceRequestSchema.parse(request);

  try {
    const experience = validateExperienceForContext(
      await provider.selectExperience({
        activityContext: parsedRequest.activityContext,
      }),
      parsedRequest.activityContext,
    );
    return { experience, runtime: { source: "seeded_provider" } };
  } catch (error) {
    // Resolve a local reviewed template against this exact context rather than
    // returning an age- or material-mismatched activity.
    const experience = validateExperienceForContext(deterministicApprovedQuestForContext(parsedRequest.activityContext), parsedRequest.activityContext);
    return {
      experience,
      runtime: {
        source: "seeded_fallback",
        diagnostic: diagnostic("experience_selection", failureCode(error)),
      },
    };
  }
}

/** Test-only-shaped helper for the visible, no-key fallback/retry exercise. */
export function unavailableSeededProvider(): ExperienceRuntimeProvider {
  return {
    async getPhotoInventory() {
      throw new RuntimeProviderFailure("provider_unavailable");
    },
    async selectExperience() {
      throw new RuntimeProviderFailure("provider_unavailable");
    },
  };
}
