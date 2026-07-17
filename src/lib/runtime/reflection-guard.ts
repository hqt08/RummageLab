export const MAX_REFLECTION_CHARACTERS = 400;
export const MAX_REFLECTION_UTF8_BYTES = 1_200;

export type ReflectionGuardResult =
  | { safe: true; text: string }
  | { safe: false; code: "empty" | "too_long" | "pii_risk" };

const PII_RISK_PATTERNS = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /(?:https?:\/\/|www\.)\S+/i,
  /(?:\+?\d[\s().-]*){7,}/,
  /\b\d{1,5}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,4}\s+(?:street|st|avenue|ave|road|rd|lane|ln|drive|dr|court|ct|boulevard|blvd|way)\b/i,
  /\b(?:my\s+child(?:'s)?|his|her|their|the\s+child(?:'s)?)\s+(?:full\s+)?name\s+is\b/i,
  /\b(?:born|date of birth|dob)\b/i,
  /\b(?:school|daycare|preschool|teacher)\s+(?:is|at|named)\b/i,
  /\b(?:social security|ssn|account number|medical record)\b/i,
  /(?:^|\s)@[a-z0-9_.-]{2,}\b/i,
  /\b\d{5}(?:-\d{4})?\b/,
  /\b(?:diagnos(?:is|ed|tic)|autis(?:m|tic)|adhd|disability|disorder|therapy|therapist|medication|medical|doctor|pediatrician)\b/i,
  /\b(?:student|patient|account|member|case)\s*(?:id|number|#)\b/i,
  /\b(?:my|our|his|her|their)\s+(?:son|daughter|child|kid|toddler|baby)\s+(?:is\s+|named\s+)?[\p{L}][\p{L}'-]{1,}\b/iu,
  /\b(?:go(?:es)?|attends?|enrolled)\s+(?:to|at|in)\s+[\p{L}][\p{L}'-]*(?:\s+[\p{L}][\p{L}'-]*){0,4}\s+(?:school|elementary|preschool|daycare|academy)\b/iu,
  /\b(?:we|they|he|she|i)\s+(?:live|stay|reside)\s+(?:in|at|near)\b/i,
  /\b(?:apartment|apt\.?|unit)\s*[A-Z0-9-]+\b/i,
  /\b(?:diabetes|asthma|seizures?|allerg(?:y|ies|ic)|epilepsy|cancer|condition|syndrome)\b/i,
];

/**
 * A deliberately conservative, deterministic pre-request screen. It blocks
 * likely identifying details instead of trying to redact or infer intent.
 * Passing this screen is not a guarantee that text contains no PII.
 */
export function guardTypedReflection(input: string): ReflectionGuardResult {
  const normalized = input.normalize("NFKC");
  if (/\p{Cc}|\p{Cf}/u.test(normalized)) {
    return { safe: false, code: "pii_risk" };
  }
  const text = normalized.trim();
  if (!text) return { safe: false, code: "empty" };
  if (
    text.length > MAX_REFLECTION_CHARACTERS ||
    new TextEncoder().encode(text).byteLength > MAX_REFLECTION_UTF8_BYTES
  ) {
    return { safe: false, code: "too_long" };
  }
  if (PII_RISK_PATTERNS.some((pattern) => pattern.test(text))) {
    return { safe: false, code: "pii_risk" };
  }
  return { safe: true, text };
}

const ASSESSMENT_LANGUAGE =
  /\b(?:diagnos(?:is|ed|tic)|master(?:y|ed)|gifted|ability|aptitude|intelligen(?:ce|t)|assessment|learning profile|behavior(?:al)? risk|disorder|deficit|delayed|advanced for (?:his|her|their) age)\b/i;

/** Rejects model prose that crosses from a reported event into assessment. */
export function isPlainObservationLanguage(input: string): boolean {
  return guardTypedReflection(input).safe && !ASSESSMENT_LANGUAGE.test(input);
}
