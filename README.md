# RummageLab

> Turn the things around you into moments of discovery for ages 0–6.

**Status:** Seeded demo plus an optional live GPT-5.6 photo-to-activity path · **Track:** Education

RummageLab helps a parent turn a few ordinary objects and a child’s curiosity
into a developmentally appropriate moment of discovery. Every activity ends with
something the child noticed, made, heard, measured, or explained—not another
chat transcript.

## The core experience

1. In the implemented demo, a parent uses a prepared kit, an object-photo
   preview followed by optional live analysis, or a small typed-material allowlist, then confirms the
   same safe material inventory. The visible **Anchorage, Alaska** label and
   broad weather chips are prepared demo context—not a lookup or family location.
2. The server-only runtime accepts only parent-approved `ActivityContext` and returns
   a Zod-validated `ExperienceSpec`: a parent-led `RummageMoment` for ages 0–3,
   or a short `QuestSpec` for ages 3–6. For the focused 3-year-old demo, an optional
   live adapter uses GPT-5.6 to suggest an allowlisted photo inventory and compose
   the validated Kitchen Sound quest. Missing credentials or provider failure fall
   back to the deterministic seeded path.
3. For children 3+, RummageLab can render an approved interactive
   **RummageTool**. For younger children, it gives the parent a simple co-play
   script rather than putting the child in front of a screen.
4. After the quest, the parent may skip reflection, use the prepared example,
   or type a short parent-only observation. A deterministic browser guard blocks
   likely sensitive details before any request. The server repeats strict
   validation and returns only an editable, Zod-validated observation draft and
   allowlisted tag suggestions. Nothing shapes the one next idea until the
   parent explicitly approves the edited tags. Adult voice remains deferred.

The first implemented experience is **“Kitchen Sound Detectives.”** A parent can
use the prepared kit, preview a new object-only photo before optional analysis, or type material
names. Every path converges on the same parent confirmation for the large empty
plastic container, wooden utensil, soft cloth, suggested Anchorage weather
tags, and safety checkpoint. The app then renders a validated `sound_mix`
quest, an optional typed or prepared parent observation, and at most one session-only
try-next idea made only from parent-approved tags.

The prepared-kit path remains deliberately labeled as seeded and needs no key.
For live photo analysis, the parent must confirm that the image contains objects
only. The server validates and re-encodes the transient JPEG, PNG, or WebP in
memory to strip metadata. The multipart parser enforces an 8 MB photo limit and
a 9 MB total request limit while reading the stream, even when `Content-Length`
is absent or false. The server sends the sanitized image once with `store: false`
and retains neither the upload nor provider response. Typed names still use a local deterministic
allowlist; only parent-confirmed categories enter planning. Typed reflection is
bounded, screened before a request, never logged or persisted, and discarded
after transient extraction. Without a key, or when extraction fails, the app
transparently offers the validated prepared observation instead. There is no
live weather, voice, analytics, authentication, or database. Resetting or
reloading clears session state.

## Architecture

```mermaid
flowchart LR
  subgraph Device["Parent and child device"]
    C["Parent: age stage, typed or photo materials,<br/>weather and available time"]
    A["Child: parent-led moment<br/>or short quest"]
    V["Deferred: optional adult voice memo"]
    T["Optional typed parent note<br/>transient and bounded"]
  end

  subgraph App["RummageLab web app"]
    UI["Next.js web app<br/>React + TypeScript"]
    API["Server-only live adapter<br/>transient photo handling"]
    PLANVAL["Experience validation +<br/>developmental-focus allowlist"]
    PII["Transient text screening<br/>no content logs"]
    OBSVAL["Observation validation"]
    ENG["Moment/quest engine<br/>approved RummageTool components"]
    REVIEW["Parent edits or approves"]
    SESSION["Session-only NextActivityContext<br/>one next suggestion"]
    FUTURE[("Phase two only: parent-owned<br/>preferences with expiry")]
  end

  subgraph OpenAI["OpenAI services"]
    QD["GPT-5.6 Experience Director<br/>structured ExperienceSpec"]
    STT["Speech-to-text"]
    LE["GPT-5.6 observation extractor<br/>editable parent observation"]
  end

  subgraph Build["Build-time collaboration"]
    H["Human product direction"]
    CX["Codex: UI, schemas,<br/>tests, review"]
    H --> CX
    CX --> UI
  end

  C --> UI --> PLANVAL --> ENG --> A
  API --> QD
  V -. "deferred" .-> API
  T --> PII --> API --> LE --> OBSVAL --> REVIEW --> SESSION
  REVIEW -. "phase two only, after review" .-> FUTURE
  FUTURE -. "future context" .-> API
```

See [the detailed architecture](docs/architecture.md).

## Why GPT-5.6 and Codex

### GPT-5.6 runtime

- Uses object photos and parent-provided context to compose a constrained,
  developmentally appropriate moment or quest.
- Returns structured data that the server validates before it reaches the child.
- Turns a parent reflection into a small, editable observation rather than a
  child diagnosis or opaque score.

### Codex collaboration

