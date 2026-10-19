import { sendPasswordResetEmail } from 'firebase/auth';

import type { NormalizedApiError } from '@/api/errors';
import { getFirebaseAuth } from '@/config/firebase';
import { normalizeFirebaseAuthError } from '@/features/auth/firebaseAuthError';

/**
 * Asks Firebase to email a password-reset link. Resolves to `null` only when the request
 * succeeded. An unknown email is reported as success so the result never reveals whether an
 * account exists (projects without email-enumeration protection throw `auth/user-not-found`).
 */
export async function requestPasswordReset(email: string): Promise<NormalizedApiError | null> {
  try {
    await sendPasswordResetEmail(getFirebaseAuth(), email);
    return null;
  } catch (error) {
    if ((error as { code?: string }).code === 'auth/user-not-found') return null;
    return normalizeFirebaseAuthError(error);
  }
}
