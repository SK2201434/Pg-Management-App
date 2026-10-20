import { doc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore';

import { AccountRoles, AccountStatuses } from '@/constants/account';
import { getFirebaseAuth, getFirestoreDb } from '@/config/firebase';
import type { RegistrationIntent } from '@/features/auth/registrationIntent';

export type ProvisioningFailureKind =
  | 'email-unverified'
  | 'referral-invalid'
  | 'referral-expired'
  | 'referral-used'
  | 'referral-wrong-role'
  | 'referral-rejected'
  | 'permission-denied'
  | 'unavailable'
  | 'unknown';

/** A failed profile creation. `code` is the original Firebase error code, if any. */
export class ProvisioningError extends Error {
  constructor(
    readonly kind: ProvisioningFailureKind,
    readonly code?: string,
    options?: { cause?: unknown },
  ) {
    super(`Profile provisioning failed (${code ?? kind}).`, options);
    this.name = 'ProvisioningError';
  }
}

type ReferralData = { type?: unknown; status?: unknown; expiresAt?: { toMillis(): number } };

/** Why a referral (as read from Firestore) cannot be redeemed now, or null if it can. */
export function classifyReferral(
  data: ReferralData | undefined,
  now: number = Date.now(),
): ProvisioningFailureKind | null {
  if (data === undefined || data.type !== 'property_join') return 'referral-invalid';
  if (data.status === 'used') return 'referral-used';
  if (data.status !== 'active') return 'referral-invalid';
  if (typeof data.expiresAt?.toMillis !== 'function' || data.expiresAt.toMillis() <= now) {
    return 'referral-expired';
  }
  return null;
}

function toProvisioningError(error: unknown, hadReferral: boolean): ProvisioningError {
  if (error instanceof ProvisioningError) return error;
  const raw = (error as { code?: unknown } | null)?.code;
  const code = typeof raw === 'string' ? raw.replace(/^firestore\//, '') : undefined;
  if (code === 'permission-denied') {
    // With a referral this is most likely a concurrent claim, but rules do not say which.
    return new ProvisioningError(hadReferral ? 'referral-rejected' : 'permission-denied', code, {
      cause: error,
    });
  }
  if (code === 'unavailable' || code === 'deadline-exceeded') {
    return new ProvisioningError('unavailable', code, { cause: error });
  }
  return new ProvisioningError('unknown', code, { cause: error });
}

export type ProvisionInput = {
  uid: string;
  intent: RegistrationIntent;
  /** Used when the Auth user has no display name. */
  fallbackName?: string;
};

/**
 * Creates `users/{uid}` (and, for a referral, consumes the referral and creates the property
 * membership) in one atomic batch. The role is the one chosen at registration, but only the
 * Firestore rules grant it: they require a verified email, a valid single-use referral if one is
 * given, and reject anything but `tenant`/`owner`. Safe to retry; resolves without writing if the
 * profile already exists. Never creates an Auth account.
 */
export async function provisionProfile({ uid, intent, fallbackName }: ProvisionInput) {
  const hadReferral = intent.referralCode !== undefined;
  try {
    const user = getFirebaseAuth().currentUser;
    if (user === null || user.uid !== uid) throw new ProvisioningError('unknown', 'auth/no-user');
    await user.reload();
    if (!user.emailVerified) throw new ProvisioningError('email-unverified');
    // Rules read `email_verified` from the ID token, so make sure it is the fresh one.
    await user.getIdToken(true);

    const db = getFirestoreDb();
    const profileRef = doc(db, 'users', uid);
    if ((await getDoc(profileRef)).exists()) return;

    const email = user.email ?? '';
    const displayName =
      (user.displayName ?? fallbackName ?? email.split('@')[0] ?? '').trim().slice(0, 100) ||
      'HOSTELL user';
    const profile = {
      uid,
      role: intent.accountType,
      accountType: intent.accountType,
      status: AccountStatuses.Active,
      displayName,
      email,
      ...(intent.phone ? { phone: intent.phone } : {}),
      ...(intent.gender ? { gender: intent.gender } : {}),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const batch = writeBatch(db);
    const code = intent.referralCode;
    if (code === undefined) {
      batch.set(profileRef, profile);
    } else {
      if (intent.accountType !== AccountRoles.Tenant) {
        throw new ProvisioningError('referral-wrong-role');
      }
      const referralRef = doc(db, 'referrals', code);
      const referral = await getDoc(referralRef);
      const rejection = classifyReferral(referral.exists() ? referral.data() : undefined);
      if (rejection !== null) throw new ProvisioningError(rejection);
      const { propertyId, createdBy } = referral.data() as { propertyId: string; createdBy: string };

      batch.set(profileRef, { ...profile, referralCode: code });
      batch.update(referralRef, {
        status: 'used',
        useCount: 1,
        usedBy: uid,
        usedAt: serverTimestamp(),
      });
      batch.set(doc(db, 'properties', propertyId, 'members', uid), {
        tenantUid: uid,
        propertyId,
        ownerUid: createdBy,
        displayName,
        referralCode: code,
        status: 'active',
        joinedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (error) {
    throw toProvisioningError(error, hadReferral);
  }
}

/** User-facing text for a failed provisioning. */
export function getProvisioningErrorMessage(error: unknown): string {
  const kind = error instanceof ProvisioningError ? error.kind : 'unknown';
  switch (kind) {
    case 'email-unverified':
      return 'Your email is not verified yet. Open the link we emailed you, then try again.';
    case 'referral-invalid':
      return 'That referral code is not valid. Check it and try again, or continue without one.';
    case 'referral-expired':
      return 'That referral code has expired. Ask the owner for a new one, or continue without one.';
    case 'referral-used':
      return 'That referral code has already been used. Ask the owner for a new one, or continue without one.';
    case 'referral-wrong-role':
      return 'Referral codes can only be used for tenant accounts.';
    case 'referral-rejected':
      return 'The referral code could not be redeemed. It may have just been used. Try again, or continue without one.';
    case 'permission-denied':
      return 'HOSTELL is not allowed to set up your account. Please contact support.';
    case 'unavailable':
      return 'Could not reach the database. Check your connection and try again.';
    default:
      return 'Something went wrong while setting up your account. Please try again.';
  }
}

/** Whether the failure is about the referral, so "continue without a code" is a useful recovery. */
export function isReferralFailure(error: unknown): boolean {
  return error instanceof ProvisioningError && error.kind.startsWith('referral-');
}
