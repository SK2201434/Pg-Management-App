import { collection, collectionGroup, doc, GeoPoint, getDoc, getDocs, query, where } from 'firebase/firestore';

import { getFirestoreDb } from '@/config/firebase';
import { classifyLoadError, describeLoadError } from '@/features/discovery/loadError';
import { parsePolicy } from '@/features/moveOut/moveOutModel';
import { parseRules } from '@/features/properties/houseRulesModel';
import { amenityLabel } from '@/features/properties/propertySetup';
import type { StayRoom, TenantStay } from '@/features/tenantHome/tenantHomeModel';

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

const isDenied = (error: unknown) => (error as { code?: unknown } | null)?.code === 'permission-denied';

/**
 * The signed-in tenant's current property. The only link from a tenant to a property is the
 * referral they joined with: `users/{uid}.referralCode` -> `referrals/{code}.propertyId`, confirmed
 * by their own `properties/{pid}/members/{uid}` record. Every read is of a document the rules let
 * this user read; nothing is listed or matched by name or phone. Network failures are thrown so the
 * screen can offer a retry; a denied read means the membership is gone.
 */
export async function fetchTenantStay(uid: string, knownPropertyIds: readonly string[] = []): Promise<TenantStay> {
  const db = getFirestoreDb();
  const user = await getDoc(doc(db, 'users', uid));
  const code = text(user.data()?.referralCode);
  // A tenant who joined with an invite code has a referral; one the owner added after approving a
  // stay request has an approved request instead.
  const requested = code === null ? await approvedRequestProperty(uid, knownPropertyIds) : null;
  if (code === null && requested === null) return { state: 'none' };

  try {
    let propertyId: string | null = requested;
    if (code !== null) {
      const referral = await getDoc(doc(db, 'referrals', code));
      propertyId = text(referral.data()?.propertyId);
    }
    if (propertyId === null) return { state: 'unavailable' };

    const member = await getDoc(doc(db, 'properties', propertyId, 'members', uid));
    // Approved, but the owner has not added them to the property yet: no stay so far (the request shows the status).
    if (!member.exists()) return requested !== null ? { state: 'none' } : { state: 'inactive' };
    if (member.data().status !== 'active') return { state: 'inactive' };

    const property = await getDoc(doc(db, 'properties', propertyId));
    if (!property.exists()) return { state: 'unavailable' };
    const data = property.data();
    if (data.status === 'inactive') return { state: 'inactive' };

    const room = await fetchOwnRoom(propertyId, uid);
    const ownerUid = text(member.data().ownerUid);
    if (ownerUid === null) return { state: 'unavailable' };
    const ms = (v: unknown) => (typeof (v as { toMillis?: unknown } | undefined)?.toMillis === 'function' ? (v as { toMillis: () => number }).toMillis() : null);
    return {
      state: 'active',
      propertyId,
      ownerUid,
      propertyName: text(data.name) ?? 'Your property',
      coverUrl: text((Array.isArray(data.photos) ? (data.photos[0] as { url?: unknown } | undefined) : undefined)?.url),
      location: text(data.location),
      city: text(data.city),
      region: text(data.state),
      postalCode: text(data.postalCode),
      geo: data.geo instanceof GeoPoint ? { lat: data.geo.latitude, lng: data.geo.longitude } : null,
      contactName: text(data.contactName),
      contactPhone: text(data.contactPhone),
      joinedMs: ms(member.data().joinedAt),
      checkInMs: ms(member.data().checkInAt),
      checkOutMs: ms(member.data().checkOutAt),
      room,
      moveOutPolicy: parsePolicy(data.moveOutPolicy),
      houseRules: parseRules(data.houseRules),
      amenities: Array.isArray(data.amenities) ? data.amenities.flatMap((k) => (typeof k === 'string' ? [amenityLabel(k) ?? []].flat() : [])) : [],
    };
  } catch (error) {
    if (isDenied(error)) return { state: 'inactive' };
    throw error;
  }
}

/**
 * The tenant's room and bed, from the resident record the owner created for them. Nothing else is
 * read. A failure (for example the rules not yet allowing it) means the room is simply not shown.
 */
async function fetchOwnRoom(propertyId: string, uid: string): Promise<StayRoom | null> {
  try {
    const snap = await getDocs(query(collection(getFirestoreDb(), 'properties', propertyId, 'residents'), where('tenantUid', '==', uid)));
    const data = snap.docs.find((d) => d.data().status !== 'ended')?.data();
    const roomNumber = text(data?.roomNumber);
    if (!data || roomNumber === null) return null;
    return { roomNumber, bedLabel: text(data.bedLabel), sharing: typeof data.sharing === 'number' ? data.sharing : null, rentInr: typeof data.rentInr === 'number' && data.rentInr > 0 ? data.rentInr : null, depositCollectedInr: data.depositCollected === true && typeof data.depositInr === 'number' && data.depositInr > 0 ? data.depositInr : null };
  } catch (error) {
    if (__DEV__) console.warn('[tenant-stay] room lookup failed', JSON.stringify(describeLoadError(error)));
    return null;
  }
}

/**
 * The property the tenant was added to after an owner approved their stay request, or null. It is
 * found through the tenant's requests (a collection-group query), and also through the properties
 * this device knows they asked, so a missing rule or index never hides a real membership: the
 * membership document itself decides, and the caller reads it. Only a connection problem is thrown.
 */
async function approvedRequestProperty(uid: string, known: readonly string[]): Promise<string | null> {
  const db = getFirestoreDb();
  let candidates: string[] = [];
  // Memberships made without a stay request (an owner confirming a phone match) are found directly.
  let fromMembers: string[] = [];
  try {
    const snap = await getDocs(query(collectionGroup(db, 'members'), where('tenantUid', '==', uid)));
    fromMembers = snap.docs
      .filter((d) => d.data().status === 'active' && typeof d.data().propertyId === 'string')
      .map((d) => ({ id: d.data().propertyId as string, at: (d.data().joinedAt as { toMillis?: () => number } | undefined)?.toMillis?.() ?? 0 }))
      .sort((a, b) => b.at - a.at)
      .map((m) => m.id);
  } catch (error) {
    if (__DEV__) console.warn('[tenant-stay] membership lookup failed', JSON.stringify(describeLoadError(error)));
    if (classifyLoadError(error) === 'network') throw error;
  }
  try {
    const snap = await getDocs(query(collectionGroup(db, 'stayRequests'), where('tenantUid', '==', uid)));
    candidates = snap.docs
      .filter((d) => d.data().status === 'approved' && typeof d.data().propertyId === 'string')
      .map((d) => ({ id: d.data().propertyId as string, at: (d.data().updatedAt as { toMillis?: () => number } | undefined)?.toMillis?.() ?? 0 }))
      .sort((a, b) => b.at - a.at)
      .map((a) => a.id);
  } catch (error) {
    if (__DEV__) console.warn('[tenant-stay] approved-request lookup failed', JSON.stringify(describeLoadError(error)));
    if (classifyLoadError(error) === 'network') throw error;
  }
  for (const id of [...new Set([...fromMembers, ...candidates, ...known])]) {
    try {
      if ((await getDoc(doc(db, 'properties', id, 'members', uid))).exists()) return id;
    } catch (error) {
      if (classifyLoadError(error) === 'network') throw error;
    }
  }
  return null;
}
