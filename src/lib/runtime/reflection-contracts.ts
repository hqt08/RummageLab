import { z } from "zod";

import { ObservationTagSchema } from "../schemas";

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
