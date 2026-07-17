# Codex decision log

Use this as evidence of the human/Codex collaboration. Keep entries brief,
dated, and honest. The README remains the submission-facing summary.

| Date | Decision | Why | Human decision | Codex contribution |
| --- | --- | --- | --- | --- |
| 2026-07-15 | Build a web-first PWA | Fast public testing and mobile-friendly judging | Approved the product surface | Proposed and scaffolded the architecture |
| 2026-07-15 | Scope the live demo to a parent and 3-year-old | A real family can demonstrate co-play, language, adaptation, and safety | Confirmed | Reframed the age-banded architecture and demo target |
| 2026-07-15 | Use Kitchen Sound Detectives as the demo activity | It uses safe, familiar, large household materials and supports sound, pattern, language, and turn-taking play | Confirmed | Proposed the activity and parent-reflection loop |
| 2026-07-15 | Make an object photo visible in the 3-year-old demo | Demonstrates GPT-5.6 multimodal reasoning in a concrete parent workflow | Confirmed | Defined photo inventory, parent-confirmation, seeded fallback, and demo flow |
| 2026-07-15 | Use a seeded, no-login parent context | Reliability and minimal child-data handling matter more than account features in the demo | Confirmed | Documented a no-persistence architecture boundary |
| 2026-07-15 | Make parent reflection optional, asynchronous, and typed-or-voice | The adaptive loop should be useful without recording a child or forcing disclosure | Confirmed | Defined transient reflection and parent-approved context boundaries |
| 2026-07-15 | Keep preference memory out of the hackathon | The demo proves adaptation without retaining child-related data | Confirmed | Defined future parent-owned, tag-only, expiring preference boundary |
| 2026-07-16 | Use Anchorage as the editable demo city and let live weather suggest tags | Familiar rainy-day context with fast setup while preserving parent judgment and a manual fallback | Confirmed Anchorage and mandatory parent approval | Compared open providers and defined a deterministic, parent-approved adapter boundary |
| 2026-07-16 | Publish source at `hqt08/RummageLab` and deploy the app with Vercel | Gives judges direct access, PR previews, and a local fallback while supporting server routes | Confirmed public GitHub source and Vercel hosting | Audited publish readiness and defined seeded previews plus `main` production deployment |
| 2026-07-16 | Introduce worktrees only after the baseline commit | Parallel slices help later, but an all-untracked repository has no stable integration point | Asked for a worktree recommendation | Defined one-task-per-worktree and Local integration boundaries from the Codex worktree guidance |
| 2026-07-16 | License RummageLab code and documentation under Apache-2.0 | Meets the public-repository requirement with a permissive license and an explicit patent grant while reserving trademark rights | Selected Apache-2.0 after reviewing alternatives and the official rules | Compared permissive and copyleft choices and added standard license metadata |
| 2026-07-16 | Use `hqt08` and a GitHub no-reply commit address for the hackathon | Keeps the public repository tied to the entrant account without exposing a personal email | Confirmed `hqt08` now, with a possible later LLC transition | Resolved the account's ID-based no-reply address and scoped the Git configuration to this repository |
| 2026-07-16 | Adopt the GitHub-generated Apache license commit as the `main` baseline | Avoids unrelated histories while preserving the reviewed local scaffold for a later intentional commit | Created the public repository with Apache-2.0 selected | Verified the remote author identity and byte-identical license, fetched the commit, and attached local `main` without committing or pushing |
| 2026-07-16 | Keep the in-product Codex Studio in phase two | The hackathon is stronger with one polished, safe, low-latency learner loop than a second authoring product | Confirmed phase-two scope | Separated Codex's material build-time role from GPT-5.6 runtime selection of validated, prebuilt RummageTools |
| 2026-07-16 | Pin the scaffold to Node 24, pnpm 9.15.9, and patched dependencies | Node 20 is EOL, Vercel defaults to Node 24, and the initial dependency graph contained published Next.js and PostCSS advisories | Requested mechanical scaffold readiness | Updated the compatible dependency line, added a documented PostCSS override, generated the lockfile, and verified lint, types, scaffold tests, build, audit, smoke, and staged-secret checks |
| 2026-07-16 | Establish the reviewed scaffold baseline on `main` before product work | Gives every implementation slice a clean, auditable integration point | Explicitly authorized the reviewed commit and push | Rechecked the staged scope and full check, committed `aab2556`, pushed it, and verified a clean synchronized `main` |
| 2026-07-16 | Implement the first golden path as an honest seeded, session-only slice | Judges need a polished path without credentials, while live integrations should not be simulated or widen data collection | Bounded the slice to Kitchen Sound Detectives and prohibited pushing, deployment, and live APIs | Built the Zod-parsed fixture and reducer, approved `sound_mix` renderer, prepared observation branch, tag-only one-suggestion boundary, original local demo media, focused tests, and phone/desktop QA |
| 2026-07-15 | Use `RummageTool` in product-facing language | Clear, durable name for the approved learner interaction | Confirmed | Defined the safe renderer boundary |
| 2026-07-15 | Keep voice reflection asynchronous | Reliable demo latency and lower implementation risk | Confirmed, with typed input and skipping also available | Recommended and documented the flow |
| 2026-07-15 | Stop at scaffold/framework level | Preserve user approval before any learner-facing implementation | Requested explicitly | Replaced the starter visual demo with a neutral scaffold placeholder |

## Core-session evidence

- **Core Codex `/feedback` Session ID:** `TBD`
- **Local repository created:** `2026-07-15`
- **Public GitHub repository created:** `2026-07-16`
- **Important commits:** [`8615945`](https://github.com/hqt08/RummageLab/commit/861594519773fcc574fc73a3c462e4707a698866) — GitHub-generated Apache-2.0 license; [`aab2556`](https://github.com/hqt08/RummageLab/commit/aab2556356de3802f12af535b868fc4618002788) — reviewed scaffold baseline

## Entry template

```md
| YYYY-MM-DD | Decision | Why | Human decision | Codex contribution |
```
