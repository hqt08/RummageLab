import { z } from "zod";

const baseToolSchema = z.object({
  title: z.string().min(1).max(80),
  prompt: z.string().min(1).max(240),
  accessibilityHint: z.string().min(1).max(180),
}).strict();

const sortToolSchema = baseToolSchema.extend({
  kind: z.literal("sort"),
  categories: z.array(z.string().min(1).max(40)).min(2).max(4),
  items: z.array(z.string().min(1).max(60)).min(2).max(8),
}).strict();

const measureToolSchema = baseToolSchema.extend({
  kind: z.literal("measure"),
  unit: z.enum(["cm", "in", "seconds", "grams", "observations"]),
  targetLabel: z.string().min(1).max(80),
}).strict();

const predictToolSchema = baseToolSchema.extend({
  kind: z.literal("predict"),
  question: z.string().min(1).max(180),
  options: z.array(z.string().min(1).max(80)).min(2).max(4),
}).strict();

const soundMixToolSchema = baseToolSchema.extend({
  kind: z.literal("sound_mix"),
  soundLabels: z.array(z.string().min(1).max(40)).min(2).max(4),
}).strict();

const fieldJournalToolSchema = baseToolSchema.extend({
  kind: z.literal("field_journal"),
  journalPrompt: z.string().min(1).max(240),
}).strict();

/**
 * Configuration for a prebuilt learner interaction for the 3–6 age range. This
 * intentionally contains no executable code, raw HTML, package name, or URL.
 */
export const RummageToolSpecSchema = z.discriminatedUnion("kind", [
  sortToolSchema,
  measureToolSchema,
  predictToolSchema,
  soundMixToolSchema,
  fieldJournalToolSchema,
]);

export type RummageToolSpec = z.infer<typeof RummageToolSpecSchema>;
export type RummageToolKind = RummageToolSpec["kind"];
