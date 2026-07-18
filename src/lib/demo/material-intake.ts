import type { AllowedMaterialCategory, ObjectSafetyLevel, PhotoInventory } from "../schemas";

import { containsHardDenylistedTerm } from "./hard-denylist";
import { KITCHEN_SOUND_REQUIRED_MATERIALS } from "./kitchen-sound-detectives";

export const LOCAL_OBJECT_PHOTO_MAX_BYTES = 8 * 1024 * 1024;
export const LOCAL_OBJECT_PHOTO_MAX_DIMENSION = 6_000;
export const LOCAL_OBJECT_PHOTO_MAX_PIXELS = 16_000_000;

export const LOCAL_OBJECT_PHOTO_ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type MaterialIntakeSource = "seeded_demo" | "photo" | "typed";

export type LocalPhotoValidation =
  | { ok: true }
  | {
      ok: false;
      code:
        | "empty"
        | "too_large"
        | "unsupported_type"
        | "invalid_content"
        | "dimensions_too_large";
      message: string;
    };

export type TypedMaterialMatch = {
  category: AllowedMaterialCategory;
  displayLabel: string;
};

export type TypedMaterialExclusion = {
  inputLabel: string;
  reason: "private_information" | "unsafe" | "not_for_this_quest" | "unknown";
  message: string;
};

export type TypedMaterialNormalization = {
  accepted: TypedMaterialMatch[];
  excluded: TypedMaterialExclusion[];
  missing: AllowedMaterialCategory[];
  inputError: string | null;
};

const acceptedAliases: Record<string, TypedMaterialMatch> = {
  "plastic containers": {
    category: "large_empty_plastic_container",
    displayLabel: "Two empty plastic containers",
  },
  "empty plastic containers": {
    category: "large_empty_plastic_container",
    displayLabel: "Two empty plastic containers",
  },
  "plastic food containers": {
    category: "large_empty_plastic_container",
    displayLabel: "Two empty plastic containers",
  },
  "two empty plastic containers": {
    category: "large_empty_plastic_container",
    displayLabel: "Two empty plastic containers",
  },
  "two plastic containers": {
    category: "large_empty_plastic_container",
    displayLabel: "Two empty plastic containers",
  },
  "tupperware containers": {
    category: "large_empty_plastic_container",
    displayLabel: "Two empty plastic containers",
  },
  "wood spoon": {
    category: "wooden_kitchen_utensil",
    displayLabel: "Wooden spoon or utensil",
  },
  "wooden spoon": {
    category: "wooden_kitchen_utensil",
    displayLabel: "Wooden spoon or utensil",
  },
  "wood spatula": {
    category: "wooden_kitchen_utensil",
    displayLabel: "Wooden spoon or utensil",
  },
  "wooden spatula": {
    category: "wooden_kitchen_utensil",
    displayLabel: "Wooden spoon or utensil",
  },
  "cloth": {
    category: "soft_cloth",
    displayLabel: "Clean, folded dish towel or soft cloth",
  },
  "dish towel": {
    category: "soft_cloth",
    displayLabel: "Clean, folded dish towel or soft cloth",
  },
  "folded towel": {
    category: "soft_cloth",
    displayLabel: "Clean, folded dish towel or soft cloth",
  },
  "kitchen towel": {
    category: "soft_cloth",
    displayLabel: "Clean, folded dish towel or soft cloth",
  },
  "soft cloth": {
    category: "soft_cloth",
    displayLabel: "Clean, folded dish towel or soft cloth",
  },
  "tea towel": {
    category: "soft_cloth",
    displayLabel: "Clean, folded dish towel or soft cloth",
  },
};

const otherAllowedAliases: Record<string, TypedMaterialMatch> = {
  "board book": { category: "board_book", displayLabel: "Board book" },
  cardboard: { category: "paper_or_cardboard", displayLabel: "Paper or cardboard" },
  paper: { category: "paper_or_cardboard", displayLabel: "Paper or cardboard" },
  "paper cup": { category: "paper_or_cardboard", displayLabel: "Paper cup" },
  "silicone spatula": { category: "silicone_kitchen_utensil", displayLabel: "Silicone kitchen utensil" },
  "soft ball": { category: "large_soft_ball", displayLabel: "Large soft ball" },
  "large soft ball": { category: "large_soft_ball", displayLabel: "Large soft ball" },
  "soccer ball": { category: "large_soft_ball", displayLabel: "Large soft ball" },
};

