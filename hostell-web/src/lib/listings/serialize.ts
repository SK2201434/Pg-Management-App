import { safeDescription } from "./sanitize";
import { isPropertyType, type PublicProperty, type PublicRoomType } from "./types";

const MAX_PHOTOS = 8;
const MAX_AMENITIES = 20;
const MAX_ROOM_TYPES = 12;
const MAX_SHARING_OPTIONS = 12;
const MAX_SHORT_TEXT = 120;
const MAX_URL_LENGTH = 1000;

const text = (v: unknown, max = MAX_SHORT_TEXT): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t !== "" && t.length <= max ? t : null;
};

const int = (v: unknown): number | null => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : null);

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

function roomType(v: unknown): PublicRoomType[] {
  if (typeof v !== "object" || v === null) return [];
  const t = v as Record<string, unknown>;
  const sharing = int(t.sharing);
  if (sharing === null || sharing < 1) return [];
  return [
    {
      sharing,
      rooms: int(t.rooms) ?? 0,
      bedsTotal: int(t.bedsTotal) ?? 0,
      bedsAvailable: int(t.bedsAvailable) ?? 0,
      rentMinInr: int(t.rentMinInr),
      rentMaxInr: int(t.rentMaxInr),
      acRooms: int(t.acRooms) ?? 0,
    },
  ];
}

function isoOf(v: unknown): string | null {
  const date = typeof (v as { toDate?: unknown } | null)?.toDate === "function" ? (v as { toDate: () => unknown }).toDate() : null;
  return date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
}

const list = <T>(v: unknown, pick: (item: unknown) => T | null, max: number): T[] =>
  Array.isArray(v) ? v.flatMap((item) => pick(item) ?? []).slice(0, max) : [];

const sharing = (n: unknown): number | null => (int(n) !== null && (n as number) >= 1 ? (n as number) : null);

/**
 * Turns a `publicListings` document into the public shape, or null when the document must not be
 * shown: not `listed === true`, or no usable name. Every output field is written explicitly from the
 * allowlist; the document is never spread.
 */
export function toPublicProperty(id: string, data: Record<string, unknown> | undefined): PublicProperty | null {
  if (!data || data.listed !== true) return null;
  const name = text(data.name);
  if (name === null) return null;

  const photoUrls = [...new Set(list(data.photoUrls, httpsUrl, MAX_PHOTOS))];

  return {
    id,
    name,
    propertyType: isPropertyType(data.propertyType) ? data.propertyType : null,
    city: text(data.city, 100),
    state: text(data.state, 100),
    description: safeDescription(data.description),
    coverUrl: httpsUrl(data.coverUrl) ?? photoUrls[0] ?? null,
    photoUrls,
    roomTypes: Array.isArray(data.roomTypes) ? data.roomTypes.flatMap(roomType).slice(0, MAX_ROOM_TYPES) : [],
    amenities: [...new Set(list(data.amenities, (a) => text(a, 40), MAX_AMENITIES))],
    rentMinInr: int(data.rentMinInr),
    rentMaxInr: int(data.rentMaxInr),
    sharingOptions: [...new Set(list(data.sharingOptions, sharing, MAX_SHARING_OPTIONS))].sort((a, b) => a - b),
    updatedAt: isoOf(data.updatedAt),
  };
}
