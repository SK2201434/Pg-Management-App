import type { PublicProperty } from "./types";

/** Lowercase, strip accents and punctuation, collapse whitespace. */
export function normalizeSearchText(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** True when every word of the query appears in the property's city or state. An empty query matches all. */
export function matchesLocation(p: Pick<PublicProperty, "city" | "state">, query: string): boolean {
  const tokens = normalizeSearchText(query).split(" ").filter(Boolean);
  if (tokens.length === 0) return true;
  const haystack = normalizeSearchText(`${p.city ?? ""} ${p.state ?? ""}`);
  return tokens.every((t) => haystack.includes(t));
}

/**
 * True when every word of the query appears in the property's name, address line, city or state. An empty
 * query matches all. `address` is only ever compared, never returned: it is not part of the public shape.
 */
export function matchesSearch(p: Pick<PublicProperty, "name" | "city" | "state">, query: string, address: string | null = null): boolean {
  const tokens = normalizeSearchText(query).split(" ").filter(Boolean);
  if (tokens.length === 0) return true;
  const haystack = normalizeSearchText(`${p.name} ${address ?? ""} ${p.city ?? ""} ${p.state ?? ""}`);
  return tokens.every((t) => haystack.includes(t));
}

export const filterByLocation =<T extends Pick<PublicProperty, "city" | "state">>(items: T[], query: string): T[] =>
  items.filter((p) => matchesLocation(p, query));

/** Keeps properties offering the chosen sharing: "1"-"5" for that exact sharing, "more" for six and above. "" matches all. */
export function filterBySharing<T extends Pick<PublicProperty, "sharingOptions">>(items: T[], sharing: string): T[] {
  if (sharing === "") return items;
  const wanted = Number(sharing);
  return items.filter((p) => (sharing === "more" ? p.sharingOptions.some((n) => n >= 6) : p.sharingOptions.includes(wanted)));
}

/** Appends `incoming` to `existing`, skipping ids already present (also within `incoming`). */
export function mergeUnique<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const seen = new Set(existing.map((p) => p.id));
  const out = [...existing];
  for (const p of incoming) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
  }
  return out;
}
