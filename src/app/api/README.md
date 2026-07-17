# API routes

`/api/live-experience` is the only live model route. `GET` exposes only two
booleans—whether a server key makes live photo analysis available and whether
the seeded demo is available. It never exposes the key. `POST` performs either
photo-inventory or experience-selection work.

It accepts either multipart photo-inventory input or JSON experience-selection
input. Photo requests require an explicit object-only confirmation, enforce the
type, byte, pixel, and dimension limits, and decode and re-encode the image in
memory before the OpenAI request. Experience requests accept only the strict,
parent-confirmed `ActivityContext`; raw typed material text is never sent.

The route calls the Responses API server-side with `store: false`, validates
structured output with the repository Zod contracts and contextual checks, and
returns only validated inventory/experience data plus a closed, content-free
runtime diagnostic. It does not return or log filenames, image bytes, prompts,
provider payloads, or provider error bodies. `OPENAI_API_KEY` is optional and
server-only. Missing credentials, timeout, unavailable, malformed, or mismatched
output preserve the validated Kitchen Sound seeded fallback.

Deferred boundaries:

- `POST /api/reflection` — transcribe a parent memo, extract a
  `ParentObservationSuggestion`, and require parent approval before using only
  allowlisted tags for a next-activity suggestion.
- `GET /api/health` — deployment and smoke-test check.

Never expose `OPENAI_API_KEY`, persist uploads, or accept client-provided
executable content. Production credentials and deployment remain separate work.
