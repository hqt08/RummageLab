import { z } from "zod";

import { AllowedMaterialCategorySchema } from "./material-category";

/**
 * A model-surfaced advisory only. "ok" means no specific caution was raised;
 * "caution" means the parent should read the warnings before confirming. The
 * model never makes the final safety decision — the parent does.
 */
export const ObjectSafetyLevelSchema = z.enum(["ok", "caution"]);
export type ObjectSafetyLevel = z.infer<typeof ObjectSafetyLevelSchema>;

/**
 * A constrained, parent-confirmed interpretation of an object-only image or
 * typed label. It deliberately avoids person recognition and identity
 * inference. `safetyLevel` and `warnings` are advisory prompts for the parent,
 * not a safety guarantee; a local hard denylist runs before any of this shows.
 */
export const PhotoInventoryItemSchema = z.object({
  suggestedLabel: z.string().min(1).max(80),
  allowedMaterialCategory: AllowedMaterialCategorySchema,
  safetyLevel: ObjectSafetyLevelSchema,
  warnings: z.array(z.string().min(1).max(120)).max(3),
  needsParentConfirmation: z.literal(true),
}).strict();

/** Alias for the parent-vetted object shape, for activity-planning callers. */
export const VettedObjectSchema = PhotoInventoryItemSchema;
export type VettedObject = z.infer<typeof VettedObjectSchema>;

export const PhotoInventorySchema = z.object({
  imageMode: z.enum(["live", "seeded_demo"]),
  objectOnlyReminder: z.literal(true),
  suggestedItems: z.array(PhotoInventoryItemSchema).min(1).max(5),
  unsafeOrUncertainNotice: z.string().min(1).max(240),
  requiresAdultSupervision: z.literal(true),
}).strict();

export type PhotoInventory = z.infer<typeof PhotoInventorySchema>;
