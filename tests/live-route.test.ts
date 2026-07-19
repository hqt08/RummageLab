import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "../src/app/api/live-experience/route";
import {
  KITCHEN_SOUND_REQUIRED_MATERIALS,
  createKitchenSoundActivityContext,
  kitchenSoundActivityContext,
} from "../src/lib/demo/kitchen-sound-detectives";

// A live (non-seeded) context so experience_selection authors a fresh activity
// through the model instead of taking the deterministic prepared-kit path.
const photoActivityContext = createKitchenSoundActivityContext({
  materialSource: "photo",
  confirmedMaterials: KITCHEN_SOUND_REQUIRED_MATERIALS,
  approvedWeatherTags: ["rainy"],
  parentConfirmedSafety: true,
});

const validGeneratedKitchenQuest = {
  id: "generated-kitchen-activity",
  title: "Compare two gentle kitchen sounds",
  experienceMode: "guided_quest",
  ageStage: "3-4y",
  developmentalFocusIds: ["DEV.COG.CAUSE_EFFECT"],
  parentFacingGoal: "Tap two safe items and notice which sounds boomy or soft.",
  activitySummary: "A short sound-comparison game with the confirmed kitchen items.",
  materials: ["large_empty_plastic_container", "soft_cloth"],
  adultSafetyNote: "Stay within arm's reach and tap gently on a stable surface.",
  stopIf: ["An item cracks or the play stops feeling calm."],
  steps: [
    { minute: 0, instruction: "Predict together which item will sound boomy." },
    { minute: 3, instruction: "A grown-up taps each item gently and you choose a sound word." },
  ],
  evidencePrompt: "What sound word did your child choose?",
  parentReflectionPrompt: "What did you notice during the sound play? You can skip this.",
  tool: {
    kind: "predict",
    title: "Which one is boomy?",
    prompt: "Choose a prediction, then tap gently with a grown-up.",
    accessibilityHint: "Each choice uses written words; choosing one records nothing.",
    question: "Which item will sound boomy?",
    options: ["The container", "The cloth"],
  },
  fallbackMessage: "Tap each item gently and name one sound word together.",
};

const originalKey = process.env.OPENAI_API_KEY;
const originalLiveSwitch = process.env.RUMMAGELAB_LIVE_OPENAI_ENABLED;
const originalReasoningEffort = process.env.RUMMAGELAB_OPENAI_REASONING_EFFORT;

