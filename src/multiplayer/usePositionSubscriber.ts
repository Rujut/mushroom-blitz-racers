/**
 * usePositionSubscriber.ts
 *
 * Subscribes to remote player positions in RTDB.
 * Stores them in a React REF — never calls setState or Zustand.
 * This means ghost updates NEVER trigger re-renders in MultiplayerGame.
 * MultiplayerGame reads ghostsRef.current on each 60 Hz game-loop render frame.
 *
 * Also writes + keeps own position slot alive (initial write + onDisconnect cleanup).
 * usePositionSync runs separately to update x/y at 20 Hz.
 */
import { useEffect, useRef } from 'react';
import { ref, onChildAdded, onChildChanged, onChildRemoved, onDisconnect, set } from 'firebase/database';
import { getRTDB } from '@/src/firebase/rtdb';
import type { RemotePlayerSlot } from './roomStore';
import type { CharacterId } from '@/src/constants/characters';
import type { PlayerAnimState } from '@/src/game/core/playerAnimation';

interface UsePositionSubscriberOptions {
  roomCode: string;
  uid: string;
  displayName: string;
  character: CharacterId;
  color: string;
}

export function usePositionSubscriber({
  roomCode,
  uid,
  displayName,
  character,
  color,
}: UsePositionSubscriberOptions): React.MutableRefObject<RemotePlayerSlot[]> {
  /** Ghost positions for OTHER players — updated directly (no setState). */
  const ghostsRef = useRef<RemotePlayerSlot[]>([]);

  useEffect(() => {
    if (!roomCode || !uid) return;
    const db = getRTDB();
    if (!db) return;

    const playerRef  = ref(db, `rooms/${roomCode}/players/${uid}`);
    const playersRef = ref(db, `rooms/${roomCode}/players`);

    // Write own presence slot
    const mySlot: RemotePlayerSlot = {
      uid, displayName, character, color,
      x: 80, y: 0, groundY: 300, distance: 0, hearts: 3,
      finished: false, finishTime: null, eliminated: false, ready: false,
      updatedAt: Date.now(),
    };
    set(playerRef, mySlot).catch(() => {});

    // Auto-remove when device disconnects / app backgrounds
    onDisconnect(playerRef).remove().catch(() => {});

    // Subscribe using child events to prevent massive full-room JSON parsing on every tick
    // Compressed keys: x, y, gy (groundY), d (distance), h (hearts), f (finished), e (eliminated), sA (shieldActive), pA (powerActive), sb (speedBoostActive)
    const parseSlot = (key: string, val: any): RemotePlayerSlot => {
      return {
        uid: key,
        displayName: val.displayName || 'Player',
        character: val.character || 'mario',
        color: val.color || '#aaa',
        x: val.x ?? 0,
        y: val.y ?? 0,
        groundY: val.gy ?? val.groundY ?? 300,
        distance: val.d ?? val.distance ?? 0,
        hearts: val.h ?? val.hearts ?? 0,
        finished: !!(val.f ?? val.finished),
        finishTime: val.finishTime || null,
        eliminated: !!(val.e ?? val.eliminated),
        ready: !!val.ready,
        updatedAt: val.updatedAt || Date.now(),
        shieldActive: !!(val.sA ?? val.shieldActive),
        powerActive: !!(val.pA ?? val.powerActive),
        speedBoostActive: !!(val.sb ?? val.speedBoostActive),
        // Animation state
        animState: (val.aS ?? val.animState ?? 'run') as PlayerAnimState,
        animFrame: val.aF ?? val.animFrame ?? 0,
        facingRight: val.fR != null ? !!val.fR : (val.facingRight ?? true),
        projectiles: val.proj || [],
        ghostDashActive: !!(val.gD ?? val.ghostDashActive),
      };
    };

    const unsubAdded = onChildAdded(playersRef, (snap) => {
      if (snap.key === uid) return;
      const slot = parseSlot(snap.key!, snap.val());
      ghostsRef.current.push(slot);
    });

    const unsubChanged = onChildChanged(playersRef, (snap) => {
      if (snap.key === uid) return;
      const slot = parseSlot(snap.key!, snap.val());
      const idx = ghostsRef.current.findIndex(g => g.uid === snap.key);
      if (idx !== -1) {
        // In-place mutation to avoid array allocation GC overhead!
        ghostsRef.current[idx] = slot;
      } else {
        ghostsRef.current.push(slot);
      }
    });

    const unsubRemoved = onChildRemoved(playersRef, (snap) => {
      // In-place filter
      const idx = ghostsRef.current.findIndex(g => g.uid === snap.key);
      if (idx !== -1) ghostsRef.current.splice(idx, 1);
    });

    return () => {
      unsubAdded();
      unsubChanged();
      unsubRemoved();
      // Keep slot in database so other players still in the race can see our final standings.
      // onDisconnect(playerRef).remove() will clean up if the app/connection closes.
    };
  // Only re-run if room or identity changes (stable for a session)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, uid]);

  return ghostsRef;
}
