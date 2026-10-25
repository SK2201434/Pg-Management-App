import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

import { getFirestoreDb } from '@/config/firebase';
import {
  generateInviteCode,
  isInviteCode,
  parsePendingInvite,
  REFERRAL_CREDITS,
  type PendingInvite,
  type ReferralRecord,
} from '@/features/referral/inviteModel';

const PENDING_KEY = 'pending_invite_code';

/**
 * The shareable link. `Linking.createURL` gives `myapp://invite/CODE` in a build and the
 * `exp://…/--/invite/CODE` form in Expo Go. There is no https domain or universal link configured,
 * so a link only opens the app on a device that has it installed.
 */
export const buildInviteUrl = (code: string): string => Linking.createURL(`invite/${code}`);

// ---- the invite captured from a link, until sign-up ----

export async function savePendingInvite(code: string): Promise<void> {
  const value: PendingInvite = { code, savedMs: Date.now() };
  await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(value));
}

export async function loadPendingInvite(): Promise<PendingInvite | null> {
  try {
    return parsePendingInvite(await AsyncStorage.getItem(PENDING_KEY), Date.now());
  } catch {
    return null;
  }
}

export async function clearPendingInvite(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PENDING_KEY);
  } catch {
    // A leftover value expires by itself.
  }
}

// ---- the user's own code ----

const code = (value: unknown): string | null => (isInviteCode(value) ? value : null);

/**
 * The signed-in user's invite code. It is created once: `inviteOwners/{uid}` and `inviteCodes/{code}`
 * are written in one batch and are create-only, so it never changes and no two users share a code.
 * A taken code (or a code created meanwhile on another device) makes the batch fail; the loop then
 * re-reads and, if still none, tries a new code.
 */
export async function ensureInviteCode(uid: string): Promise<string> {
  const db = getFirestoreDb();
  const ownerRef = doc(db, 'inviteOwners', uid);
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const existing = code((await getDoc(ownerRef)).data()?.code);
    if (existing) return existing;
    const candidate = generateInviteCode();
    try {
      const batch = writeBatch(db);
      batch.set(ownerRef, { code: candidate, createdAt: serverTimestamp() });
      batch.set(doc(db, 'inviteCodes', candidate), { ownerUid: uid, createdAt: serverTimestamp() });
      await batch.commit();
      return candidate;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

// ---- referral records ----

const toMs = (v: unknown): number | null => {
  const t = v as { toMillis?: () => number } | undefined;
  return typeof t?.toMillis === 'function' ? t.toMillis() : null;
};

/**
 * Referrals made by this user. Only status and dates are kept: the referred account's identity is
 * not shown to the referrer. The query is limited to the caller's own records, as the rules require.
 */
export async function fetchReferrals(uid: string): Promise<ReferralRecord[]> {
  const snap = await getDocs(query(collection(getFirestoreDb(), 'inviteReferrals'), where('referrerUid', '==', uid)));
  return snap.docs.map((d): ReferralRecord => {
    const data = d.data() as Record<string, unknown>;
    return {
      id: d.id,
      status: data.status === 'completed' ? 'completed' : 'registered',
      registeredMs: toMs(data.registeredAt),
      completedMs: toMs(data.completedAt),
    };
  });
}

/**
 * Called once, right after a new account is created: if a captured invite code is waiting, record
 * that this account was referred. Never throws: attribution must not break registration. The code
 * is dropped once handled; a network failure keeps it for the next attempt. The rules reject a
 * self-referral, an unknown code, a second record, and an account that already has a profile.
 */
export async function recordInviteAttribution(referredUid: string): Promise<void> {
  const pending = await loadPendingInvite();
  if (pending === null) return;
  try {
    const db = getFirestoreDb();
    const owner = await getDoc(doc(db, 'inviteCodes', pending.code));
    const referrerUid = owner.data()?.ownerUid;
    if (typeof referrerUid === 'string' && referrerUid !== referredUid) {
      await setDoc(doc(db, 'inviteReferrals', referredUid), {
        referrerUid,
        referredUid,
        code: pending.code,
        status: 'registered',
        registeredAt: serverTimestamp(),
      });
    }
    await clearPendingInvite();
  } catch (error) {
    const kind = (error as { code?: string } | null)?.code;
    if (kind !== 'unavailable' && kind !== 'deadline-exceeded') await clearPendingInvite();
  }
}

/** Id of one of the owner's fully set up properties (drafts do not count), or null. */
async function findReadyPropertyId(uid: string): Promise<string | null> {
  const snap = await getDocs(query(collection(getFirestoreDb(), 'properties'), where('ownerUid', '==', uid)));
  return snap.docs.find((d) => d.data().setupStatus !== 'draft')?.id ?? null;
}

/**
 * Marks this account's referral `completed` once its owner has registered a property, and in the
 * same batch credits the referrer (`users/{referrer}.credits`, REFERRAL_CREDITS). Pass `propertyId`
 * when a property has just been finished; otherwise a ready property is looked up (the launch retry).
 * Does nothing unless a `registered` record exists. The rules require the property to belong to this
 * account and be ready, and a record completes only once, so credits are paid once. Never throws;
 * a failure is retried on the next launch.
 */
export async function completeInviteReferral(uid: string, propertyId?: string): Promise<void> {
  try {
    const db = getFirestoreDb();
    const ref = doc(db, 'inviteReferrals', uid);
    const snap = await getDoc(ref);
    if (!snap.exists() || snap.data().status !== 'registered') return;
    const readyId = propertyId ?? (await findReadyPropertyId(uid));
    if (readyId === null) return;
    const batch = writeBatch(db);
    batch.update(ref, { status: 'completed', completedAt: serverTimestamp(), propertyId: readyId });
    batch.update(doc(db, 'users', snap.data().referrerUid as string), { credits: increment(REFERRAL_CREDITS) });
    await batch.commit();
  } catch {
    // Retried on the next launch.
  }
}
