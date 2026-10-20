import { sendEmailVerification } from 'firebase/auth';

import type { NormalizedApiError } from '@/api/errors';
import { getFirebaseAuth } from '@/config/firebase';
import { normalizeFirebaseAuthError } from '@/features/auth/firebaseAuthError';
import { authStateChanged } from '@/features/auth/ownerAuthSlice';
import { toOwnerUser } from '@/features/auth/ownerUser';
import type { AppDispatch } from '@/store/store';

/** Sends the Firebase verification email to the signed-in user. Resolves to null on success. */
export async function sendVerificationEmail(): Promise<NormalizedApiError | null> {
  const user = getFirebaseAuth().currentUser;
  if (user === null) {
    return { message: 'You are signed out. Please sign in again.', category: 'unknown' };
  }
  try {
    await sendEmailVerification(user);
    return null;
  } catch (error) {
    return normalizeFirebaseAuthError(error);
  }
}

export type VerificationCheck =
  | { status: 'verified' }
  | { status: 'pending' }
  | { status: 'error'; error: NormalizedApiError };

/**
 * Reloads the Firebase user and force-refreshes the ID token, so `emailVerified` and the
 * `email_verified` claim that Firestore rules check are current, then publishes the user to Redux
 * (`onAuthStateChanged` does not fire on reload).
 */
export async function checkEmailVerified(dispatch: AppDispatch): Promise<VerificationCheck> {
  const user = getFirebaseAuth().currentUser;
  if (user === null) {
    return {
      status: 'error',
      error: { message: 'You are signed out. Please sign in again.', category: 'unknown' },
    };
  }
  try {
    await user.reload();
    if (!user.emailVerified) return { status: 'pending' };
    await user.getIdToken(true);
    dispatch(authStateChanged(toOwnerUser(user)));
    return { status: 'verified' };
  } catch (error) {
    return { status: 'error', error: normalizeFirebaseAuthError(error) };
  }
}
