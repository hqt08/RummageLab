# Material-intake and live-runtime QA record

Date: 2026-07-16

This is the repeatable browser and contract checklist for local intake, optional
live photo analysis, and the no-key prepared fallback.

## Automated checks

- Run Node 24 lint, typecheck, the full Vitest suite, and the production build.
- Reducer tests prove that `photo` and `typed` provenance cannot start a quest
  without a current intake candidate set.
- Utility tests cover MIME/size checks, matching image signatures, decoded
  dimension limits, typed allowlisting, quantity-sensitive container input,
  PII-like/unsafe rejection, and object-URL revocation.
- Server tests cover the streaming 8 MB photo and 9 MB request limits without
  trusting `Content-Length`, duplicate/unexpected fields, object-only
  confirmation, decoded type and dimensions, metadata stripping, missing-key
  fallback, strict provider output, content-free failures, and reset behavior.

## Browser interaction pass

Run against the production server at 320 × 800 and 1280 × 900:

1. Switch from prepared to typed intake.
2. Enter `plastic containers`, `wooden spoon`, and `dish towel`; confirm that
   exactly three confirmation cards appear.
3. Enter `coin`, `silicone spatula`, an unknown item, and contact-like text;
   confirm that all are excluded and contact-like text is not echoed.
4. Confirm the valid kit, weather, and safety; verify the quest button enables.
5. Edit the typed list; verify all material and safety confirmation is cleared.
6. Reset, choose photo intake, and verify material confirmation stays disabled
   until a valid, decoded, bounded object photo has been analyzed or the route
   has returned the clearly labeled prepared inventory.
7. Verify no horizontal overflow at either viewport and no browser warnings or
   errors.
8. Start a photo selection and reset before validation finishes; verify the
   pending selection cannot restore a preview, filename, or candidate kit.

The 2026-07-16 pass completed the first seven checks. The eighth is enforced by
the selection-version invalidation on reset and is a required regression check
for the next automated browser suite. Before recording on a phone,
repeat photo capture using the intended device: confirm the rear-camera choice,
the common JPEG path, and the explicit HEIC rejection/fallback behavior.

Raw typed text is cleared on source exit, successful quest start, or reset.
Local photo object URLs are revoked on replacement, rejection, removal, source
exit, reset, or unmount.

## Live and fallback pass

Run the production build first without `OPENAI_API_KEY`:

1. Choose a valid object photo, confirm objects only, and select **Analyze
   objects with GPT-5.6**.
2. Verify the server route returns the prepared inventory with an honest
   fallback label and no provider, photo, filename, or typed-text detail.
3. Confirm the materials, weather tags, and safety acknowledgement, then start
   the quest. Verify the prepared validated quest remains usable.
4. Exercise **Retry live planner** and **Open prepared fallback**; neither may
   strand the parent or imply a successful live call.
5. Verify the browser console has no warnings or errors.
6. Start an analysis or planning request, immediately select **Reset demo**,
   then verify a late response cannot restore the photo, inventory, or quest.

With a development key, repeat the photo and quest path and verify the visible
inventory/activity reflects mocked or controlled live output. Confirm the model
cannot add unconfirmed material categories or a non-`sound_mix` renderer. Never
use a photo containing a person or identifying information for this check.
