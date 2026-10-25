import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

import { getFirestoreDb } from '@/config/firebase';

/**
 * The permanent Property ID is the property's own document id. A tenant cannot read a property, so
 * `propertyJoin/{propertyId}` tells them (and the rules) who owns it. New properties get it in the batch
 * that creates them; this adds it for a property created before that, once. Safe to call repeatedly.
 */
export async function ensurePropertyJoin(propertyId: string, ownerUid: string): Promise<void> {
  const ref = doc(getFirestoreDb(), 'propertyJoin', propertyId);
  if ((await getDoc(ref)).exists()) return;
  await setDoc(ref, { ownerUid, createdAt: serverTimestamp() });
}

export const buildPropertyIdMessage = (propertyName: string, propertyId: string): string =>
  `You are invited to join ${propertyName} on HOSTELL. Install the app, create a tenant account, and enter this Property ID as the referral code: ${propertyId}. The owner will then see your stay request and approve it.`;
