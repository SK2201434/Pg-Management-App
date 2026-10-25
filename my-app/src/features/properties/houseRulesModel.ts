// Pure model of a property's rules and regulations: an ordered list of short statements the owner
// writes, stored on the property document as `houseRules: string[]`. No React, no Firebase.

export const MAX_RULES = 30;
export const RULE_MAX = 200;

/** Trims each rule, drops empty ones and keeps at most MAX_RULES, in the owner's order. */
export const cleanRules = (items: readonly string[]): string[] =>
  items
    .map((t) => t.trim().replace(/\s+/g, ' ').slice(0, RULE_MAX))
    .filter((t) => t !== '')
    .slice(0, MAX_RULES);

/** The stored value, defensively: only non-empty strings survive. */
export const parseRules = (value: unknown): string[] => (Array.isArray(value) ? cleanRules(value.filter((v): v is string => typeof v === 'string')) : []);

export const sameRules = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((r, i) => r === b[i]);
