// Pure model of property discovery and stay requests. No React, no Firebase.
//
// Firestore shape (see firestore.rules):
//   properties/{propertyId}                     read directly by tenants once `setupStatus == 'ready'` and not switched off
//   properties/{pid}/rooms/{id}/beds/{id}       readable by tenants; a bed's `occupied` flag shows availability
//   properties/{pid}/stayRequests/{tenantUid}   one request per tenant per property: tenantUid, ownerUid, propertyId,
//                                               tenantName, tenantPhone?, message?, status, createdAt, updatedAt

import type { PropertyType } from '@/features/properties/propertySetup';

export type Listing = {
  id: string;
  ownerUid: string;
  name: string;
  /** One of PROPERTY_TYPES; null for listings published before the field existed. */
  propertyType: PropertyType | null;
  location: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  description: string | null;
  coverUrl: string | null;
  /** All the photos the owner published, in order (the cover is the first). Empty for older listings. */
  photoUrls: string[];
  rentMinInr: number | null;
  rentMaxInr: number | null;
  /** Per sharing type: rooms, beds, free beds and price, as of `updatedMs`. Empty for older listings. */
  roomTypes: RoomType[];
  /** Amenity keys the owner ticked (see AMENITIES in propertySetup). */
  amenities: string[];
  /** When the owner's app last refreshed this listing (so availability can be dated). */
  updatedMs: number | null;
  /** Distinct bed counts per room the owner offers (1 = single, 2 = double sharing...). */
  sharingOptions: number[];
  contactName: string | null;
  contactPhone: string | null;
  /** The owner's rules and regulations, in the owner's order. Empty for listings published before this existed. */
  houseRules: string[];
};

/** One sharing type of a property, e.g. all of its 2-sharing rooms. */
export type RoomType = {
  sharing: number;
  rooms: number;
  bedsTotal: number;
  bedsAvailable: number;
  rentMinInr: number | null;
  rentMaxInr: number | null;
  acRooms: number;
};

export const STAY_REQUEST_STATUSES = ['pending', 'approved', 'rejected', 'withdrawn'] as const;
export type StayRequestStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn';

export type StayRequest = {
  status: StayRequestStatus;
  message: string | null;
  /** When the request last changed (for a declined one: when the owner declined it). */
  decidedMs: number | null;
};

/** How long a tenant waits after an owner declines before they may ask the same property again. */
export const REREQUEST_WAIT_DAYS = 7;
const REREQUEST_WAIT_MS = REREQUEST_WAIT_DAYS * 86_400_000;

/** When a declined tenant may send a new request, or null when the request was not declined. */
export const requestAgainMs = (existing: StayRequest | null): number | null =>
  existing?.status === 'rejected' && existing.decidedMs !== null ? existing.decidedMs + REREQUEST_WAIT_MS : null;

export const MESSAGE_MAX = 300;
/** Most photos a listing carries (4 property photos + 4 room photos). */
export const MAX_LISTING_PHOTOS = 8;

export const addressOf = (l: Pick<Listing, 'location' | 'city' | 'state' | 'postalCode'>): string | null => {
  const text = [l.location, l.city, [l.state, l.postalCode].filter(Boolean).join(' ')].filter((p) => p && p.trim()).join(', ');
  return text === '' ? null : text;
};

/** Case-insensitive match of the query on name, city, locality/address and state. An empty query matches all. */
export function filterListings(items: readonly Listing[], query: string): Listing[] {
  const q = query.trim().toLowerCase();
  if (q === '') return [...items];
  return items.filter((l) => [l.name, l.location, l.city, l.state, l.postalCode].some((f) => f?.toLowerCase().includes(q)));
}

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

/** "₹4,000 – ₹6,500 / month", a single price, or null when no rent is configured. */
export function formatRentRange(min: number | null, max: number | null): string | null {
  if (min === null || max === null) return null;
  return `${min === max ? inr(min) : `${inr(min)} – ${inr(max)}`} / month`;
}

export const sharingLabel = (n: number): string => (n === 1 ? 'Single' : `${n}-sharing`);

export const sharingSummary = (options: readonly number[]): string | null =>
  options.length === 0 ? null : [...options].sort((a, b) => a - b).map(sharingLabel).join(' · ');

