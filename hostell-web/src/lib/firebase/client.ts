import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

// The Firebase web API key is a public identifier (it ships in every client bundle), not a secret.
// Set NEXT_PUBLIC_FIREBASE_API_KEY in `.env.local` and in Vercel; the project id and auth domain are fixed.
const PROJECT_ID = "hostell-685b3";

/** The single browser-side Firebase app; never creates a second instance. Browser only. */
export function getFirebaseClientApp(): FirebaseApp {
  if (getApps().length > 0) return getApp();
  return initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: `${PROJECT_ID}.firebaseapp.com`,
    projectId: PROJECT_ID,
  });
}

export const getFirebaseClientAuth = (): Auth => getAuth(getFirebaseClientApp());
