import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FieldJournalTool, type FieldJournalSpec } from "../src/components/field-journal-tool";

const spec: FieldJournalSpec = {
  kind: "field_journal",
  title: "Garden field journal",
  prompt: "Tap a starter to say what you noticed outside.",
  accessibilityHint: "Each starter uses words as well as a visual symbol.",
  journalPrompt: "What did you notice in the garden today?",
};

describe("FieldJournalTool", () => {
  it("renders prebuilt note starters without media or persistence", () => {
    const html = renderToStaticMarkup(createElement(FieldJournalTool, { spec }));
    expect(html).toContain("RummageTool · field journal");
    expect(html).toContain("Garden field journal");
    expect(html).toContain("records nothing");
    expect(html).not.toContain("<audio");
    expect(html).not.toContain("<video");
  });
});
