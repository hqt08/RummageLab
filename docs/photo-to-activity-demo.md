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

The bundled demo photo will live at:

```text
public/demo/kitchen-sound-detectives.jpg
```

It is intentionally not included until the family chooses or creates the final
demo photograph.

## Five visible UI beats

1. **Set the stage** — Parent chooses `3–4 years` and sees “grown-up co-play;
   objects only in the photo.”
2. **Take, choose, or type** — Parent captures the arranged materials, loads the
   prepared image fixture, or types materials such as “plastic container, wooden
   spoon, dish towel.” All three routes converge on the same confirmation step.
3. **See, then confirm** — The app shows three suggested cards: `plastic
   container`, `wooden spoon`, and `dish towel`. The parent taps to confirm each
   and confirms that all items are safe, room-temperature, and supervised.
4. **Make the moment** — The generated plan says: predict boomy/quiet/scratchy;
   tap gently; copy a two-beat rhythm; make a rain-to-thunder-to-quiet story.
   The 3-year-old interacts mainly with the real objects; the screen is only a
   visual prompt and parent guide.
5. **Reflect and adapt** — Parent records or types: “She said boom, copied two
   taps, and needed help waiting.” The app shows an editable “What you noticed”
   card, not a score, and proposes a short next sound-pattern activity with more
   turn-taking support.

## Live and seeded modes

| Mode | What happens | How to present it honestly |
| --- | --- | --- |
| Live | GPT-5.6 reads the object-only photo and returns a constrained `PhotoInventory` | Show the analysis result and parent confirmation |
| Seeded fallback | The prepared photo loads a matching `PhotoInventory` fixture | Label the UI `Demo mode`; do not describe it as a live call |

Both modes must pass through the same validation and parent-confirmation step.
That makes the fallback a reliability feature rather than a fake demonstration.

Typed materials use the same flow: the parent sees normalized material cards,
removes anything unsuitable, and confirms that only safe items enter the plan.

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

## Acceptance criteria for later implementation

- A parent can see exactly which suggested objects will be used.
- The parent can remove a wrongly recognized or unsuitable item before planning.
- The model cannot plan from unconfirmed items.
- The activity works with the seeded fixture and without a live API call.
- The raw photo does not need to be kept after the inventory is confirmed.
