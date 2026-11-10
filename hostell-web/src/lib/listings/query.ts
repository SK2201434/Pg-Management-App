import { FieldPath, type Firestore } from "firebase-admin/firestore";

import { decodeCursor, encodeCursor } from "./cursor";
import { filterBySharing, matchesSearch } from "./filter";
import { PUBLIC_COLLECTION } from "./collection";
import { fetchRooms } from "./rooms";
import { toPublicProperty } from "./serialize";
import { isPropertyType, type PublicProperty, type PublicPropertiesPage } from "./types";

export { PUBLIC_COLLECTION };

/** Properties whose rooms are read at the same time. */
const ROOM_BATCH = 12;

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

/** The id and last update of every browsable property (up to SITEMAP_MAX), reading only the fields needed to judge one. */
export async function fetchPublicPropertyIndex(
  db: Pick<Firestore, "collection">,
  max: number = SITEMAP_MAX,
): Promise<{ id: string; updatedAt: string | null }[]> {
  const snap = await db
    .collection(PUBLIC_COLLECTION)
    .orderBy(FieldPath.documentId())
    .select("setupStatus", "status", "name", "updatedAt")
    .limit(max)
    .get();
  return snap.docs.flatMap((d) => {
    const item = toPublicProperty(d.id, d.data());
    return item ? [{ id: item.id, updatedAt: item.updatedAt }] : [];
  });
}

/** Most reads one page may take to find enough browsable properties among drafts and switched-off ones. */
const MAX_SCAN_ROUNDS = 5;

/**
 * One page of browsable properties in document-id order, read from `properties` (drafts and switched-off
 * properties are skipped, and reading continues past them so a page is still full). Document id is the
 * one ordering every document has, is unique, and never changes, so pages cannot repeat or skip an item
 * even when `updatedAt` is missing or properties change between requests. One extra browsable property
 * is found to know whether another page exists. Only the properties shown have their rooms read, for
 * their rent range and sharing options.
 */
export async function fetchPublicProperties(
  db: Pick<Firestore, "collection">,
  args: { limit: number; cursor: string | null },
): Promise<PublicPropertiesPage> {
  let after = args.cursor !== null ? decodeCursor(args.cursor) : null;
  const usable: { id: string; data: Record<string, unknown> }[] = [];
  let exhausted = false;
  let lastScanned: string | null = null;
  for (let round = 0; round < MAX_SCAN_ROUNDS && usable.length <= args.limit && !exhausted; round += 1) {
    let query = db.collection(PUBLIC_COLLECTION).orderBy(FieldPath.documentId());
    if (after !== null) query = query.startAfter(after);
    const snap = await query.limit(args.limit + 1).get();
    exhausted = snap.docs.length < args.limit + 1;
    for (const d of snap.docs) {
      const data = d.data();
      if (toPublicProperty(d.id, data) !== null) usable.push({ id: d.id, data });
    }
    if (snap.docs.length > 0) lastScanned = snap.docs[snap.docs.length - 1].id;
    after = lastScanned;
  }

  const page = usable.slice(0, args.limit);
  const shown = await Promise.all(page.map((p) => withRooms(db, p.id, p.data)));
  const items = shown.flatMap((item) => (item ? [item] : []));
  // More follows when another browsable property was found, or the scan stopped before the end.
  if (usable.length > args.limit) return { items, hasMore: true, nextCursor: encodeCursor(page[page.length - 1].id) };
  if (!exhausted && lastScanned !== null) return { items, hasMore: true, nextCursor: encodeCursor(lastScanned) };
  return { items, hasMore: false, nextCursor: null };
}

/** A property with its rooms, or null when it must not be shown. A rooms failure leaves it without rent or sharing rather than hiding it. */
async function withRooms(db: Pick<Firestore, "collection">, id: string, data: Record<string, unknown>): Promise<PublicProperty | null> {
  if (toPublicProperty(id, data) === null) return null;
  const rooms = await fetchRooms(db, id, false).catch(() => []);
  return toPublicProperty(id, data, rooms);
}

/**
 * One page of browsable properties matching a text query (name, address, city or state), a sharing filter and/or a property type,
 * in document-id order with the same cursor as `fetchPublicProperties`. Reads at most SEARCH_SCAN_MAX
 * documents after the cursor; if that limit is hit before the collection ends, the page still reports
 * `hasMore` so the next page continues the scan from where it stopped. Rooms (needed for the sharing
 * filter and the rent range) are read only for properties that match the text and type, a few at a time,
 * and only until the page is full.
 */
export async function searchPublicProperties(
  db: Pick<Firestore, "collection">,
  args: { q: string; sharing: string; type?: string; limit: number; cursor: string | null },
): Promise<PublicPropertiesPage> {
  let query = db.collection(PUBLIC_COLLECTION).orderBy(FieldPath.documentId());
  if (args.cursor !== null) query = query.startAfter(decodeCursor(args.cursor));
  const snap = await query.limit(SEARCH_SCAN_MAX).get();

  // The street address is read only to match against; it never leaves this function.
  const candidates = snap.docs.flatMap((d) => {
    const data = d.data();
    const item = toPublicProperty(d.id, data);
    const address = typeof data?.location === "string" ? data.location : null;
    return item && matchesSearch(item, args.q, address) && (!args.type || item.propertyType === args.type) ? [{ id: d.id, data }] : [];
  });

  const matches: PublicProperty[] = [];
  for (let i = 0; i < candidates.length && matches.length <= args.limit; i += ROOM_BATCH) {
    const batch = await Promise.all(candidates.slice(i, i + ROOM_BATCH).map((c) => withRooms(db, c.id, c.data)));
    matches.push(...filterBySharing(batch.flatMap((item) => (item ? [item] : [])), args.sharing));
  }

  const items = matches.slice(0, args.limit);
  const scanTruncated = snap.docs.length === SEARCH_SCAN_MAX;
  if (matches.length > args.limit) return { items, hasMore: true, nextCursor: encodeCursor(items[items.length - 1].id) };
  if (scanTruncated) return { items, hasMore: true, nextCursor: encodeCursor(snap.docs[snap.docs.length - 1].id) };
  return { items, hasMore: false, nextCursor: null };
}
