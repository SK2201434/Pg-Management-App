import { updateProfile } from 'firebase/auth';
import { deleteField, doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';

import { getFirebaseAuth, getFirestoreDb } from '@/config/firebase';
import type { EditableProfile } from '@/features/profile/profileModel';

/** What the profile page shows, read from `users/{uid}`. Authorization fields are read-only here. */
export type AccountProfile = {
  displayName: string | null;
  email: string | null;
  phone: string | null;
  gender: 'male' | 'female' | null;
  status: string | null;
  /** Referral credits earned; 0 until the first completed referral. */
  credits: number;
  createdMs: number | null;
};

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

export async function fetchAccountProfile(uid: string): Promise<AccountProfile> {
  const snap = await getDoc(doc(getFirestoreDb(), 'users', uid));
  const data = (snap.data() ?? {}) as Record<string, unknown>;
  const created = data.createdAt as { toMillis?: () => number } | undefined;
  return {
    displayName: text(data.displayName),
    email: text(data.email),
    phone: text(data.phone),
    gender: data.gender === 'male' || data.gender === 'female' ? data.gender : null,
    status: text(data.status),
    credits: typeof data.credits === 'number' && data.credits > 0 ? data.credits : 0,
    createdMs: typeof created?.toMillis === 'function' ? created.toMillis() : null,
  };
}

/**
 * Saves only the editable fields (name, phone) plus `updatedAt`, which is all the rules accept: uid,
 * role, status and the referral records cannot be touched from here. An emptied phone is removed.
 */
export async function saveAccountProfile(uid: string, input: EditableProfile): Promise<void> {
  const phone = input.phone.trim();
  const displayName = input.displayName.trim();
  await updateDoc(doc(getFirestoreDb(), 'users', uid), {
    displayName,
    phone: phone === '' ? deleteField() : phone,
    updatedAt: serverTimestamp(),
  });
  try {
    const user = getFirebaseAuth().currentUser;
    if (user && user.uid === uid) await updateProfile(user, { displayName });
  } catch {
    // The Firestore profile is the source of truth; the Auth display name is a convenience.
  }
}
