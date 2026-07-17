"use client";

import React, { useId } from "react";

import type { RummageToolSpec } from "@/lib/schemas/rummage-tool";

export type PredictSpec = Extract<RummageToolSpec, { kind: "predict" }>;

export function PredictTool({
  spec,
  selectedOption,
  onChoose,
}: {
  spec: PredictSpec;
  selectedOption: string | null;
  onChoose: (option: string) => void;
}) {
  const titleId = useId();
  const promptId = useId();
  const hintId = useId();
  return (
    <section aria-describedby={`${promptId} ${hintId}`} aria-labelledby={titleId} className="sound-lab">
      <header>
        <p className="panel-kicker">RummageTool · prediction</p>
        <h2 className="panel-title" id={titleId}>{spec.title}</h2>
        <p className="panel-copy" id={promptId}>{spec.prompt}</p>
      </header>
      <p className="tool-boundary" id={hintId}>{spec.accessibilityHint}</p>
      <p className="trail-heading">{spec.question}</p>
      <div aria-label="Prediction choices" className="sound-buttons" role="group">
        {spec.options.map((option) => (
          <button
            aria-pressed={selectedOption === option}
            className="sound-button"
            key={option}
            onClick={() => onChoose(option)}
            type="button"
          >
            {option}
          </button>
        ))}
      </div>
      <div aria-atomic="true" aria-live="polite" className="sound-trail" role="status">
        {selectedOption ? <p className="trail-empty">Prediction chosen: {selectedOption}. Now try one gentle grown-up roll.</p> : <p className="trail-empty">Choose a prediction. There is no right answer to score.</p>}
      </div>
      <p className="tool-boundary">This tool only shows a choice. It records nothing and does not move the real ball.</p>
    </section>
  );
}
