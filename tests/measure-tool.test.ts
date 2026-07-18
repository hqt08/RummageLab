import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MeasureTool, type MeasureSpec } from "../src/components/measure-tool";

const spec: MeasureSpec = {
  kind: "measure",
  title: "Count the bird visits",
  prompt: "Tap plus each time you spot a visitor at the feeder.",
  accessibilityHint: "The tally is read aloud as words as well as a number.",
  unit: "observations",
  targetLabel: "Birds at the feeder",
};

describe("MeasureTool", () => {
  it("renders a prebuilt tally without media or persistence", () => {
    const html = renderToStaticMarkup(createElement(MeasureTool, { spec }));
    expect(html).toContain("RummageTool · measuring");
    expect(html).toContain("Count the bird visits");
    expect(html).toContain("records nothing");
    expect(html).not.toContain("<audio");
    expect(html).not.toContain("<video");
  });
});
