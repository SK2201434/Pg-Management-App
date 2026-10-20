import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';

import { normalizeApiError, type NormalizedApiError } from '@/api/errors';
import { getFirebaseAuth } from '@/config/firebase';
import type { AccountType, Gender } from '@/constants/account';
import type {
  OwnerLoginRequest,
  OwnerRegisterRequest,
  OwnerUser,
} from '@/features/auth/authTypes';
import {
  normalizeFirebaseAuthError,
  normalizeGoogleSignInError,
} from '@/features/auth/firebaseAuthError';
import { signInWithGoogle, signOutOfGoogle } from '@/features/auth/googleSignIn';
import { removeOwnerToken } from '@/features/auth/ownerTokenStorage';
import { recordInviteAttribution } from '@/features/referral/referralService';
import { saveRegistrationIntent } from '@/features/auth/registrationIntent';
import { toOwnerUser } from '@/features/auth/ownerUser';

/** What the Create Account screen submits. `accountType`/`referralCode` are intent, not a grant. */
export type RegisterOwnerArgs = OwnerRegisterRequest & {
  accountType: AccountType;
  phone?: string;
  gender?: Gender;
  referralCode?: string;
};

/** Result of `registerOwnerThunk`. */
export type RegisterResult = { verificationEmailSent: boolean };

type AuthOperation = 'register' | 'login' | 'google';

export type AuthState = {
  owner: OwnerUser | null;
  isAuthenticated: boolean;
  /** False until Firebase has reported the persisted session once (or failed to). */
  isInitialized: boolean;
  /** True when the account was created but the verification email could not be sent. */
  verificationEmailFailed: boolean;
  loading: Record<AuthOperation, boolean>;
  errors: Record<AuthOperation | 'restoreSession', NormalizedApiError | null>;
};

const initialState: AuthState = {
  owner: null,
  isAuthenticated: false,
  isInitialized: false,
  verificationEmailFailed: false,
  loading: { register: false, login: false, google: false },
  errors: { register: null, login: null, google: null, restoreSession: null },
};

// Passwords and Firebase tokens never enter state or payloads. The session itself is owned
// by Firebase Auth; this slice mirrors the signed-in user through `authStateChanged`, which
// is dispatched by the single auth observer (`ownerAuthObserver.ts`), not by the thunks.

/** Result of `logoutOwnerThunk`. A failed sign-out rejects instead, leaving the session intact. */
export type OwnerLogoutResult = { signedOut: true };

const createAuthThunk = createAsyncThunk.withTypes<{ rejectValue: NormalizedApiError }>();

// Creating the account also signs the user in, so the observer authenticates them and the gate
// shows the verify-email screen. No profile is written here: that happens only after the email is
// verified (see userProvisioning.ts). The chosen type and referral are saved on the device, keyed
// by UID, for that later step.
export const registerOwnerThunk = createAuthThunk<RegisterResult, RegisterOwnerArgs>(
  'ownerAuth/registerOwner',
  async (
    { full_name, email, password, accountType, phone, gender, referralCode },
    { dispatch, rejectWithValue },
  ) => {
    let credential;
    try {
      credential = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
    } catch (error) {
      return rejectWithValue(normalizeFirebaseAuthError(error));
    }

    // The account exists from here on, so nothing below may fail the registration: the verify
    // screen can resend the email, and provisioning falls back to asking for the type once.
    try {
      await saveRegistrationIntent(credential.user.uid, {
        accountType,
        ...(phone ? { phone } : {}),
        ...(gender ? { gender } : {}),
        ...(referralCode ? { referralCode } : {}),
      });
    } catch {
      // Missing intent is handled safely at provisioning time.
    }

    // A captured invite link is attributed to this brand-new account (never throws).
    await recordInviteAttribution(credential.user.uid);

    let verificationEmailSent = true;
    try {
      await sendEmailVerification(credential.user);
    } catch {
      verificationEmailSent = false;
    }

    try {
      await updateProfile(credential.user, { displayName: full_name.trim() });
      // The observer already ran with no display name; publish the updated user.
      dispatch(authStateChanged(toOwnerUser(credential.user)));
    } catch {
      // The name can be set again later; the session is valid without it.
    }
    return { verificationEmailSent };
  },
);

