import { z } from "zod";

import { AgeStageSchema, ObservationTagSchema, WeatherTagSchema } from "../schemas";

export const TypedReflectionRequestSchema = z.object({
  operation: z.literal("reflection_suggestion"),
  fixtureId: z.literal("kitchen-sound-detectives"),
  reflection: z.object({
    source: z.literal("typed"),
    text: z.string().trim().min(1).max(400),
    childVoiceIncluded: z.literal(false),
  }).strict(),
}).strict();

/**
 * Provider output is intentionally unapproved. Only the client-side parent
 * approval step may construct a parent_approved NextActivityContext.
 */
export const ReflectionSuggestionDraftSchema = z.object({
  source: z.literal("parent_reported"),
  observedEvents: z.array(z.string().trim().min(1).max(180)).min(1).max(3),
  parentSummary: z.string().trim().min(1).max(240),
  suggestedInterestTags: z.array(ObservationTagSchema).min(1).max(3),
  suggestedSupportTags: z.array(ObservationTagSchema).max(2),
  ephemeralOnly: z.literal(true),
  requiresParentReview: z.literal(true),
  notAnAssessment: z.literal(true),
}).strict().superRefine((draft, context) => {
  const interest = new Set(draft.suggestedInterestTags);
  const support = new Set(draft.suggestedSupportTags);
  if (interest.size !== draft.suggestedInterestTags.length || support.size !== draft.suggestedSupportTags.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Suggested tags must be unique" });
  }
  if (draft.suggestedInterestTags.some((tag) => support.has(tag))) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Interest and support tags must be disjoint" });
  }
});

export const ReflectionFailureCodeSchema = z.enum([
  "provider_disabled",
  "provider_timeout",
  "provider_unavailable",
  "provider_malformed_response",
  "provider_unsafe_response",
  "provider_unexpected_failure",
]);

export const ReflectionResponseSchema = z.object({
  suggestion: ReflectionSuggestionDraftSchema,
  runtime: z.object({
    source: z.enum(["live_provider", "prepared_fallback"]),
    diagnostic: z.object({
      operation: z.literal("reflection_suggestion"),
      code: ReflectionFailureCodeSchema,
      fallbackUsed: z.literal(true),
      retryable: z.boolean(),
    }).strict().optional(),
  }).strict(),
}).strict();

export type TypedReflectionRequest = z.infer<typeof TypedReflectionRequestSchema>;
export type ReflectionSuggestionDraft = z.infer<typeof ReflectionSuggestionDraftSchema>;
export type ReflectionFailureCode = z.infer<typeof ReflectionFailureCodeSchema>;

export interface ReflectionProvider {
  suggest(request: TypedReflectionRequest): Promise<unknown>;
}

/**
 * Request for one live-authored next-activity idea after a generated (non
 * golden-path) activity. Everything here is already parent-approved: the tags
 * were explicitly checked, the summary is the parent's own reviewed wording
 * (guarded again server-side), and the labels are the confirmed objects.
 */
export const NextSuggestionRequestSchema = z.object({
  operation: z.literal("next_suggestion"),
  ageStage: AgeStageSchema,
  weatherTags: z.array(WeatherTagSchema).min(1).max(4),
  objectLabels: z.array(z.string().trim().min(1).max(60)).min(1).max(5),
  previousActivityTitle: z.string().trim().min(1).max(100),
  approvedInterestTags: z.array(ObservationTagSchema).min(1).max(3),
  approvedSupportTags: z.array(ObservationTagSchema).max(2),
  parentSummary: z.string().trim().min(1).max(400),
}).strict();

export const NextActivitySuggestionSchema = z.object({
  title: z.string().trim().min(1).max(80),
  durationMinutes: z.union([z.literal(5), z.literal(8), z.literal(10)]),
  invitation: z.string().trim().min(1).max(240),
  connection: z.string().trim().min(1).max(240),
}).strict();

export const NextSuggestionResponseSchema = z.object({
  suggestion: NextActivitySuggestionSchema,
  runtime: z.object({
    source: z.enum(["live_provider", "prepared_fallback"]),
    diagnostic: z.object({
      operation: z.literal("next_suggestion"),
      code: ReflectionFailureCodeSchema,
      fallbackUsed: z.literal(true),
      retryable: z.boolean(),
    }).strict().optional(),
  }).strict(),
}).strict();

export type NextSuggestionRequest = z.infer<typeof NextSuggestionRequestSchema>;
export type NextActivitySuggestion = z.infer<typeof NextActivitySuggestionSchema>;
export type NextSuggestionResponse = z.infer<typeof NextSuggestionResponseSchema>;
