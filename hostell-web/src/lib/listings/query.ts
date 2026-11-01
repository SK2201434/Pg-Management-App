import { FieldPath, type Firestore } from "firebase-admin/firestore";

import { decodeCursor, encodeCursor } from "./cursor";
import { filterBySharing, matchesSearch } from "./filter";
import { toPublicProperty } from "./serialize";
import { isPropertyType, type PublicPropertiesPage } from "./types";

/** The only collection the public API reads. No private collection or subcollection is touched. */
export const PUBLIC_COLLECTION = "publicListings";

export const DEFAULT_LIMIT = 12;
export const MAX_LIMIT = 24;

export class InvalidLimitError extends Error {
  constructor() {
    super("Invalid limit.");
    this.name = "InvalidLimitError";
  }
}

/** `null`/empty gives the default; anything that is not a whole number from 1 to MAX_LIMIT is rejected. */
export function parseLimit(raw: string | null): number {
  if (raw === null || raw === "") return DEFAULT_LIMIT;
  if (!/^\d{1,3}$/.test(raw)) throw new InvalidLimitError();
  const n = Number(raw);
  if (n < 1 || n > MAX_LIMIT) throw new InvalidLimitError();
  return n;
}

export const MAX_QUERY_LENGTH = 100;
/** The most listed documents one search reads. Firestore has no substring search, so matching happens here. */
export const SEARCH_SCAN_MAX = 1000;

const SHARING_FILTER = /^([1-5]|more)$/;

export class InvalidSearchError extends Error {
  constructor() {
    super("Invalid search.");
    this.name = "InvalidSearchError";
  }
}

/** Trims the text query (empty when absent) and checks the sharing filter ("" for any, "1"-"5", or "more") and the property type ("" for any, or one of PROPERTY_TYPES). */
export function parseSearch(rawQuery: string | null, rawSharing: string | null, rawType: string | null = null): { q: string; sharing: string; type: string } {
  const q = (rawQuery ?? "").trim();
  const sharing = rawSharing ?? "";
  const type = rawType ?? "";
  if (q.length > MAX_QUERY_LENGTH || (sharing !== "" && !SHARING_FILTER.test(sharing)) || (type !== "" && !isPropertyType(type))) {
    throw new InvalidSearchError();
  }
  return { q, sharing, type };
}

export const SITEMAP_MAX = 5000;

/** The id and last update of every usable listed property (up to SITEMAP_MAX), reading only the fields needed to judge a listing. */
export async function fetchPublicPropertyIndex(
  db: Pick<Firestore, "collection">,
  max: number = SITEMAP_MAX,
): Promise<{ id: string; updatedAt: string | null }[]> {
  const snap = await db
    .collection(PUBLIC_COLLECTION)
    .where("listed", "==", true)
    .orderBy(FieldPath.documentId())
    .select("listed", "name", "updatedAt")
    .limit(max)
    .get();
  return snap.docs.flatMap((d) => {
    const item = toPublicProperty(d.id, d.data());
    return item ? [{ id: item.id, updatedAt: item.updatedAt }] : [];
  });
}

/**
 * One page of listed properties in document-id order. Document id is the one ordering every
 * document has, is unique, and never changes, so pages cannot repeat or skip an item even when
 * `updatedAt` is missing or listings change between requests. One extra document is read to know
 * whether another page exists.
 */
export async function fetchPublicProperties(
  db: Pick<Firestore, "collection">,
  args: { limit: number; cursor: string | null },
): Promise<PublicPropertiesPage> {
  let query = db.collection(PUBLIC_COLLECTION).where("listed", "==", true).orderBy(FieldPath.documentId());
  if (args.cursor !== null) query = query.startAfter(decodeCursor(args.cursor));
  const snap = await query.limit(args.limit + 1).get();

  const hasMore = snap.docs.length > args.limit;
  const docs = snap.docs.slice(0, args.limit);
  const items = docs.flatMap((d) => {
    const item = toPublicProperty(d.id, d.data());
    return item ? [item] : [];
  });
  // A page can hold fewer items than `limit` when a document is unusable; the cursor still advances.
  return { items, hasMore, nextCursor: hasMore ? encodeCursor(docs[docs.length - 1].id) : null };
}

/**
 * One page of listed properties matching a text query (name, address, city or state), a sharing filter and/or a property type,
 * in document-id order with the same cursor as `fetchPublicProperties`. Reads at most SEARCH_SCAN_MAX
 * documents after the cursor; if that limit is hit before the collection ends, the page still reports
 * `hasMore` so the next page continues the scan from where it stopped.
 */
export async function searchPublicProperties(
  db: Pick<Firestore, "collection">,
  args: { q: string; sharing: string; type?: string; limit: number; cursor: string | null },
): Promise<PublicPropertiesPage> {
  let query = db.collection(PUBLIC_COLLECTION).where("listed", "==", true).orderBy(FieldPath.documentId());
  if (args.cursor !== null) query = query.startAfter(decodeCursor(args.cursor));
  const snap = await query.limit(SEARCH_SCAN_MAX).get();

  // The street address is read only to match against; it never leaves this function.
  const candidates = snap.docs.flatMap((d) => {
    const data = d.data();
    const item = toPublicProperty(d.id, data);
    const address = typeof data?.location === "string" ? data.location : null;
    return item ? [{ item, address }] : [];
  });
  const matches = filterBySharing(
    candidates.filter(({ item, address }) => matchesSearch(item, args.q, address) && (!args.type || item.propertyType === args.type)).map(({ item }) => item),
    args.sharing,
  );

  const items = matches.slice(0, args.limit);
  const scanTruncated = snap.docs.length === SEARCH_SCAN_MAX;
  if (matches.length > args.limit) return { items, hasMore: true, nextCursor: encodeCursor(items[items.length - 1].id) };
  if (scanTruncated) return { items, hasMore: true, nextCursor: encodeCursor(snap.docs[snap.docs.length - 1].id) };
  return { items, hasMore: false, nextCursor: null };
}
