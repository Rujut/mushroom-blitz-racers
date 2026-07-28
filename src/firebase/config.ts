/**
 * Firebase config — credentials hardcoded as fallback for APK/IPA builds.
 * Also initialises Firebase Auth with AsyncStorage persistence so the user
 * stays signed in across app restarts.
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';

// Primary: env vars (Expo Go / web dev server)
// Fallback: hardcoded values (APK/IPA builds where env vars aren't available)
const firebaseConfig = {
  apiKey:            process.env.EXPO_PUBLIC_FIREBASE_API_KEY            || 'AIzaSyBYvDRB4ZclpzDXizxcK6X0JtM3vxlhfpk',
  authDomain:        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN        || 'blitz-racer.firebaseapp.com',
  projectId:         process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID         || 'blitz-racer',
  storageBucket:     process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET     || 'blitz-racer.firebasestorage.app',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '689201498985',
  appId:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID             || '1:689201498985:web:a9b38f576168e3b58ccbf8',
  databaseURL:       process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL       || 'https://blitz-racer-default-rtdb.asia-southeast1.firebasedatabase.app',
  measurementId:     process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID     || 'G-Y70WBMD57N',
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
