import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  checkRateLimit,
  clientKeyFromHeaders,
  liveRateLimitConfig,
  resetRateLimitStateForTests,
} from "../src/lib/runtime/rate-limit";
import { POST } from "../src/app/api/live-experience/route";
import { kitchenSoundActivityContext } from "../src/lib/demo/kitchen-sound-detectives";

const originalKey = process.env.OPENAI_API_KEY;
const originalSwitch = process.env.RUMMAGELAB_LIVE_OPENAI_ENABLED;
const originalLimit = process.env.RUMMAGELAB_LIVE_RATE_LIMIT;

beforeEach(() => resetRateLimitStateForTests());
afterEach(() => {
  vi.restoreAllMocks();
  resetRateLimitStateForTests();
  if (originalKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = originalKey;
  if (originalSwitch === undefined) delete process.env.RUMMAGELAB_LIVE_OPENAI_ENABLED; else process.env.RUMMAGELAB_LIVE_OPENAI_ENABLED = originalSwitch;
  if (originalLimit === undefined) delete process.env.RUMMAGELAB_LIVE_RATE_LIMIT; else process.env.RUMMAGELAB_LIVE_RATE_LIMIT = originalLimit;
});

describe("sliding-window limiter", () => {
  it("allows up to the limit per key and window, then refuses with a retry hint", () => {
    const config = { limit: 3, windowMs: 60_000 };
    const start = 1_000_000;
    for (let i = 0; i < 3; i += 1) {
      expect(checkRateLimit("a", config, start + i).allowed).toBe(true);
    }
    const refused = checkRateLimit("a", config, start + 10);
    expect(refused.allowed).toBe(false);
    if (!refused.allowed) expect(refused.retryAfterSeconds).toBeGreaterThan(0);

    // A different key is unaffected; the window releases old entries.
    expect(checkRateLimit("b", config, start + 10).allowed).toBe(true);
    expect(checkRateLimit("a", config, start + 61_001).allowed).toBe(true);
  });

  it("reads owner-tunable env defaults", () => {
    process.env.RUMMAGELAB_LIVE_RATE_LIMIT = "5";
    expect(liveRateLimitConfig().limit).toBe(5);
    process.env.RUMMAGELAB_LIVE_RATE_LIMIT = "not-a-number";
    expect(liveRateLimitConfig().limit).toBe(20);
  });

  it("keys on the proxy-set forwarded address with a shared fallback bucket", () => {
    expect(clientKeyFromHeaders(new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }))).toBe("203.0.113.9");
    expect(clientKeyFromHeaders(new Headers())).toBe("unknown");
  });
});

describe("route enforcement", () => {
  it("returns 429 on billable typed calls past the limit but never limits the seeded path", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.RUMMAGELAB_LIVE_OPENAI_ENABLED = "true";
    process.env.RUMMAGELAB_LIVE_RATE_LIMIT = "2";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("rate limited upstream", { status: 429 }));

    const typedRequest = () => new Request("http://local/api/live-experience", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.7" },
      body: JSON.stringify({ operation: "typed_object_inventory", objectLabels: ["ball"] }),
    });
    // Two billable attempts consume the window (they fail upstream, still billable attempts)...
    await POST(typedRequest());
    await POST(typedRequest());
    // ...the third is refused before any provider work.
    const limited = await POST(typedRequest());
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBeTruthy();
    expect(await limited.json()).toEqual({ error: { code: "rate_limited" } });

    // The deterministic seeded experience path stays exempt.
    for (let i = 0; i < 4; i += 1) {
      const seeded = await POST(new Request("http://local/api/live-experience", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.7" },
        body: JSON.stringify({ operation: "experience_selection", fixtureId: "kitchen-sound-detectives", activityContext: kitchenSoundActivityContext }),
      }));
      expect(seeded.status).toBe(200);
    }
  });

  it("rate-limits photo uploads before reading the multipart body", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.RUMMAGELAB_LIVE_OPENAI_ENABLED = "true";
    process.env.RUMMAGELAB_LIVE_RATE_LIMIT = "1";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("x", { status: 500 }));

    const photoBytes = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#888" } }).jpeg().toBuffer();
    const makeRequest = () => {
      const form = new FormData();
      form.set("operation", "photo_inventory");
      form.set("objectOnlyConfirmed", "true");
      form.set("ageStage", "3-4y");
      form.set("photo", new Blob([new Uint8Array(photoBytes)], { type: "image/jpeg" }), "photo.jpg");
      return new Request("http://local/api/live-experience", {
        method: "POST",
        headers: { "x-forwarded-for": "203.0.113.8" },
        body: form,
      });
    };
    await POST(makeRequest());
    const limited = await POST(makeRequest());
    expect(limited.status).toBe(429);
  });
});
