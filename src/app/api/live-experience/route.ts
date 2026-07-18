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
  disabledExperienceResponse,
  resolveExperience,
  runtimeDiagnostic,
  validateLivePhotoInventory,
} from "../../../lib/runtime/seeded-runtime";
import { getLiveOpenAICapability } from "../../../lib/runtime/live-openai-server";
import {
  kitchenSoundActivityContext,
} from "../../../lib/demo/kitchen-sound-detectives";
import { ActivityContextSchema, AgeStageSchema } from "../../../lib/schemas";
import { guardTypedObjectLabels } from "../../../lib/demo/material-intake";

export const runtime = "nodejs";
// Authoring a full activity can take longer than a simple object inventory;
// allow the server function to outlast the provider's generation timeout so a
// slow model call fails to the reviewed fallback rather than a gateway timeout.
export const maxDuration = 60;

const ExperienceBodySchema = z.object({
  operation: z.literal("experience_selection"),
  fixtureId: z.literal("kitchen-sound-detectives"),
  activityContext: ActivityContextSchema,
}).strict();

const TypedObjectInventoryBodySchema = z.object({
  operation: z.literal("typed_object_inventory"),
  objectLabels: z.array(z.string().min(1).max(80)).min(1).max(5),
  /** Optional for backward compatibility; defaults to the 3–4 demo band. */
  ageStage: AgeStageSchema.optional(),
}).strict();

const JsonBodySchema = z.union([ExperienceBodySchema, TypedObjectInventoryBodySchema]);

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
    livePhotoAnalysisAvailable: getLiveOpenAICapability().enabled,
    seededDemoAvailable: true,
  });
}

export async function POST(request: Request) {
  const capability = getLiveOpenAICapability();
  const contentType = request.headers.get("content-type") ?? "";

  // Fail closed before reading multipart bytes, decoding an image, or creating a
  // provider. The UI avoids this request while disabled; this response keeps a
  // closed, schema-validated fallback for direct callers.
  if (!capability.enabled) {
    if (/^multipart\/form-data(?:;|$)/i.test(contentType)) {
      return invalidRequest("live_photo_inventory_unavailable", 503);
    }
    if (/^application\/json(?:;|$)/i.test(contentType)) {
      if (request.headers.get("x-rummagelab-operation") === "typed_object_inventory") {
        return invalidRequest("live_typed_mapping_unavailable", 503);
      }
      return NextResponse.json(ExperienceResponseSchema.parse(disabledExperienceResponse({
        fixtureId: "kitchen-sound-detectives",
        activityContext: kitchenSoundActivityContext,
      })));
    }
    return invalidRequest("unsupported_content_type", 415);
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return invalidRequest("request_too_large", 413);
  }

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

    try {
      const provider = createOpenAIExperienceProvider({
        apiKey: capability.apiKey,
        model: capability.model,
        transientImage: {
          mimeType: sanitized.mediaType,
          base64: Buffer.from(sanitized.bytes).toString("base64"),
        },
      });
      const inventory = validateLivePhotoInventory(await provider.getPhotoInventory({
        mode: "live_transient_object_upload",
        ageStage: upload.ageStage,
        objectOnly: true,
      }));
      return NextResponse.json(PhotoInventoryResponseSchema.parse({
        inventory,
        runtime: { source: "live_provider" },
      }));
    } catch (error) {
      if (error instanceof ImageSanitizationError) return invalidRequest(error.code);
      runtimeDiagnostic("photo_inventory", error);
      return invalidRequest("live_photo_inventory_unavailable", 503);
    }
  }

  if (!/^application\/json(?:;|$)/i.test(contentType)) return invalidRequest("unsupported_content_type", 415);
  try {
    const raw = await readBoundedJson(request);
    const body = JsonBodySchema.parse(raw);
    if (body.operation === "typed_object_inventory") {
      const guarded = guardTypedObjectLabels(body.objectLabels.join("\n"));
      if (!guarded.safe) return invalidRequest("unsafe_typed_object_labels");
      try {
        const provider = createOpenAIExperienceProvider({
          apiKey: capability.apiKey,
          model: capability.model,
          transientImage: { mimeType: "image/jpeg", base64: "" },
        });
        const inventory = validateLivePhotoInventory(await provider.getPhotoInventory({
          mode: "live_typed_object_labels",
          ageStage: body.ageStage ?? "3-4y",
          objectLabels: guarded.objectLabels,
        }));
        return NextResponse.json(PhotoInventoryResponseSchema.parse({
          inventory,
          runtime: { source: "live_provider" },
        }));
      } catch (error) {
        // Typed input has its own browser-side bounded allowlist. Never replace
        // the parent's labels with the unrelated Kitchen Sound fixture when the
        // live mapper is unavailable; a content-free 503 lets the client retain
        // its local candidates instead.
        runtimeDiagnostic("typed_object_inventory", error);
        return invalidRequest("live_typed_mapping_unavailable", 503);
      }
    }
    const provider = createOpenAIExperienceProvider({
      apiKey: capability.apiKey,
      model: capability.model,
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
