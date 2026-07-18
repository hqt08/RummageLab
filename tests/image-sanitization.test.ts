import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

import {
  ImageSanitizationError,
  sanitizeObjectPhoto,
} from "../src/lib/runtime/image-sanitizer";

async function expectFailure(
  promise: Promise<unknown>,
  code: ImageSanitizationError["code"],
) {
  await expect(promise).rejects.toMatchObject({
    name: "ImageSanitizationError",
    code,
    message: code,
  });
}

describe("sanitizeObjectPhoto", () => {
  it("re-encodes supported pixels as a metadata-free JPEG", async () => {
    const source = await sharp({
      create: {
        width: 12,
        height: 8,
        channels: 3,
        background: { r: 35, g: 120, b: 190 },
      },
    })
      .jpeg()
      .withExif({ IFD0: { Artist: "private parent metadata" } })
      .withIccProfile("p3")
      .toBuffer();

    expect((await sharp(source).metadata()).exif).toBeDefined();

    const result = await sanitizeObjectPhoto({
      bytes: new Uint8Array(source),
      declaredType: "image/jpeg",
    });
    const metadata = await sharp(result.bytes).metadata();

    expect(result.mediaType).toBe("image/jpeg");
    expect(metadata.format).toBe("jpeg");
    expect(metadata.width).toBe(12);
    expect(metadata.height).toBe(8);
    expect(metadata.exif).toBeUndefined();
    expect(metadata.icc).toBeUndefined();
    expect(metadata.xmp).toBeUndefined();
    expect(metadata.comments).toBeUndefined();
  });

  it("rejects empty, oversize, unsupported, and spoofed input with closed codes", async () => {
    await expectFailure(
      sanitizeObjectPhoto({ bytes: new Uint8Array(), declaredType: "image/jpeg" }),
      "empty",
    );
    await expectFailure(
      sanitizeObjectPhoto({
        bytes: new Uint8Array(8 * 1024 * 1024 + 1),
        declaredType: "image/jpeg",
      }),
      "too_large",
    );
    await expectFailure(
      sanitizeObjectPhoto({ bytes: new Uint8Array([1]), declaredType: "image/gif" }),
      "unsupported_type",
    );

    const png = await sharp({
      create: {
        width: 2,
        height: 2,
        channels: 3,
        background: "white",
      },
    })
      .png()
      .toBuffer();
    await expectFailure(
      sanitizeObjectPhoto({
        bytes: new Uint8Array(png),
        declaredType: "image/jpeg",
      }),
      "invalid_content",
    );
  });

  it("accepts valid image bytes even when the browser sends no MIME type", async () => {
    const jpeg = await sharp({
      create: { width: 10, height: 10, channels: 3, background: "white" },
    })
      .jpeg()
      .toBuffer();

    const result = await sanitizeObjectPhoto({
      bytes: new Uint8Array(jpeg),
      declaredType: "",
    });
    expect(result.mediaType).toBe("image/jpeg");
  });

  it("rejects decoded dimensions beyond the reviewed limits", async () => {
    const tooWide = await sharp({
      create: {
        width: 6_001,
        height: 1,
        channels: 3,
        background: "white",
      },
    })
      .png()
      .toBuffer();

    await expectFailure(
      sanitizeObjectPhoto({
        bytes: new Uint8Array(tooWide),
        declaredType: "image/png",
      }),
      "dimensions_too_large",
    );
  });

  it("does not log source bytes or decoder failures", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      await expectFailure(
        sanitizeObjectPhoto({
          bytes: new Uint8Array([0xff, 0xd8, 0xff, 0x00]),
          declaredType: "image/jpeg",
        }),
        "invalid_content",
      );
      expect(log).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
      warn.mockRestore();
      error.mockRestore();
    }
  });
});
