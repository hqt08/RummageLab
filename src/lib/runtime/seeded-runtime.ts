import { z } from "zod";

import { findLearningFocus } from "../data/learning-focuses";
import {
  KITCHEN_SOUND_REQUIRED_MATERIALS,
  kitchenSoundPhotoInventory,
  kitchenSoundQuest,
} from "../demo/kitchen-sound-detectives";
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
 * The automatic fallback exists only for the reviewed Kitchen Sound fixture.
 * Future adapters use the generic ExperienceRequest contract in contracts.ts;
 * they must register a separately validated fallback for every supported route.
 */
export const SeededKitchenSoundExperienceRequestSchema = z
  .object({
    fixtureId: z.literal("kitchen-sound-detectives"),
    activityContext: ExperienceRequestSchema.shape.activityContext,
  })
  .strict()
  .superRefine((request, refinementContext) => {
    const context = request.activityContext;
    const confirmedMaterials = context.confirmedMaterials.map(
      (item) => item.allowedMaterialCategory,
    );
    const isExactKit =
      confirmedMaterials.length === KITCHEN_SOUND_REQUIRED_MATERIALS.length &&
      KITCHEN_SOUND_REQUIRED_MATERIALS.every((material) =>
        confirmedMaterials.includes(material),
      );

    if (context.ageStage !== "3-4y" || !isExactKit || context.availableMinutes < 8) {
      refinementContext.addIssue({
        code: z.ZodIssueCode.custom,
        message: "The seeded fallback supports only the confirmed Kitchen Sound fixture",
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
    retryable: code !== "provider_context_mismatch",
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

function validateExperienceForContext(
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
    // The current fallback is deliberately limited to Kitchen Sound Detectives.
    // Re-validate it against this exact context rather than ever returning an
    // age- or material-mismatched activity for an unsupported request.
    const experience = validateExperienceForContext(
      kitchenSoundQuest,
      parsedRequest.activityContext,
    );
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
