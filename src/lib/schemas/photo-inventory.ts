import { z } from "zod";

import { AllowedMaterialCategorySchema } from "./material-category";

/**
 * A constrained, parent-confirmed interpretation of an object-only image. It
 * deliberately avoids person recognition, identity inference, or safety claims.
 */
export const PhotoInventoryItemSchema = z.object({
  suggestedLabel: z.string().min(1).max(80),
  allowedMaterialCategory: AllowedMaterialCategorySchema,
  needsParentConfirmation: z.literal(true),
}).strict();

export const PhotoInventorySchema = z.object({
  imageMode: z.enum(["live", "seeded_demo"]),
  objectOnlyReminder: z.literal(true),
  suggestedItems: z.array(PhotoInventoryItemSchema).min(1).max(5),
  unsafeOrUncertainNotice: z.string().min(1).max(240),
  requiresAdultSupervision: z.literal(true),
}).strict();

export type PhotoInventory = z.infer<typeof PhotoInventorySchema>;
