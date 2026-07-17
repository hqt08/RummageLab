import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  canSendPhotoForLiveAnalysis,
  KitchenSoundDemo,
  photoAnalysisResult,
} from "../src/components/kitchen-sound-demo";
import { kitchenSoundPhotoInventory } from "../src/lib/demo/kitchen-sound-detectives";

describe("KitchenSoundDemo", () => {
  it("keeps photo upload closed until the server capability explicitly allows it", () => {
    const photo = {} as File;
    expect(canSendPhotoForLiveAnalysis(false, photo, true)).toBe(false);
    expect(canSendPhotoForLiveAnalysis(true, photo, false)).toBe(false);
    expect(canSendPhotoForLiveAnalysis(true, null, true)).toBe(false);
    expect(canSendPhotoForLiveAnalysis(true, photo, true)).toBe(true);
  });

  it("clears photo inventory candidates if a late response says the provider is disabled", () => {
    expect(photoAnalysisResult({
      inventory: kitchenSoundPhotoInventory,
      runtime: {
        source: "seeded_fallback",
        diagnostic: {
          operation: "photo_inventory",
          code: "provider_disabled",
          fallbackUsed: true,
          retryable: false,
        },
      },
    })).toEqual({
      livePhotoAnalysisAvailable: false,
      inventory: null,
      source: null,
      candidates: [],
    });
  });

  it("renders the honest seeded kit-review boundary and accessible controls", () => {
    const html = renderToStaticMarkup(createElement(KitchenSoundDemo));

    expect(html).toContain("Seeded demo");
    expect(html).toContain("no live photo, weather, voice, or GPT analysis");
    expect(html).toContain("Kitchen Sound Detectives");
    expect(html).toContain("Rummage your way in");
    expect(html).toContain("Use the prepared kit");
    expect(html).toContain("Take or choose an object photo");
    expect(html).toContain("Type what you have");
    expect(html).toContain('type="radio"');
    expect(html).toContain("Object-only demo photo");
    expect(html).toContain("Anchorage, Alaska");
    expect(html).toContain("Public demo city label");
    expect(html).toContain('type="text"');
    expect(html).toContain('href="#demo-content"');
    expect(html).toContain('id="demo-content" tabindex="-1"');
    expect(html).toContain("Approve these demo weather tags");
    expect(html).toContain("Not sure");
    expect(html).toContain("Choose 1–4 broad tags");
    expect(html).toContain("Make our activity");
    expect(html).toContain("Optional transient GPT-5.6 analysis");
    expect(html).toContain('type="checkbox"');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Make our activity/);
    expect(html).not.toContain("sessionStorage");
    expect(html).not.toContain("localStorage");
    expect(html).not.toContain("<audio");
    expect(html).not.toContain("<video");
    expect(html).not.toContain("no network request");
  });
});
