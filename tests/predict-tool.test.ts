import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { PredictTool, type PredictSpec } from "../src/components/predict-tool";

const spec: PredictSpec = {
  kind: "predict",
  title: "Where will it stop?",
  prompt: "Choose a picture prediction, then try one gentle roll.",
  accessibilityHint: "Each choice uses words as well as a visual symbol.",
  question: "Where do you think the ball will stop?",
  options: ["Near us", "Farther away"],
};

describe("PredictTool", () => {
  it("renders prebuilt, named choices without media or persistence", () => {
    const onChoose = vi.fn();
    const html = renderToStaticMarkup(createElement(PredictTool, {
      spec, selectedOption: null, onChoose,
    }));
    expect(html).toContain("RummageTool · prediction");
    expect(html).toContain('aria-label="Prediction choices"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain("There is no right answer to score.");
    expect(html).toContain("records nothing");
    expect(html).not.toContain("<audio");
    expect(html).not.toContain("<video");
    expect(onChoose).not.toHaveBeenCalled();
  });
});
