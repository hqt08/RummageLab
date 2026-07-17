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
2. **Choose an intake path** — The parent can use the prepared kit, select an
   object-only JPEG, PNG, or WebP for a browser-local preview, or type object
   names. The photo is sent only after the parent explicitly confirms the
   object-only boundary and chooses live analysis. Typed input uses a
   deterministic allowlist rather than pretending to be model recognition.
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
| Live (implemented, optional) | After explicit object-only confirmation, the server re-encodes the transient photo and GPT-5.6 returns a constrained `PhotoInventory` | State that the model suggests objects but cannot confirm presence or safety; require parent confirmation |
| Local preview | The browser previews the selected object-only file before optional analysis | Replacing, removing, or resetting clears stale suggestions and confirmation |
| Typed shell (implemented) | A deterministic alias table maps safe Kitchen Sound names to the same confirmation cards and keeps unsafe, contact-like, off-quest, and unknown entries out | Show both accepted and excluded entries before confirmation |
| Seeded fallback (implemented) | The prepared photo loads a matching, Zod-parsed `PhotoInventory` fixture | The persistent seeded label says there was no live analysis |

All modes must pass through the same validation and parent-confirmation step.
That makes the fallback a reliability feature rather than a fake demonstration.

All three implemented paths converge on the same material and adult-safety
confirmation. Editing the typed list, replacing or removing a photo, or
switching paths clears stale confirmations. The quest cannot start until the
current path is complete.

Before the live adapter sends a file, the server enforces size and dimension
limits, validates its declared type against decoded content, and freshly
re-encodes it as JPEG in memory to strip metadata. The parent confirms the
object-only boundary; the app does not claim automated face or PII detection.
The sanitized image is sent once with `store: false` and is not persisted or
placed in content logs.

The live route accepts the transient upload only for inventory analysis and
accepts only validated, parent-confirmed context for activity planning. If a provider
returns malformed or incompatible data, times out, or is unavailable, it returns
the prepared Zod-validated fallback with a public diagnostic that contains only a
closed error code and retry flag. The demo exposes that loading/fallback/retry
state without implying that a local photo has been analyzed.

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

## Implemented intake-and-seeded acceptance criteria

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
- JPEG, PNG, and WebP files under 8 MB are the only locally previewable photo
  types. Their signatures must match, decoding must succeed, and decoded images
  must stay within 16 megapixels and 6000 pixels per side. Changing the photo
  invalidates prior material confirmation.
- Typed aliases are bounded to five short object names and never become freeform
  activity instructions.
