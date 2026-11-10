import { safeDescription } from "./sanitize";
import { summarizeRooms, type RoomInput } from "./rooms";
import { isPropertyType, type PublicProperty } from "./types";

const MAX_PHOTOS = 8;
const MAX_AMENITIES = 20;
const MAX_SHORT_TEXT = 120;
const MAX_URL_LENGTH = 1000;

const text = (v: unknown, max = MAX_SHORT_TEXT): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t !== "" && t.length <= max ? t : null;
};


/** Only https URLs are published. */
const httpsUrl = (v: unknown): string | null => {
  const t = text(v, MAX_URL_LENGTH);
  if (t === null) return null;
  try {
    return new URL(t).protocol === "https:" ? t : null;
  } catch {
    return null;
  }
};

function isoOf(v: unknown): string | null {
  const date = typeof (v as { toDate?: unknown } | null)?.toDate === "function" ? (v as { toDate: () => unknown }).toDate() : null;
  return date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
}

const list = <T>(v: unknown, pick: (item: unknown) => T | null, max: number): T[] =>
  Array.isArray(v) ? v.flatMap((item) => pick(item) ?? []).slice(0, max) : [];

/** Setup finished (a document without `setupStatus` predates the field and counts as ready) and not switched off. */
export const isListed = (data: Record<string, unknown>): boolean => (data.setupStatus ?? "ready") === "ready" && data.status !== "inactive";

const photoUrlsOf = (v: unknown): string[] => list(v, (p) => httpsUrl((p as { url?: unknown } | null)?.url), MAX_PHOTOS);

/**
 * Turns a `properties` document (plus its rooms, when they were read) into the public shape, or null
 * when the property must not be shown: a draft, switched off, or without a usable name. Every output
 * field is written explicitly from the allowlist; the document is never spread, so the owner, contact
 * details, street address, postal code, coordinates and house rules cannot pass through.
 */
export function toPublicProperty(id: string, data: Record<string, unknown> | undefined, rooms: readonly RoomInput[] = []): PublicProperty | null {
  if (!data || !isListed(data)) return null;
  const name = text(data.name);
  if (name === null) return null;

  const photos = photoUrlsOf(data.photos);
  const photoUrls = [...new Set([...photos, ...photoUrlsOf(data.roomPhotos)])].slice(0, MAX_PHOTOS);
  const { rentMinInr, rentMaxInr, sharingOptions, roomTypes } = summarizeRooms(rooms);

  return {
    id,
    name,
    propertyType: isPropertyType(data.propertyType) ? data.propertyType : null,
    city: text(data.city, 100),
    state: text(data.state, 100),
    description: safeDescription(data.description),
    coverUrl: photos[0] ?? photoUrls[0] ?? null,
    photoUrls,
    roomTypes,
    amenities: [...new Set(list(data.amenities, (a) => text(a, 40), MAX_AMENITIES))],
    rentMinInr,
    rentMaxInr,
    sharingOptions,
    updatedAt: isoOf(data.updatedAt),
  };
}
