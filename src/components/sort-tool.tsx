"use client";

import React, { useId, useState } from "react";

import type { RummageToolSpec } from "@/lib/schemas/rummage-tool";

export type SortSpec = Extract<RummageToolSpec, { kind: "sort" }>;

export function SortTool({ spec }: { spec: SortSpec }) {
  const titleId = useId();
  const promptId = useId();
  const hintId = useId();

  const [activeItem, setActiveItem] = useState<string | null>(null);
  const [filed, setFiled] = useState<Record<string, string>>({});

  const fileItem = (category: string) => {
    if (!activeItem) {
      return;
    }
    const nextItem = activeItem;
    setFiled((current) => ({ ...current, [nextItem]: category }));
    setActiveItem(null);
  };

  const sortedEntries = Object.entries(filed);

  return (
    <section
      aria-describedby={`${promptId} ${hintId}`}
      aria-labelledby={titleId}
      className="sound-lab"
    >
      <header>
        <p className="panel-kicker">RummageTool · sorting</p>
        <h2 className="panel-title" id={titleId}>{spec.title}</h2>
        <p className="panel-copy" id={promptId}>{spec.prompt}</p>
      </header>

      <p className="tool-boundary" id={hintId}>{spec.accessibilityHint}</p>

      <p className="trail-heading">Pick a thing, then pick a bin.</p>
      <div aria-label="Things to sort" className="sound-buttons" role="group">
        {spec.items.map((item, index) => (
          <button
            aria-pressed={activeItem === item}
            className="sound-button"
            key={`${item}-${index}`}
            onClick={() => setActiveItem((current) => (current === item ? null : item))}
            type="button"
          >
            {item}
          </button>
        ))}
      </div>

      <p className="trail-heading">Bins</p>
      <div aria-label="Sorting bins" className="sound-buttons" role="group">
        {spec.categories.map((category, index) => (
          <button
            aria-label={`File the chosen thing into ${category}`}
            className="sound-button"
            disabled={!activeItem}
            key={`${category}-${index}`}
            onClick={() => fileItem(category)}
            type="button"
          >
            {category}
          </button>
        ))}
      </div>

      <div aria-atomic="true" aria-live="polite" className="sound-trail" role="status">
        <p className="trail-heading">Sorted so far</p>
        {sortedEntries.length === 0 ? (
          <p className="trail-empty">Nothing filed yet. Choose a thing, then a bin.</p>
        ) : (
          <ul className="trail-tokens">
            {sortedEntries.map(([item, category]) => (
              <li className="trail-token" key={item}>{item} → {category}</li>
            ))}
          </ul>
        )}
      </div>

      <p className="tool-boundary">
        The real objects lead the sorting. This tool only shows your choices, records nothing, and sends nothing.
      </p>
    </section>
  );
}
