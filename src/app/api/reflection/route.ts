import { NextResponse } from "next/server";
import { z } from "zod";

import { TypedReflectionRequestSchema } from "../../../lib/runtime/reflection-contracts";
import { guardTypedReflection } from "../../../lib/runtime/reflection-guard";
import { createOpenAIReflectionProvider } from "../../../lib/runtime/openai-reflection-provider";
import { disabledReflectionResponse, resolveReflection } from "../../../lib/runtime/reflection-runtime";
import { getLiveOpenAICapability } from "../../../lib/runtime/live-openai-server";

export const runtime = "nodejs";
const MAX_BODY_BYTES = 4 * 1024;

function errorResponse(code: string, status: number) {
  return NextResponse.json({ error: { code } }, { status });
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
    const body = TypedReflectionRequestSchema.parse(await readBoundedJson(request));
    const guard = guardTypedReflection(body.reflection.text);
    if (!guard.safe) {
      return errorResponse(guard.code === "too_long" ? "reflection_too_long" : "reflection_pii_risk", 422);
    }
    const capability = getLiveOpenAICapability();
    if (!capability.enabled) {
      return NextResponse.json(disabledReflectionResponse());
    }
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
