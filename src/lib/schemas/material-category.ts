import { z } from "zod";

/**
 * Human-curated material categories that may cross the activity-planning
 * boundary after parent confirmation. Raw typed labels and vision text do not.
 */
export const AllowedMaterialCategorySchema = z.enum([
  "large_empty_plastic_container",
  "wooden_kitchen_utensil",
  "silicone_kitchen_utensil",
  "soft_cloth",
  "paper_or_cardboard",
  "board_book",
  "large_soft_ball",
  "large_natural_object",
  // Open, parent-vetted bucket for any other ordinary object GPT surfaces that
  // does not fit a bespoke category. Still parent-confirmed and denylist-checked.
  "other_safe_object",
]);

/**
 * Smaller allowlist for caregiver-led moments with children under three.
 */
export const UnderThreeMaterialCategorySchema = z.enum([
  "large_empty_plastic_container",
  "soft_cloth",
  "board_book",
  "large_soft_ball",
]);

export type AllowedMaterialCategory = z.infer<
  typeof AllowedMaterialCategorySchema
>;
export type UnderThreeMaterialCategory = z.infer<
  typeof UnderThreeMaterialCategorySchema
>;
