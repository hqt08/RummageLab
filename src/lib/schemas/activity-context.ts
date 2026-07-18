import { z } from "zod";

import {
  AllowedMaterialCategorySchema,
  UnderThreeMaterialCategorySchema,
} from "./material-category";
import { PhotoInventorySchema } from "./photo-inventory";

const MaterialLabelSchema = z.string().trim().min(1).max(80);

export const TypedMaterialInputSchema = z.object({
  source: z.literal("typed"),
  items: z.array(MaterialLabelSchema).min(1).max(5),
}).strict();

export const PhotoMaterialInputSchema = z.object({
  source: z.literal("photo"),
  inventory: PhotoInventorySchema,
}).strict();

export const SeededMaterialInputSchema = z.object({
  source: z.literal("seeded_demo"),
  fixtureId: z.literal("kitchen-sound-detectives"),
}).strict();

/**
 * Raw input never becomes activity context by itself. Every route produces a
 * parent-confirmed inventory before the model may plan an experience.
 */
export const MaterialInputSchema = z.discriminatedUnion("source", [
  TypedMaterialInputSchema,
  PhotoMaterialInputSchema,
  SeededMaterialInputSchema,
]);

export const ConfirmedMaterialSchema = z.object({
  allowedMaterialCategory: AllowedMaterialCategorySchema,
  /**
   * Optional short human label the parent confirmed (e.g. "rubber duck"). It
   * carries the real object into activity planning, especially for the open
   * `other_safe_object` category. Absent for older seeded/category-only paths.
   */
  label: z.string().min(1).max(60).optional(),
  parentConfirmed: z.literal(true),
}).strict();

export const WeatherTagSchema = z.enum([
  "sunny",
  "cloudy",
  "rainy",
  "snowy",
  "windy",
  "hot",
  "cold",
  "unknown",
]);

/**
 * This is the weather subset allowed into activity planning. A provider may
 * suggest several tags, but only the parent's final approved set crosses this
 * boundary. City, coordinates, raw conditions, and provider payloads do not.
 */
export const WeatherContextSchema = z.object({
  source: z.enum(["parent_selected", "weather_lookup", "seeded_demo"]),
  approvedTags: z.array(WeatherTagSchema).min(1).max(4),
  parentApproved: z.literal(true),
  preciseLocationStored: z.literal(false),
}).strict();

/**
 * The complete, PII-free context allowed into an Experience Director request.
 */
export const ActivityContextSchema = z.object({
  ageStage: z.enum(["0-12m", "12-36m", "3-4y", "4-6y"]),
  materialSource: z.enum(["typed", "photo", "seeded_demo"]),
  confirmedMaterials: z.array(ConfirmedMaterialSchema).min(1).max(5),
  weather: WeatherContextSchema.optional(),
  availableMinutes: z.union([z.literal(5), z.literal(8), z.literal(10), z.literal(15)]),
  setting: z.enum(["indoors", "outdoors", "either"]),
  parentConfirmedSafety: z.literal(true),
})
  .strict()
  .superRefine((context, refinementContext) => {
    if (context.ageStage !== "0-12m" && context.ageStage !== "12-36m") {
      return;
    }

    for (const [index, material] of context.confirmedMaterials.entries()) {
      if (!UnderThreeMaterialCategorySchema.safeParse(material.allowedMaterialCategory).success) {
        refinementContext.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["confirmedMaterials", index, "allowedMaterialCategory"],
          message: "Material category is not approved for children under three",
        });
      }
    }
  });

export type ActivityContext = z.infer<typeof ActivityContextSchema>;
