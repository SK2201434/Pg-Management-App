import { isPropertyType, type PublicProperty, type PublicPropertiesPage, type PublicRoomType } from "./types";

export const PAGE_SIZE = 12;

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.flatMap((x) => str(x) ?? []) : []);

function roomType(v: unknown): PublicRoomType[] {
  if (typeof v !== "object" || v === null) return [];
  const r = v as Record<string, unknown>;
  const sharing = num(r.sharing);
  if (sharing === null || sharing < 1) return [];
  return [
    {
      sharing,
      rooms: num(r.rooms) ?? 0,
      bedsTotal: num(r.bedsTotal) ?? 0,
      bedsAvailable: num(r.bedsAvailable) ?? 0,
      rentMinInr: num(r.rentMinInr),
      rentMaxInr: num(r.rentMaxInr),
      acRooms: num(r.acRooms) ?? 0,
    },
  ];
}

/** Defensively rebuilds a property from untrusted JSON; null when it lacks an id or name. */
export function normalizeProperty(v: unknown): PublicProperty | null {
  if (typeof v !== "object" || v === null) return null;
  const p = v as Record<string, unknown>;
  const id = str(p.id);
  const name = str(p.name);
  if (id === null || name === null) return null;
  return {
    id,
    name,
    propertyType: isPropertyType(p.propertyType) ? p.propertyType : null,
    city: str(p.city),
    state: str(p.state),
    description: null,
    coverUrl: str(p.coverUrl),
    photoUrls: strings(p.photoUrls),
    roomTypes: Array.isArray(p.roomTypes) ? p.roomTypes.flatMap(roomType) : [],
    amenities: strings(p.amenities),
    rentMinInr: num(p.rentMinInr),
    rentMaxInr: num(p.rentMaxInr),
    sharingOptions: Array.isArray(p.sharingOptions)
      ? [...new Set(p.sharingOptions.filter((n): n is number => typeof n === "number" && Number.isInteger(n) && n >= 1))].sort((a, b) => a - b)
      : [],
    updatedAt: str(p.updatedAt),
  };
}

export function parsePage(json: unknown): PublicPropertiesPage {
  if (typeof json !== "object" || json === null || !Array.isArray((json as { items?: unknown }).items)) {
    throw new Error("Unexpected response from the listings API.");
  }
  const j = json as { items: unknown[]; nextCursor?: unknown; hasMore?: unknown };
  const nextCursor = str(j.nextCursor);
  return {
    items: j.items.flatMap((i) => normalizeProperty(i) ?? []),
    nextCursor,
    hasMore: j.hasMore === true && nextCursor !== null,
  };
}

/** Fetches one page from the public API. Throws on network, HTTP or shape errors. */
export async function fetchPropertiesPage(
  opts: { cursor?: string | null; q?: string; sharing?: string; type?: string; signal?: AbortSignal } = {},
): Promise<PublicPropertiesPage> {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
  if (opts.cursor) params.set("cursor", opts.cursor);
  if (opts.q) params.set("q", opts.q);
  if (opts.sharing) params.set("sharing", opts.sharing);
  if (opts.type) params.set("type", opts.type);
  const res = await fetch(`/api/public/properties?${params}`, { signal: opts.signal, headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Listings request failed (${res.status}).`);
  return parsePage(await res.json());
}
