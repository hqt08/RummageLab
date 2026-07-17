# Submission checklist

## Product and testing

- [ ] Public demo URL works in a fresh browser.
- [x] Seeded demo works without a model API key.
- [x] Judge instructions are in the README; the seeded path needs no test credentials.
- [x] README identifies the seeded sample data and gives testing instructions.
- [x] Lint, typecheck, 38 tests, and production build pass under Node 24; rerun
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
