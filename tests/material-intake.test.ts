import { describe, expect, it, vi } from "vitest";

import {
  guardTypedObjectLabels,
  LOCAL_OBJECT_PHOTO_MAX_BYTES,
  LOCAL_OBJECT_PHOTO_MAX_DIMENSION,
  LOCAL_OBJECT_PHOTO_MAX_PIXELS,
  computeDownscaledDimensions,
  createLocalPhotoPreview,
  normalizeKitchenSoundTypedMaterials,
  releaseLocalPhotoPreview,
  validateLocalObjectPhoto,
  validateLocalObjectPhotoContent,
  validateLocalObjectPhotoDimensions,
} from "../src/lib/demo/material-intake";

describe("typed material intake", () => {
  it("normalizes only the exact Kitchen Sound allowlist and deduplicates categories", () => {
    const result = normalizeKitchenSoundTypedMaterials(
      "plastic containers, tupperware containers\nwooden spoon\ndish towel",
    );

    expect(result.inputError).toBeNull();
    expect(result.accepted.map((item) => item.category)).toEqual([
      "large_empty_plastic_container",
      "wooden_kitchen_utensil",
      "soft_cloth",
    ]);
    expect(result.missing).toEqual([]);
    expect(result.excluded).toEqual([]);
  });

  it("keeps unsafe, unknown, and contact-like items out while retaining other approved categories", () => {
    const result = normalizeKitchenSoundTypedMaterials(
      "coin, silicone spatula, soft ball, mystery widget, parent@example.com",
    );

    expect(result.accepted.map((item) => item.category)).toEqual([
      "silicone_kitchen_utensil",
      "large_soft_ball",
    ]);
    expect(result.excluded.map((item) => item.reason)).toEqual([
      "unsafe",
      "unknown",
      "private_information",
    ]);
    expect(result.missing).toHaveLength(3);
  });

  it("rejects lists over five entries and labels over 80 characters", () => {
    expect(
      normalizeKitchenSoundTypedMaterials("one,two,three,four,five,six")
        .inputError,
    ).toMatch(/five/);
    expect(
      normalizeKitchenSoundTypedMaterials("x".repeat(81)).inputError,
    ).toMatch(/80/);
  });

  it("does not treat one container as the required two-container kit", () => {
    const result = normalizeKitchenSoundTypedMaterials(
      "plastic container, wooden spoon, dish towel",
    );

    expect(result.accepted.map((item) => item.category)).not.toContain(
      "large_empty_plastic_container",
    );
    expect(result.missing).toContain("large_empty_plastic_container");
  });

  it("guards transient live labels before they can leave the browser", () => {
    expect(guardTypedObjectLabels("duck\nball")).toEqual({
      safe: true,
      objectLabels: ["duck", "ball"],
    });
    expect(guardTypedObjectLabels("my-school address")).toMatchObject({
      safe: false,
      code: "private_information",
    });
    expect(guardTypedObjectLabels("coin")).toMatchObject({
      safe: false,
      code: "unsafe",
    });
  });
});

describe("local object-photo intake", () => {
  it("accepts bounded JPEG, PNG, and WebP files", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"]) {
      expect(validateLocalObjectPhoto({ size: 1_024, type })).toEqual({
        ok: true,
      });
    }
  });

  it("rejects empty and oversized files on size alone (type is not trusted)", () => {
    expect(validateLocalObjectPhoto({ size: 0, type: "image/jpeg" })).toMatchObject({
      ok: false,
      code: "empty",
    });
    expect(
      validateLocalObjectPhoto({
        size: LOCAL_OBJECT_PHOTO_MAX_BYTES + 1,
        type: "image/png",
      }),
    ).toMatchObject({ ok: false, code: "too_large" });
    // An empty or odd MIME type (as iOS galleries send) is not rejected here;
    // the real format is decided from the bytes in content validation.
    expect(validateLocalObjectPhoto({ size: 1_024, type: "" })).toEqual({ ok: true });
  });

  it("downscales oversized phone captures to fit the review limits, preserving aspect", () => {
    // A 48MP iPhone portrait capture must scale to within 6000px and 16MP.
    const portrait = computeDownscaledDimensions(6048, 8064);
    expect(portrait).not.toBeNull();
    expect(portrait!.width * portrait!.height).toBeLessThanOrEqual(LOCAL_OBJECT_PHOTO_MAX_PIXELS);
    expect(Math.max(portrait!.width, portrait!.height)).toBeLessThanOrEqual(LOCAL_OBJECT_PHOTO_MAX_DIMENSION);
    // Aspect ratio preserved within rounding.
    expect(portrait!.height / portrait!.width).toBeCloseTo(8064 / 6048, 2);

    // A 24MP landscape capture also fits after scaling.
    const landscape = computeDownscaledDimensions(6000, 4000);
    expect(landscape).not.toBeNull();
    expect(landscape!.width * landscape!.height).toBeLessThanOrEqual(LOCAL_OBJECT_PHOTO_MAX_PIXELS);

    // A standard 12MP capture needs no resize.
    expect(computeDownscaledDimensions(4032, 3024)).toBeNull();
    // Degenerate input never produces a bogus target.
    expect(computeDownscaledDimensions(0, 100)).toBeNull();
  });

  it("decides the image type from magic bytes, not the declared MIME type", async () => {
    // A valid JPEG whose browser-reported type is empty (the iOS gallery case).
    const jpegNoType = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0x00])], {
      type: "",
    }) as Blob & { type: string };
    const png = new Blob([
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ]) as Blob & { type: string };
    const heic = new Blob([
      new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]),
    ]) as Blob & { type: string };
    const disguisedText = new Blob(["not an image"], {
      type: "image/jpeg",
    }) as Blob & { type: string };

    await expect(validateLocalObjectPhotoContent(jpegNoType)).resolves.toMatchObject({
      ok: true,
      detectedType: "image/jpeg",
    });
    await expect(validateLocalObjectPhotoContent(png)).resolves.toMatchObject({
      ok: true,
      detectedType: "image/png",
    });
    await expect(validateLocalObjectPhotoContent(heic)).resolves.toMatchObject({
      ok: false,
      code: "unsupported_type",
    });
    await expect(validateLocalObjectPhotoContent(disguisedText)).resolves.toMatchObject({
      ok: false,
      code: "invalid_content",
    });
    expect(validateLocalObjectPhotoDimensions({ width: 4000, height: 3000 })).toEqual({
      ok: true,
    });
    expect(
      validateLocalObjectPhotoDimensions({
        width: LOCAL_OBJECT_PHOTO_MAX_PIXELS,
        height: 2,
      }),
    ).toMatchObject({ ok: false, code: "dimensions_too_large" });
  });

  it("revokes replaced and released temporary object URLs", () => {
    const revokeObjectURL = vi.fn();
    const createObjectURL = vi.fn(() => "blob:new-preview");
    const objectUrlApi = { createObjectURL, revokeObjectURL };
    const blob = new Blob(["photo"], { type: "image/jpeg" });

    const preview = createLocalPhotoPreview(blob, "blob:old-preview", objectUrlApi);
    releaseLocalPhotoPreview(preview, objectUrlApi);

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(revokeObjectURL).toHaveBeenNthCalledWith(1, "blob:old-preview");
    expect(revokeObjectURL).toHaveBeenNthCalledWith(2, "blob:new-preview");
  });
});
