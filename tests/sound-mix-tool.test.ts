import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  SoundMixTool,
  type SoundMixSpec,
} from "../src/components/sound-mix-tool";

const soundMixSpec: SoundMixSpec = {
  kind: "sound_mix",
  title: "Build a sound trail",
  prompt: "Choose a sound word, then make it with the real objects.",
  accessibilityHint: "Each button adds one word to the trail below.",
  soundLabels: ["Boomy", "Scratchy", "Quiet"],
};

function renderSoundMixTool(trail: readonly string[] = []) {
  const onAdd = vi.fn();
  const onClear = vi.fn();
  const html = renderToStaticMarkup(
    createElement(SoundMixTool, {
      spec: soundMixSpec,
      trail,
      onAdd,
      onClear,
    }),
  );

  return { html, onAdd, onClear };
}

describe("SoundMixTool", () => {
  it("renders validated copy and native, explicitly named controls", () => {
    const { html, onAdd, onClear } = renderSoundMixTool();

    expect(html).toContain("<section");
    expect(html).toContain("Build a sound trail");
    expect(html).toContain(
      "Choose a sound word, then make it with the real objects.",
    );
    expect(html).toContain(
      "Each button adds one word to the trail below.",
    );
    expect(html.match(/<button/g)).toHaveLength(4);
    expect(html.match(/type="button"/g)).toHaveLength(4);
    expect(html).toContain(
      'aria-label="Add Boomy to the sound trail"',
    );
    expect(html).toContain(
      'aria-label="Add Scratchy to the sound trail"',
    );
    expect(html).toContain(
      'aria-label="Add Quiet to the sound trail"',
    );
    expect(html).toContain('aria-label="Sound words"');
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="Clear the sound trail"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-atomic="true"');
    expect(html).toContain("No sound words yet. Choose one to begin.");
    expect(html).toMatch(
      /<button[^>]*aria-label="Clear the sound trail"[^>]*disabled=""/,
    );
    expect(html).not.toContain("<audio");
    expect(html).not.toContain("<video");
    expect(onAdd).not.toHaveBeenCalled();
    expect(onClear).not.toHaveBeenCalled();
  });

  it("renders the controlled trail in order and enables clearing", () => {
    const { html } = renderSoundMixTool(["Boomy", "Quiet", "Boomy"]);

    expect(html).toContain('<ol aria-label="Chosen sound trail"');
    expect(html.indexOf(">Boomy</li>")).toBeLessThan(
      html.indexOf(">Quiet</li>"),
    );
    expect(html.match(/<li\b/g)).toHaveLength(3);

    const clearButton = html.match(
      /<button[^>]*aria-label="Clear the sound trail"[^>]*>/,
    )?.[0];
    expect(clearButton).toBeDefined();
    expect(clearButton).not.toContain("disabled");
    expect(html).not.toContain("No sound words yet");
  });
});
