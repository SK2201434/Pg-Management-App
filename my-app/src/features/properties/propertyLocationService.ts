import { doc, getDoc, serverTimestamp, setDoc, type WriteBatch } from 'firebase/firestore';

import { getFirestoreDb } from '@/config/firebase';
import { locationCheckKeys, locationKeys, type LocationParts } from '@/features/properties/propertyLocation';

const lockRef = (key: string) => doc(getFirestoreDb(), 'propertyLocations', key);

/** Thrown when another property already holds this location. */
export class DuplicateLocationError extends Error {
  constructor() {
    super('A property already exists at this location.');
    this.name = 'DuplicateLocationError';
  }
}

/**
 * Throws DuplicateLocationError if any of the location's keys is held by a property other than
 * `propertyId`. Reading a lock is allowed to any signed-in user and reveals only the property id.
 */
export async function assertLocationFree(parts: LocationParts, propertyId: string): Promise<void> {
  for (const key of locationCheckKeys(parts)) {
    const snap = await getDoc(lockRef(key));
    if (snap.exists() && snap.data().propertyId !== propertyId) throw new DuplicateLocationError();
  }
}

/** Adds the lock documents to the batch that creates the property, so both succeed or neither does. */
export function addLocationLocks(batch: WriteBatch, parts: LocationParts, propertyId: string): void {
  for (const key of locationKeys(parts)) {
    batch.set(lockRef(key), { propertyId, createdAt: serverTimestamp() });
  }
}

/**
 * Claims locks for a property that was created before locks existed. Best effort: a location that
 * is already held (by this or another property) is left alone, and failures are ignored.
 */
export async function claimLocationLocks(parts: LocationParts, propertyId: string): Promise<void> {
  for (const key of locationKeys(parts)) {
    try {
      if (!(await getDoc(lockRef(key))).exists()) await setDoc(lockRef(key), { propertyId, createdAt: serverTimestamp() });
    } catch {
      // Not claimable now; creating a duplicate of this property is then not blocked by this key.
    }
  }
}

/**
 * Queues the lock changes for a property whose address or coordinates changed: the old locks this
 * property holds are released and the new ones claimed, in the same batch as the property update.
 * Only locks that really exist (and are ours) are deleted, because deleting a missing one is denied.
 */
export async function queueLocationMove(batch: WriteBatch, before: LocationParts, after: LocationParts, propertyId: string): Promise<void> {
  const oldKeys = locationKeys(before);
  const newKeys = locationKeys(after);
  for (const key of oldKeys.filter((k) => !newKeys.includes(k))) {
    const snap = await getDoc(lockRef(key));
    if (snap.exists() && snap.data().propertyId === propertyId) batch.delete(lockRef(key));
  }
  for (const key of newKeys.filter((k) => !oldKeys.includes(k))) {
    if (!(await getDoc(lockRef(key))).exists()) batch.set(lockRef(key), { propertyId, createdAt: serverTimestamp() });
  }
}
