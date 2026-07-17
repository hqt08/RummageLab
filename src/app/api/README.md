# API routes

`/api/live-experience` handles optional live photo and quest planning. `GET` exposes only two
booleans—whether both the server key and `RUMMAGELAB_LIVE_OPENAI_ENABLED === "true"`
make live photo analysis available and whether the seeded demo is available. It never exposes the key. `POST` performs either
photo-inventory or experience-selection work.

It accepts either multipart photo-inventory input or JSON experience-selection
input. Photo requests require an explicit object-only confirmation, enforce the
type, byte, pixel, and dimension limits, and decode and re-encode the image in
memory before the OpenAI request. Experience requests accept only the strict,
parent-confirmed `ActivityContext`; raw typed material text is never sent.

When the switch is disabled or the key is absent, the route fails closed before
reading multipart bytes, decoding or sanitizing a photo, or constructing a
provider. It returns only the strict, content-free `provider_disabled`
diagnostic and a validated fallback for direct callers; the photo UI does not
send an upload or supply fallback candidates in this state.

When enabled, the route calls the Responses API server-side with `store: false`, validates
structured output with the repository Zod contracts and contextual checks, and
returns only validated inventory/experience data plus a closed, content-free
runtime diagnostic. It does not return or log filenames, image bytes, prompts,
provider payloads, or provider error bodies. `OPENAI_API_KEY` and
`RUMMAGELAB_LIVE_OPENAI_ENABLED` are server-only. Missing credentials, a disabled
switch, timeout, unavailable, malformed, or mismatched output preserve the
validated Kitchen Sound seeded fallback.

`POST /api/reflection` accepts only a strict, bounded typed-parent-reflection
body after the browser guard passes. The server repeats deterministic PII-risk
screening before any provider call, then returns its prepared draft without
constructing a provider when live mode is disabled. When enabled it never logs
content and uses a stateless
structured Responses API request with `store: false`. It validates all returned
free text and allowlisted tags before returning an unapproved, editable
observation draft. Raw reflection is never returned or placed in the
`NextActivityContext`. Missing credentials, timeout, unavailable, malformed, or
unsafe provider output returns a transparent validated prepared draft; public
diagnostics remain closed and content-free.

Deferred boundaries:

- Parent memo upload and transcription; the route accepts typed text only and
  never accepts child audio.
- `GET /api/health` — deployment and smoke-test check.

Never expose `OPENAI_API_KEY`, persist uploads, or accept client-provided
executable content. Production credentials and deployment remain separate work.
