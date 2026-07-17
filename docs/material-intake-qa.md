# Material-intake shell QA record

Date: 2026-07-16

This is repeatable browser and contract evidence for the local-only intake
slice. It does not claim live photo analysis.

## Automated checks

- Node 24 lint, typecheck, 38 Vitest tests, and production build pass.
- Reducer tests prove that `photo` and `typed` provenance cannot start a quest
  without a current intake candidate set.
- Utility tests cover MIME/size checks, matching image signatures, decoded
  dimension limits, typed allowlisting, quantity-sensitive container input,
  PII-like/unsafe rejection, and object-URL revocation.

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
   until a valid, decoded, bounded object photo is ready.
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

## Runtime-contract fallback pass

The same production build was checked in-browser on 2026-07-16 with no key or
runtime planner/network request:

1. Confirm the prepared materials, weather tags, and safety acknowledgement.
2. Select **Preview fallback and retry**; verify the content-free loading state
   says that no network request is being made.
3. Verify the simulated unavailable planner presents the prepared fallback and
   retry controls, without showing a provider response, photo, or typed text.
4. Select **Retry seeded planner**; verify it reaches `Kitchen Sound
   Detectives` and its completion control.
5. Verify the browser console has no warnings or errors.
6. Start the fallback preview, immediately select **Reset demo**, then wait past
   the loading delay; verify the kit-review screen remains visible and no quest
   transition occurs.

Contract tests separately prove malformed output, age/context/material mismatch,
timeout/unavailable taxonomy, fallback, and that seeded mode does not call
`fetch`; the browser trace above proves the visible retry path. This is
deterministic local simulation, not a live model or photo-analysis claim.
