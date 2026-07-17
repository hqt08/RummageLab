# Draft demo script — target 2 minutes 30 seconds

This is a narrative and acceptance target only. The app does not implement this
flow yet, so do not submit or record this script until the named steps work.

## 0:00–0:15 — Promise

“RummageLab turns the objects already around a child into a short learning
adventure—without turning curiosity into homework.”

## 0:15–0:45 — Context becomes a parent-led activity

Show the parent choosing the `3–4 years` stage and taking a photo of `Kitchen
Sound Detectives` materials: two empty plastic containers, a wooden spoon or
silicone spatula, and a clean dish towel. The app visibly suggests “plastic
container,” “wooden spoon,” and “dish towel”; the parent confirms that the items
are present, room-temperature, and safe. Briefly show **Anchorage, Alaska** as
the editable demo city, then show the parent approving or changing its suggested
weather tags. Show the developmental focus and adult safety note.

## 0:45–1:30 — Play, not chat

Open **Kitchen Sound Detectives**. The child predicts which surface will sound
“boomy,” “quiet,” or “scratchy,” then gently taps it, copies a two-beat pattern,
and takes turns with their parent. Point out that the activity is generated from
validated data but the child experience is parent-led and screen-light.

## 1:30–2:00 — Adaptation

Show a short parent reflection—recorded or typed—and the resulting editable
“What you noticed” card: for example, “she copied two taps but found waiting for
my turn hard.” Preview the next-step cue: a short sound-pattern picnic with
turn-taking support.

## 2:00–2:30 — Technical proof

Show the architecture or code briefly. State exactly:

- GPT-5.6 turned the object photo into a constrained material inventory, then
  created the structured ExperienceSpec and editable observation suggestion.
- RummageLab validates model output and renders only approved components.
- Codex was used at build time to create and review the UI, schemas, tests, and
  documentation; it is not invoked by the learner runtime. Show the core session
  ID in the README before submission.

## Demo fallback

Use the seeded Kitchen Sound Detectives photo fixture and activity if the model
or network is unavailable. Never present a seeded response as a live analysis;
label it `Demo mode` in the app and use the same validation path. If live weather
is unavailable, label the replacement tags `Demo weather` and still require
parent approval.