function normalizeLabel(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function looksLikePrivateInformation(value: string): boolean {
  return (
    /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/i.test(value) ||
    /\b(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/.test(
      value,
    ) ||
    /\b(?:school|daycare|preschool|kindergarten|address|apartment|street|avenue|road)\b/i.test(value)
  );
}

function containsUnsafeWord(value: string): boolean {
  return containsHardDenylistedTerm(value);
}

/**
 * Shared client/server boundary for transient labels sent to the optional live
 * mapper. It rejects likely PII and known young-child hazards before a model
 * request, but is not presented as perfect PII detection.
 */
export function guardTypedObjectLabels(rawInput: string):
  | { safe: true; objectLabels: string[] }
  | { safe: false; code: "empty" | "too_many" | "too_long" | "private_information" | "unsafe" } {
  const objectLabels = rawInput
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (objectLabels.length === 0) return { safe: false, code: "empty" };
  if (objectLabels.length > 5) return { safe: false, code: "too_many" };
  if (objectLabels.some((item) => item.length > 80)) return { safe: false, code: "too_long" };
  if (objectLabels.some(looksLikePrivateInformation)) return { safe: false, code: "private_information" };
  if (objectLabels.some(containsUnsafeWord)) return { safe: false, code: "unsafe" };
  return { safe: true, objectLabels };
}

export function validateLocalObjectPhoto(file: {
  size: number;
  type: string;
}): LocalPhotoValidation {
  if (file.size <= 0) {
    return {
      ok: false,
      code: "empty",
      message: "That image is empty. Choose a JPEG, PNG, or WebP photo.",
    };
  }

  if (
    !LOCAL_OBJECT_PHOTO_ACCEPTED_TYPES.some(
      (acceptedType) => acceptedType === file.type,
    )
  ) {
    return {
      ok: false,
      code: "unsupported_type",
      message: "Use a JPEG, PNG, or WebP object photo.",
    };
  }

  if (file.size > LOCAL_OBJECT_PHOTO_MAX_BYTES) {
    return {
      ok: false,
      code: "too_large",
      message: "Choose an object photo smaller than 8 MB.",
    };
  }

  return { ok: true };
}

function bytesStartWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((value, index) => bytes[index] === value);
}

export async function validateLocalObjectPhotoContent(
  file: Blob & { type: string },
): Promise<LocalPhotoValidation> {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const hasExpectedSignature =
    (file.type === "image/jpeg" && bytesStartWith(bytes, [0xff, 0xd8, 0xff])) ||
    (file.type === "image/png" &&
      bytesStartWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ||
    (file.type === "image/webp" &&
      bytesStartWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
      bytesStartWith(bytes.slice(8), [0x57, 0x45, 0x42, 0x50]));

  return hasExpectedSignature
    ? { ok: true }
    : {
        ok: false,
        code: "invalid_content",
        message: "That file does not appear to be a valid JPEG, PNG, or WebP image.",
      };
}

export function validateLocalObjectPhotoDimensions(dimensions: {
  width: number;
  height: number;
}): LocalPhotoValidation {
  const { width, height } = dimensions;
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    width > LOCAL_OBJECT_PHOTO_MAX_DIMENSION ||
    height > LOCAL_OBJECT_PHOTO_MAX_DIMENSION ||
    width * height > LOCAL_OBJECT_PHOTO_MAX_PIXELS
  ) {
    return {
      ok: false,
      code: "dimensions_too_large",
      message: "Choose an image no larger than 16 megapixels or 6000 pixels on either side.",
    };
  }

  return { ok: true };
}

export function readLocalObjectPhotoDimensions(
  previewUrl: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () =>
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error("Image decoding failed."));
    image.src = previewUrl;
  });
}

export type ObjectUrlApi = {
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
};

export function createLocalPhotoPreview(
  file: Blob,
  previousUrl: string | null,
  objectUrlApi: ObjectUrlApi = URL,
): string {
  if (previousUrl) {
    objectUrlApi.revokeObjectURL(previousUrl);
  }

  return objectUrlApi.createObjectURL(file);
}

export function releaseLocalPhotoPreview(
  previewUrl: string | null,
  objectUrlApi: Pick<ObjectUrlApi, "revokeObjectURL"> = URL,
): void {
  if (previewUrl) {
    objectUrlApi.revokeObjectURL(previewUrl);
  }
}

