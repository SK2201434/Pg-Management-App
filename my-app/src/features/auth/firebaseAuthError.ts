import type { NormalizedApiError } from '@/api/errors';
import {
  GOOGLE_SIGN_IN_CONFIG_ERROR,
  GOOGLE_SIGN_IN_EXPO_GO_ERROR,
  GOOGLE_SIGN_IN_PLAY_SERVICES_ERROR,
} from '@/features/auth/googleSignIn';

// Maps Firebase Auth error codes to user-facing messages. Wrong-password and unknown-email are
// deliberately the same message so the form does not reveal which emails have accounts.
const MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/user-not-found': 'Incorrect email or password.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/email-already-in-use':
    'An account with this email already exists. Please sign in instead.',
  'auth/weak-password': 'Choose a stronger password (at least 6 characters).',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
  'auth/network-request-failed':
    'Unable to reach the server. Check your connection and try again.',
  'auth/operation-not-allowed': 'Email/password sign-in is not enabled for this app.',
  'auth/invalid-api-key': 'Authentication is not configured correctly. Please contact support.',
};

const FALLBACK_MESSAGE = 'Something went wrong. Please try again.';

/** Converts a thrown Firebase Auth error into the NormalizedApiError the auth state uses. */
export function normalizeFirebaseAuthError(error: unknown): NormalizedApiError {
  const code =
    typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
      ? error.code
      : undefined;

  return {
    message: (code !== undefined ? MESSAGES[code] : undefined) ?? FALLBACK_MESSAGE,
    category: code === 'auth/network-request-failed' ? 'network' : 'unknown',
  };
}

// Google sign-in failures. Codes from the Google native library are numeric strings; "10" is
// Android's DEVELOPER_ERROR (the app's package name / SHA-1 does not match the OAuth client).
const GOOGLE_MESSAGES: Record<string, string> = {
  [GOOGLE_SIGN_IN_CONFIG_ERROR]: 'Google sign-in is not set up for this build yet.',
  [GOOGLE_SIGN_IN_EXPO_GO_ERROR]:
    'Google sign-in is not available in Expo Go. Use a development build, or sign in with email.',
  [GOOGLE_SIGN_IN_PLAY_SERVICES_ERROR]:
    'Google Play services is missing or out of date. Update it and try again.',
  '10': 'Google sign-in is not configured correctly for this build. Please contact support.',
  'auth/account-exists-with-different-credential':
    'An account with this email already exists using a different sign-in method.',
  'auth/invalid-credential': 'Google sign-in failed. Please try again.',
  'auth/operation-not-allowed': 'Google sign-in is not enabled for this app.',
  'auth/unauthorized-domain': 'Google sign-in is not allowed from this domain.',
  'auth/popup-blocked': 'The sign-in popup was blocked. Allow popups and try again.',
};

/** Like normalizeFirebaseAuthError, with messages that make sense for Google sign-in. */
export function normalizeGoogleSignInError(error: unknown): NormalizedApiError {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : undefined;
  const message = code !== undefined ? GOOGLE_MESSAGES[code] : undefined;
  return message !== undefined
    ? { message, category: 'unknown' }
    : normalizeFirebaseAuthError(error);
}
