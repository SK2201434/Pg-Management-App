import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, getReactNativePersistence, initializeAuth, type Auth } from "firebase/auth";
import { Platform } from "react-native";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};


const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// On native, Auth must be created with `initializeAuth` so the session persists in AsyncStorage
// (`getAuth` alone keeps it in memory and signs the user out on every restart). `initializeAuth`
// throws if Auth already exists for the app, e.g. after a Fast Refresh, so fall back to `getAuth`.
// On web the default browser persistence is used.
function createAuth(): Auth {
  if (Platform.OS === "web") return getAuth(app);
  try {
    return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  } catch (error) {
    if ((error as { code?: string }).code === "auth/already-initialized") return getAuth(app);
    throw error;
  }
}

let authInstance: Auth | undefined;

// Created on first use rather than at import time, so a misconfiguration (e.g. a missing API
// key) surfaces as an error the auth flow can show instead of crashing the app at startup.
// A failed attempt is not cached, so a retry tries again; later calls return the same instance.
function getFirebaseAuth(): Auth {
  authInstance ??= createAuth();
  return authInstance;
}

export { app, getFirebaseAuth };
