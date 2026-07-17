# API routes

Reserved for server-only routes. No live model route has been implemented.

The implemented server-only prerequisite lives in `src/lib/runtime/`: provider-neutral,
Zod-validated request/response contracts; a deterministic seeded provider; and
content-free timeout/error diagnostics with automatic seeded fallback. It accepts
no bytes, raw photo filename, typed material text, prompt, or provider payload.
It makes no network call, is not an API route, and is not imported by a client
component. The visible no-key retry exercise is client-local simulation rather
than a call to this boundary.

Expected future boundaries:

- `POST /api/quest` — validate parent context, request structured `QuestSpec`,
  check developmental-focus IDs against the curated allowlist, and return safe
  data. Kindergarten-standard links are optional for the reviewed 4–6 band only.
- `POST /api/reflection` — transcribe a parent memo, extract a
  `ParentObservationSuggestion`, and require parent approval before using only
  allowlisted tags for a next-activity suggestion.
- `GET /api/health` — deployment and smoke-test check.

Never expose `OPENAI_API_KEY` or accept client-provided executable content. A
future photo adapter may receive only a transient object-only upload after a
separate server implementation and security review; do not add it implicitly.
