"use client";

import React, { useId, useState } from "react";

import type { RummageToolSpec } from "@/lib/schemas/rummage-tool";

export type FieldJournalSpec = Extract<RummageToolSpec, { kind: "field_journal" }>;

const NOTE_STARTERS = ["I saw…", "I heard…", "I felt…"] as const;

export function FieldJournalTool({ spec }: { spec: FieldJournalSpec }) {
  const titleId = useId();
  const promptId = useId();
  const hintId = useId();

  const [notes, setNotes] = useState<readonly string[]>([]);

  const addNote = (starter: string) => setNotes((current) => [...current, starter]);
  const clearNotes = () => setNotes([]);

  return (
    <section
      aria-describedby={`${promptId} ${hintId}`}
      aria-labelledby={titleId}
      className="sound-lab"
    >
      <header>
        <p className="panel-kicker">RummageTool · field journal</p>
        <h2 className="panel-title" id={titleId}>{spec.title}</h2>
        <p className="panel-copy" id={promptId}>{spec.prompt}</p>
      </header>

      <p className="tool-boundary" id={hintId}>{spec.accessibilityHint}</p>

      <p className="trail-heading">{spec.journalPrompt}</p>
      <div aria-label="Note starters" className="sound-buttons" role="group">
        {NOTE_STARTERS.map((starter, index) => (
          <button
            aria-label={`Add the note starter ${starter}`}
            className="sound-button"
            key={`${starter}-${index}`}
            onClick={() => addNote(starter)}
            type="button"
          >
            {starter}
          </button>
        ))}
      </div>

      <div aria-atomic="true" aria-live="polite" className="sound-trail" role="status">
        <p className="trail-heading">Chosen note starters</p>
        {notes.length === 0 ? (
          <p className="trail-empty">No notes yet. Tap a starter to think out loud.</p>
        ) : (
          <ol className="trail-tokens">
            {notes.map((starter, index) => (
              <li className="trail-token" key={`${starter}-${index}`}>{starter}</li>
            ))}
          </ol>
        )}
      </div>

      <button
        aria-label="Clear the chosen note starters"
        className="trail-clear"
        disabled={notes.length === 0}
        onClick={clearNotes}
        type="button"
      >
        Clear notes
      </button>

      <p className="tool-boundary">
        The real watching and wondering lead the play. This tool only echoes chosen starters, records nothing, and sends nothing.
      </p>
    </section>
  );
}
