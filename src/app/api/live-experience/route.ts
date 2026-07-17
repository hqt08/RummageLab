import { NextResponse } from "next/server";
import { z } from "zod";

import { createOpenAIExperienceProvider } from "../../../lib/runtime/openai-provider";
import { ImageSanitizationError, sanitizeObjectPhoto } from "../../../lib/runtime/image-sanitizer";
import {
  MultipartPhotoError,
  parseTransientPhotoMultipart,
} from "../../../lib/runtime/multipart-photo";
import {
  ExperienceResponseSchema,
  PhotoInventoryResponseSchema,
} from "../../../lib/runtime/contracts";
import {
  resolveExperience,
  RuntimeProviderFailure,
  runtimeDiagnostic,
  validateLivePhotoInventory,
} from "../../../lib/runtime/seeded-runtime";
import { kitchenSoundPhotoInventory } from "../../../lib/demo/kitchen-sound-detectives";
import { ActivityContextSchema } from "../../../lib/schemas";

export const runtime = "nodejs";

const ExperienceBodySchema = z.object({
  operation: z.literal("experience_selection"),
  fixtureId: z.literal("kitchen-sound-detectives"),
  activityContext: ActivityContextSchema,
}).strict();

const MAX_REQUEST_BYTES = 9 * 1024 * 1024;
const MAX_JSON_BYTES = 64 * 1024;

class BoundedBodyError extends Error {
  constructor(readonly code: "invalid_request" | "request_too_large") {
    super(code);
  }
}

function invalidRequest(code: string, status = 400) {
  return NextResponse.json({ error: { code } }, { status });
}

async function readBoundedJson(request: Request): Promise<unknown> {
  if (!request.body) throw new BoundedBodyError("invalid_request");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_JSON_BYTES) {
        await reader.cancel();
        throw new BoundedBodyError("request_too_large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(body));
}

export async function GET() {
  return NextResponse.json({
    livePhotoAnalysisAvailable: Boolean(process.env.OPENAI_API_KEY?.trim()),
    seededDemoAvailable: true,
  });
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return invalidRequest("request_too_large", 413);
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (/^multipart\/form-data(?:;|$)/i.test(contentType)) {
    let upload;
    try {
      upload = await parseTransientPhotoMultipart(request);
    } catch (error) {
      if (error instanceof MultipartPhotoError) {
        const status = error.code === "request_too_large" || error.code === "photo_too_large" ? 413 : 400;
        return invalidRequest(error.code, status);
      }
      return invalidRequest("invalid_form_data");
    }

    let sanitized;
    try {
      sanitized = await sanitizeObjectPhoto({
        bytes: upload.photo.bytes,
        declaredType: upload.photo.declaredType,
      });
    } catch (error) {
      if (error instanceof ImageSanitizationError) return invalidRequest(error.code);
      return invalidRequest("invalid_content");
    }

    if (!process.env.OPENAI_API_KEY?.trim()) {
      return NextResponse.json(PhotoInventoryResponseSchema.parse({
        inventory: kitchenSoundPhotoInventory,
        runtime: {
          source: "seeded_fallback",
          diagnostic: runtimeDiagnostic("photo_inventory", new RuntimeProviderFailure("provider_unavailable")),
        },
      }));
    }

    try {
      const provider = createOpenAIExperienceProvider({
        apiKey: process.env.OPENAI_API_KEY,
        transientImage: {
          mimeType: sanitized.mediaType,
          base64: Buffer.from(sanitized.bytes).toString("base64"),
        },
      });
      const inventory = validateLivePhotoInventory(await provider.getPhotoInventory({
        mode: "live_transient_object_upload",
        ageStage: "3-4y",
        objectOnly: true,
      }));
      return NextResponse.json(PhotoInventoryResponseSchema.parse({
        inventory,
        runtime: { source: "live_provider" },
      }));
    } catch (error) {
      if (error instanceof ImageSanitizationError) return invalidRequest(error.code);
      return NextResponse.json(PhotoInventoryResponseSchema.parse({
        inventory: kitchenSoundPhotoInventory,
        runtime: {
          source: "seeded_fallback",
          diagnostic: runtimeDiagnostic("photo_inventory", error),
        },
      }));
    }
  }

  if (!/^application\/json(?:;|$)/i.test(contentType)) return invalidRequest("unsupported_content_type", 415);
  try {
    const raw = await readBoundedJson(request);
    const body = ExperienceBodySchema.parse(raw);
    const provider = createOpenAIExperienceProvider({
      apiKey: process.env.OPENAI_API_KEY,
      transientImage: { mimeType: "image/jpeg", base64: "" },
    });
    const result = await resolveExperience({
      fixtureId: body.fixtureId,
      activityContext: body.activityContext,
    }, provider);
    return NextResponse.json(ExperienceResponseSchema.parse({
      ...result,
      runtime: result.runtime.source === "seeded_provider"
        ? { source: "live_provider" }
        : result.runtime,
    }));
  } catch (error) {
    if (error instanceof BoundedBodyError) {
      return invalidRequest(error.code, error.code === "request_too_large" ? 413 : 400);
    }
    if (error instanceof z.ZodError) return invalidRequest("invalid_activity_context");
    return invalidRequest("invalid_request");
  }
}
