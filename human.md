# Product-owner decision record

These decisions define product scope and data handling. The product-scope items
below are resolved; pending deployment and submission actions are tracked at the
end. When a future material choice needs human direction, add it here as an
unchecked item rather than silently assuming an answer.

- [x] **Live demo learner:** A parent and their 3-year-old will be the demo
      protagonists. The first planned activity is `Kitchen Sound Detectives`.
- [x] **Age-banded product scope:** Confirmed parent-first 0–6 design:
      caregiver moments for 0–3, picture/audio-led mini investigations for 3–4,
      and short guided quests for 4–6. The hackathon implementation remains one
      polished 3-year-old flow.
- [x] **Tool name:** Confirmed **RummageTool** for all user-facing language.
- [x] **Profile model:** Confirmed seeded, no-login parent context for the
      hackathon. Persistent profiles and authentication are post-demo work.
- [x] **Future preference memory:** Confirmed no persistence for the hackathon.
      Any later memory is a parent-owned, PII-free, tag-only activity-preference
      context with expiry, added only after a privacy review.
- [x] **Reflection input:** Confirmed optional asynchronous parent voice memo
      with an optional typed alternative. The child is never recorded; reflection
      may be skipped entirely.
- [x] **Material input:** Confirmed: parents can add everyday materials by
      object-only photo or typed text. Both paths produce the same
      parent-confirmed material inventory; a seeded Kitchen Sound Detectives
      path remains available.
- [x] **Photo showcase:** Confirmed: the recorded demo uses a fresh photo of
      the real kitchen kit (objects only, never the child), while the public
      judge path retains a clearly labeled curated fallback image.
- [x] **Weather interaction:** Confirmed a visible, editable preset city for the
      hackathon. A weather adapter may preselect broad condition tags, but the
      parent must edit or approve them before activity planning. Manual chips
      and a clearly labeled seeded fallback remain available. Only approved
      tags—not the city or coordinates—enter activity or observation context.
- [x] **Preset demo city:** Confirmed **Anchorage, Alaska** as the visible,
      editable public demo default. Treat it as demo configuration, never as an
      inferred or stored child/family location.
- [x] **Hosting:** Confirmed a public hosted demo backed by the public GitHub
      repository `hqt08/RummageLab`, with local execution retained as a backup.
- [x] **Deployment provider:** Confirmed GitHub for source plus Vercel for the
      public Next.js app. Production deploys from `main`; pull requests may use
      seeded preview deployments without production credentials.
- [x] **Public repository license:** Confirmed **Apache License 2.0** for the
      RummageLab source code and documentation. This does not grant permission
      to use RummageLab trademarks; demo media and third-party assets require
      their own explicit rights or notices.
- [x] **Copyright-holder label:** Confirmed **hqt08** for the hackathon-era
      repository copyright notice. A later move to an LLC name is a separate,
      explicit ownership and documentation decision; do not infer it from a
      metadata change alone.
- [x] **Public commit identity:** Confirmed repository-local Git author identity
      `hqt08 <1230758+hqt08@users.noreply.github.com>` for the hackathon. This
      may be changed prospectively to the LLC name and email after formation.
- [x] **Verify the no-reply alias:** Confirmed in GitHub Settings → Emails that
      `1230758+hqt08@users.noreply.github.com` is the account's private commit
      address.
- [x] **Create the GitHub remote:** Confirmed public repository
      `hqt08/RummageLab`. GitHub created the first commit with the standard
      Apache-2.0 `LICENSE`; its author uses the verified no-reply address, the
      license matches the local copy exactly, and local `main` now tracks
      `origin/main`. The reviewed scaffold and seeded Kitchen Sound demo are
      published; pull request #1 is merged at `041cf34`.
- [x] **In-product Codex Studio:** Confirmed as a documented phase-two feature,
      not part of the hackathon demo. For the hackathon, Codex remains a
      build-time collaborator; GPT-5.6 selects a validated `RummageToolSpec`
      that the app renders with approved, prebuilt components.
- [x] **Live runtime authorization:** The GPT-5.6 photo-to-activity vertical
      slice may use a server-only development API key, a transient object-only
      upload route, and stateless outbound model calls. The key is never added to
      source. The server must re-encode and discard uploads, strictly validate
      model output, and preserve the no-key seeded path. This does not authorize
      persistence, analytics, production credentials or deployment,
      authentication, PWA work, live weather, typed reflection, or voice.
- [x] **Typed parent-reflection authorization:** The optional typed-reflection
      slice may use a short, parent-only note, a conservative deterministic
      PII-risk guard before any request, and a server-only structured extraction
      route with a prepared no-key fallback. Raw text must remain transient and
      absent from logs and next-activity context. Only parent-edited, explicitly
      approved allowlisted tags may shape one next recommendation. This does not
      authorize voice/transcription, persistence, profiles, analytics,
      authentication, PWA work, live weather, or deployment.

## Deployment and submission owner actions

- [x] **Create the Vercel production project:** Imported the public
      `hqt08/RummageLab` GitHub repository, retained the standard Next.js and
      repository-root settings, deployed `main` with no environment variables,
      and verified the seeded public flow in a fresh browser at
      <https://rummage-lab.vercel.app/>. Do not continue if any visible credit
      indicator is below $10.
- [ ] **Optionally enable the live GPT-5.6 path in Vercel:** In the approved
      Vercel project settings, first confirm an owner-controlled OpenAI project
      spend cap or alert and that no visible credit indicator is below $10.
      Because the prototype routes do not include an application-level abuse
      gate, prefer the no-key seeded production deployment for public judging.
      If live mode is still approved, add only `OPENAI_API_KEY` as a server-side
      Production secret and redeploy. Do not paste the value into source, chat,
      build logs, preview settings, or a `NEXT_PUBLIC_` variable. The public
      seeded path must continue to work without this secret.
- [ ] **Record real Codex evidence:** In the core build task, run `/feedback`
      and replace the `TBD` core Session ID in `README.md` and
      `docs/codex-decisions.md`. Never invent or reuse an unrelated ID.
- [ ] **Finish submission-owned evidence:** Capture the under-three-minute
      English demo video with audio using `docs/demo-script.md`, then provide the
      public video URL and confirm the English project description, API/key
      disclosure, public source URL, and judging-period availability against the
      official submission form.
