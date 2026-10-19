import { onAuthStateChanged, type Unsubscribe } from 'firebase/auth';

import { getFirebaseAuth } from '@/config/firebase';
import { queryClient } from '@/lib/queryClient';
import { authStateChanged, authStateFailed } from '@/features/auth/ownerAuthSlice';
import { normalizeFirebaseAuthError } from '@/features/auth/firebaseAuthError';
import { toOwnerUser } from '@/features/auth/ownerUser';
import type { AppDispatch } from '@/store/store';

// Firebase Auth is the source of truth for the session. This mirrors its state into Redux.
// The first callback fires once the persisted session has been read, so it also marks the
// auth state as initialized. The caller must unsubscribe to avoid duplicate subscriptions.
export function observeOwnerAuthState(dispatch: AppDispatch): Unsubscribe {
  let previousUid: string | null = null;
  try {
    return onAuthStateChanged(
      getFirebaseAuth(),
      (user) => {
        // Cached server data belongs to the user who fetched it. Drop it whenever that user
        // signs out (including Firebase ending the session, e.g. a disabled account) or is
        // replaced by another, so the next user never sees it. The first callback after launch
        // has no previous user, so a restored session keeps its (empty) cache untouched.
        const uid = user?.uid ?? null;
        if (previousUid !== null && uid !== previousUid) queryClient.clear();
        previousUid = uid;
        dispatch(authStateChanged(user ? toOwnerUser(user) : null));
      },
      (error) => {
        dispatch(authStateFailed(normalizeFirebaseAuthError(error)));
      },
    );
  } catch (error) {
    // Firebase Auth could not be created. Report it so the gate leaves the loading screen
    // and offers a retry, instead of waiting for a callback that will never come.
    dispatch(authStateFailed(normalizeFirebaseAuthError(error)));
    return () => {};
  }
}
