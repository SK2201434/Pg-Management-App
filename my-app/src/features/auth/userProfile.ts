import { doc, getDoc } from 'firebase/firestore';

import { AccountRoles, AccountStatuses, type AccountRole } from '@/constants/account';
import { getFirestoreDb } from '@/config/firebase';
import type { UserProfile } from '@/features/auth/authTypes';
import { isValidPhone } from '@/features/auth/phone';

/** The authorization fields of `users/{uid}` the app acts on. */
export type VerifiedProfile = Pick<UserProfile, 'uid' | 'role' | 'status'> & {
  /** Display name from the profile, when present and non-empty. */
  displayName: string | null;
  /** The profile's 10-digit phone number, or null when it has none (or an old, invalid one). */
  phone?: string | null;
};

/**
 * Outcome of reading the signed-in user's profile. Only `ready` may render the authenticated
 * app. A failed read (network, permissions) is thrown instead, so it can be retried.
 */
export type UserProfileResult =
  | { state: 'ready'; profile: VerifiedProfile }
  | { state: 'missing' | 'invalid' | 'disabled' };

const isAccountRole = (value: unknown): value is AccountRole =>
  value === AccountRoles.Owner || value === AccountRoles.Tenant;

const READ_TIMEOUT_MS = 12_000;

/** Thrown when Firestore gives no answer in time; the SDK can otherwise wait indefinitely. */
export class ProfileReadTimeoutError extends Error {
  readonly code = 'profile/timeout';
  constructor() {
    super('Reading the account profile timed out.');
  }
}

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ProfileReadTimeoutError()), READ_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export type ProfileReadFailureKind =
  | 'permission-denied'
  | 'unauthenticated'
  | 'not-found'
  | 'unavailable'
  | 'timeout'
  | 'config'
  | 'unknown';

/** A failed profile read. Keeps the original Firebase `code` so the UI can tell causes apart. */
export class ProfileReadError extends Error {
  constructor(
    readonly kind: ProfileReadFailureKind,
    /** The original Firebase error code (e.g. `permission-denied`), if there was one. */
    readonly code: string | undefined,
    options?: { cause?: unknown },
  ) {
    super(`Reading the account profile failed (${code ?? kind}).`, options);
    this.name = 'ProfileReadError';
  }
}

function classifyProfileReadError(error: unknown): ProfileReadError {
  if (error instanceof ProfileReadError) return error;
  if (error instanceof ProfileReadTimeoutError) {
    return new ProfileReadError('timeout', error.code, { cause: error });
  }
  const raw = (error as { code?: unknown } | null)?.code;
  const code = typeof raw === 'string' ? raw.replace(/^firestore\//, '') : undefined;
  let kind: ProfileReadFailureKind = 'unknown';
  if (code === 'permission-denied' || code === 'unauthenticated' || code === 'not-found') {
    kind = code;
  } else if (code === 'unavailable') {
    kind = 'unavailable';
  } else if (code === 'deadline-exceeded') {
    kind = 'timeout';
  } else if (code?.startsWith('auth/') || code === 'invalid-argument' || code === 'failed-precondition') {
    kind = 'config';
  } else if (code === undefined && error instanceof Error && /projectId|apiKey|app/i.test(error.message)) {
    kind = 'config';
  }
  return new ProfileReadError(kind, code, { cause: error });
}

/**
 * Reads `users/{uid}` once. The role comes only from this document, which trusted provisioning
 * writes; `accountType` (the sign-up choice) is deliberately ignored.
 */
export async function fetchUserProfile(uid: string): Promise<UserProfileResult> {
  let snapshot;
  try {
    snapshot = await withTimeout(getDoc(doc(getFirestoreDb(), 'users', uid)));
  } catch (error) {
    const failure = classifyProfileReadError(error);
    if (__DEV__) {
      // Code and message only: never the uid, tokens or config.
      console.warn(
        `[profile] read failed: kind=${failure.kind} code=${failure.code ?? 'none'} message=${
          (error as Error | null)?.message ?? 'n/a'
        }`,
      );
    }
    throw failure;
  }
  if (!snapshot.exists()) return { state: 'missing' };

  const { role, status, displayName, phone } = snapshot.data() as Partial<
    Record<'role' | 'status' | 'displayName' | 'phone', unknown>
  >;
  if (!isAccountRole(role)) return { state: 'invalid' };
  if (status === AccountStatuses.Disabled) return { state: 'disabled' };
  if (status !== AccountStatuses.Active) return { state: 'invalid' };

  return {
    state: 'ready',
    profile: {
      uid,
      role,
      status,
      displayName: typeof displayName === 'string' && displayName.trim() ? displayName.trim() : null,
      phone: typeof phone === 'string' && isValidPhone(phone.trim()) ? phone.trim() : null,
    },
  };
}
