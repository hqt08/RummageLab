import { z } from "zod";

import { UnderThreeMaterialCategorySchema } from "./material-category";
import { AgeStageSchema } from "./quest-spec";

export const RummageMomentAgeStageSchema = z.enum(["0-12m", "12-36m"]);

/**
 * A non-screen-first parent/co-play activity. This contract intentionally has
 * no child-facing tool, child recording, evaluation, or mastery field.
 */
const RummageMomentBaseSchema = z.object({
  id: z.string().min(1).max(80),
  title: z.string().min(1).max(100),
  developmentalFocusIds: z.array(z.string().min(1).max(80)).min(1).max(3),
  parentFacingGoal: z.string().min(1).max(240),
  adultSupervision: z.literal(true),
  approvedMaterialCategories: z
    .array(UnderThreeMaterialCategorySchema)
    .min(1)
    .max(5),
  forbiddenMaterialCategories: z.array(z.string().min(1).max(100)).min(1),
  adultScript: z.array(z.string().min(1).max(280)).min(2).max(5),
  stopIf: z.array(z.string().min(1).max(160)).min(1).max(4),
  parentObservationPrompt: z.string().min(1).max(240),
  fallbackMessage: z.string().min(1).max(240),
});

const InfantMomentSpecSchema = RummageMomentBaseSchema.extend({
  ageStage: z.literal("0-12m"),
  experienceMode: z.literal("caregiver_moment"),
}).strict();

const ToddlerMomentSpecSchema = RummageMomentBaseSchema.extend({
  ageStage: z.literal("12-36m"),
  experienceMode: z.literal("co_play"),
}).strict();

export const RummageMomentSpecSchema = z.discriminatedUnion("ageStage", [
  InfantMomentSpecSchema,
  ToddlerMomentSpecSchema,
]);

export type RummageMomentSpec = z.infer<typeof RummageMomentSpecSchema>;

// Keep the shared stage schema exported from one place for future API boundaries.
export { AgeStageSchema };
