import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, doc, getDocs, serverTimestamp, writeBatch } from 'firebase/firestore';

import { getFirestoreDb } from '@/config/firebase';
import { mergeLocalReads, parseLocalReads } from '@/features/notifications/notificationsModel';

// Read marks: `users/{uid}/notificationReads/{notificationId}` = { readAt }. They are the only thing
// stored for notifications. A copy is also kept on the device, so the unread dot is right even when
// the cloud copy cannot be read or written (offline, or the rules not deployed yet).

const localKey = (uid: string) => `notification_reads:${uid}`;
const BATCH = 400;

async function loadLocal(uid: string): Promise<string[]> {
  try {
    return parseLocalReads(await AsyncStorage.getItem(localKey(uid)));
  } catch {
    return [];
  }
}

/** Ids this owner has read, from the cloud and this device. Never throws: a failed source counts as empty. */
export async function fetchReadIds(uid: string): Promise<string[]> {
  const local = await loadLocal(uid);
  try {
    const snap = await getDocs(collection(getFirestoreDb(), 'users', uid, 'notificationReads'));
    return [...new Set([...local, ...snap.docs.map((d) => d.id)])];
  } catch {
    return local;
  }
}

/**
 * Marks notifications read: on the device first (so it is never lost), then in the cloud in batches.
 * Only the owner's own marks are written (the rules require the path to be their uid). Returns whether
 * the cloud copy was saved; a failure leaves the device copy in place.
 */
export async function saveReadIds(uid: string, ids: readonly string[]): Promise<boolean> {
  if (ids.length === 0) return true;
  try {
    await AsyncStorage.setItem(localKey(uid), JSON.stringify(mergeLocalReads(await loadLocal(uid), ids)));
  } catch {
    // The cloud copy below may still succeed.
  }
  try {
    const db = getFirestoreDb();
    for (let i = 0; i < ids.length; i += BATCH) {
      const batch = writeBatch(db);
      for (const id of ids.slice(i, i + BATCH)) {
        batch.set(doc(db, 'users', uid, 'notificationReads', id), { readAt: serverTimestamp() });
      }
      await batch.commit();
    }
    return true;
  } catch {
    return false;
  }
}
