import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';

import { getFirestoreDb } from '@/config/firebase';
import { cleanRules, parseRules } from '@/features/properties/houseRulesModel';
import { cleanPolicy, parsePolicy, type MoveOutPolicy } from '@/features/moveOut/moveOutModel';
import { PropertyRequestError, toRequestError } from '@/features/properties/propertyService';

/** The property's rules. A property that is not the signed-in owner's is refused, as elsewhere. */
export type HouseRulesData = { rules: string[]; policy: MoveOutPolicy };

export async function fetchHouseRules(propertyId: string, ownerUid: string): Promise<HouseRulesData> {
  try {
    const snap = await getDoc(doc(getFirestoreDb(), 'properties', propertyId));
    if (!snap.exists() || snap.data().ownerUid !== ownerUid) throw new PropertyRequestError('not-found', undefined);
    return { rules: parseRules(snap.data().houseRules), policy: parsePolicy(snap.data().moveOutPolicy) };
  } catch (error) {
    throw toRequestError(error);
  }
}

/** Replaces the property's rules and move-out options (owner-only, enforced by the rules). */
export async function saveHouseRules(propertyId: string, rules: readonly string[], policy: MoveOutPolicy): Promise<void> {
  try {
    await updateDoc(doc(getFirestoreDb(), 'properties', propertyId), { houseRules: cleanRules(rules), moveOutPolicy: cleanPolicy(policy), updatedAt: serverTimestamp() });
  } catch (error) {
    throw toRequestError(error);
  }
}
