import sharp from "sharp";

const MAX_INPUT_BYTES = 8 * 1024 * 1024;
const MAX_DIMENSION = 6_000;
const MAX_PIXELS = 16_000_000;

const supportedTypes = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type ImageSanitizationFailureCode =
  | "empty"
  | "too_large"
  | "unsupported_type"
  | "invalid_content"
  | "dimensions_too_large";

/** A content-free error suitable for mapping to a public route response. */
export class ImageSanitizationError extends Error {
  constructor(readonly code: ImageSanitizationFailureCode) {
    super(code);
    this.name = "ImageSanitizationError";
  }
}

export type SanitizedObjectPhoto = {
  bytes: Uint8Array;
  mediaType: "image/jpeg";
};

type SupportedFormat = (typeof supportedTypes)[keyof typeof supportedTypes];

function isSupportedFormat(format: string | undefined): format is SupportedFormat {
  return format === "jpeg" || format === "png" || format === "webp";
}

/**
 * A non-empty declared type must be a supported one. An empty/absent declared
 * type is tolerated here (mobile galleries send valid image bytes with no MIME);
 * the authoritative format check happens against the decoded bytes below.
 */
function declaredFormatOrNull(declaredType: string): SupportedFormat | null {
  if (declaredType === "") return null;
  if (!(declaredType in supportedTypes)) {
    throw new ImageSanitizationError("unsupported_type");
  }
  return supportedTypes[declaredType as keyof typeof supportedTypes];
}

/**
 * Decodes and re-encodes a transient object photo entirely in memory. Sharp
 * omits source EXIF, XMP, ICC, and comments unless metadata retention is
 * explicitly requested; this pipeline never requests it.
 */
export async function sanitizeObjectPhoto(input: {
  bytes: Uint8Array;
  declaredType: string;
}): Promise<SanitizedObjectPhoto> {
  if (input.bytes.byteLength === 0) {
    throw new ImageSanitizationError("empty");
  }
  if (input.bytes.byteLength > MAX_INPUT_BYTES) {
    throw new ImageSanitizationError("too_large");
  }

  const declaredFormat = declaredFormatOrNull(input.declaredType);

  try {
    const image = sharp(input.bytes, {
      animated: false,
      failOn: "warning",
      limitInputPixels: MAX_PIXELS,
      sequentialRead: true,
    });
    const metadata = await image.metadata();

    // The decoded bytes are authoritative. Accept only real JPEG/PNG/WebP, and
    // if a supported type was declared it must agree with what the bytes are.
    if (!isSupportedFormat(metadata.format) || !metadata.width || !metadata.height) {
      throw new ImageSanitizationError("invalid_content");
    }
    if (declaredFormat && metadata.format !== declaredFormat) {
      throw new ImageSanitizationError("invalid_content");
    }
    if ((metadata.pages ?? 1) !== 1) {
      throw new ImageSanitizationError("invalid_content");
    }
    if (
      metadata.width > MAX_DIMENSION ||
      metadata.height > MAX_DIMENSION ||
      metadata.width * metadata.height > MAX_PIXELS
    ) {
      throw new ImageSanitizationError("dimensions_too_large");
    }

    const bytes = await image
      .rotate()
      .jpeg({ quality: 86, chromaSubsampling: "4:2:0", progressive: false })
      .toBuffer();

    return { bytes: new Uint8Array(bytes), mediaType: "image/jpeg" };
  } catch (error) {
    if (error instanceof ImageSanitizationError) {
      throw error;
    }
    if (
      error instanceof Error &&
      /pixel limit|Input image exceeds pixel limit/i.test(error.message)
    ) {
      throw new ImageSanitizationError("dimensions_too_large");
    }
    throw new ImageSanitizationError("invalid_content");
  }
}
