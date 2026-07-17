# Live-or-seeded demo script — target 2 minutes 30 seconds

The app implements three material-intake choices and an optional live GPT-5.6
path. Present the mode honestly: a selected photo is first a browser preview and
is uploaded only after the parent confirms it contains objects only and chooses
analysis. Live weather, voice, and reflection processing remain deferred.

## 0:00–0:15 — Promise

“RummageLab turns the objects already around a child into a short learning
adventure—without turning curiosity into homework.”

## 0:15–0:45 — Context becomes a parent-led activity

Take or choose an object-only photo of the Kitchen Sound Detectives kit: a large empty
plastic container, a wooden utensil, and a folded dish towel. Point out that the
image is only a local preview until the parent checks the object-only boundary.
Choose **Analyze objects with GPT-5.6**, then point out which constrained
suggestions came from live analysis and confirm what is actually present and
safe. Review **Anchorage, Alaska** as a public demo
preset rather than a family location, approve the broad weather tags, and check
the adult safety statement. If file selection is unreliable during recording,
use the clearly labeled prepared kit fallback instead.

## 0:45–1:30 — Play, not chat

Open **Kitchen Sound Detectives**. The child predicts which surface will sound
“boomy,” “quiet,” or “scratchy,” then gently taps it, copies a two-beat pattern,
and takes turns with their parent. Point out that the activity is generated from
validated data but the child experience is parent-led and screen-light.

## 1:30–2:00 — Adaptation

Show that reflection may be skipped without losing the finished activity. Then
take the prepared-example branch, edit the “What you noticed” wording, and
approve only the small allowlisted tag set. Preview the one session-only cue: a
short sound-pattern picnic with turn-taking support. Point out that the note is
not used to make the suggestion.

## 2:00–2:30 — Technical proof

Show the architecture or code briefly. State exactly for this build:

- The server decodes and re-encodes a confirmed object-only photo in memory,
  sends the sanitized image once with `store: false`, and does not persist the
  upload or provider response.
- GPT-5.6 returns a strict structured inventory and quest. Zod and contextual
  checks reject unapproved materials, focus IDs, ages, times, and tool shapes.
- RummageLab renders only the approved `sound_mix` React component; it never
  executes generated code.
- If the development key or provider is unavailable, the same screen opens the
  prepared Zod-validated path and labels it as fallback rather than live output.
- Codex was used at build time to create and review the UI, schemas, tests, and
  documentation; it is not invoked by the learner runtime. Show the core session
  ID in the README before submission.

## Seeded reliability path

The no-key reliability path is the seeded Kitchen Sound Detectives photo fixture
and activity. Never present it as live analysis: the app keeps a `Seeded demo`
or prepared-fallback label visible and uses the same validation boundary as live
structured output. The Anchorage weather tags are also prepared and still
require parent approval.

The typed-material path is a second honest fallback: its deterministic alias
table shows accepted and excluded names, then reaches the same parent
confirmation. It is not presented as natural-language model analysis.
