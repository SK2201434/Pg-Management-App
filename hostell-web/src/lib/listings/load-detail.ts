import "server-only";

import { cache } from "react";

import { getAdminFirestore } from "@/lib/firebase/admin";
import { fetchPublicProperty, isValidPropertyId } from "./detail";
import { formatLocation, formatRentRange, formatSharing, RENT_UNAVAILABLE_LABEL } from "./format";
import { fetchPublicProperties } from "./query";
import type { PublicProperty } from "./types";

export const OTHER_PROPERTIES_COUNT = 3;

export type PropertyDetailResult =
  | { kind: "ok"; property: PublicProperty; others: PublicProperty[] }
  | { kind: "invalid" | "not_found" | "unavailable" };

/** Everything the detail page needs, with failures reduced to a state. Memoized per request. */
export const loadPropertyDetail = cache(async (id: string): Promise<PropertyDetailResult> => {
  if (!isValidPropertyId(id)) return { kind: "invalid" };
  try {
    const db = getAdminFirestore();
    const [property, page] = await Promise.all([
      fetchPublicProperty(db, id),
      // Related properties are optional: one small page, and a failure just hides the section.
      fetchPublicProperties(db, { limit: OTHER_PROPERTIES_COUNT + 1, cursor: null }).catch(() => null),
    ]);
    if (property === null) return { kind: "not_found" };
    const others = (page?.items ?? []).filter((p) => p.id !== property.id).slice(0, OTHER_PROPERTIES_COUNT);
    return { kind: "ok", property, others };
  } catch (e) {
    const code = (e as { code?: unknown } | null)?.code;
    console.error("[property-detail] failed", e instanceof Error ? e.name : "UnknownError", typeof code === "string" || typeof code === "number" ? code : "");
    return { kind: "unavailable" };
  }
});

/** Page title and description built only from public fields. */
export function propertyMetadata(result: PropertyDetailResult): { title: string; description: string } {
  if (result.kind !== "ok") return { title: "Property details", description: "Hostel and PG accommodation on HOSTELL." };
  const p = result.property;
  const location = formatLocation(p);
  const rent = formatRentRange(p);
  const parts = [`${p.name}${location ? ` in ${location}` : ""}.`];
  if (rent !== RENT_UNAVAILABLE_LABEL) parts.push(`Rent ${rent} per month.`);
  if (p.sharingOptions.length > 0) parts.push(`Sharing options: ${p.sharingOptions.map(formatSharing).join(", ")}.`);
  return { title: location ? `${p.name} in ${location}` : p.name, description: parts.join(" ") };
}
