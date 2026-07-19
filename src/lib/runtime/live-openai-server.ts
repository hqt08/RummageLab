import "server-only";

const LIVE_REASONING_EFFORTS = ["none", "low", "medium", "high", "xhigh", "max"] as const;

export type LiveReasoningEffort = (typeof LIVE_REASONING_EFFORTS)[number];

function configuredReasoningEffort(value: string | undefined): LiveReasoningEffort {
  const normalized = value?.trim().toLowerCase();
  return LIVE_REASONING_EFFORTS.includes(normalized as LiveReasoningEffort)
    ? normalized as LiveReasoningEffort
    : "low";
}

/**
 * Server-only capability check. Keep this module out of client components:
 * it reads server environment variables and deliberately defaults closed.
 */
export function getLiveOpenAICapability() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const enabled =
    process.env.RUMMAGELAB_LIVE_OPENAI_ENABLED === "true" &&
    Boolean(apiKey);
  // Owner-configurable model tier (e.g. a faster/cheaper variant). The provider
  // defaults to gpt-5.6 when unset. Only server-side configuration crosses this
  // boundary.
  const model = process.env.RUMMAGELAB_OPENAI_MODEL?.trim() || undefined;
  // GPT-5.6 defaults to medium reasoning when this is omitted. Activity
  // authoring is latency-sensitive, so use low unless the owner configures a
  // supported effort explicitly. Inventory mapping stays reasoning-free.
  const reasoningEffort = configuredReasoningEffort(
    process.env.RUMMAGELAB_OPENAI_REASONING_EFFORT,
  );

  return { enabled, apiKey, model, reasoningEffort };
}
