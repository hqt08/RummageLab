import "server-only";

/**
 * Small in-memory, per-IP sliding-window limiter for the billable live-model
 * operations. It exists as a cost floor against scripted abuse of the public
 * demo, not as a billing control: serverless memory is per warm instance, so
 * the effective global ceiling is (limit × concurrently warm instances). The
 * deterministic seeded paths are never limited. Nothing here is persisted and
 * no IP is logged; addresses live only in this process's memory window.
 */

const requestLog = new Map<string, number[]>();
const MAX_TRACKED_KEYS = 10_000;

export type RateLimitConfig = {
  limit: number;
  windowMs: number;
};

/** Owner-tunable via Vercel env vars; safe defaults for a public demo. */
export function liveRateLimitConfig(): RateLimitConfig {
  const limit = Number(process.env.RUMMAGELAB_LIVE_RATE_LIMIT ?? "");
  const windowMinutes = Number(process.env.RUMMAGELAB_LIVE_RATE_WINDOW_MINUTES ?? "");
  return {
    limit: Number.isInteger(limit) && limit > 0 ? limit : 20,
    windowMs:
      (Number.isFinite(windowMinutes) && windowMinutes > 0 ? windowMinutes : 60) * 60_000,
  };
}

/** First hop of x-forwarded-for (set by Vercel's proxy), else a shared bucket. */
export function clientKeyFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || headers.get("x-real-ip")?.trim() || "unknown";
}

export type RateLimitDecision =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

export function checkRateLimit(
  key: string,
  config: RateLimitConfig = liveRateLimitConfig(),
  now: number = Date.now(),
): RateLimitDecision {
  const windowStart = now - config.windowMs;
  const timestamps = (requestLog.get(key) ?? []).filter((t) => t > windowStart);

  if (timestamps.length >= config.limit) {
    requestLog.set(key, timestamps);
    const oldest = timestamps[0];
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((oldest + config.windowMs - now) / 1000)),
    };
  }

  timestamps.push(now);
  requestLog.set(key, timestamps);

  // Bound memory: drop the stalest keys rather than growing without limit.
  if (requestLog.size > MAX_TRACKED_KEYS) {
    for (const staleKey of requestLog.keys()) {
      if (requestLog.size <= MAX_TRACKED_KEYS) break;
      if (staleKey !== key) requestLog.delete(staleKey);
    }
  }

  return { allowed: true };
}

/** Test-only: clear the shared window state. */
export function resetRateLimitStateForTests(): void {
  requestLog.clear();
}
