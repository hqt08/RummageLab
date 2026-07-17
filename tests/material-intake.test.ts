import { describe, expect, it, vi } from "vitest";

import {
  guardTypedObjectLabels,
  LOCAL_OBJECT_PHOTO_MAX_BYTES,
  LOCAL_OBJECT_PHOTO_MAX_PIXELS,
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

  it("rejects empty, oversized, and unsupported files", () => {
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
    expect(
      validateLocalObjectPhoto({ size: 1_024, type: "image/heic" }),
    ).toMatchObject({ ok: false, code: "unsupported_type" });
  });

  it("verifies image signatures and bounded decoded dimensions", async () => {
    const jpeg = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0x00])], {
      type: "image/jpeg",
    }) as Blob & { type: string };
    const disguisedText = new Blob(["not an image"], {
      type: "image/jpeg",
    }) as Blob & { type: string };

    await expect(validateLocalObjectPhotoContent(jpeg)).resolves.toEqual({
      ok: true,
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
