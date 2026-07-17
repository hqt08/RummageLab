# Photo-to-activity demo flow

## The promise shown to judges

“Take a picture of a few safe things already on the table, and RummageLab turns
them into a parent-led learning moment that fits your child right now.”

This is a credible multimodal feature only if the photo has a visible effect on
the resulting activity. Avoid a photo upload that disappears into an opaque chat
request.

## Demo materials and photo composition

Place these **large, room-temperature, unbreakable** objects on a plain table or
placemat:

- two empty plastic food-storage containers
- one wooden spoon or silicone spatula
- one clean, folded dish towel

Do not include the child, faces, mail, labels, small loose pieces, glass,
magnets, batteries, or hot cookware in the image.

The bundled demo photo lives at:

```text
public/demo/kitchen-sound-detectives.jpg
```

It is an original, rights-safe image generated for this repository with
OpenAI's built-in image generation tool. Its prompt summary, creation date,
rights note, and runtime boundary are recorded in
[`public/demo/README.md`](../public/demo/README.md). The image contains only the
three allowlisted material types and is never uploaded to an external service
or analyzed in the seeded path.

## Five visible UI beats

1. **Set the stage** — The seeded case shows `3–4 years`, “grown-up co-play,”
   and an object-only prepared photo. Choosing another stage is future work.
2. **Review the prepared kit** — The parent sees the local image fixture and an
   explicit statement that nothing was uploaded or analyzed. Capture and typed
   material entry are not implemented in this slice.
3. **See, then confirm** — The app shows three suggested cards: `plastic
   container`, `wooden spoon`, and `dish towel`. The parent taps to confirm each
   and confirms that all items are safe, room-temperature, and supervised.
4. **Make the moment** — The generated plan says: predict boomy/quiet/scratchy;
   tap gently; copy a two-beat rhythm; make a rain-to-thunder-to-quiet story.
   The 3-year-old interacts mainly with the real objects; the screen is only a
   visual prompt and parent guide.
5. **Reflect and adapt** — The parent may skip reflection or edit a clearly
   prepared observation. Only checked allowlisted tags—not the note—can create
   exactly one session-only next sound-pattern idea.

## Live and seeded modes

| Mode | What happens | How to present it honestly |
| --- | --- | --- |
| Live (future) | GPT-5.6 reads the object-only photo and returns a constrained `PhotoInventory` | Show the analysis result and parent confirmation |
| Seeded (implemented) | The prepared photo loads a matching, Zod-parsed `PhotoInventory` fixture | The persistent `Seeded demo` banner says there was no live analysis |

Both modes must pass through the same validation and parent-confirmation step.
That makes the fallback a reliability feature rather than a fake demonstration.

Typed materials will use the same flow when implemented: the parent will see
normalized material cards, remove anything unsuitable, and confirm that only
safe items enter the plan.

## Parent-facing generated output

```text
Kitchen Sound Detectives · 8 minutes

Try: “Which one will sound BOOMY?”
Then: tap gently, listen, and choose a sound word.
Together: copy TAP-TAP / pause, then switch roles.
Story: make rain, thunder, then quiet.

Developmental focus: descriptive words, cause and effect,
early patterning, shared attention and turn-taking.
```

## Implemented seeded-slice acceptance criteria

- A parent can see exactly which suggested objects will be used.
- The quest cannot start until all three exact demo materials, the selected
  weather tags, weather approval, and the adult safety checkpoint are present.
- Every prepared payload is parsed through the existing Zod contracts before it
  reaches the renderer.
- The activity works with the seeded fixture and without a live API call.
- Only the approved `sound_mix` renderer appears.
- Reflection can be skipped; the prepared note never enters the next-activity
  context.
- At most one next suggestion is created from parent-approved allowlisted tags.
- Reset and reload clear all demo state.