- **Core `/feedback` Session ID:** `TBD — record before submission`
- **Codex accelerated:** project scaffolding, interaction design, schemas,
  tests, documentation, and code review.
- **Human decisions:** learner scope, standards allowlist, safety/privacy
  boundaries, product direction, and final approval.
- **Evidence:** dated commits and [Codex decision log](docs/codex-decisions.md).

For the hackathon, Codex is used materially at build time to create and verify
the product. The live runtime may select only a validated `RummageToolSpec`; the
app still renders only approved, prebuilt React components. The seeded path uses
the same validation boundary without requiring credentials. A teacher/parent
authoring studio is documented phase-two scope; even then, the learner app will
never execute arbitrary generated code.

## Technology choices

| Concern | Choice | Why |
| --- | --- | --- |
| Product surface | Next.js, React, TypeScript | Fast public deployment, phone-friendly, easy judge access |
| Source and hosting | Public [GitHub repository](https://github.com/hqt08/RummageLab) + [Vercel demo](https://rummage-lab.vercel.app/) | Reviewable source and a stable seeded production URL |
| Model contracts | GPT-5.6 + Zod structured schemas | Consistent, inspectable, parent-safe rendering boundaries |
| Reflection MVP | Optional typed parent note or Skip; voice deferred | Deterministic screening, strict structured output, explicit tag approval |
| Data | Seeded, no-login parent context; preferences later | Keeps the demo reliable without sensitive child data |
| Weather | Anchorage demo default suggests tags; parent approves | Convenient live context without sending location to the model |
| Interactive activity | Prebuilt React RummageTool components | Instant, safe, testable experience |
| Styling | CSS field-notebook design system | Tactile and playful without a generic AI interface |

## Scaffold setup

Prerequisite: Node.js 24 LTS and Corepack using the project-pinned
`pnpm@9.15.9`. The repository's `.node-version` and `engines.node` both select
Node 24.

```bash
corepack enable # omit if pnpm 9.15.9 is already installed
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://localhost:3000` to run the complete seeded Kitchen Sound Detectives
path. No environment file, login, API key, or external service is required.

Live development is optional. Put a development key only in an ignored
`.env.local` file; never commit it or expose it with a `NEXT_PUBLIC_` name:

```bash
OPENAI_API_KEY=your-development-key
```

The live slice is deliberately pinned to `gpt-5.6`. Without `OPENAI_API_KEY`,
the prepared seeded demo remains fully usable and live requests fail safely to
that path.

`GET /api/live-experience` reports only whether live photo analysis and the
seeded demo are available; it never returns credential or provider details.

## Framework checks

```bash
pnpm test
pnpm typecheck
pnpm check
```

The combined check runs under Node 24. Tests cover material, age-band,
learning-focus and RummageTool safety contracts; the seeded fixture; local and
server photo validation; metadata stripping; session reset; strict live request
and response validation; missing-key, malformed, timeout, and mismatch
fallbacks; content-free diagnostics; typed-reflection PII-risk and byte guards;
strict live or prepared observation drafts; raw-content logging prohibition; the
explicit one-suggestion approval boundary; sound mixer; and the rendered demo
shell.

## Seeded demo path

1. Open the app.
2. Use the prepared kit, take or choose an object-only photo, or type the
   material names. Live photo analysis happens only after the parent checks the
   object-only confirmation and selects **Analyze objects with GPT-5.6**; without
   a key, the validated prepared inventory remains available.
3. Confirm all three allowlisted materials, the Anchorage demo weather tags,
   and the adult safety checkpoint.
4. Start the validated `sound_mix` quest and build a three-card sound trail.
5. Skip reflection, type a short parent-only observation, or review the prepared
   fallback. Remove likely sensitive details if the local guard blocks sending.
6. Review the editable wording and tags, then explicitly approve the allowlisted
   tags to create exactly one session-only try-next
   idea, then reset or reload to clear the demo.

Before submission, add the final under-three-minute demo video.
Use the
[submission checklist](docs/submission-checklist.md) rather than relying on
memory.

## Documentation

- [Architecture and data contracts](docs/architecture.md)
- [Early-learning focus catalogue](docs/learning-focuses-catalog.md)
- [Privacy and safety boundaries](docs/privacy-safety.md)
- [Parent observations and adaptive suggestions](docs/observation-model.md)
- [Demo script](docs/demo-script.md)
- [Photo-to-activity demo flow](docs/photo-to-activity-demo.md)
- [Material-intake QA record](docs/material-intake-qa.md)
- [Activity-context contract](docs/activity-context.md)
- [Codex decision log](docs/codex-decisions.md)
- [Submission checklist](docs/submission-checklist.md)
- [Repository, worktree, and deployment workflow](docs/repository-workflow.md)
- [Product-owner decision record](human.md)

## License

Copyright © 2026 hqt08.

RummageLab source code and documentation are licensed under the
[Apache License 2.0](LICENSE).

The license does not grant permission to use RummageLab trade names,
trademarks, service marks, or product names except as the license permits for
describing the work's origin. Demo media and third-party assets are not covered
unless their files explicitly say otherwise.
