import * as FirebaseAuth from 'firebase/auth';
import { GoogleAuthProvider, signInWithCredential, type Auth } from 'firebase/auth';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

import { getFirebaseAuth } from '@/config/firebase';

// Public OAuth client ID of type "Web application" from the same Google Cloud project as
// Firebase. On native it is what makes Google return an ID token that Firebase can verify.
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

export const GOOGLE_SIGN_IN_CONFIG_ERROR = 'google-sign-in/not-configured';
export const GOOGLE_SIGN_IN_EXPO_GO_ERROR = 'google-sign-in/expo-go';
export const GOOGLE_SIGN_IN_PLAY_SERVICES_ERROR = 'google-sign-in/play-services-unavailable';
const GOOGLE_SIGN_IN_NO_TOKEN_ERROR = 'google-sign-in/no-id-token';

// Expo Go does not include the native Google Sign-In module, and loading it there throws
// "RNGoogleSignin could not be found". A browser-based OAuth flow is not a reliable substitute:
// Expo documents that Expo Go cannot be used to develop OAuth flows, and a Google web client only
// accepts https redirect URIs, which Expo Go's exp:// redirect cannot satisfy. So Expo Go gets a
// clear error and the native module is never imported there.
const IS_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export type GoogleSignInResult = { status: 'signed-in' } | { status: 'cancelled' };

function errorWithCode(code: string): Error & { code: string } {
  return Object.assign(new Error(code), { code });
}

function getErrorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : undefined;
}

// The popup flow only exists in Firebase's browser build. The React Native type definitions
// that TypeScript resolves here omit it, but the web bundle resolves the browser build.
const signInWithPopup = (FirebaseAuth as unknown as {
  signInWithPopup: (auth: Auth, provider: FirebaseAuth.AuthProvider) => Promise<unknown>;
}).signInWithPopup;

async function signInOnWeb(): Promise<GoogleSignInResult> {
  try {
    await signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider());
    return { status: 'signed-in' };
  } catch (error) {
    const code = getErrorCode(error);
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      return { status: 'cancelled' };
    }
    throw error;
  }
}

async function signInOnNative(): Promise<GoogleSignInResult> {
  if (IS_EXPO_GO) throw errorWithCode(GOOGLE_SIGN_IN_EXPO_GO_ERROR);
  if (!WEB_CLIENT_ID) throw errorWithCode(GOOGLE_SIGN_IN_CONFIG_ERROR);

  // Loaded on demand: the native module is missing in Expo Go, and importing it eagerly would
  // crash the whole app at startup instead of only failing this button.
  const { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } = await import(
    '@react-native-google-signin/google-signin'
  );

  try {
    GoogleSignin.configure({ webClientId: WEB_CLIENT_ID });
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return { status: 'cancelled' };

    const idToken = response.data.idToken;
    if (!idToken) throw errorWithCode(GOOGLE_SIGN_IN_NO_TOKEN_ERROR);

    // Firebase verifies the token and signs in to the existing Firebase user for this Google
    // account (or creates one). The auth observer then publishes the signed-in user.
    await signInWithCredential(getFirebaseAuth(), GoogleAuthProvider.credential(idToken));
    return { status: 'signed-in' };
  } catch (error) {
    if (isErrorWithCode(error)) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) return { status: 'cancelled' };
      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw errorWithCode(GOOGLE_SIGN_IN_PLAY_SERVICES_ERROR);
      }
    }
    throw error;
  }
}

/** Signs in to Firebase with a Google account. Resolves `cancelled` if the user backs out. */
export function signInWithGoogle(): Promise<GoogleSignInResult> {
  return Platform.OS === 'web' ? signInOnWeb() : signInOnNative();
}

/**
 * Clears the Google account remembered by the native library so the next sign-in shows the
 * account chooser. Best effort: the Firebase sign-out has already happened.
 */
export async function signOutOfGoogle(): Promise<void> {
  if (Platform.OS === 'web' || IS_EXPO_GO || !WEB_CLIENT_ID) return;
  try {
    const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
    await GoogleSignin.signOut();
  } catch {
    // Not signed in with Google, or the native module is unavailable (Expo Go).
  }
}
