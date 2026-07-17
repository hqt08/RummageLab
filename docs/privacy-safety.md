# Privacy and safety boundaries

RummageLab is an early prototype. These boundaries make the hackathon demo
safer; they are not a substitute for formal legal, security, or child-privacy
review before a real launch.

## Data minimization

- Use one seeded, no-login parent context for the hackathon; do not create an
  account or persist a real child’s information.
- **Do not intentionally request or retain PII in the hackathon demo.** This
  includes a child or parent name/nickname, date of birth, email, phone number,
  address, precise location, school/daycare, account identifier, face photo,
  video, child voice, or identifying document.
- Typed notes are free-form and may contain accidental PII. The implemented
  slice warns the parent and conservatively blocks likely sensitive details with
  the same deterministic guard in the browser and server before any model call.
  It never logs the text and discards it after the transient request. The guard
  is defense in depth and is not described as perfect automated PII detection.
- A voice memo is an explicit, opt-in **adult-only** recording. Unless
  transcription runs locally, raw parent audio necessarily reaches the
  transcription service before its contents can be screened. Never log or
  persist the audio; delete it immediately after transient transcription, screen
  the transcript before the observation-extraction model call, then discard the
  transcript after that request. Never solicit or accept a child recording.
- Disable product analytics, advertising SDKs, and cross-site tracking for the
  demo. Do not place prompt, photo, audio, transcript, or observation content in
  application logs or error reports.
- The runtime-contract seam may expose only operation, closed failure code,
  fallback-used, and retryable fields. It must never put request content,
  provider responses, error causes, filenames, prompts, or identifiers into
  diagnostics, logs, analytics, or retry state.
- Make object photos optional. In product copy, ask users to avoid faces and
  identifying documents; strip photo metadata and discard the object-only image
  after the one-time request.
- The implemented live route requires the parent to attest that a photo contains
  objects only, independently validates and decodes it, and freshly re-encodes
  it in memory before a single model request. This reduces metadata exposure but
  is not face detection and must not be described as a perfect privacy screen.
- Live Responses API requests use `store: false`. The application does not save
  the upload, sanitized image, provider response, or prompt, and public errors
  use only the closed runtime failure taxonomy.
- The live OpenAI capability is server-only and default-off: both a trimmed
  `OPENAI_API_KEY` and `RUMMAGELAB_LIVE_OPENAI_ENABLED === "true"` are required.
  When it is off, the server stops before reading an upload, decoding or
  sanitizing an image, constructing a provider, or making an outbound model
  request. A local browser preview may remain visible, but it is not uploaded
  and does not produce prepared photo candidates.
- Typed-reflection Responses API requests also use `store: false` when the
  server-only capability is enabled. When disabled, deterministic PII screening
  still runs and the route returns only a prepared draft with a content-free
  `provider_disabled` diagnostic. Their public
  responses contain only a strictly validated observation draft, allowlisted tag
  suggestions, source metadata, and content-free errors—never the raw note,
  prompt, provider payload, or error cause. Missing credentials or a rejected
  provider result use a clearly labeled prepared draft.
- Material names may be typed, but raw typed text is transient and must be
  normalized into parent-confirmed material categories before model use or any
  adaptive context. When the live switch is enabled, the parent may explicitly
  send one to five object labels (80 characters each) for a one-time GPT-5.6
  category suggestion after the same browser/server PII-and-hazard prefilter.
  The app does not store or log those labels; only parent-confirmed allowlisted
  categories can reach planning. The prefilter is defense in depth, not a
  guarantee of perfect PII detection.
- For a non-OK live-provider response, server operations logging may record only
  the HTTP status and provider request ID to support incident debugging. It
  must not record the request, typed labels, photo, prompt, response body,
  authorization header, or error content. The browser receives only the closed
  failure code and a safe fallback.
- Parent selects an age stage; do not collect or infer a child’s date of birth.
- Delete raw audio and image uploads immediately after their one-time processing
  step. A future persistent mode may retain only parent-selected allowlisted
  tags, never free-text observations.
- In the hackathon demo, do not persist raw images, raw audio, transcripts, or
  observations at all: keep only session state and let the parent reset it.
- A reflection may be a parent-only voice memo or typed text. It is optional;
  never collect a child voice recording. Only typed reflection is implemented;
  voice and transcription remain deferred.

## Future parent-owned preferences

After a separate privacy/legal review, a future authenticated product may retain
a small, parent-owned `ActivityPreferenceContext`: an age stage, parent-selected
interest tags, preferred activity length, and at most a few recent approved
context tags. It must remain separate from authentication data and must never
become a child identity or assessment record. Parents need clear review, export,
delete, and retention controls before this feature exists.

Every saved field must be explicit and parent-selected, carry a clear expiry,
and contain no PII. Do not automatically promote a model inference into saved
preferences. Because RummageLab is designed for ages 0–6, treat any future
persistent product as needing child-privacy review; an account or opaque ID does
not remove that responsibility.

## Content and interaction safety

- Use only approved tool components and server-validated model output.
- Provide adult safety notes with each activity.
- Keep quests household-safe and require adult support when materials may pose a
  risk.
- Under-3 activities must use a curated large-object material policy. Exclude
  small/detachable parts, magnets, button batteries, coins, balloons, water
  beads, cords, glass, sharp/hot/electrical items, chemicals, and choking risks.
- Parent supervision is required. For ages 0–3, the app prompts the parent and
  does not solicit a child voice recording or independent screen use.
- Provide a visible report/edit control for generated content.
- Avoid claims of diagnosis, clinical assessment, or guaranteed learning.
- Do not generate or store personality labels, ability levels, behavioral-risk
  scores, mental-health inferences, diagnoses, or predictions about a child.
- Feed only an edited, allowlisted next-activity context into later suggestions;
  never feed a raw reflection history back as a hidden assessment record.

## Location and weather

Weather is optional. The hackathon shows **Anchorage, Alaska** as a visible,
editable public demo default; live weather lookup is deferred.
Treat that value as application configuration, not a claim about where a child
or family lives. Do not request device GPS, infer a child's precise location,
associate the city with a child identity, or place the city or coordinates in
model prompts, activity/observation context, analytics, or content logs.

The lookup produces suggested broad weather tags. A parent must edit or approve
them; only the approved tags may reach the activity planner. Manual chips and a
clearly labeled seeded fallback remain available if the parent declines or the
provider is unavailable. Disclose the weather provider and its required
attribution. A future saved city belongs in parent Settings only after privacy
review and must be optional, editable, clearable, and removable.

## References to review before a real launch

- [CPSC small-parts and choking-hazard FAQ](https://www.cpsc.gov/FAQ/Small-Parts-and-Choking-Hazard-Labeling-FAQs)
- [Head Start Early Learning Outcomes Framework](https://headstart.gov/school-readiness/article/head-start-early-learning-outcomes-framework)
- [OpenAI API data controls](https://platform.openai.com/docs/models/default-usage-policies-by-endpoint)
- [FTC COPPA guidance](https://www.ftc.gov/business-guidance/resources/childrens-online-privacy-protection-rule-not-just-kids-sites)
