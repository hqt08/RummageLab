import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "../src/app/api/live-experience/route";
import { kitchenSoundActivityContext } from "../src/lib/demo/kitchen-sound-detectives";

const originalKey = process.env.OPENAI_API_KEY;

afterEach(() => {
  vi.restoreAllMocks();
  if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalKey;
});

async function objectPhoto() {
  const encoded = await sharp({ create: { width: 12, height: 12, channels: 3, background: "#55aa88" } }).jpeg().toBuffer();
  const bytes = new Uint8Array(encoded.length);
  bytes.set(encoded);
  return bytes;
}

function providerResponse(value: unknown) {
  return new Response(JSON.stringify({ output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(value) }] }] }), { status: 200 });
}

describe("live experience API route", () => {
  it("advertises the no-key capability gate and returns seeded inventory without outbound fetch", async () => {
    delete process.env.OPENAI_API_KEY;
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(await (await GET()).json()).toEqual({ livePhotoAnalysisAvailable: false, seededDemoAvailable: true });
    const form = new FormData();
    form.set("operation", "photo_inventory");
    form.set("objectOnlyConfirmed", "true");
    form.set("ageStage", "3-4y");
    form.set("photo", new Blob([await objectPhoto()], { type: "image/jpeg" }), "private-name.jpg");
    const response = await POST(new Request("http://local/api/live-experience", { method: "POST", body: form }));
    const body = await response.json();
    expect(body.runtime.source).toBe("seeded_fallback");
    expect(body).not.toContain("private-name");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects unconfirmed uploads and unexpected fields without calling the provider", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const form = new FormData();
    form.set("operation", "photo_inventory");
    form.set("objectOnlyConfirmed", "false");
    form.set("ageStage", "3-4y");
    form.set("extra", "raw-content");
    form.set("photo", new Blob([await objectPhoto()], { type: "image/jpeg" }), "x.jpg");
    const response = await POST(new Request("http://local/api/live-experience", { method: "POST", body: form }));
    expect(response.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects oversized streaming uploads with absent or falsely small Content-Length", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    for (const declaredLength of [null, "1"]) {
      const form = new FormData();
      form.set("operation", "photo_inventory");
      form.set("objectOnlyConfirmed", "true");
      form.set("ageStage", "3-4y");
      form.set("photo", new Blob([new Uint8Array(8 * 1024 * 1024 + 1)], { type: "image/jpeg" }), "oversize.jpg");
      const generated = new Request("http://local/api/live-experience", { method: "POST", body: form });
      const headers = new Headers(generated.headers);
      if (declaredLength === null) headers.delete("content-length");
      else headers.set("content-length", declaredLength);
      const request = new Request(generated.url, { method: "POST", headers, body: generated.body, duplex: "half" } as RequestInit);
      const response = await POST(request);
      expect(response.status).toBe(413);
      expect((await response.json()).error.code).toBe("photo_too_large");
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns a strict live inventory through the sanitized server boundary", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(providerResponse({
      imageMode: "live", objectOnlyReminder: true, requiresAdultSupervision: true,
      unsafeOrUncertainNotice: "A parent must confirm every object and check it before play.",
      suggestedItems: [
        { suggestedLabel: "Blue containers", allowedMaterialCategory: "large_empty_plastic_container", needsParentConfirmation: true },
        { suggestedLabel: "Wooden spoon", allowedMaterialCategory: "wooden_kitchen_utensil", needsParentConfirmation: true },
        { suggestedLabel: "Soft towel", allowedMaterialCategory: "soft_cloth", needsParentConfirmation: true },
      ],
    }));
    const form = new FormData();
    form.set("operation", "photo_inventory"); form.set("objectOnlyConfirmed", "true"); form.set("ageStage", "3-4y");
    form.set("photo", new Blob([await objectPhoto()], { type: "image/jpeg" }), "with-metadata.jpg");
    const response = await POST(new Request("http://local/api/live-experience", { method: "POST", body: form }));
    const body = await response.json();
    expect(body.runtime.source).toBe("live_provider");
    expect(body.inventory.suggestedItems[0].suggestedLabel).toBe("Blue containers");
    const providerBody = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body));
    expect(providerBody.store).toBe(false);
    expect(JSON.stringify(providerBody)).not.toContain("with-metadata");
  });

  it("falls back for a missing key or malformed provider activity without leaking raw errors", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(providerResponse({ raw: "secret-provider-output" }));
    const response = await POST(new Request("http://local/api/live-experience", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ operation: "experience_selection", fixtureId: "kitchen-sound-detectives", activityContext: kitchenSoundActivityContext }),
    }));
    const text = await response.text();
    expect(JSON.parse(text).runtime.source).toBe("seeded_fallback");
    expect(text).not.toContain("secret-provider-output");
  });
});
