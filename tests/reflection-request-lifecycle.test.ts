import { describe, expect, it } from "vitest";

import { ReflectionRequestLifecycle } from "../src/lib/runtime/reflection-request-lifecycle";

describe("typed-reflection request lifecycle", () => {
  it.each(["reset", "skip", "prepared replacement", "unmount"])(
    "cancels and rejects a late response after %s",
    () => {
      const lifecycle = new ReflectionRequestLifecycle();
      const request = lifecycle.begin();

      lifecycle.cancel();

      expect(request.signal.aborted).toBe(true);
      expect(lifecycle.isCurrent(request.version)).toBe(false);
    },
  );

  it("admits only the newest request when responses arrive out of order", () => {
    const lifecycle = new ReflectionRequestLifecycle();
    const older = lifecycle.begin();
    const newer = lifecycle.begin();

    expect(older.signal.aborted).toBe(true);
    expect(lifecycle.isCurrent(older.version)).toBe(false);
    expect(lifecycle.isCurrent(newer.version)).toBe(true);

    lifecycle.finish(newer.version);
    expect(lifecycle.isCurrent(newer.version)).toBe(false);
  });
});
