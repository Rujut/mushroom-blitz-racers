/**
 * Firebase config — loaded from environment variables only.
 * Copy .env.example → .env and fill in your Firebase project credentials.
 * Never hardcode API keys here; they will be exposed in a public repository.
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';

// All values must be set in your .env file (see .env.example)
const firebaseConfig = {
  apiKey:            process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  databaseURL:       process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
  measurementId:     process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

export const isFirebaseConfigured = true;

let _app: FirebaseApp | null = null;

export function getFirebaseApp(): FirebaseApp | null {
  try {
    if (_app) return _app;
    _app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    return _app;
  } catch (e) {
    console.warn('[Firebase] initializeApp failed:', e);
    return null;
  }
}
