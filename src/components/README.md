# Components

Approved presentational and interactive components live here.

The first implemented slice contains:

1. `KitchenSoundDemo` — the parent-first, session-only seeded golden path
2. `SoundMixTool` — the controlled renderer for the approved `sound_mix` spec

The shell parses prepared fixtures through the existing schemas before rendering
and never accepts generated HTML or JavaScript. Continue adding tool types one
reviewed vertical slice at a time; do not create all five at once.
