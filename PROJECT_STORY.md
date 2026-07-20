# The Story of RummageLab

## Inspiration

Rainy season came early this year and refused to leave. Grey morning after
grey morning stuck indoors with a baby, a toddler, and a full-time job — and
every pressure valve equally unappealing: infinite snacks, more screen time,
or expensive classes across town.

At the same time, I'd been itching to go deeper on modern AI tooling —
pipelines, agent orchestration, scaffolding, git worktrees — and a hackathon
weekend looked like a chance to solve both problems at once.

The dream workflow was honest about my life: type a `/goal`, send off a team of
agents, and go cook breakfast for the wailing kids while their dad is still
asleep. Come back, review, steer, repeat.

The dream product was equally simple: something that turns the junk drawer, the
kitchen counter, and the backyard into short, age-right learning moments —
things my kids can *do* with their hands, not another screen to stare at.

## What it does

RummageLab turns everyday objects into safe, developmentally appropriate
activities for ages 0–6. A parent picks an age band, then photographs or types
what is on the table. On the live path, GPT-5.6 vets each object, and — only
after the parent confirms every item — authors an activity fitted to the
confirmed objects, the child's age band, and the weather.
Under-threes get screen-free caregiver co-play scripts; threes-and-up get short
guided quests that end with something the child noticed, made, heard, measured,
or explained — not another chat transcript. A deterministic seeded path
(Kitchen Sound Detectives) runs the full experience with no key configured, so
the demo never depends on a live model call.

## How I built it

I built RummageLab primarily with **Codex 5.6 (Sol & Terra)**:

- **Codex 5.6** did the heavy early lifting: initial planning, architecture,
scaffolding the Next.js app, the Zod schema layer, the runtime contracts,
tests, and CI. Work ran as one-task-per-worktree branches with dedicated
review passes before merging.
- The orchestration pattern that emerged: a master orchestrator task fanning
out subtasks mapped to git workflows, with dedicated reviewer agents on each
feature branch before merge.

The runtime idea I'm proudest of: use **live GPT-5.6** to author each activity  
dynamically — age-appropriate, weather-dependent, built from parent-vetted  
objects — while keeping a hard boundary around it. Nothing the model authors  
reaches a child without passing a local hazard denylist, strict Zod plus  
context re-validation (materials must be a subset of what the parent confirmed,  
focus IDs must exist in the local catalogue, steps must fit the time window),  
and explicit parent confirmation. The model composes; it never runs code, and  
the app renders only prebuilt, non-recording components. Codex stays at build  
time; GPT-5.6 is the only model in the learner runtime.

## Challenges and what I learned

1. **AI orchestration is a skill of its own.** Running a master orchestrator
  with subtasks mapped to git workflows — and dedicated reviewers per feature
   branch — took real iteration. Restarting agents with fresh, focused context
   beat letting any one context grow stale.
2. **Goal and loop engineering.** Writing goals that agents can pursue for a
  long stretch without drifting, and knowing when to steer versus when to let
   a loop run, was half the project.
3. **Scaffold extensively, build in branches.** Heavy upfront scaffolding plus
  worktree-isolated branches made parallel agent work merge cleanly instead of
   colliding.
4. **Vercel hosting** for easy deployment.
5. **Don't use GPT-5.6 Ultra for everything.** 💸 Gradiate the effort: start
  with high-effort planning, then drop to lower effort tiers for debugging and
   mechanical work. My token bill learned this lesson before I did.
6. **Kid safety has to be an axiom, not a feature.** COPPA-adjacent design is
  genuinely tricky: no accounts, no stored photos, no child profiling, PII
   screening before any request. And it cuts both ways — my hard denylist
   confidently rejected the rubber duckie my one-year-old plays with
   incessantly. That forced a real design change: conservative automated
   vetting *plus* parental override, because the parent — not the model, and
   not my denylist — is the final authority on their own living room.

## What's next

- **Finish the adaptive feedback loop**: a personal model of family
preferences (with the same no-PII stance — parent-approved tags only, never
raw notes or child data) so subsequent activities follow what a family
actually enjoys.
- **Grow RummageLab toward a K–8 audience** — same everyday objects, bigger  
STEM ideas.

