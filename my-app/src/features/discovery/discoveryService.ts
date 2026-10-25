import { GeoPoint, collection, deleteDoc, doc, documentId, getDoc, getDocs, limit, orderBy, query, startAfter, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';

import { getFirestoreDb } from '@/config/firebase';
import { PAGE_SIZE, buildListing, isListable, type Listing, type RoomType, type StayRequest, type StayRequestStatus } from '@/features/discovery/discoveryModel';
import { classifyLoadError, describeLoadError } from '@/features/discovery/loadError';
import { claimLocationLocks } from '@/features/properties/propertyLocationService';
import { fetchPropertyRooms } from '@/features/properties/propertyService';


const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const int = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function toRoomType(v: unknown): RoomType[] {
  const t = v as Record<string, unknown> | null;
  const sharing = int(t?.sharing);
  if (!t || sharing === null) return [];
  return [{ sharing, rooms: int(t.rooms) ?? 0, bedsTotal: int(t.bedsTotal) ?? 0, bedsAvailable: int(t.bedsAvailable) ?? 0, rentMinInr: int(t.rentMinInr), rentMaxInr: int(t.rentMaxInr), acRooms: int(t.acRooms) ?? 0 }];
}

function toListing(id: string, data: Record<string, unknown>): Listing | null {
  const name = text(data.name);
  const ownerUid = text(data.ownerUid);
  if (name === null || ownerUid === null) return null;
  return {
    id,
    ownerUid,
    name,
    location: text(data.location),
    city: text(data.city),
    state: text(data.state),
    postalCode: text(data.postalCode),
    description: text(data.description),
    coverUrl: text(data.coverUrl),
    photoUrls: Array.isArray(data.photoUrls) ? data.photoUrls.filter((u): u is string => typeof u === 'string' && u.startsWith('https://')) : [],
    roomTypes: Array.isArray(data.roomTypes) ? data.roomTypes.flatMap(toRoomType) : [],
    amenities: Array.isArray(data.amenities) ? data.amenities.filter((k): k is string => typeof k === 'string') : [],
    updatedMs: typeof (data.updatedAt as { toMillis?: unknown } | undefined)?.toMillis === 'function' ? (data.updatedAt as { toMillis: () => number }).toMillis() : null,
    rentMinInr: int(data.rentMinInr),
    rentMaxInr: int(data.rentMaxInr),
    sharingOptions: Array.isArray(data.sharingOptions) ? data.sharingOptions.filter((n): n is number => typeof n === 'number') : [],
    contactName: text(data.contactName),
    contactPhone: text(data.contactPhone),
  };
}

export type ListingsPage = { items: Listing[]; nextCursor: string | null };

/**
 * One page of publicly listed properties, in document-id order. The `listed == true` filter is what
 * the rules require for a list; ordering by id needs no composite index. One extra document is read
 * to know whether another page exists, and the last kept document's id is the cursor for the next page.
 */
export async function fetchListingsPage(cursor: string | null): Promise<ListingsPage> {
  let snap;
  try {
    snap = await getDocs(
      query(
        collection(getFirestoreDb(), 'publicListings'),
        where('listed', '==', true),
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
  const items = docs.flatMap((d) => {
    const l = toListing(d.id, d.data());
    return l ? [l] : [];
  });
  if (__DEV__) console.warn('[discovery] listings page', JSON.stringify({ returned: docs.length, usable: items.length, hasMore }));
  return { items, nextCursor: hasMore ? docs[docs.length - 1].id : null };
}

/** One listing, or null when it does not exist or is not listed. */
export async function fetchListing(propertyId: string): Promise<Listing | null> {
  let snap;
  try {
    snap = await getDoc(doc(getFirestoreDb(), 'publicListings', propertyId));
  } catch (error) {
    // The rules deny a read of a listing that does not exist or is not listed: it is just not available.
    if (classifyLoadError(error) === 'permission-denied') return null;
    throw error;
  }
  const data = snap.data();
  return snap.exists() && data?.listed === true ? toListing(snap.id, data) : null;
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
  return { status: STATUSES.includes(data.status) ? data.status : 'pending', message: text(data.message) };
}

/** Sends a request, or re-sends one that was withdrawn. The rules allow nothing else. */
export async function sendStayRequest(args: { listing: Listing; tenantUid: string; tenantName: string; tenantPhone: string | null; tenantGender?: 'male' | 'female' | null; tenantEmail?: string | null; message: string; existing: StayRequest | null }): Promise<void> {
  const { listing, tenantUid, tenantName, tenantPhone, tenantGender, tenantEmail, existing } = args;
  const message = args.message.trim();
  const ref = requestRef(listing.id, tenantUid);
  if (existing?.status === 'withdrawn') {
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

/**
 * Owner side: publishes (or refreshes) the property's public listing from its own data. Only values
 * the owner has configured are copied, and the contact only when `shareContact` is true. No owner
 * screen calls this yet (see the final report).
 */
export async function publishListing(propertyId: string, ownerUid: string, shareContact: boolean): Promise<void> {
  const db = getFirestoreDb();
  const snap = await getDoc(doc(db, 'properties', propertyId));
  const data = snap.data();
  if (!snap.exists() || data?.ownerUid !== ownerUid) throw new Error('not-owner');
  const urlsOf = (v: unknown) => (Array.isArray(v) ? (v as { url?: unknown }[]).flatMap((x) => (text(x?.url) ? [text(x.url) as string] : [])) : []);
  const photos = [...urlsOf(data.photos), ...urlsOf(data.roomPhotos)];
  const rooms = await fetchPropertyRooms(propertyId, ownerUid);
  const listing = buildListing({
    property: {
      name: text(data.name) ?? 'Untitled property',
      location: text(data.location),
      city: text(data.city),
      state: text(data.state),
      postalCode: text(data.postalCode),
      description: text(data.description),
      coverUrl: photos[0] ?? null,
      photoUrls: photos,
      contactName: text(data.contactName),
      contactPhone: text(data.contactPhone),
    },
    rooms,
    amenities: Array.isArray(data.amenities) ? (data.amenities as unknown[]).filter((k): k is string => typeof k === 'string') : [],
    shareContact,
  });
  await setDoc(doc(db, 'publicListings', propertyId), { ...listing, ownerUid, propertyId, listed: true, updatedAt: serverTimestamp() });
}

export async function unpublishListing(propertyId: string): Promise<void> {
  await deleteDoc(doc(getFirestoreDb(), 'publicListings', propertyId));
}

const devWarn = (what: string, error: unknown) => {
  if (__DEV__) console.warn(`[discovery] ${what}`, JSON.stringify(describeLoadError(error)));
};

type OwnListings = Map<string, { sharesContact: boolean; hasRoomTypes: boolean }>;

/**
 * The owner's own listings, read with a query on `ownerUid`. A single-document read of a listing
 * that does not exist is denied by the rules (they look at `resource.data`, which is empty), so a
 * "does it exist?" check must be a query, which simply returns nothing.
 */
async function fetchOwnListings(ownerUid: string): Promise<OwnListings> {
  const snap = await getDocs(query(collection(getFirestoreDb(), 'publicListings'), where('ownerUid', '==', ownerUid)));
  return new Map(snap.docs.map((d) => [d.id, { sharesContact: text(d.data().contactPhone) !== null, hasRoomTypes: Array.isArray(d.data().roomTypes) }]));
}

export type SyncOutcome = 'listed' | 'unlisted' | 'skipped' | 'failed';

/**
 * Keeps the public listing in step with the property: a ready, active property is listed (with the
 * contact left private unless the listing already shared it); a draft or switched-off one is not.
 * Best effort: a failure never blocks the owner's own action, and is logged in development.
 */
export async function syncListing(propertyId: string, ownerUid: string, known?: OwnListings): Promise<SyncOutcome> {
  try {
    const db = getFirestoreDb();
    const [property, own] = await Promise.all([getDoc(doc(db, 'properties', propertyId)), known ?? fetchOwnListings(ownerUid)]);
    const data = property.data();
    if (!property.exists() || data?.ownerUid !== ownerUid) return 'skipped';
    // Properties created before location locks existed claim theirs now (best effort).
    void claimLocationLocks({ location: text(data.location), city: text(data.city), state: text(data.state), postalCode: text(data.postalCode), geo: data.geo instanceof GeoPoint ? data.geo : null }, propertyId);
    const existing = own.get(propertyId);
    if (isListable(data)) {
      // The owner's contact number is the property's public contact: tenants call it from the listing.
      await publishListing(propertyId, ownerUid, true);
      return 'listed';
    }
    if (existing) await unpublishListing(propertyId);
    return existing ? 'unlisted' : 'skipped';
  } catch (error) {
    devWarn(`could not sync listing for ${propertyId}`, error);
    return 'failed';
  }
}

/** Lists the owner's existing properties that have no public listing yet (a one-time catch-up). */
export async function backfillListings(ownerUid: string, propertyIds: readonly string[]): Promise<void> {
  const counts: Record<SyncOutcome | 'alreadyListed', number> = { listed: 0, unlisted: 0, skipped: 0, failed: 0, alreadyListed: 0 };
  try {
    const own = await fetchOwnListings(ownerUid);
    for (const id of propertyIds) {
      // A listing published before bed availability existed is refreshed once to add it.
      if (own.get(id)?.hasRoomTypes) counts.alreadyListed += 1;
      else counts[await syncListing(id, ownerUid, own)] += 1;
    }
  } catch (error) {
    devWarn('could not read existing listings', error);
  }
  if (__DEV__) console.warn('[discovery] backfill', JSON.stringify({ properties: propertyIds.length, ...counts }));
}
