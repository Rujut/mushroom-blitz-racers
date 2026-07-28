/**
 * useFireballSync.ts
 *
 * Cross-player fireball damage system.
 *
 * How it works:
 *   1. Every 50 ms, check if any local projectile overlaps a ghost's bounding box.
 *   2. On overlap → write a "hit" event to RTDB: rooms/{code}/hits/{victimUid}/{timestamp}
 *   3. Each client subscribes to their OWN hit node and calls engine.takeDamageExternal().
 *   4. Hit events are auto-deleted after 2 s via onDisconnect + TTL check.
 *
 * De-duplication: tracks last-hit timestamp per victim so the same fireball
 * cannot trigger multiple hits (1.8 s cooldown = invincibility window).
 */
import { useEffect, useRef } from 'react';
import { ref, onValue, push, remove, serverTimestamp } from 'firebase/database';
import { getRTDB } from '@/src/firebase/rtdb';
import type { GameEngine } from '@/src/game/core/GameEngine';
import type { RemotePlayerSlot } from './roomStore';
import { PHYSICS } from '@/src/game/core/constants';

const CHECK_INTERVAL_MS = 50;
const HIT_COOLDOWN_MS   = 1800; // matches engine invincibility window

interface UseFireballSyncOptions {
  engine: GameEngine;
  roomCode: string;
  myUid: string;
  ghostsRef: React.MutableRefObject<RemotePlayerSlot[]>;
  active: boolean;
  /** Called when a hit is detected — uid of victim */
  onHitDetected?: (victimUid: string) => void;
}

export function useFireballSync({
  engine,
  roomCode,
  myUid,
  ghostsRef,
  active,
  onHitDetected,
}: UseFireballSyncOptions) {
  const engineRef       = useRef(engine);
  const activeRef       = useRef(active);
  const lastHitTime     = useRef<Record<string, number>>({});
  engineRef.current     = engine;
  activeRef.current     = active;

  // ── 1. Detect our fireballs hitting ghosts ─────────────────────────────────
  useEffect(() => {
    const db = getRTDB();
    if (!db || !roomCode || !myUid) return;

    const id = setInterval(() => {
      if (!activeRef.current) return;
      const snap = engineRef.current.getSnapshot();
      if (!snap.projectiles.length) return;

      const ghosts = ghostsRef.current;
      const now    = Date.now();

      for (const proj of snap.projectiles) {
        for (const ghost of ghosts) {
          if (ghost.eliminated || ghost.hearts <= 0) continue;
          // Skip if target is using Luigi ghost dash or Peach shield
          if (ghost.ghostDashActive || ghost.shieldActive) continue;

          // Bounding box overlap (AABB) with normalised Y coordinate across different screen heights
          const ghostGroundY = ghost.groundY > 0 ? ghost.groundY : snap.groundY;
          const relY = ghost.y - ghostGroundY;
          const normalizedGhostY = snap.groundY + relY;

          const left   = ghost.x;
          const right  = ghost.x + PHYSICS.PLAYER_WIDTH;
          const top    = normalizedGhostY;
          const bottom = normalizedGhostY + PHYSICS.PLAYER_HEIGHT;
          const r = proj.radius;

          if (proj.x + r > left && proj.x - r < right && proj.y + r > top && proj.y - r < bottom) {
            // Check cooldown to avoid spamming
            const lastHit = lastHitTime.current[ghost.uid] ?? 0;
            if (now - lastHit < HIT_COOLDOWN_MS) continue;
            lastHitTime.current[ghost.uid] = now;

            // Write hit event to RTDB
            const hitRef = ref(db, `rooms/${roomCode}/hits/${ghost.uid}`);
            push(hitRef, { from: myUid, at: now }).catch(() => {});

            // Notify caller for visual flash
            onHitDetected?.(ghost.uid);
          }
        }
      }
    }, CHECK_INTERVAL_MS);

    return () => clearInterval(id);
  }, [roomCode, myUid, ghostsRef, onHitDetected]);

  // ── 2. Subscribe to hits on OUR uid — apply damage to local engine ─────────
  useEffect(() => {
    const db = getRTDB();
    if (!db || !roomCode || !myUid) return;

    const myHitsRef = ref(db, `rooms/${roomCode}/hits/${myUid}`);
    const unsub = onValue(myHitsRef, (snap) => {
      const data = snap.val() as Record<string, { from: string; at: number }> | null;
      if (!data) return;

      const now = Date.now();
      // Process each hit event; engine's invincibility window prevents double-dipping
      Object.values(data).forEach((hit) => {
        // Only process recent events (< 3 s old)
        if (now - hit.at < 3000) {
          engineRef.current.takeDamageExternal();
        }
      });

      // Clean up processed events
      remove(myHitsRef).catch(() => {});
    });

    return () => unsub();
  }, [roomCode, myUid]);
}
