import Busboy from "busboy";
import { once } from "node:events";

const MAX_REQUEST_BYTES = 9 * 1024 * 1024;
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

export type MultipartPhotoFailureCode =
  | "invalid_form_data"
  | "request_too_large"
  | "photo_too_large"
  | "unexpected_field"
  | "unconfirmed_or_invalid_context";

export class MultipartPhotoError extends Error {
  constructor(readonly code: MultipartPhotoFailureCode) {
    super(code);
    this.name = "MultipartPhotoError";
  }
}

export type TransientPhotoAgeStage = "0-12m" | "12-36m" | "3-4y" | "4-6y";

const TRANSIENT_PHOTO_AGE_STAGES: readonly TransientPhotoAgeStage[] = [
  "0-12m",
  "12-36m",
  "3-4y",
  "4-6y",
];

export type TransientPhotoMultipart = {
  operation: "photo_inventory";
  objectOnlyConfirmed: true;
  ageStage: TransientPhotoAgeStage;
  photo: {
    bytes: Uint8Array;
    declaredType: string;
  };
};

/**
 * Parses the upload as a stream. Raw request bytes and photo bytes are bounded
 * independently of Content-Length; filenames are deliberately ignored.
 */
export async function parseTransientPhotoMultipart(
  request: Request,
): Promise<TransientPhotoMultipart> {
  if (!request.body) {
    throw new MultipartPhotoError("invalid_form_data");
  }

  let parser: ReturnType<typeof Busboy>;
  try {
    parser = Busboy({
      headers: { "content-type": request.headers.get("content-type") ?? "" },
      limits: {
        fieldNameSize: 40,
        fieldSize: 100,
        fields: 4,
        fileSize: MAX_PHOTO_BYTES,
        files: 2,
        parts: 5,
      },
    });
  } catch {
    throw new MultipartPhotoError("invalid_form_data");
  }

  const fields = new Map<string, string>();
  const photoChunks: Buffer[] = [];
  let photoType: string | null = null;
  let photoSeen = false;
  let failure: MultipartPhotoFailureCode | null = null;

  const markFailure = (code: MultipartPhotoFailureCode) => {
    failure ??= code;
  };

  parser.on("field", (name, value, info) => {
    if (
      info.nameTruncated ||
      info.valueTruncated ||
      !["operation", "objectOnlyConfirmed", "ageStage"].includes(name) ||
      fields.has(name)
    ) {
      markFailure("unexpected_field");
      return;
    }
    fields.set(name, value);
  });

  parser.on("file", (name, stream, info) => {
    if (name !== "photo" || photoSeen) {
      markFailure("unexpected_field");
      stream.resume();
      return;
    }
    photoSeen = true;
    photoType = info.mimeType;
    stream.on("limit", () => markFailure("photo_too_large"));
    stream.on("data", (chunk: Buffer) => {
      if (!failure) photoChunks.push(chunk);
    });
  });
  parser.on("fieldsLimit", () => markFailure("unexpected_field"));
  parser.on("filesLimit", () => markFailure("unexpected_field"));
  parser.on("partsLimit", () => markFailure("unexpected_field"));
  parser.on("error", () => markFailure("invalid_form_data"));

  const closed = once(parser, "close");
  const reader = request.body.getReader();
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_REQUEST_BYTES) {
        failure = "request_too_large";
        await reader.cancel();
        parser.destroy();
        break;
      }
      if (!parser.write(Buffer.from(value))) {
        await once(parser, "drain");
      }
    }
    if (totalBytes <= MAX_REQUEST_BYTES) parser.end();
    await closed;
  } catch {
    markFailure("invalid_form_data");
    parser.destroy();
  } finally {
    reader.releaseLock();
  }

  if (failure) throw new MultipartPhotoError(failure);
  const ageStage = fields.get("ageStage") as TransientPhotoAgeStage | undefined;
  if (
    fields.get("operation") !== "photo_inventory" ||
    fields.get("objectOnlyConfirmed") !== "true" ||
    !ageStage ||
    !TRANSIENT_PHOTO_AGE_STAGES.includes(ageStage) ||
    !photoSeen ||
    !photoType
  ) {
    throw new MultipartPhotoError("unconfirmed_or_invalid_context");
  }

  return {
    operation: "photo_inventory",
    objectOnlyConfirmed: true,
    ageStage,
    photo: {
      bytes: new Uint8Array(Buffer.concat(photoChunks)),
      declaredType: photoType,
    },
  };
}
