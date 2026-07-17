# Submission checklist

## Evidence handoff

### Complete and ready to use

- **Public source:** <https://github.com/hqt08/RummageLab>
- **English project description:** RummageLab helps parents turn safe everyday
  materials into short, developmentally appropriate moments of discovery for
  children ages 0–6. Its flagship Kitchen Sound Detectives demo uses GPT-5.6 to
  suggest an allowlisted object inventory and compose a structured activity,
  validates every model response on the server, and renders only approved React
  components. A deterministic seeded path lets judges complete the full
  parent-context, activity, reflection, and try-next loop without an API key.
- **API and key disclosure:** The public seeded demo requires no credentials.
  Optional live photo analysis and typed parent-reflection extraction use
  GPT-5.6 through server-only, stateless requests with `store: false` and only
  when the host has an `OPENAI_API_KEY`. The key must never be committed,
  exposed to the browser, included in logs, or shared with judges.
- **Video capture sequence:** Follow `docs/demo-script.md`: promise (0:00–0:15),
  parent context and object-only photo (0:15–0:45), Kitchen Sound play
  (0:45–1:30), optional reflection and one approved next idea (1:30–2:00), and
  structured-output/privacy/Codex proof (2:00–2:30).

### User-owned evidence still pending

- **Public demo URL:** Create and verify the Vercel production project from
  `main`, then record the stable URL here and in `README.md`.
- **Core Codex evidence:** Run `/feedback` in the core build task and record the
  real Session ID in `README.md` and `docs/codex-decisions.md`.
- **Video evidence:** Record, publish, and add the under-three-minute video URL.
- **Final submission:** Enter the English description and disclosures above,
  confirm current official rules, and keep the demo available through judging.

## Product and testing

- [ ] Public demo URL works in a fresh browser.
- [x] Seeded demo works without a model API key.
- [x] Judge instructions are in the README; the seeded path needs no test credentials.
- [x] README identifies the seeded sample data and gives testing instructions.
- [x] Lint, typecheck, 94 tests, and production build pass under Node 24; rerun
      before submission.
- [x] GitHub Actions verifies pull requests and `main` pushes with the pinned
      Node 24 and pnpm 9.15.9 toolchain, frozen install, lint, typecheck, tests,
      and production build without secrets; first hosted PR run passed.
- [x] Deterministic provider failures (malformed output, mismatch, timeout, or
      unavailable provider) automatically return the validated seeded fallback;
      this is contract coverage, not proof of a live API integration.

## Required evidence

- [x] README explains the product, technical architecture, GPT-5.6 usage, Codex
      contribution, and human decisions.
- [ ] Core Codex `/feedback` Session ID is recorded in the README.
- [ ] Dated commits and `docs/codex-decisions.md` distinguish work created during
      the hackathon.
- [x] Public repository exists with an Apache-2.0 license.

## Video

- [ ] Public video is under three minutes and has audio.
- [ ] Video demonstrates the working product, not only slides.
- [ ] Video explicitly distinguishes Codex's build-time contribution from
      GPT-5.6 runtime use.
- [ ] Video still makes sense if judges only review it and the submission text.

## Final review

- [ ] Project description is in English.
- [ ] No secrets, raw child identifiers, or unlicensed assets are included.
- [ ] Third-party APIs, data, fonts, and demo assets are disclosed; required
      licenses and attributions are present.
- [ ] Demo access remains available through the judging period.
- [ ] Confirm current requirements against the official rules before submitting.