/** A bed is free when the owner has not blocked it and no resident holds it. */
export const isBedFree = (bed: { status: string; occupant: string | null }): boolean => bed.status === 'available' && bed.occupant === null;

/** Groups rooms by sharing type with real bed counts; types are in ascending order. */
export function roomTypesOf(rooms: readonly { sharing: number; ac: boolean; rentPerBedInr: number | null; beds: readonly { status: string; occupant: string | null }[] }[]): RoomType[] {
  const bySharing = new Map<number, RoomType>();
  for (const r of rooms) {
    const t = bySharing.get(r.sharing) ?? { sharing: r.sharing, rooms: 0, bedsTotal: 0, bedsAvailable: 0, rentMinInr: null, rentMaxInr: null, acRooms: 0 };
    t.rooms += 1;
    t.bedsTotal += r.beds.length;
    t.bedsAvailable += r.beds.filter(isBedFree).length;
    if (r.ac) t.acRooms += 1;
    if (r.rentPerBedInr !== null) {
      t.rentMinInr = t.rentMinInr === null ? r.rentPerBedInr : Math.min(t.rentMinInr, r.rentPerBedInr);
      t.rentMaxInr = t.rentMaxInr === null ? r.rentPerBedInr : Math.max(t.rentMaxInr, r.rentPerBedInr);
    }
    bySharing.set(r.sharing, t);
  }
  return [...bySharing.values()].sort((a, b) => a.sharing - b.sharing);
}

/** "AC", "Non-AC" or "AC & non-AC". */
export const acLabel = (t: Pick<RoomType, 'rooms' | 'acRooms'>): string => (t.acRooms === 0 ? 'Non-AC' : t.acRooms === t.rooms ? 'AC' : 'AC & non-AC');

/** Whether a property belongs in tenant discovery: finished setup and not switched off. */
export const isListable = (p: { status?: unknown; setupStatus?: unknown }): boolean => p.status !== 'inactive' && p.setupStatus !== 'draft';

export const REQUEST_LABEL: Record<StayRequestStatus, string> = {
  pending: 'Request sent',
  approved: 'Approved',
  rejected: 'Not accepted',
  withdrawn: 'Withdrawn',
};

/** Whether the tenant may send (or re-send) a request given the one they already have. */
export function canRequest(existing: StayRequest | null, nowMs: number): boolean {
  if (existing === null || existing.status === 'withdrawn') return true;
  const again = requestAgainMs(existing);
  return again !== null && nowMs >= again;
}

export const whatsAppUrl = (phone: string | null): string | null => {
  const digits = phone?.replace(/\D/g, '') ?? '';
  if (digits.length < 10) return null;
  // A bare 10-digit number is an Indian mobile: WhatsApp links need the country code.
  return `https://wa.me/${digits.length === 10 ? `91${digits}` : digits}`;
};

/** Listings loaded per page of the infinite list. */
export const PAGE_SIZE = 10;
/** While searching, at most this many pages are pulled in so the in-memory search stays bounded (10 x 10 = 100 listings). */
export const MAX_SEARCH_PAGES = 10;

/** Concatenates pages, dropping a listing that appears twice (e.g. when the list changed between pages). */
export function mergePages(pages: readonly { items: readonly Listing[] }[]): Listing[] {
  const seen = new Set<string>();
  return pages.flatMap((p) => p.items).filter((l) => !seen.has(l.id) && !!seen.add(l.id));
}

/**
 * Searching filters what is loaded, so while a search is typed the remaining pages are fetched (up
 * to MAX_SEARCH_PAGES) instead of waiting for the user to scroll to them.
 */
export const shouldLoadMoreForSearch = (a: { searching: boolean; hasNextPage: boolean; busy: boolean; failed: boolean; pagesLoaded: number }): boolean =>
  a.searching && a.hasNextPage && !a.busy && !a.failed && a.pagesLoaded < MAX_SEARCH_PAGES;

/** The photos to show: the published list, or just the cover for listings published before photos were added. */
export const galleryOf = (l: Pick<Listing, 'photoUrls' | 'coverUrl'>): string[] =>
  l.photoUrls.length > 0 ? l.photoUrls : l.coverUrl ? [l.coverUrl] : [];
