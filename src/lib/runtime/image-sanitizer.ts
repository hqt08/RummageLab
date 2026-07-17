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

function expectedFormat(
  declaredType: string,
): (typeof supportedTypes)[keyof typeof supportedTypes] {
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

  const format = expectedFormat(input.declaredType);

  try {
    const image = sharp(input.bytes, {
      animated: false,
      failOn: "warning",
      limitInputPixels: MAX_PIXELS,
      sequentialRead: true,
    });
    const metadata = await image.metadata();

    if (metadata.format !== format || !metadata.width || !metadata.height) {
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
