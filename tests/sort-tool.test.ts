import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SortTool, type SortSpec } from "../src/components/sort-tool";

const spec: SortSpec = {
  kind: "sort",
  title: "Sort the nature finds",
  prompt: "Pick a thing, then pick a bin it belongs in.",
  accessibilityHint: "Each bin and thing uses words as well as a visual symbol.",
  categories: ["Leaves", "Stones"],
  items: ["Oak leaf", "Grey pebble", "Maple leaf"],
};

describe("SortTool", () => {
  it("renders prebuilt bins and things without media or persistence", () => {
    const html = renderToStaticMarkup(createElement(SortTool, { spec }));
    expect(html).toContain("RummageTool · sorting");
    expect(html).toContain("Sort the nature finds");
    expect(html).toContain("records nothing");
    expect(html).not.toContain("<audio");
    expect(html).not.toContain("<video");
  });
});
