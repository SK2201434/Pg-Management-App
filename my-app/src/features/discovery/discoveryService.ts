import { collection, doc, documentId, getDoc, getDocs, limit, orderBy, query, startAfter, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';

import { getFirestoreDb } from '@/config/firebase';
import { MAX_LISTING_PHOTOS, PAGE_SIZE, isListable, roomTypesOf, type Listing, type StayRequest, type StayRequestStatus } from '@/features/discovery/discoveryModel';
import { classifyLoadError, describeLoadError } from '@/features/discovery/loadError';
import { parseRules } from '@/features/properties/houseRulesModel';
import { isPropertyType } from '@/features/properties/propertySetup';

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const int = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** A room as tenants see it. `beds` is empty when only the room documents were read (the list). */
type BrowseRoom = { sharing: number; ac: boolean; rentPerBedInr: number | null; beds: { status: string; occupant: string | null }[] };

const urlsOf = (v: unknown): string[] => (Array.isArray(v) ? (v as { url?: unknown }[]).flatMap((x) => (typeof x?.url === 'string' && x.url.startsWith('https://') ? [x.url] : [])) : []);

/**
 * A browsable listing, built straight from the `properties/{id}` document and its rooms. There is no
 * separate published copy: what the owner edits is what tenants see. `withBeds` means the beds were
 * read, so per-sharing availability is real; otherwise only sharing options and the rent range are known.
 */
function toListing(id: string, data: Record<string, unknown>, rooms: readonly BrowseRoom[], withBeds: boolean): Listing | null {
  const name = text(data.name);
  const ownerUid = text(data.ownerUid);
  if (name === null || ownerUid === null) return null;
  const photos = urlsOf(data.photos);
  const photoUrls = [...new Set([...photos, ...urlsOf(data.roomPhotos)])].slice(0, MAX_LISTING_PHOTOS);
  const rents = rooms.map((r) => r.rentPerBedInr).filter((r): r is number => r !== null);
  return {
    id,
    ownerUid,
    name,
    propertyType: isPropertyType(data.propertyType) ? data.propertyType : null,
    location: text(data.location),
    city: text(data.city),
    state: text(data.state),
    postalCode: text(data.postalCode),
    description: text(data.description),
    coverUrl: photos[0] ?? photoUrls[0] ?? null,
    photoUrls,
    roomTypes: withBeds ? roomTypesOf(rooms) : [],
    amenities: Array.isArray(data.amenities) ? data.amenities.filter((k): k is string => typeof k === 'string') : [],
    // Availability is read live, so there is no "as of" date to show.
    updatedMs: null,
    rentMinInr: rents.length ? Math.min(...rents) : null,
    rentMaxInr: rents.length ? Math.max(...rents) : null,
    sharingOptions: [...new Set(rooms.map((r) => r.sharing).filter((n) => n > 0))].sort((a, b) => a - b),
    contactName: text(data.contactName),
    contactPhone: text(data.contactPhone),
    houseRules: parseRules(data.houseRules),
  };
}

const toBrowseRoom = (d: Record<string, unknown>, beds: BrowseRoom['beds']): BrowseRoom => ({
  sharing: int(d.sharing) ?? 0,
  ac: d.ac === true,
  rentPerBedInr: int(d.rentPerBedInr),
  beds,
});

/**
 * The rooms of a property (and, when asked, their beds), read as a tenant. A bed counts as taken when
 * the owner blocked it or its `occupied` flag is set (written with the bed claim); tenants cannot read
 * the claims themselves, which name the residents.
 */
async function fetchBrowseRooms(propertyId: string, withBeds: boolean): Promise<BrowseRoom[]> {
  const db = getFirestoreDb();
  const rooms = await getDocs(collection(db, 'properties', propertyId, 'rooms'));
  return Promise.all(
    rooms.docs.map(async (r) => {
      const d = r.data() as Record<string, unknown>;
      if (!withBeds) return toBrowseRoom(d, []);
      const beds = await getDocs(collection(db, 'properties', propertyId, 'rooms', r.id, 'beds'));
      return toBrowseRoom(d, beds.docs.map((b) => ({ status: b.data().status === 'unavailable' ? 'unavailable' : 'available', occupant: b.data().occupied === true ? 'occupied' : null })));
    }),
  );
}

export type ListingsPage = { items: Listing[]; nextCursor: string | null };

/**
 * One page of browsable properties, in document-id order, read from `properties`. The
 * `setupStatus == 'ready'` filter is what the rules require for a list by a non-owner; ordering by id
 * needs no composite index. Switched-off properties are dropped here. One extra document is read to
 * know whether another page exists, and the last kept document's id is the cursor for the next page.
 * Each property's rooms are read too (one query each) for the rent range and sharing options.
 */
export async function fetchListingsPage(cursor: string | null): Promise<ListingsPage> {
  let snap;
  try {
    snap = await getDocs(
      query(
        collection(getFirestoreDb(), 'properties'),
        where('setupStatus', '==', 'ready'),
        orderBy(documentId()),
        ...(cursor ? [startAfter(cursor)] : []),
        limit(PAGE_SIZE + 1),
      ),
    );
  } catch (error) {
    // The original error is rethrown unchanged; in development its code and message are logged.
    if (__DEV__) console.warn('[discovery] listings query failed', JSON.stringify(describeLoadError(error)));
    throw error;
  }
  const hasMore = snap.size > PAGE_SIZE;
  const docs = snap.docs.slice(0, PAGE_SIZE);
  const items = (
    await Promise.all(
      docs.map(async (d) => {
        const data = d.data() as Record<string, unknown>;
        if (!isListable(data)) return [];
        // A property whose rooms cannot be read is still shown, without rent or sharing.
        const rooms = await fetchBrowseRooms(d.id, false).catch((): BrowseRoom[] => []);
        const l = toListing(d.id, data, rooms, false);
        return l ? [l] : [];
      }),
    )
  ).flat();
  if (__DEV__) console.warn('[discovery] listings page', JSON.stringify({ returned: docs.length, usable: items.length, hasMore }));
  return { items, nextCursor: hasMore ? docs[docs.length - 1].id : null };
}

/** One browsable property with its rooms and beds, or null when it does not exist or is not browsable. */
export async function fetchListing(propertyId: string): Promise<Listing | null> {
  let snap;
  try {
    snap = await getDoc(doc(getFirestoreDb(), 'properties', propertyId));
  } catch (error) {
    // The rules deny a read of a property that does not exist, is a draft or is switched off.
    if (classifyLoadError(error) === 'permission-denied') return null;
    throw error;
  }
  const data = snap.data();
  if (!snap.exists() || !data || !isListable(data)) return null;
  const rooms = await fetchBrowseRooms(propertyId, true);
  return toListing(snap.id, data, rooms, true);
}

const requestRef = (propertyId: string, tenantUid: string) => doc(getFirestoreDb(), 'properties', propertyId, 'stayRequests', tenantUid);

const STATUSES: readonly StayRequestStatus[] = ['pending', 'approved', 'rejected', 'withdrawn'];

/** The tenant's own request for a property, if any (the document id is their uid, so there is at most one). */
export async function fetchMyStayRequest(propertyId: string, tenantUid: string): Promise<StayRequest | null> {
  let snap;
  try {
    snap = await getDoc(requestRef(propertyId, tenantUid));
  } catch (error) {
    // The rules judge a request by its own fields, so reading one that does not exist is denied:
    // for the applicant's own id that means "no request yet".
    if (classifyLoadError(error) === 'permission-denied') return null;
    throw error;
  }
  if (!snap.exists()) return null;
  const data = snap.data();
  const updated = data.updatedAt as { toMillis?: () => number } | undefined;
  return { status: STATUSES.includes(data.status) ? data.status : 'pending', message: text(data.message), decidedMs: typeof updated?.toMillis === 'function' ? updated.toMillis() : null };
}

/** Sends a request, or re-sends one that was withdrawn, or one the owner declined at least a week ago. The rules allow nothing else. */
export async function sendStayRequest(args: { listing: Listing; tenantUid: string; tenantName: string; tenantPhone: string | null; tenantGender?: 'male' | 'female' | null; tenantEmail?: string | null; message: string; existing: StayRequest | null }): Promise<void> {
  const { listing, tenantUid, tenantName, tenantPhone, tenantGender, tenantEmail, existing } = args;
  const message = args.message.trim();
  const ref = requestRef(listing.id, tenantUid);
  if (existing?.status === 'withdrawn' || existing?.status === 'rejected') {
    await updateDoc(ref, { status: 'pending', message: message || null, updatedAt: serverTimestamp() });
    return;
  }
  await setDoc(ref, {
    tenantUid,
    ownerUid: listing.ownerUid,
    propertyId: listing.id,
    tenantName,
    ...(tenantPhone ? { tenantPhone } : {}),
    // Copied from the tenant's own profile so the owner can add them without editing their details.
    ...(tenantGender ? { tenantGender } : {}),
    ...(tenantEmail ? { tenantEmail } : {}),
    ...(message ? { message } : {}),
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function withdrawStayRequest(propertyId: string, tenantUid: string): Promise<void> {
  await updateDoc(requestRef(propertyId, tenantUid), { status: 'withdrawn', updatedAt: serverTimestamp() });
}
