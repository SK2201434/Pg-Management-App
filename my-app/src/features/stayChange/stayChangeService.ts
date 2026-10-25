import { doc, getDoc, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';

import { getFirestoreDb } from '@/config/firebase';
import { classifyLoadError } from '@/features/discovery/loadError';
import { STAY_CHANGE_STATUSES, type BedChoice, type StayChange } from '@/features/stayChange/stayChangeModel';

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const millis = (v: unknown): number | null => (typeof (v as { toMillis?: unknown } | null)?.toMillis === 'function' ? (v as { toMillis: () => number }).toMillis() : null);

const changeRef = (propertyId: string, tenantUid: string) => doc(getFirestoreDb(), 'properties', propertyId, 'stayChanges', tenantUid);

function toChange(propertyId: string, tenantUid: string, data: Record<string, unknown>): StayChange | null {
  const status = STAY_CHANGE_STATUSES.find((s) => s === data.status);
  const residentId = text(data.residentId);
  const toRoomId = text(data.toRoomId);
  const toBedId = text(data.toBedId);
  const toRoomNumber = text(data.toRoomNumber);
  const toBedLabel = text(data.toBedLabel);
  if (!status || !residentId || !toRoomId || !toBedId || !toRoomNumber || !toBedLabel || typeof data.toSharing !== 'number') return null;
  return {
    propertyId,
    tenantUid,
    residentId,
    fromRoomNumber: text(data.fromRoomNumber) ?? '',
    fromBedLabel: text(data.fromBedLabel),
    toRoomId,
    toBedId,
    toRoomNumber,
    toBedLabel,
    toSharing: data.toSharing,
    toRentInr: typeof data.toRentInr === 'number' ? data.toRentInr : null,
    status,
    createdMs: millis(data.createdAt),
    updatedMs: millis(data.updatedAt),
  };
}

/** The proposal for a tenant (owner or tenant side), if any. */
export async function fetchStayChange(propertyId: string, tenantUid: string): Promise<StayChange | null> {
  let snap;
  try {
    snap = await getDoc(changeRef(propertyId, tenantUid));
  } catch (error) {
    // The rules judge a proposal by its own fields, so reading one that does not exist is denied:
    // that means "no proposal yet".
    if (classifyLoadError(error) === 'permission-denied') return null;
    throw error;
  }
  return snap.exists() ? toChange(propertyId, tenantUid, snap.data()) : null;
}

/** The owner proposes moving a tenant to a free bed. A finished earlier proposal is replaced. */
export async function proposeStayChange(args: {
  propertyId: string;
  ownerUid: string;
  tenantUid: string;
  residentId: string;
  from: { roomNumber: string; bedLabel: string | null };
  target: BedChoice;
}): Promise<void> {
  const { propertyId, ownerUid, tenantUid, residentId, from, target } = args;
  const fields = {
    residentId,
    fromRoomNumber: from.roomNumber,
    ...(from.bedLabel ? { fromBedLabel: from.bedLabel } : {}),
    toRoomId: target.roomId,
    toBedId: target.bedId,
    toRoomNumber: target.roomNumber,
    toBedLabel: target.bedLabel,
    toSharing: target.sharing,
    ...(target.rentInr !== null ? { toRentInr: target.rentInr } : {}),
    status: 'pending',
    updatedAt: serverTimestamp(),
  };
  // `setDoc` replaces the whole document, so a finished proposal's stale optional fields do not linger.
  await setDoc(changeRef(propertyId, tenantUid), { ...fields, ownerUid, tenantUid, propertyId, createdAt: serverTimestamp() });
}

export async function cancelStayChange(propertyId: string, tenantUid: string): Promise<void> {
  await updateDoc(changeRef(propertyId, tenantUid), { status: 'cancelled', updatedAt: serverTimestamp() });
}

/** The tenant's answer. */
export async function respondStayChange(propertyId: string, tenantUid: string, status: 'accepted' | 'declined'): Promise<void> {
  await updateDoc(changeRef(propertyId, tenantUid), { status, updatedAt: serverTimestamp() });
}

/**
 * Applies an ACCEPTED proposal: moves the resident to the new room and bed, releases the old bed and
 * claims the new one, and marks the proposal applied, all in one batch. The rules refuse it unless the
 * tenant has accepted, the new bed is free and the claim is made for this resident.
 */
export async function applyStayChange(change: StayChange, ownerUid: string): Promise<void> {
  const db = getFirestoreDb();
  const residentRef = doc(db, 'properties', change.propertyId, 'residents', change.residentId);
  const resident = await getDoc(residentRef);
  const data = resident.data();
  if (!resident.exists() || data?.ownerUid !== ownerUid) throw new Error('resident-not-found');
  const oldBedId = text(data.bedId);
  const name = text(data.name);
  if (!oldBedId || !name) throw new Error('resident-incomplete');

  const batch = writeBatch(db);
  batch.update(residentRef, {
    roomId: change.toRoomId,
    bedId: change.toBedId,
    roomNumber: change.toRoomNumber,
    bedLabel: change.toBedLabel,
    sharing: change.toSharing,
    ...(change.toRentInr !== null ? { rentInr: change.toRentInr } : {}),
    updatedAt: serverTimestamp(),
  });
  batch.delete(doc(db, 'properties', change.propertyId, 'bedAllocations', oldBedId));
  batch.set(doc(db, 'properties', change.propertyId, 'bedAllocations', change.toBedId), {
    ownerUid,
    propertyId: change.propertyId,
    roomId: change.toRoomId,
    bedId: change.toBedId,
    residentId: change.residentId,
    residentName: name,
    createdAt: serverTimestamp(),
  });
  batch.update(changeRef(change.propertyId, change.tenantUid), { status: 'applied', updatedAt: serverTimestamp() });
  await batch.commit();
}
