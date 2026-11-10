import {
  collection,
  doc,
  getDoc,
  getDocs,
  GeoPoint,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

import { getFirestoreDb } from '@/config/firebase';
import type { RoomWrite } from '@/features/properties/propertySetup';
import type { Property, PropertyDetail, PropertyStatus, PropertyTenant, PropertyRoom, RoomBed } from '@/features/properties/propertyTypes';

/** A failed property request, keeping the Firebase `code` (e.g. `permission-denied`). */
export class PropertyRequestError extends Error {
  constructor(
    readonly kind: 'permission-denied' | 'not-found' | 'unavailable' | 'duplicate-location' | 'unknown',
    readonly code: string | undefined,
    options?: { cause?: unknown },
  ) {
    super(`Property request failed (${code ?? kind}).`, options);
    this.name = 'PropertyRequestError';
  }
}

export function toRequestError(error: unknown): PropertyRequestError {
  const raw = (error as { code?: unknown } | null)?.code;
  const code = typeof raw === 'string' ? raw.replace(/^firestore\//, '') : undefined;
  const kind =
    code === 'permission-denied'
      ? 'permission-denied'
      : code === 'unavailable' || code === 'deadline-exceeded'
        ? 'unavailable'
        : 'unknown';
  return new PropertyRequestError(kind, code, { cause: error });
}

/** `photos[0].url` when the property has a usable first photo. */
/** Every usable https photo URL, in order. */
function allPhotoUrls(photos: unknown): string[] {
  return Array.isArray(photos)
    ? (photos as { url?: unknown }[]).flatMap((p) => (typeof p?.url === 'string' && p.url.startsWith('https://') ? [p.url] : []))
    : [];
}

function firstPhotoUrl(photos: unknown): string | null {
  const first = Array.isArray(photos) ? (photos[0] as { url?: unknown } | undefined) : undefined;
  return typeof first?.url === 'string' && first.url !== '' ? first.url : null;
}

/**
 * The owner's own properties. The `ownerUid` filter is required, not cosmetic: the Security Rules
 * only allow a list query that is constrained to the caller's own documents.
 */
export async function fetchOwnerProperties(ownerUid: string): Promise<Property[]> {
  try {
    const snapshot = await getDocs(
      query(collection(getFirestoreDb(), 'properties'), where('ownerUid', '==', ownerUid)),
    );
    return snapshot.docs
      .map((d) => {
        const data = d.data() as { name?: unknown; location?: unknown; setupStatus?: unknown; status?: unknown; geo?: unknown; photos?: unknown; createdAt?: unknown };
        const created = data.createdAt as { toMillis?: () => number } | undefined;
        return {
          id: d.id,
          ownerUid,
          createdMs: typeof created?.toMillis === 'function' ? created.toMillis() : null,
          name: typeof data.name === 'string' ? data.name : '',
          location:
            typeof data.location === 'string' && data.location.trim() ? data.location.trim() : null,
          // Documents from before drafts existed have no field and are complete.
          hasGeo: data.geo instanceof GeoPoint,
          coverUrl: firstPhotoUrl(data.photos),
          setupStatus: data.setupStatus === 'draft' ? ('draft' as const) : ('ready' as const),
          status: data.status === 'inactive' ? ('inactive' as const) : ('active' as const),
        };
      })
      .filter((p) => p.name !== '')
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    throw toRequestError(error);
  }
}

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

/**
 * One property of the signed-in owner. The rules also let a joined tenant read a property, so
 * ownership is checked here too: a property that belongs to someone else is `permission-denied`,
 * a missing document is `not-found`.
 */
export async function fetchPropertyDetail(propertyId: string, ownerUid: string): Promise<PropertyDetail> {
  let snapshot;
  try {
    snapshot = await getDoc(doc(getFirestoreDb(), 'properties', propertyId));
  } catch (error) {
    throw toRequestError(error);
  }
  if (!snapshot.exists()) throw new PropertyRequestError('not-found', 'not-found');
  const data = snapshot.data() as Record<string, unknown>;
  if (data.ownerUid !== ownerUid) throw new PropertyRequestError('permission-denied', 'permission-denied');
  return {
    id: snapshot.id,
    ownerUid,
    name: text(data.name) ?? 'Untitled property',
    location: text(data.location),
    setupStatus: data.setupStatus === 'draft' ? 'draft' : 'ready',
    status: data.status === 'inactive' ? 'inactive' : 'active',
    hasGeo: data.geo instanceof GeoPoint,
    coverUrl: firstPhotoUrl(data.photos),
    photoUrls: [...allPhotoUrls(data.photos), ...allPhotoUrls(data.roomPhotos)],
    description: text(data.description),
    city: text(data.city),
    state: text(data.state),
    postalCode: text(data.postalCode),
  };
}

/**
 * The property's rooms and, for each, the bed records under it. The rules allow no cross-room bed
 * query, so there is one bed query per room. Room/bed list queries must filter on `ownerUid`.
 */
/**
 * Which resident holds which bed: the property's `bedAllocations` claims, as bed id -> resident name.
 * If they cannot be read (e.g. the rules that define them are not deployed yet) no bed counts as
 * occupied rather than failing the whole room list.
 */
export async function fetchBedOccupants(propertyId: string, ownerUid: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  try {
    const snap = await getDocs(
      query(collection(getFirestoreDb(), 'properties', propertyId, 'bedAllocations'), where('ownerUid', '==', ownerUid)),
    );
    for (const d of snap.docs) {
      const data = d.data() as Record<string, unknown>;
      if (data.propertyId === propertyId) out.set(d.id, text(data.residentName) ?? 'Resident');
    }
  } catch {
    // See above.
  }
  return out;
}

export async function fetchPropertyRooms(propertyId: string, ownerUid: string): Promise<PropertyRoom[]> {
  try {
    const db = getFirestoreDb();
    const rooms = await getDocs(
      query(collection(db, 'properties', propertyId, 'rooms'), where('ownerUid', '==', ownerUid)),
    );
    const occupants = await fetchBedOccupants(propertyId, ownerUid);
    return await Promise.all(
      // Belt and braces: the path already scopes to this property; also require the stored propertyId.
      rooms.docs.filter((r) => r.data().propertyId === propertyId).map(async (r): Promise<PropertyRoom> => {
        const d = r.data() as Record<string, unknown>;
        const beds = await getDocs(
          query(collection(db, 'properties', propertyId, 'rooms', r.id, 'beds'), where('ownerUid', '==', ownerUid)),
        );
        return {
          id: r.id,
          roomNumber: text(d.roomNumber) ?? r.id,
          floor: typeof d.floor === 'number' ? d.floor : null,
          sharing: typeof d.sharing === 'number' ? d.sharing : 0,
          ac: d.ac === true,
          rentPerBedInr: typeof d.rentPerBedInr === 'number' ? d.rentPerBedInr : null,
          beds: beds.docs.filter((b) => b.data().propertyId === propertyId).map((b): RoomBed => {
            const bd = b.data() as Record<string, unknown>;
            return {
              id: b.id,
              label: text(bd.label) ?? b.id,
              status: bd.status === 'unavailable' ? 'unavailable' : 'available',
              occupant: occupants.get(b.id) ?? null,
            };
          }),
        };
      }),
    );
  } catch (error) {
    throw toRequestError(error);
  }
}

/**
 * Makes every bed's `occupied` flag match the property's bed claims. New claims set the flag in the
 * same batch (see residentService); this repairs beds claimed before the flag existed. Best effort:
 * a failure is logged in development and never thrown.
 */
export async function syncBedOccupancy(ownerUid: string, propertyIds: readonly string[]): Promise<void> {
  const db = getFirestoreDb();
  for (const propertyId of propertyIds) {
    try {
      const claimed = await fetchBedOccupants(propertyId, ownerUid);
      const rooms = await getDocs(query(collection(db, 'properties', propertyId, 'rooms'), where('ownerUid', '==', ownerUid)));
      let batch = writeBatch(db);
      let pending = 0;
      for (const room of rooms.docs) {
        const beds = await getDocs(query(collection(room.ref, 'beds'), where('ownerUid', '==', ownerUid)));
        for (const bed of beds.docs) {
          if ((bed.data().occupied === true) === claimed.has(bed.id)) continue;
          batch.update(bed.ref, { occupied: claimed.has(bed.id), updatedAt: serverTimestamp() });
          pending += 1;
          if (pending >= 400) {
            await batch.commit();
            batch = writeBatch(db);
            pending = 0;
          }
        }
      }
      if (pending > 0) await batch.commit();
    } catch (error) {
      if (__DEV__) console.warn('[bed-occupancy] sync failed', (error as { code?: unknown } | null)?.code);
    }
  }
}

/**
 * The tenants who joined this property. The collection path is the property scope; the `ownerUid`
 * filter is what the rules require for a list, and `propertyId` is checked again on each document.
 */
export async function fetchPropertyTenants(propertyId: string, ownerUid: string): Promise<PropertyTenant[]> {
  try {
    const snapshot = await getDocs(
      query(collection(getFirestoreDb(), 'properties', propertyId, 'members'), where('ownerUid', '==', ownerUid)),
    );
    const residents = await fetchResidents(propertyId, ownerUid);
    // A tenant added from a stay request is both a member and a resident: list the resident (it has the bed).
    const linked = new Set(residents.flatMap((r) => (r.linkedTenantUid ? [r.linkedTenantUid] : [])));
    const joined = snapshot.docs
      .filter((d) => d.data().propertyId === propertyId && !linked.has(d.id))
      .map((d): PropertyTenant => {
        const data = d.data() as Record<string, unknown>;
        const at = data.joinedAt as { toMillis?: () => number } | undefined;
        return {
          tenantUid: d.id,
          name: text(data.displayName) ?? 'Tenant',
          status: data.status === 'active' ? 'active' : 'inactive',
          joinedAtMs: typeof at?.toMillis === 'function' ? at.toMillis() : null,
          source: 'joined',
          accountUid: d.id,
          roomNumber: null,
          bedLabel: null,
          sharing: null,
          rentInr: null,
        };
      });
    return [...joined, ...residents].sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    throw toRequestError(error);
  }
}

/** Tenants the owner added by hand (`residents`). Unreadable (rules not deployed yet) means none. */
async function fetchResidents(propertyId: string, ownerUid: string): Promise<(PropertyTenant & { linkedTenantUid?: string })[]> {
  try {
    const snap = await getDocs(
      query(collection(getFirestoreDb(), 'properties', propertyId, 'residents'), where('ownerUid', '==', ownerUid)),
    );
    return snap.docs
      .filter((d) => d.data().propertyId === propertyId)
      .map((d): PropertyTenant & { linkedTenantUid?: string } => {
        const data = d.data() as Record<string, unknown>;
        const moved = data.moveInDate as { toMillis?: () => number } | undefined;
        return {
          tenantUid: d.id,
          name: text(data.name) ?? 'Tenant',
          status: data.status === 'active' ? 'active' : 'inactive',
          joinedAtMs: typeof moved?.toMillis === 'function' ? moved.toMillis() : null,
          source: 'added',
          roomNumber: text(data.roomNumber),
          bedLabel: text(data.bedLabel),
          sharing: typeof data.sharing === 'number' ? data.sharing : null,
          rentInr: typeof data.rentInr === 'number' ? data.rentInr : null,
          ...(typeof data.tenantUid === 'string' ? { linkedTenantUid: data.tenantUid, accountUid: data.tenantUid } : {}),
        };
      });
  } catch {
    return [];
  }
}

/** Switches a property active/inactive. Owner-only, enforced by the rules (which must allow `status`). */
export async function setPropertyStatus(propertyId: string, status: PropertyStatus): Promise<void> {
  try {
    await updateDoc(doc(getFirestoreDb(), 'properties', propertyId), { status, updatedAt: serverTimestamp() });
  } catch (error) {
    throw toRequestError(error);
  }
}

/**
 * Creates one room and its beds in a single batch, so there is never a room without its beds or the
 * reverse. The ids come from the draft, so retrying the same write overwrites instead of duplicating.
 * Beds are always created `available`; the rules reject anything else.
 */
export async function createRoomWithBeds(propertyId: string, ownerUid: string, write: RoomWrite): Promise<void> {
  try {
    const db = getFirestoreDb();
    const batch = writeBatch(db);
    const roomRef = doc(db, 'properties', propertyId, 'rooms', write.roomId);
    batch.set(roomRef, { ownerUid, propertyId, ...write.room, updatedAt: serverTimestamp() });
    for (const bed of write.beds) {
      batch.set(doc(roomRef, 'beds', bed.id), {
        ownerUid,
        propertyId,
        roomId: write.roomId,
        ...bed.data,
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (error) {
    throw toRequestError(error);
  }
}

/** Stores the property's coordinates (a Firestore GeoPoint). Owner-only, enforced by the rules. */
export async function setPropertyGeo(
  propertyId: string,
  coordinates: { latitude: number; longitude: number },
): Promise<void> {
  try {
    await updateDoc(doc(getFirestoreDb(), 'properties', propertyId), {
      geo: new GeoPoint(coordinates.latitude, coordinates.longitude),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw toRequestError(error);
  }
}

/** True when the save failed because another property already holds this location. */
export const isDuplicateLocationError = (error: unknown): boolean => error instanceof PropertyRequestError && error.kind === 'duplicate-location';

/** User-facing text for a failed property request. */
export function getPropertyErrorMessage(error: unknown): string {
  const kind = error instanceof PropertyRequestError ? error.kind : 'unknown';
  switch (kind) {
    case 'permission-denied':
      return 'HOSTELL is not allowed to access your properties. Sign out and in again; if it continues, contact support.';
    case 'not-found':
      return 'This property no longer exists.';
    case 'duplicate-location':
      return 'A property already exists at this location. Check the address, or the location you captured, and try again.';
    case 'unavailable':
      return 'Could not reach the database. Check your connection and try again.';
    default:
      return 'Something went wrong. Please try again.';
  }
}
