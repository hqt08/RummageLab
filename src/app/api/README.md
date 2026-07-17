# API routes

Reserved for server-only routes. No live model route has been implemented.

Expected future boundaries:

- `POST /api/quest` — validate parent context, request structured `QuestSpec`,
  check developmental-focus IDs against the curated allowlist, and return safe
  data. Kindergarten-standard links are optional for the reviewed 4–6 band only.
- `POST /api/reflection` — transcribe a parent memo, extract a
  `ParentObservationSuggestion`, and require parent approval before using only
  allowlisted tags for a next-activity suggestion.
- `GET /api/health` — deployment and smoke-test check.

Never expose `OPENAI_API_KEY` or accept client-provided executable content.
