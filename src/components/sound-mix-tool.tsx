"use client";

import React, { useId } from "react";

import type { RummageToolSpec } from "@/lib/schemas/rummage-tool";

export type SoundMixSpec = Extract<RummageToolSpec, { kind: "sound_mix" }>;

export type SoundMixToolProps = {
  spec: SoundMixSpec;
  trail: readonly string[];
  onAdd: (soundLabel: string) => void;
  onClear: () => void;
};

export function SoundMixTool({
  spec,
  trail,
  onAdd,
  onClear,
}: SoundMixToolProps) {
  const titleId = useId();
  const promptId = useId();
  const hintId = useId();

  return (
    <section
      aria-describedby={`${promptId} ${hintId}`}
      aria-labelledby={titleId}
      className="sound-lab"
    >
      <header>
        <p className="panel-kicker">RummageTool · sound mix</p>
        <h2 className="panel-title" id={titleId}>{spec.title}</h2>
        <p className="panel-copy" id={promptId}>{spec.prompt}</p>
      </header>

      <p className="tool-boundary" id={hintId}>
        {spec.accessibilityHint}
      </p>

      <div
        aria-label="Sound words"
        className="sound-buttons"
        role="group"
      >
        {spec.soundLabels.map((soundLabel, index) => (
          <button
            aria-label={`Add ${soundLabel} to the sound trail`}
            className="sound-button"
            key={`${soundLabel}-${index}`}
            onClick={() => onAdd(soundLabel)}
            type="button"
          >
            {soundLabel}
          </button>
        ))}
      </div>

      <div
        aria-atomic="true"
        aria-live="polite"
        className="sound-trail"
        role="status"
      >
        <p className="trail-heading">Your sound trail · last three cards</p>
        {trail.length === 0 ? (
          <p className="trail-empty">
            No sound words yet. Choose one to begin.
          </p>
        ) : (
          <ol aria-label="Chosen sound trail" className="trail-tokens">
            {trail.map((soundLabel, index) => (
              <li className="trail-token" key={`${soundLabel}-${index}`}>{soundLabel}</li>
            ))}
          </ol>
        )}
      </div>

      <button
        aria-label="Clear the sound trail"
        className="trail-clear"
        disabled={trail.length === 0}
        onClick={onClear}
        type="button"
      >
        Clear trail
      </button>

      <p className="tool-boundary">
        Make every sound with the real objects. This tool plays no audio and
        records nothing.
      </p>
    </section>
  );
}
