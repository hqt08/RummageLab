import { NextResponse } from "next/server";
import { z } from "zod";

import {
  NextSuggestionResponseSchema,
  NextSuggestionRequestSchema,
  TypedReflectionRequestSchema,
  type NextSuggestionRequest,
  type ReflectionFailureCode,
} from "../../../lib/runtime/reflection-contracts";
import { guardTypedReflection } from "../../../lib/runtime/reflection-guard";
import {
  createOpenAIReflectionProvider,
  suggestNextActivityLive,
} from "../../../lib/runtime/openai-reflection-provider";
import {
  ReflectionProviderFailure,
  disabledReflectionResponse,
  resolveReflection,
} from "../../../lib/runtime/reflection-runtime";
import { createGenericNextIdea } from "../../../lib/demo/generic-next-suggestion";
import { getLiveOpenAICapability } from "../../../lib/runtime/live-openai-server";
import {
  checkRateLimit,
  clientKeyFromHeaders,
} from "../../../lib/runtime/rate-limit";

const ReflectionBodySchema = z.union([
  TypedReflectionRequestSchema,
  NextSuggestionRequestSchema,
]);

function fallbackNextSuggestionResponse(
  body: NextSuggestionRequest,
  code: ReflectionFailureCode,
) {
  return NextSuggestionResponseSchema.parse({
    suggestion: createGenericNextIdea({
      interestTags: body.approvedInterestTags,
      supportTags: body.approvedSupportTags,
      objectLabels: body.objectLabels,
    }),
    runtime: {
      source: "prepared_fallback",
      diagnostic: {
        operation: "next_suggestion",
        code,
        fallbackUsed: true,
        retryable: code !== "provider_disabled",
      },
    },
  });
}

export const runtime = "nodejs";
const MAX_BODY_BYTES = 4 * 1024;

function errorResponse(code: string, status: number) {
  return NextResponse.json({ error: { code } }, { status });
}

/** Content-free 429 shared with the live-experience route's billable paths. */
function rateLimitedResponse(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: { code: "rate_limited" } },
    { status: 429, headers: { "retry-after": String(retryAfterSeconds) } },
  );
}

async function readBoundedJson(request: Request): Promise<unknown> {
  if (!request.body) throw new Error("invalid_request");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new Error("request_too_large");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body)); }
  catch { throw new Error("invalid_request"); }
}

export async function POST(request: Request) {
  if (!/^application\/json(?:;|$)/i.test(request.headers.get("content-type") ?? "")) {
    return errorResponse("unsupported_content_type", 415);
  }
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return errorResponse("request_too_large", 413);
  try {
    const body = ReflectionBodySchema.parse(await readBoundedJson(request));

    if (body.operation === "next_suggestion") {
      const guard = guardTypedReflection(body.parentSummary);
      if (!guard.safe) {
        return errorResponse(guard.code === "too_long" ? "reflection_too_long" : "reflection_pii_risk", 422);
      }
      const capability = getLiveOpenAICapability();
      if (!capability.enabled) {
        return NextResponse.json(fallbackNextSuggestionResponse(body, "provider_disabled"));
      }
      const decision = checkRateLimit(clientKeyFromHeaders(request.headers));
      if (!decision.allowed) return rateLimitedResponse(decision.retryAfterSeconds);
      try {
        const suggestion = await suggestNextActivityLive(body, {
          apiKey: capability.apiKey,
          signal: request.signal,
        });
        return NextResponse.json(NextSuggestionResponseSchema.parse({
          suggestion,
          runtime: { source: "live_provider" },
        }));
      } catch (error) {
        const code = error instanceof ReflectionProviderFailure
          ? error.code
          : "provider_unexpected_failure";
        return NextResponse.json(fallbackNextSuggestionResponse(body, code));
      }
    }

    const guard = guardTypedReflection(body.reflection.text);
    if (!guard.safe) {
      return errorResponse(guard.code === "too_long" ? "reflection_too_long" : "reflection_pii_risk", 422);
    }
    const capability = getLiveOpenAICapability();
    if (!capability.enabled) {
      return NextResponse.json(disabledReflectionResponse());
    }
    const decision = checkRateLimit(clientKeyFromHeaders(request.headers));
    if (!decision.allowed) return rateLimitedResponse(decision.retryAfterSeconds);
    const response = await resolveReflection(body, createOpenAIReflectionProvider({
      apiKey: capability.apiKey,
      signal: request.signal,
    }));
    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof Error && error.message === "request_too_large") return errorResponse("request_too_large", 413);
    if (error instanceof z.ZodError) return errorResponse("invalid_reflection_request", 400);
    return errorResponse("invalid_request", 400);
  }
}
