import { z } from "zod";

import {
  ActivityContextSchema,
  AgeStageSchema,
  ExperienceSpecSchema,
  PhotoInventorySchema,
} from "../schemas";

/**
 * A future server upload handler owns bytes and metadata stripping. The runtime
 * contract intentionally receives only this content-free capability marker.
 */
export const PhotoInventoryRequestSchema = z.discriminatedUnion("mode", [
  z
    .object({
      mode: z.literal("seeded_demo"),
      fixtureId: z.literal("kitchen-sound-detectives"),
      ageStage: AgeStageSchema,
      objectOnly: z.literal(true),
    })
    .strict(),
  z
    .object({
      mode: z.literal("live_transient_object_upload"),
      ageStage: AgeStageSchema,
      objectOnly: z.literal(true),
    })
    .strict(),
]);

export const ExperienceRequestSchema = z
  .object({
    activityContext: ActivityContextSchema,
  })
  .strict();

export const RuntimeOperationSchema = z.enum([
  "photo_inventory",
  "experience_selection",
]);

/**
 * This taxonomy is safe to expose to UI and operations. It contains no prompt,
 * photo, parent text, provider payload, identifier, or provider-specific error.
 */
export const RuntimeFailureCodeSchema = z.enum([
  "provider_disabled",
  "provider_timeout",
  "provider_unavailable",
  "provider_malformed_response",
  "provider_context_mismatch",
  "provider_unexpected_failure",
]);

export const RuntimeDiagnosticSchema = z
  .object({
    operation: RuntimeOperationSchema,
    code: RuntimeFailureCodeSchema,
    fallbackUsed: z.literal(true),
    retryable: z.boolean(),
  })
  .strict();

export const RuntimeResponseMetaSchema = z
  .object({
    source: z.enum(["live_provider", "seeded_provider", "seeded_fallback"]),
    diagnostic: RuntimeDiagnosticSchema.optional(),
  })
  .strict();

/** Content-free capability marker for the optional server-only live path. */
export const LiveExperienceCapabilitySchema = z
  .object({
    livePhotoAnalysisAvailable: z.boolean(),
    seededDemoAvailable: z.literal(true),
  })
  .strict();

export const PhotoInventoryResponseSchema = z
  .object({
    inventory: PhotoInventorySchema,
    runtime: RuntimeResponseMetaSchema,
  })
  .strict();

export const ExperienceResponseSchema = z
  .object({
    experience: ExperienceSpecSchema,
    runtime: RuntimeResponseMetaSchema,
  })
  .strict();

export type PhotoInventoryRequest = z.infer<typeof PhotoInventoryRequestSchema>;
export type ExperienceRequest = z.infer<typeof ExperienceRequestSchema>;
export type RuntimeOperation = z.infer<typeof RuntimeOperationSchema>;
export type RuntimeFailureCode = z.infer<typeof RuntimeFailureCodeSchema>;
export type RuntimeDiagnostic = z.infer<typeof RuntimeDiagnosticSchema>;
export type LiveExperienceCapability = z.infer<typeof LiveExperienceCapabilitySchema>;
export type PhotoInventoryResponse = z.infer<typeof PhotoInventoryResponseSchema>;
export type ExperienceResponse = z.infer<typeof ExperienceResponseSchema>;

export interface ExperienceRuntimeProvider {
  getPhotoInventory(request: PhotoInventoryRequest): Promise<unknown>;
  selectExperience(request: ExperienceRequest): Promise<unknown>;
}
