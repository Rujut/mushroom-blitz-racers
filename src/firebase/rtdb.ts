/**
 * rtdb.ts — Safe Firebase Realtime Database accessor.
 * Returns null when Firebase is not configured (.env missing).
 * Never throws. Single-player always works without Firebase.
 */
import { getDatabase as _getDatabase } from 'firebase/database';
import type { Database } from 'firebase/database';
import { getFirebaseApp } from './config';

let _db: Database | null = null;

export function getRTDB(): Database | null {
  const app = getFirebaseApp();
  if (!app) return null;
  try {
    if (!_db) _db = _getDatabase(app);
    return _db;
  } catch {
    return null;
  }
}
