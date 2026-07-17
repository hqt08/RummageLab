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

  return { enabled, apiKey };
}
