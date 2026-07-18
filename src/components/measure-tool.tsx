"use client";

import React, { useId, useState } from "react";

import type { RummageToolSpec } from "@/lib/schemas/rummage-tool";

export type MeasureSpec = Extract<RummageToolSpec, { kind: "measure" }>;

export function MeasureTool({ spec }: { spec: MeasureSpec }) {
  const titleId = useId();
  const promptId = useId();
  const hintId = useId();

  const [count, setCount] = useState(0);

  const decrease = () => setCount((current) => (current > 0 ? current - 1 : 0));
  const increase = () => setCount((current) => current + 1);
  const reset = () => setCount(0);

  return (
    <section
      aria-describedby={`${promptId} ${hintId}`}
      aria-labelledby={titleId}
      className="sound-lab"
    >
      <header>
        <p className="panel-kicker">RummageTool · measuring</p>
        <h2 className="panel-title" id={titleId}>{spec.title}</h2>
        <p className="panel-copy" id={promptId}>{spec.prompt}</p>
      </header>

      <p className="tool-boundary" id={hintId}>{spec.accessibilityHint}</p>

      <p className="trail-heading">Measuring: {spec.targetLabel}</p>

      <div aria-label="Tally the count" className="sound-buttons" role="group">
        <button
          aria-label="Take one away"
          className="sound-button"
          disabled={count === 0}
          onClick={decrease}
          type="button"
        >
          −
        </button>
        <button
          aria-label="Add one"
          className="sound-button"
          onClick={increase}
          type="button"
        >
          +
        </button>
        <button
          aria-label="Reset the tally"
          className="sound-button"
          disabled={count === 0}
          onClick={reset}
          type="button"
        >
          Reset
        </button>
      </div>

      <div aria-atomic="true" aria-live="polite" className="sound-trail" role="status">
        <p className="trail-heading">Tally so far</p>
        <p className="trail-empty">{count} {spec.unit}</p>
      </div>

      <p className="tool-boundary">
        You do the real measuring with real things. This tool only tallies the count, records nothing, and keeps nothing.
      </p>
    </section>
  );
}