afterEach(() => {
  vi.restoreAllMocks();
  if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalKey;
  if (originalLiveSwitch === undefined) delete process.env.RUMMAGELAB_LIVE_OPENAI_ENABLED;
  else process.env.RUMMAGELAB_LIVE_OPENAI_ENABLED = originalLiveSwitch;
  if (originalReasoningEffort === undefined) delete process.env.RUMMAGELAB_OPENAI_REASONING_EFFORT;
  else process.env.RUMMAGELAB_OPENAI_REASONING_EFFORT = originalReasoningEffort;
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
  it("defaults closed without a key and does not make an outbound request", async () => {
    delete process.env.OPENAI_API_KEY;
    process.env.RUMMAGELAB_LIVE_OPENAI_ENABLED = "true";
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(await (await GET()).json()).toEqual({ livePhotoAnalysisAvailable: false, seededDemoAvailable: true });
    const form = new FormData();
    form.set("operation", "photo_inventory");
    form.set("objectOnlyConfirmed", "true");
    form.set("ageStage", "3-4y");
    form.set("photo", new Blob([await objectPhoto()], { type: "image/jpeg" }), "private-name.jpg");
    const response = await POST(new Request("http://local/api/live-experience", { method: "POST", body: form }));
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body).toEqual({ error: { code: "live_photo_inventory_unavailable" } });
    expect(JSON.stringify(body)).not.toContain("private-name");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("fails closed with a key when the switch is false, without reading photo or JSON bodies", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.RUMMAGELAB_LIVE_OPENAI_ENABLED = "false";
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    let photoBodyRead = false;
    const photoResponse = await POST({
      headers: new Headers({ "content-type": "multipart/form-data; boundary=private" }),
      get body() {
        photoBodyRead = true;
        throw new Error("disabled path must not read uploads");
      },
    } as unknown as Request);
    const photo = await photoResponse.json();
    expect(photoResponse.status).toBe(503);
    expect(photo).toEqual({ error: { code: "live_photo_inventory_unavailable" } });
    expect(photoBodyRead).toBe(false);

    let jsonBodyRead = false;
    const jsonResponse = await POST({
      headers: new Headers({ "content-type": "application/json" }),
      get body() {
        jsonBodyRead = true;
        throw new Error("disabled path must not read JSON planning input");
      },
    } as unknown as Request);
    const json = await jsonResponse.json();
    expect(json.runtime.diagnostic.code).toBe("provider_disabled");
    expect(jsonBodyRead).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("defaults closed when a key is present but the switch is unset", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    delete process.env.RUMMAGELAB_LIVE_OPENAI_ENABLED;
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(await (await GET()).json()).toEqual({ livePhotoAnalysisAvailable: false, seededDemoAvailable: true });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects unconfirmed uploads and unexpected fields without calling the provider", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.RUMMAGELAB_LIVE_OPENAI_ENABLED = "true";
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
    process.env.RUMMAGELAB_LIVE_OPENAI_ENABLED = "true";
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
    process.env.RUMMAGELAB_LIVE_OPENAI_ENABLED = "true";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(providerResponse({
      imageMode: "live", objectOnlyReminder: true, requiresAdultSupervision: true,
      unsafeOrUncertainNotice: "A parent must confirm every object and check it before play.",
      suggestedItems: [
        { suggestedLabel: "Blue containers", allowedMaterialCategory: "large_empty_plastic_container", safetyLevel: "ok", warnings: [], needsParentConfirmation: true },
        { suggestedLabel: "Wooden spoon", allowedMaterialCategory: "wooden_kitchen_utensil", safetyLevel: "ok", warnings: [], needsParentConfirmation: true },
        { suggestedLabel: "Soft towel", allowedMaterialCategory: "soft_cloth", safetyLevel: "ok", warnings: [], needsParentConfirmation: true },
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

  it("never substitutes the seeded Kitchen inventory when live photo analysis fails", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.RUMMAGELAB_LIVE_OPENAI_ENABLED = "true";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("rate limited", { status: 429 }));
    const form = new FormData();
    form.set("operation", "photo_inventory");
    form.set("objectOnlyConfirmed", "true");
    form.set("ageStage", "3-4y");
    form.set("photo", new Blob([await objectPhoto()], { type: "image/jpeg" }), "unrelated.jpg");

    const response = await POST(new Request("http://local/api/live-experience", {
      method: "POST",
      body: form,
    }));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ error: { code: "live_photo_inventory_unavailable" } });
    expect(JSON.stringify(body)).not.toContain("kitchen");
    expect(JSON.stringify(body)).not.toContain("unrelated");
  });

  it("fails closed when the live photo inventory is malformed", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.RUMMAGELAB_LIVE_OPENAI_ENABLED = "true";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(providerResponse({
      imageMode: "live",
      suggestedItems: [{ suggestedLabel: "unvalidated", allowedMaterialCategory: "not-allowed" }],
    }));
    const form = new FormData();
    form.set("operation", "photo_inventory");
    form.set("objectOnlyConfirmed", "true");
    form.set("ageStage", "3-4y");
    form.set("photo", new Blob([await objectPhoto()], { type: "image/jpeg" }), "malformed.jpg");

    const response = await POST(new Request("http://local/api/live-experience", {
      method: "POST",
      body: form,
    }));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: { code: "live_photo_inventory_unavailable" },
    });
  });

  it("falls back to a reviewed activity for a malformed generated activity without leaking raw errors", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.RUMMAGELAB_LIVE_OPENAI_ENABLED = "true";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(providerResponse({ raw: "secret-provider-output" }));
    const response = await POST(new Request("http://local/api/live-experience", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ operation: "experience_selection", fixtureId: "kitchen-sound-detectives", activityContext: photoActivityContext }),
    }));
    const text = await response.text();
    expect(JSON.parse(text).runtime.source).toBe("seeded_fallback");
    expect(text).not.toContain("secret-provider-output");
  });

  it("authors a live activity for a live context when both capability settings are present", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.RUMMAGELAB_LIVE_OPENAI_ENABLED = "true";
    delete process.env.RUMMAGELAB_OPENAI_REASONING_EFFORT;
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(providerResponse(validGeneratedKitchenQuest));
    const response = await POST(new Request("http://local/api/live-experience", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ operation: "experience_selection", fixtureId: "kitchen-sound-detectives", activityContext: photoActivityContext }),
    }));
    const body = await response.json();
    expect(body.runtime.source).toBe("live_provider");
    expect(body.experience.activitySummary).toBe("A short sound-comparison game with the confirmed kitchen items.");
    expect(fetchSpy).toHaveBeenCalledOnce();
    const requestBody = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body));
    expect(requestBody.reasoning).toEqual({ effort: "low" });
  });

  it("passes an owner-configured reasoning effort only to live activity authoring", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.RUMMAGELAB_LIVE_OPENAI_ENABLED = "true";
    process.env.RUMMAGELAB_OPENAI_REASONING_EFFORT = "medium";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(providerResponse(validGeneratedKitchenQuest));
    const response = await POST(new Request("http://local/api/live-experience", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ operation: "experience_selection", fixtureId: "kitchen-sound-detectives", activityContext: photoActivityContext }),
    }));
    expect(response.status).toBe(200);
    const requestBody = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body));
    expect(requestBody.reasoning).toEqual({ effort: "medium" });
  });

  it("keeps the seeded prepared kit deterministic (no model call) even with live enabled", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.RUMMAGELAB_LIVE_OPENAI_ENABLED = "true";
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const response = await POST(new Request("http://local/api/live-experience", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ operation: "experience_selection", fixtureId: "kitchen-sound-detectives", activityContext: kitchenSoundActivityContext }),
    }));
    const body = await response.json();
    expect(body.experience.id).toBe("kitchen-sound-detectives");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("maps bounded safe typed labels live and blocks unsafe labels before the provider", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.RUMMAGELAB_LIVE_OPENAI_ENABLED = "true";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(providerResponse({
      imageMode: "live", objectOnlyReminder: true, requiresAdultSupervision: true,
      unsafeOrUncertainNotice: "Confirm each category.",
      suggestedItems: [{ suggestedLabel: "Large soft ball", allowedMaterialCategory: "large_soft_ball", safetyLevel: "ok", warnings: [], needsParentConfirmation: true }],
    }));
    const response = await POST(new Request("http://local/api/live-experience", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ operation: "typed_object_inventory", objectLabels: ["ball"] }),
    }));
    expect((await response.json()).runtime.source).toBe("live_provider");
    expect(fetchSpy).toHaveBeenCalledOnce();

    fetchSpy.mockClear();
    const rejected = await POST(new Request("http://local/api/live-experience", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ operation: "typed_object_inventory", objectLabels: ["school address"] }),
    }));
    expect(rejected.status).toBe(400);
    expect((await rejected.json()).error.code).toBe("unsafe_typed_object_labels");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("fails typed mapping without substituting the unrelated kitchen fixture", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.RUMMAGELAB_LIVE_OPENAI_ENABLED = "true";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("rate limited", { status: 429 }));

    const response = await POST(new Request("http://local/api/live-experience", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ operation: "typed_object_inventory", objectLabels: ["soft ball"] }),
    }));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ error: { code: "live_typed_mapping_unavailable" } });
    expect(JSON.stringify(body)).not.toContain("kitchen");
  });
});
