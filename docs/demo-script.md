# Seeded demo script — target 2 minutes 30 seconds

The local app implements this seeded path. Present it explicitly as prepared
demo behavior: there is no live photo, weather, voice, or GPT analysis in this
slice.

## 0:00–0:15 — Promise

“RummageLab turns the objects already around a child into a short learning
adventure—without turning curiosity into homework.”

## 0:15–0:45 — Context becomes a parent-led activity

Show the clearly labeled object-only Kitchen Sound Detectives fixture: two empty
plastic containers, a wooden spoon, and a folded dish towel. The parent confirms
all three exact suggestions, reviews **Anchorage, Alaska** as a public demo
preset rather than a family location, approves the broad weather tags, and
checks the adult safety statement. Point out that nothing was uploaded or
analyzed. Show the developmental focus and adult safety note.

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

Show the architecture or code briefly. State exactly for this seeded build:

- The prepared inventory, quest, tool, observation, and next-activity context
  use the same Zod validation boundary planned for live structured output.
- RummageLab renders only the approved `sound_mix` React component; it never
  executes generated code.
- This run made no GPT or other external network call. GPT-5.6 live selection is
  the next integration step, not something this screen simulates.
- Codex was used at build time to create and review the UI, schemas, tests, and
  documentation; it is not invoked by the learner runtime. Show the core session
  ID in the README before submission.

## Seeded reliability path

The current primary demo is the seeded Kitchen Sound Detectives photo fixture
and activity. Never present it as live analysis: the app keeps a `Seeded demo`
label visible and uses the same validation boundary planned for live structured
output. The Anchorage weather tags are also prepared and still require parent
approval.
