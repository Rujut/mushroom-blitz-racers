/**
 * src/firebase/userProfile.ts
 *
 * Firestore user profile management.
 * Profile includes: displayName, username, isAnonymous, coins.
 * Coins are persisted so they survive sign-out and app restarts.
 */
import { getFirestore, doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getFirebaseApp } from './config';

let _db: ReturnType<typeof getFirestore> | null = null;
function getDB() {
  try {
    const app = getFirebaseApp();
    if (!app) return null;
    _db = _db ?? getFirestore(app);
    return _db;
  } catch {
    return null;
  }
}

export interface UserProfile {
  uid: string;
  username: string;
  displayName: string;
  isAnonymous: boolean;
  coins: number;
  selectedCharacterId?: string;
  unlockedCharacterIds?: string[];
  createdAt: any;
}

/** Fetch user profile — returns null if not found (new user). */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const db = getDB();
  if (!db) return null;
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

/** Save user profile to Firestore. Also reserves the username in /usernames/. */
export async function saveUserProfile(
  uid: string,
  username: string,
  displayName: string,
  isAnonymous: boolean,
  coins = 0,
): Promise<void> {
  const db = getDB();
  if (!db) return;

  const profile: UserProfile = {
    uid, username, displayName, isAnonymous, coins,
    createdAt: serverTimestamp(),
  };

  await setDoc(doc(db, 'users', uid), profile, { merge: true });

  // Reserve username in /usernames/ for uniqueness checks.
  // Non-fatal: if Firestore rules haven't been updated yet this won't block the user.
  try {
    await setDoc(doc(db, 'usernames', username.toLowerCase()), { uid }, { merge: false });
  } catch (e: any) {
    // Log but don't rethrow — the core profile is already saved.
    console.warn('[userProfile] username reservation failed (check Firestore rules):', e?.code, e?.message);
  }
}

/** Save coins to Firestore (called after each game). Fire-and-forget. */
export async function saveCoins(uid: string, coins: number): Promise<void> {
  const db = getDB();
  if (!db) return;
  try {
    await updateDoc(doc(db, 'users', uid), { coins });
  } catch {
    await setDoc(doc(db, 'users', uid), { coins }, { merge: true });
  }
}

/** Save full game state (coins + character selection). Fire-and-forget. */
export async function saveGameState(
  uid: string,
  data: { coins: number; selectedCharacterId: string; unlockedCharacterIds: string[] },
): Promise<void> {
  const db = getDB();
  if (!db) return;
  try {
    await updateDoc(doc(db, 'users', uid), data);
  } catch {
    await setDoc(doc(db, 'users', uid), data, { merge: true });
  }
}

/** Returns true if username is already taken. */
export async function isUsernameTaken(username: string): Promise<boolean> {
  const db = getDB();
  if (!db) return false;
  const snap = await getDoc(doc(db, 'usernames', username.toLowerCase()));
  return snap.exists();
}

/** Subscribe to user profile for real-time syncing. Returns an unsubscribe function. */
import { onSnapshot } from 'firebase/firestore';

export function subscribeToUserProfile(uid: string, onUpdate: (profile: UserProfile | null) => void): () => void {
  const db = getDB();
  if (!db) return () => {};
  return onSnapshot(doc(db, 'users', uid), (snap) => {
    onUpdate(snap.exists() ? (snap.data() as UserProfile) : null);
  }, (err) => {
    console.error("Profile sync error:", err);
  });
}