export function normalizeKitchenSoundTypedMaterials(
  rawInput: string,
): TypedMaterialNormalization {
  const rawItems = rawInput
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (rawItems.length > 5) {
    return {
      accepted: [],
      excluded: [],
      missing: [...KITCHEN_SOUND_REQUIRED_MATERIALS],
      inputError: "List up to five material names.",
    };
  }

  if (rawItems.some((item) => item.length > 80)) {
    return {
      accepted: [],
      excluded: [],
      missing: [...KITCHEN_SOUND_REQUIRED_MATERIALS],
      inputError: "Keep each material name to 80 characters or fewer.",
    };
  }

  const acceptedByCategory = new Map<AllowedMaterialCategory, TypedMaterialMatch>();
  const excluded: TypedMaterialExclusion[] = [];

  for (const inputLabel of rawItems) {
    if (looksLikePrivateInformation(inputLabel)) {
      excluded.push({
        inputLabel,
        reason: "private_information",
        message: "Looks like contact information, so it stays out of the kit.",
      });
      continue;
    }

    if (containsUnsafeWord(inputLabel)) {
      excluded.push({
        inputLabel,
        reason: "unsafe",
        message: "Not supported for this young-child demo.",
      });
      continue;
    }

    const normalized = normalizeLabel(inputLabel);
    const acceptedMatch = acceptedAliases[normalized];
    if (acceptedMatch) {
      acceptedByCategory.set(acceptedMatch.category, acceptedMatch);
      continue;
    }

    const otherAllowedMatch = otherAllowedAliases[normalized];
    if (otherAllowedMatch) {
      acceptedByCategory.set(otherAllowedMatch.category, otherAllowedMatch);
      continue;
    }

    excluded.push({
      inputLabel,
      reason: "unknown",
      message: "Not recognized by this small demo allowlist.",
    });
  }

  const accepted = [...acceptedByCategory.values()];
  const acceptedCategories = new Set(accepted.map((item) => item.category));
  const missing = KITCHEN_SOUND_REQUIRED_MATERIALS.filter(
    (category) => !acceptedCategories.has(category),
  );

  return {
    accepted,
    excluded,
    missing: [...missing],
    inputError: null,
  };
}

/**
 * A parent-facing candidate object, carried through intake and confirmation with
 * a stable per-session id so several distinct open objects (all mapped to the
 * `other_safe_object` category) stay independently selectable. `label` follows
 * the object into activity planning; `category` still drives template gating.
 */
export type VettedCandidate = {
  id: string;
  label: string;
  category: AllowedMaterialCategory;
  safetyLevel: ObjectSafetyLevel;
  warnings: string[];
};

/** Stable within a session; derived from the label so repeats collapse. */
export function vettedCandidateId(label: string): string {
  return normalizeLabel(label) || label.trim().toLowerCase();
}

function toVettedCandidate(input: {
  label: string;
  category: AllowedMaterialCategory;
  safetyLevel?: ObjectSafetyLevel;
  warnings?: readonly string[];
}): VettedCandidate {
  return {
    id: vettedCandidateId(input.label),
    label: input.label,
    category: input.category,
    safetyLevel: input.safetyLevel ?? "ok",
    warnings: input.warnings ? [...input.warnings] : [],
  };
}

/** Dedupe by id, preserving first occurrence. */
export function dedupeVettedCandidates(
  candidates: readonly VettedCandidate[],
): VettedCandidate[] {
  const seen = new Set<string>();
  const result: VettedCandidate[] = [];
  for (const candidate of candidates) {
    if (seen.has(candidate.id)) continue;
    seen.add(candidate.id);
    result.push(candidate);
  }
  return result;
}

/** Map a parent-vetted photo/typed inventory to selectable candidates. */
export function photoInventoryToCandidates(
  inventory: PhotoInventory,
): VettedCandidate[] {
  return dedupeVettedCandidates(
    inventory.suggestedItems.map((item) =>
      toVettedCandidate({
        label: item.suggestedLabel,
        category: item.allowedMaterialCategory,
        safetyLevel: item.safetyLevel,
        warnings: item.warnings,
      }),
    ),
  );
}

/** Map the offline typed-allowlist matches to selectable candidates. */
export function typedMatchesToCandidates(
  matches: readonly TypedMaterialMatch[],
): VettedCandidate[] {
  return dedupeVettedCandidates(
    matches.map((match) =>
      toVettedCandidate({ label: match.displayLabel, category: match.category }),
    ),
  );
}
