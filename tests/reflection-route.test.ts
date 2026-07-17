import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "../src/app/api/reflection/route";

const originalKey = process.env.OPENAI_API_KEY;
const originalLiveSwitch = process.env.RUMMAGELAB_LIVE_OPENAI_ENABLED;
afterEach(() => {
  vi.restoreAllMocks();
  if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalKey;
  if (originalLiveSwitch === undefined) delete process.env.RUMMAGELAB_LIVE_OPENAI_ENABLED;
  else process.env.RUMMAGELAB_LIVE_OPENAI_ENABLED = originalLiveSwitch;
});

function requestFor(text: string, extra: Record<string, unknown> = {}) {
  return new Request("http://local/api/reflection", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({
      operation: "reflection_suggestion", fixtureId: "kitchen-sound-detectives",
      reflection: { source: "typed", text, childVoiceIncluded: false },
      ...extra,
    }),
  });
}

describe("typed reflection route", () => {
  it("returns a transparent prepared, unapproved fallback without a key or outbound call", async () => {
    delete process.env.OPENAI_API_KEY;
    process.env.RUMMAGELAB_LIVE_OPENAI_ENABLED = "true";
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const response = await POST(requestFor("They copied two taps and asked to go again."));
    const body = await response.json();
    expect(body.runtime).toMatchObject({ source: "prepared_fallback", diagnostic: { code: "provider_disabled" } });
    expect(body.suggestion).not.toHaveProperty("nextActivityContext");
    expect(JSON.stringify(body)).not.toContain("parent_approved");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("keeps deterministic PII screening and otherwise fails closed before provider creation", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.RUMMAGELAB_LIVE_OPENAI_ENABLED = "false";
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const piiResponse = await POST(requestFor("My child's name is Rowan"));
    expect(piiResponse.status).toBe(422);
    expect(await piiResponse.json()).toEqual({ error: { code: "reflection_pii_risk" } });

    const response = await POST(requestFor("They copied two taps and asked to go again."));
    expect((await response.json()).runtime).toMatchObject({
      source: "prepared_fallback",
      diagnostic: { code: "provider_disabled", retryable: false },
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each(["parent@example.com", "Call 907-555-0199", "My child's name is Rowan"])("blocks PII risk before fetch: %s", async (text) => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.RUMMAGELAB_LIVE_OPENAI_ENABLED = "true";
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const response = await POST(requestFor(text));
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: { code: "reflection_pii_risk" } });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects unexpected fields and streaming bodies over the byte bound", async () => {
    expect((await POST(requestFor("They tapped twice.", { rawHistory: "no" }))).status).toBe(400);
    const oversized = new Request("http://local/api/reflection", { method: "POST", headers: { "content-type": "application/json", "content-length": "1" }, body: JSON.stringify({ padding: "x".repeat(5000) }) });
    const response = await POST(oversized);
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: { code: "request_too_large" } });
  });

  it("never logs or returns raw reflection or provider content on failure", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.RUMMAGELAB_LIVE_OPENAI_ENABLED = "true";
    const raw = "They copied a private banana rhythm.";
    const providerSecret = "secret-provider-payload";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(providerSecret, { status: 502 }));
    const logSpies = [vi.spyOn(console, "log"), vi.spyOn(console, "error"), vi.spyOn(console, "warn"), vi.spyOn(console, "info")];
    const response = await POST(requestFor(raw));
    const text = await response.text();
    expect(text).not.toContain(raw);
    expect(text).not.toContain(providerSecret);
    expect(JSON.parse(text).runtime.diagnostic.code).toBe("provider_unavailable");
    for (const spy of logSpies) expect(spy).not.toHaveBeenCalled();
  });

  it("falls back instead of returning a successful provider echo", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.RUMMAGELAB_LIVE_OPENAI_ENABLED = "true";
    const raw = "They copied a bright banana rhythm twice.";
    const echoedDraft = {
      source: "parent_reported",
      observedEvents: [raw],
      parentSummary: raw,
      suggestedInterestTags: ["sound_play"],
      suggestedSupportTags: [],
      ephemeralOnly: true,
      requiresParentReview: true,
      notAnAssessment: true,
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      output: [{ content: [{ type: "output_text", text: JSON.stringify(echoedDraft) }] }],
    }), { status: 200 }));

    const response = await POST(requestFor(raw));
    const text = await response.text();
    expect(text).not.toContain(raw);
    expect(JSON.parse(text).runtime).toMatchObject({
      source: "prepared_fallback",
      diagnostic: { code: "provider_unsafe_response", retryable: false },
    });
  });

  it("never returns a short raw provider echo", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.RUMMAGELAB_LIVE_OPENAI_ENABLED = "true";
    const raw = "Again";
    const echoedDraft = {
      source: "parent_reported", observedEvents: [raw], parentSummary: raw,
      suggestedInterestTags: ["sound_play"], suggestedSupportTags: [],
      ephemeralOnly: true, requiresParentReview: true, notAnAssessment: true,
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      output: [{ content: [{ type: "output_text", text: JSON.stringify(echoedDraft) }] }],
    }), { status: 200 }));
    const text = await (await POST(requestFor(raw))).text();
    expect(text).not.toContain(raw);
    expect(JSON.parse(text).runtime.diagnostic.code).toBe("provider_unsafe_response");
  });
});
