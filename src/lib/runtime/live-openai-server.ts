import "server-only";

/**
 * Server-only capability check. Keep this module out of client components:
 * it reads server environment variables and deliberately defaults closed.
 */
export function getLiveOpenAICapability() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const enabled =
    process.env.RUMMAGELAB_LIVE_OPENAI_ENABLED === "true" &&
    Boolean(apiKey);
  // Owner-configurable model tier (e.g. a faster/cheaper variant). Falls back
  // to the default model when unset. Only the model id crosses this boundary.
  const model = process.env.RUMMAGELAB_OPENAI_MODEL?.trim() || undefined;

  return { enabled, apiKey, model };
}