// The observer authenticates the user once Firebase reports the signed-in state.
export const loginOwnerThunk = createAuthThunk<void, OwnerLoginRequest>(
  'ownerAuth/loginOwner',
  async ({ email, password }, { rejectWithValue }) => {
    try {
      await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
    } catch (error) {
      return rejectWithValue(normalizeFirebaseAuthError(error));
    }
  },
);

/** Result of `loginWithGoogleThunk`. Backing out of the Google dialog is not an error. */
export type GoogleLoginResult = { cancelled: boolean };

// As with email login, the observer authenticates the user once Firebase reports the session.
export const loginWithGoogleThunk = createAuthThunk<GoogleLoginResult, void>(
  'ownerAuth/loginWithGoogle',
  async (_, { rejectWithValue }) => {
    try {
      const result = await signInWithGoogle();
      return { cancelled: result.status === 'cancelled' };
    } catch (error) {
      return rejectWithValue(normalizeGoogleSignInError(error));
    }
  },
);

const ownerAuthSlice = createSlice({
  name: 'ownerAuth',
  initialState,
  reducers: {
    verificationEmailSendResult: (state, action: PayloadAction<boolean>) => {
      state.verificationEmailFailed = !action.payload;
    },
    authStateChanged: (state, action: PayloadAction<OwnerUser | null>) => {
      state.owner = action.payload;
      state.isAuthenticated = action.payload !== null;
      state.isInitialized = true;
      state.errors.restoreSession = null;
    },
    authStateFailed: (state, action: PayloadAction<NormalizedApiError>) => {
      state.owner = null;
      state.isAuthenticated = false;
      state.isInitialized = true;
      state.errors.restoreSession = action.payload;
    },
    // Stays initialized: the auth state is known (signed out), so the gate must not spin.
    logoutOwner: () => ({ ...initialState, isInitialized: true }),
  },
  extraReducers: (builder) => {
    builder
      .addCase(registerOwnerThunk.pending, (state) => {
        state.loading.register = true;
        state.errors.register = null;
      })
      .addCase(registerOwnerThunk.fulfilled, (state, action) => {
        state.loading.register = false;
        state.verificationEmailFailed = !action.payload.verificationEmailSent;
      })
      .addCase(registerOwnerThunk.rejected, (state, action) => {
        state.loading.register = false;
        state.errors.register = action.payload ?? normalizeApiError(action.error);
      })
      // A failed login does not clear an existing session.
      .addCase(loginOwnerThunk.pending, (state) => {
        state.loading.login = true;
        state.errors.login = null;
      })
      .addCase(loginOwnerThunk.fulfilled, (state) => {
        state.loading.login = false;
      })
      .addCase(loginOwnerThunk.rejected, (state, action) => {
        state.loading.login = false;
        state.errors.login = action.payload ?? normalizeApiError(action.error);
      })
      .addCase(loginWithGoogleThunk.pending, (state) => {
        state.loading.google = true;
        state.errors.google = null;
      })
      .addCase(loginWithGoogleThunk.fulfilled, (state) => {
        state.loading.google = false;
      })
      .addCase(loginWithGoogleThunk.rejected, (state, action) => {
        state.loading.google = false;
        state.errors.google = action.payload ?? normalizeApiError(action.error);
      });
  },
});

const ownerAuthReducer = ownerAuthSlice.reducer;

export const {
  authStateChanged,
  authStateFailed,
  logoutOwner,
  verificationEmailSendResult,
} = ownerAuthSlice.actions;
export default ownerAuthReducer;

// Signs out of Firebase first and clears Redux only once that succeeded, so the UI and the
// persisted session cannot disagree: if sign-out fails the owner stays signed in and the
// rejection carries the error. On success the auth observer also reports the signed-out state.
// The legacy backend token from the previous login flow is removed too (best effort).
export const logoutOwnerThunk = createAuthThunk<OwnerLogoutResult, void>(
  'ownerAuth/logout',
  async (_, { dispatch, rejectWithValue }) => {
    try {
      await signOut(getFirebaseAuth());
    } catch (error) {
      return rejectWithValue(normalizeFirebaseAuthError(error));
    }
    dispatch(logoutOwner());
    await signOutOfGoogle();
    try {
      await removeOwnerToken();
    } catch {
      // Nothing reads this token any more; a leftover one is harmless.
    }
    return { signedOut: true };
  },
);
