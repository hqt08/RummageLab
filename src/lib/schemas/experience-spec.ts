import { z } from "zod";

import { QuestSpecSchema } from "./quest-spec";
import { RummageMomentSpecSchema } from "./rummage-moment";

/**
 * The complete, structured response boundary for an experience planner.
 * This deliberately contains data for approved renderers only.
 */
export const ExperienceSpecSchema = z.union([
  RummageMomentSpecSchema,
  QuestSpecSchema,
]);

export type ExperienceSpec = z.infer<typeof ExperienceSpecSchema>;
