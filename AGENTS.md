# RummageLab

## Product promise

RummageLab helps parents turn everyday materials into developmentally appropriate
moments of discovery for children ages 0–6. For children who are ready, those
moments can grow into short, hands-on learning quests.

## Hackathon success criteria

- The primary flow works end to end: parent context -> ExperienceSpec ->
  parent-led activity -> parent reflection -> adaptive next-step recommendation.
- GPT-5.6 is visibly central to the product; it is not a generic chat wrapper.
- Codex contribution is documented with the core `/feedback` Session ID, dated
  commits, and a clear account of AI and human decisions in `README.md`.
- A judge can run or test the seeded `Kitchen Sound Detectives` demo without
  entering an API key.

## MVP scope

- Web-first, touch-friendly PWA; do not build a native app during the hackathon.
- The flagship demo is a **parent and 3-year-old** completing the 8–12 minute
  `Kitchen Sound Detectives` activity. It begins with a parent photo of safe
  plastic containers, a wooden spoon/silicone spatula, and a folded dish towel.
  Polish this photo-to-activity flow before expanding scope.
- Product horizon is age-banded, parent-first learning for ages 0–6:
  - `0–12 months`: caregiver-led sensory moments, 2–5 minutes, no child device.
  - `12–36 months`: adult co-play, 3–8 minutes, large safe objects only.
  - `3–4 years`: picture/audio-led mini investigations, 8–12 minutes.
  - `4–6 years`: guided quests, 10–15 minutes, with optional kindergarten links.
- `RummageMoment` is an adult script for ages 0–3. `RummageTool` is a child-safe
  renderer for ages 3–6. Do not treat them as interchangeable.
- Supported future `RummageTool` types are `sort`, `measure`, `predict`,
  `sound_mix`, and `field_journal`.
- A photo is optional. A safe seeded demo must always be available.
- In a live flow, image analysis only suggests a small, allowed material
  inventory. The parent must confirm what is present and safe before an activity
  is planned. The seeded photo fixture must use that same contract.
- Parents may alternatively type material names. Typed materials must pass the
  same safety/confirmation path as photo suggestions; do not trust or persist
  raw free text.
- Suggestion context combines only parent-confirmed materials, parent-selected
  age stage, parent-approved normalized weather tags, available time, and
  indoor/outdoor setting. Never save precise location or raw weather-query
  input.
- The demo shows **Anchorage, Alaska** as a visible, editable public default and
  may use a weather adapter to suggest tags. Never describe the default as the
  child or family's location. Require the parent to edit or approve those tags
  before activity planning. Keep the city and coordinates separate from model, activity,
  observation, preference, analytics, and log contexts. Manual chips and a
  clearly labeled seeded fallback must remain available.
- A parent voice memo is asynchronous; do not attempt live child voice chat in
  the MVP.
- Reflection is optional. Accept either a short parent voice memo or typed text;
  never record a child. The user may skip reflection without losing the activity.
- Use one seeded, no-login parent context for the hackathon. Do not implement
  authentication or persistent preference memory unless explicitly reprioritized.
- Do not implement an in-product Codex authoring studio during the hackathon.
  Codex is a build-time collaborator; GPT-5.6 may select only validated
  `RummageToolSpec` values rendered by approved, prebuilt components. Keep the
  constrained adult-facing studio in documented phase-two scope.

## Architecture rules

- GPT-5.6 returns validated structured data only: `RummageMomentSpec`,
  `QuestSpec`, `RummageToolSpec`, `ParentObservationSuggestion`, and
  `NextActivityContext`.
- The learner client renders only approved React components. It must never run
  model-generated JavaScript, HTML, packages, shell commands, or URLs.
- Developmental-focus IDs must come from `src/lib/data/learning-focuses.ts`.
  For ages 0–5, use developmentally appropriate focus language, not standards
  or mastery claims. Kindergarten standards may be added only after review.
- Validate all model output on the server with the Zod schemas before rendering
  or saving it.
- Keep API keys and database credentials server-side. Never add them to client
  components or commit them.

## Child safety and privacy boundaries

- Use a seeded parent context; do not require a child's full name, school,
  face image, precise location, or contact details.
- Treat raw audio and images as transient uploads. Do not persist observations
  in the demo; a future product may retain only parent-selected allowlisted tags.
- The hackathon demo stores no raw photo, raw audio, transcript, or observation
  beyond the browser session. A “reset demo” action must clear session state.
- Feed only parent-approved, structured `NextActivityContext` tags into the next
  suggestion—not raw voice, raw text, psychological labels, scores, diagnoses,
  or inferred traits.
- Use parent-facing language such as “what you noticed” and “try next,” not
  “learning profile,” “mastery,” “behavior prediction,” or “assessment.”
- Treat typed reflection and transcription as possible accidental PII. Screen
  typed text before observation extraction. For an opt-in adult memo, keep raw
  audio transient and unlogged, delete it after transcription, then screen the
  transcript before observation extraction and discard it afterward. Do not
  claim that automated PII detection is perfect.
- Keep model requests stateless where possible; do not build on persisted
  conversation/thread objects. When a live Responses API call is implemented,
  explicitly review current retention behavior and use `store: false` if
  supported by the required feature.
- Parent selects the age band; never ask for or infer a child’s date of birth.
- For under-3 activities, exclude small/detachable objects, magnets, button
  batteries, coins, balloons, water beads, cords, glass, sharp/hot/electrical
  items, chemicals, and food-choking hazards. Require adult supervision.
- Collect only a parent voice memo, never a child voice recording, for the
  adaptive loop.
- Do not claim diagnosis, guaranteed learning outcomes, or autonomous grading.
- Keep safety directions practical and require adult support for any potentially
  hazardous activity.

## Engineering workflow

- Keep `main` deployable and use one short-lived branch per independently
  reviewable slice. Use Codex-managed worktrees only after a clean baseline
  commit exists, and only for work that can proceed without editing the same
  shared hotspots. Hand changes back to Local for integrated testing when useful.
- A worktree starts detached by default. Create a named branch before pushing,
  and never try to check out the same branch in two worktrees.
- Work in small vertical slices and preserve the seeded demo path at all times.
- Before editing, state the acceptance criteria and relevant files.
- After editing, run `pnpm check` when dependencies are installed. At minimum,
  run the directly relevant test, typecheck, and smoke check.
- Add or update schema tests whenever a model contract changes.
- Update `docs/codex-decisions.md` when a material product or technical decision
  is made, and keep the README's Codex-collaboration account accurate.
- Do not add a dependency, widen child-data collection, or change a model/data
  boundary without explaining the trade-off first.
- Never commit `.env`, `.env.local`, API keys, deployment tokens, raw uploads, or
  child-related content. Preview deployments must remain useful in seeded mode
  without production secrets.
- Preserve the root Apache-2.0 `LICENSE` and the `Apache-2.0` package metadata.
  Track third-party code, data, fonts, and media licenses or attribution before
  adding those materials. Do not treat the RummageLab name, logo, or demo media
  as automatically licensed with the source code.

## Design direction

- The product should feel like an annotated field notebook found at a kitchen
  table: tactile, curious, bright, and calm—not like a generic chatbot.
- Prioritize one magical learner activity and two or three polished screens over
  unshown feature breadth.
- Support keyboard navigation, readable contrast, clear motion reduction, and
  touch targets appropriate for children and parents.

## Definition of done

- A fresh user can complete the seeded quest without model credentials.
- Loading, empty, and API-failure states remain useful and polished.
- Tests and checks pass, and the README/demo script match the product.
- No secret, raw child identifier, or unvalidated model output is committed.
