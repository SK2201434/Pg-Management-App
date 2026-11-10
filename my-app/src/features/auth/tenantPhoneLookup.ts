import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';

import { getFirestoreDb } from '@/config/firebase';

// `tenantPhones/{phone}/accounts/{uid}` = { uid, displayName }. A tiny lookup, written by the tenant for
// their own account, that lets an owner's app ask "has anyone registered with this phone number?" for a
// number the owner already holds (a resident they added). It carries only what the owner's confirmation
// card needs; the tenant's profile, email and everything else stay private. Several accounts may share a
// number (the path includes the uid), so nobody can block someone else's number by registering first.
const lookupRef = (phone: string, uid: string) => doc(getFirestoreDb(), 'tenantPhones', phone, 'accounts', uid);

/** Writes the lookup for this tenant, unless it is already there and current. Cheap: one read when up to date. */
export async function ensureTenantPhoneLookup(uid: string, phone: string, displayName: string): Promise<void> {
  const ref = lookupRef(phone, uid);
  const existing = await getDoc(ref);
  if (existing.exists() && existing.data().displayName === displayName) return;
  await setDoc(ref, { uid, displayName });
}

/** Removes the lookup for a number the tenant no longer uses. */
export async function removeTenantPhoneLookup(uid: string, phone: string): Promise<void> {
  await deleteDoc(lookupRef(phone, uid));
}
