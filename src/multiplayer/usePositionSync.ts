/**
 * usePositionSync.ts
 *
 * Throttled position publisher — pushes local player state to RTDB at ~20 Hz.
 * Publishes groundY so receiving devices can correctly normalise Y position
 * across different screen sizes (ghost Y-fix).
 */
import { useEffect, useRef } from 'react';
import { ref, update } from 'firebase/database';
import { getRTDB } from '@/src/firebase/rtdb';
import type { GameEngine } from '@/src/game/core/GameEngine';

interface UsePositionSyncOptions {
  engine: GameEngine;
  roomCode: string;
  uid: string;
  active: boolean;
}

import { qualityManager } from '@/src/utils/QualityManager';

export function usePositionSync({ engine, roomCode, uid, active }: UsePositionSyncOptions) {
  const profile = qualityManager.getProfile();
  const PUBLISH_HZ = profile.syncRateHz;
  const PUBLISH_INTERVAL_MS = 1000 / PUBLISH_HZ;
  const engineRef = useRef(engine);
  const activeRef = useRef(active);
  engineRef.current = engine;
  activeRef.current = active;

  useEffect(() => {
    const db = getRTDB();
    if (!db || !roomCode || !uid) return;

    const playerRef = ref(db, `rooms/${roomCode}/players/${uid}`);

    const id = setInterval(() => {
      if (!activeRef.current) return;
      const snap = engineRef.current.getSnapshot();
      const isGhostOrDead = snap.status === 'gameover' || snap.status === 'ghost';
      // Don't overwrite eliminated/hearts/distance when in ghost mode —
      // those are set once by MultiplayerGame.handleGameFinish
      const payload: Record<string, any> = {
        x:         Math.round(snap.player.x),
        y:         Math.round(snap.player.y),
        gy:        Math.round(snap.groundY),
        updatedAt: Date.now(),
        sA:        !!snap.effects.shield,
        pA:        !!snap.power.active,
        sb:        !!snap.effects.speedBoost,
        gD:        !!snap.effects.ghost, // Luigi ghost dash active
        // Animation state for accurate remote rendering
        aS:        snap.player.animState,
        aF:        snap.player.animFrame,
        fR:        snap.player.facingRight ? 1 : 0,
        proj:      snap.projectiles.length > 0 
                     ? snap.projectiles.map(p => ({ id: p.id, x: Math.round(p.x), y: Math.round(p.y) }))
                     : null,
      };
      
      if (!isGhostOrDead) {
        // Only update game stats while alive
        payload.d = snap.distance;
        payload.h = snap.hearts;
      }
      update(playerRef, payload).catch(() => {});
    }, PUBLISH_INTERVAL_MS);

    return () => clearInterval(id);
  }, [roomCode, uid]);
}
