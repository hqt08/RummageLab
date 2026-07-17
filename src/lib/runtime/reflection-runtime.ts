import { z } from "zod";

import {
  ReflectionResponseSchema,
  ReflectionSuggestionDraftSchema,
  TypedReflectionRequestSchema,
  type ReflectionFailureCode,
  type ReflectionProvider,
  type TypedReflectionRequest,
} from "./reflection-contracts";
import { guardTypedReflection, isPlainObservationLanguage } from "./reflection-guard";

export class ReflectionProviderFailure extends Error {
  constructor(readonly code: ReflectionFailureCode) {
    super(code);
    this.name = "ReflectionProviderFailure";
  }
}

export const preparedReflectionSuggestion = ReflectionSuggestionDraftSchema.parse({
  source: "parent_reported",
  observedEvents: ["Copied a two-tap pattern.", "Used a sound word while comparing containers."],
  parentSummary: "They copied two taps and used a sound word while comparing the containers.",
  suggestedInterestTags: ["sound_play", "two_beat_pattern"],
  suggestedSupportTags: ["turn_taking"],
  ephemeralOnly: true,
  requiresParentReview: true,
  notAnAssessment: true,
});

export function disabledReflectionResponse() {
  return ReflectionResponseSchema.parse({
    suggestion: preparedReflectionSuggestion,
    runtime: {
      source: "prepared_fallback",
      diagnostic: {
        operation: "reflection_suggestion",
        code: "provider_disabled",
        fallbackUsed: true,
        retryable: false,
      },
    },
  });
}

function failureCode(error: unknown): ReflectionFailureCode {
  if (error instanceof ReflectionProviderFailure) return error.code;
  if (error instanceof z.ZodError) return "provider_malformed_response";
  if (error instanceof Error && error.name === "TimeoutError") return "provider_timeout";
  return "provider_unexpected_failure";
}

function comparableText(input: string): string {
  return input.normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function validateReflectionSuggestion(input: unknown, rawReflection?: string) {
  const suggestion = ReflectionSuggestionDraftSchema.parse(input);
  const prose = [...suggestion.observedEvents, suggestion.parentSummary];
  if (prose.some((value) => !isPlainObservationLanguage(value))) {
    throw new ReflectionProviderFailure("provider_unsafe_response");
  }
  if (rawReflection) {
    const raw = comparableText(rawReflection);
    if (prose.some((value) => {
      const output = comparableText(value);
      return output === raw || (
        raw.length >= 12 && (output.includes(raw) || raw.includes(output))
      );
    })) {
      throw new ReflectionProviderFailure("provider_unsafe_response");
    }
  }
  return suggestion;
}

export async function resolveReflection(
  request: TypedReflectionRequest,
  provider: ReflectionProvider,
) {
  const parsed = TypedReflectionRequestSchema.parse(request);
  if (!guardTypedReflection(parsed.reflection.text).safe) {
    throw new ReflectionProviderFailure("provider_unsafe_response");
  }
  try {
    return ReflectionResponseSchema.parse({
      suggestion: validateReflectionSuggestion(
        await provider.suggest(parsed),
        parsed.reflection.text,
      ),
      runtime: { source: "live_provider" },
    });
  } catch (error) {
    const code = failureCode(error);
    return ReflectionResponseSchema.parse({
      suggestion: preparedReflectionSuggestion,
      runtime: {
        source: "prepared_fallback",
        diagnostic: {
          operation: "reflection_suggestion",
          code,
          fallbackUsed: true,
          retryable: code !== "provider_unsafe_response",
        },
      },
    });
  }
}
