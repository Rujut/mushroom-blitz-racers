/**
 * src/firebase/auth.ts
 *
 * Firebase Auth helpers — Google + Apple + Guest sign-in.
 *
 * Persistence strategy:
 *  - Web: uses firebase default (indexedDB) — sessions persist automatically
 *  - Native (Android/iOS): firebase v12 JS SDK doesn't expose
 *    getReactNativePersistence. Instead we store the Firebase ID token in
 *    AsyncStorage and use signInWithCredential on restart to restore the session.
 *    Firebase Auth itself handles token refresh once authenticated.
 */
import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import {
  getAuth,
  initializeAuth,
  signInAnonymously,
  signInWithCredential,
  GoogleAuthProvider,
  OAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged as _onAuthStateChanged,
  type User,
} from 'firebase/auth';
// @ts-ignore - Firebase types omit this for standard resolution, but RN bundler provides it
import { getReactNativePersistence } from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { getFirebaseApp } from './config';

export { type User };

// ── Auth instance (singleton) ──────────────────────────────────────────────────
let _auth: ReturnType<typeof getAuth> | null = null;

function getFirebaseAuth() {
  const app = getFirebaseApp();
  if (!app) return null;
  if (_auth) return _auth;
  try {
    if (Platform.OS === 'web') {
      _auth = getAuth(app);
    } else {
      _auth = initializeAuth(app, {
        persistence: getReactNativePersistence(ReactNativeAsyncStorage),
      });
    }
    return _auth;
  } catch (err: any) {
    if (err.code === 'auth/already-initialized') {
      _auth = getAuth(app);
      return _auth;
    }
    console.warn('[Firebase] Auth init failed:', err);
    return null;
  }
}

// ── Guest (anonymous) ─────────────────────────────────────────────────────────
export async function signInAsGuest(): Promise<User | null> {
  const auth = getFirebaseAuth();
  if (!auth) return null;
  const cred = await signInAnonymously(auth);
  return cred.user;
}

// ── Google Sign-In ────────────────────────────────────────────────────────────
export async function signInWithGoogle(): Promise<User | null> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Firebase not configured');

  if (Platform.OS === 'web') {
    const { signInWithPopup } = await import('firebase/auth');
    const provider = new GoogleAuthProvider();
    const result   = await signInWithPopup(auth, provider);
    return result.user;
  } else {
    const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
    if (isExpoGo) {
      throw new Error('Google Sign-In requires a custom dev client. It is not supported in Expo Go.');
    }

    const { GoogleSignin } = await import('@react-native-google-signin/google-signin');

    const webClientId =
      process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
      '689201498985-27pcgda2lkut855kffl8jalaanoe9m07.apps.googleusercontent.com';

    GoogleSignin.configure({ webClientId, offlineAccess: false });
    await GoogleSignin.hasPlayServices();
    // Always sign out first so the account picker shows ALL accounts
    // instead of auto-selecting the previously used account.
    try { await GoogleSignin.signOut(); } catch { /* ignore — may not be signed in */ }
    const signInResult = await GoogleSignin.signIn();
    const idToken = (signInResult as any)?.data?.idToken ?? (signInResult as any)?.idToken;
    if (!idToken) throw new Error('Google Sign-In: no idToken returned');
    const credential = GoogleAuthProvider.credential(idToken);
    const result = await signInWithCredential(auth, credential);
    return result.user;
  }
}

// ── Apple Sign-In ─────────────────────────────────────────────────────────────
export async function signInWithApple(): Promise<User | null> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Firebase not configured');
  if (Platform.OS !== 'ios') throw new Error('Apple Sign-In is only available on iOS');

  const AppleAuthentication = await import('expo-apple-authentication');
  const nonce      = Math.random().toString(36).substring(2, 18);
  const appleCred  = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });
  if (!appleCred.identityToken) throw new Error('Apple Sign-In: no identity token');
  const provider   = new OAuthProvider('apple.com');
  const credential = provider.credential({ idToken: appleCred.identityToken, rawNonce: nonce });
  const result     = await signInWithCredential(auth, credential);
  return result.user;
}

// ── Sign out ──────────────────────────────────────────────────────────────────
export async function signOutUser(): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth) return;

  // Sign out of Google natively too so the picker shows account selector next time
  if (Platform.OS !== 'web') {
    const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
    if (!isExpoGo) {
      try {
        const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
        await GoogleSignin.signOut();
      } catch { /* not signed in via Google — ignore */ }
    }
  }

  await firebaseSignOut(auth);
}

// ── Auth state listener ───────────────────────────────────────────────────────
export function onAuthChanged(cb: (user: User | null) => void): () => void {
  const auth = getFirebaseAuth();
  if (!auth) { cb(null); return () => {}; }
  return _onAuthStateChanged(auth, cb);
}
