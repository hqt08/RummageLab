import { z } from "zod";

import { AllowedMaterialCategorySchema } from "./material-category";
import { RummageToolSpecSchema } from "./rummage-tool";

export const AgeStageSchema = z.enum(["0-12m", "12-36m", "3-4y", "4-6y"]);
export const GuidedQuestAgeStageSchema = z.enum(["3-4y", "4-6y"]);

export const QuestStepSchema = z.object({
  minute: z.number().int().min(0).max(15),
  instruction: z.string().min(1).max(280),
}).strict();

/**
 * This is the only model-planned object that can reach the 3–6 learner renderer.
 * Validate it server-side, then additionally check developmentalFocusIds against
 * the local human-curated catalogue before persistence or display.
 */
const QuestSpecBaseSchema = z.object({
  id: z.string().min(1).max(80),
  title: z.string().min(1).max(100),
  experienceMode: z.literal("guided_quest"),
  developmentalFocusIds: z.array(z.string().min(1).max(80)).min(1).max(4),
  parentFacingGoal: z.string().min(1).max(240),
  /** Optional one-sentence, parent-facing synopsis for a generated activity. */
  activitySummary: z.string().min(1).max(240).optional(),
  materials: z.array(AllowedMaterialCategorySchema).min(1).max(5),
  adultSafetyNote: z.string().min(1).max(280),
  stopIf: z.array(z.string().min(1).max(160)).min(1).max(4),
  steps: z.array(QuestStepSchema).min(2).max(6),
  evidencePrompt: z.string().min(1).max(240),
  parentReflectionPrompt: z.string().min(1).max(240),
  tool: RummageToolSpecSchema,
  fallbackMessage: z.string().min(1).max(240),
});

const PreschoolQuestSpecSchema = QuestSpecBaseSchema.extend({
  ageStage: z.literal("3-4y"),
  kindergartenStandardId: z.never().optional(),
}).strict();

const KindergartenQuestSpecSchema = QuestSpecBaseSchema.extend({
  ageStage: z.literal("4-6y"),
  kindergartenStandardId: z.string().min(1).max(80).optional(),
}).strict();

export const QuestSpecSchema = z.discriminatedUnion("ageStage", [
  PreschoolQuestSpecSchema,
  KindergartenQuestSpecSchema,
]);

export type QuestSpec = z.infer<typeof QuestSpecSchema>;
