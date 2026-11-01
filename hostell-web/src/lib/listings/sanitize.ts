// Server-side screening of free text before it is published. Descriptions are typed by owners and
// may contain contact details; the public site must never be the place those appear.

const MIN_PHONE_DIGITS = 8;
// A run of digits with common separators between them, optionally starting with "+".
const DIGIT_RUN = /\+?\d(?:[\s().–-]?\d)+/g;
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const URL_LIKE = /(?:https?:\/\/|www\.|wa\.me\/|t\.me\/)\S+/i;
const DIGIT_WORD = "(?:zero|one|two|three|four|five|six|seven|eight|nine)";
const SPELLED_DIGITS = new RegExp(`\\b${DIGIT_WORD}(?:[\\s,.-]+${DIGIT_WORD}){6,}\\b`, "i");

export const MAX_DESCRIPTION_LENGTH = 1000;

export function containsContactDetails(text: string): boolean {
  if (EMAIL.test(text) || URL_LIKE.test(text) || SPELLED_DIGITS.test(text)) return true;
  for (const run of text.match(DIGIT_RUN) ?? []) {
    if (run.replace(/\D/g, "").length >= MIN_PHONE_DIGITS) return true;
  }
  return false;
}

/**
 * The description to publish, or null. A description that looks like it contains a phone number,
 * email address or messaging link is omitted whole rather than rewritten, so legitimate text is
 * never altered. This is a screen for obvious cases, not a guarantee.
 */
export function safeDescription(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  if (text === "" || text.length > MAX_DESCRIPTION_LENGTH) return null;
  return containsContactDetails(text) ? null : text;
}
