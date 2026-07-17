import { z } from "zod";

/**
 * Optional, parent-only input. Audio is transcribed server-side and then treated
 * like typed text. Neither a raw recording nor a transcript belongs in the
 * hackathon demo's persistent state.
 */
export const ParentReflectionInputSchema = z.object({
  source: z.enum(["typed", "parent_voice_transcript"]),
  text: z.string().trim().min(1).max(400),
  childVoiceIncluded: z.literal(false),
  parentConfirmedNoSensitiveDetails: z.literal(true),
}).strict();

export const ObservationTagSchema = z.enum([
  "sound_play",
  "loud_quiet_contrast",
  "two_beat_pattern",
  "turn_taking",
  "descriptive_words",
  "cause_and_effect",
  "movement_play",
  "texture_exploration",
]);

/**
 * The only adaptive data approved for the next activity in the demo. It is
 * deliberately a small, editable tag set rather than an assessment record.
 */
export const NextActivityContextSchema = z.object({
  source: z.literal("parent_approved"),
  interestTags: z.array(ObservationTagSchema).max(3),
  supportTags: z.array(ObservationTagSchema).max(2),
  useFor: z.literal("next_activity_only"),
  expires: z.literal("end_of_demo_session"),
  parentEditable: z.literal(true),
}).strict();

/**
 * Future-only, parent-owned preference memory. This is not used by the
 * hackathon demo and must not contain identity, raw media, scores, or traits.
 */
export const ActivityPreferenceContextSchema = z.object({
  source: z.literal("parent_selected"),
  ageStage: z.enum(["0-12m", "12-36m", "3-4y", "4-6y"]),
  interestTags: z.array(ObservationTagSchema).max(4),
  activityLength: z.enum(["very_short", "short", "standard"]).optional(),
  recentApprovedContext: z.array(ObservationTagSchema).max(3),
  expiresAt: z.string().datetime(),
  parentEditable: z.literal(true),
}).strict();

export const ParentObservationSuggestionSchema = z.object({
  source: z.literal("parent_reported"),
  observedEvents: z.array(z.string().trim().min(1).max(180)).max(3),
  parentSummary: z.string().trim().min(1).max(240),
  nextActivityContext: NextActivityContextSchema,
  ephemeralOnly: z.literal(true),
  requiresParentReview: z.literal(true),
  notAnAssessment: z.literal(true),
}).strict();

export type ParentReflectionInput = z.infer<typeof ParentReflectionInputSchema>;
export type NextActivityContext = z.infer<typeof NextActivityContextSchema>;
export type ActivityPreferenceContext = z.infer<
  typeof ActivityPreferenceContextSchema
>;
export type ParentObservationSuggestion = z.infer<
  typeof ParentObservationSuggestionSchema
>;
