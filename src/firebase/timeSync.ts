/**
 * timeSync.ts
 *
 * Keeps track of the client's clock offset relative to the Firebase RTDB server.
 * Allows calculating the true server time locally to synchronize countdowns.
 */
import { ref, onValue } from 'firebase/database';
import { getRTDB } from './rtdb';

let offset = 0;
let unsubscribe: (() => void) | null = null;

export function initTimeSync() {
  const db = getRTDB();
  if (!db) return;
  if (unsubscribe) return; // Already tracking

  const offsetRef = ref(db, '.info/serverTimeOffset');
  unsubscribe = onValue(offsetRef, (snap) => {
    offset = snap.val() || 0;
  });
}

/**
 * Returns the estimated server time in milliseconds.
 * This should be used for countdowns and scheduling instead of Date.now().
 */
export function getServerTime(): number {
  return Date.now() + offset;
}
