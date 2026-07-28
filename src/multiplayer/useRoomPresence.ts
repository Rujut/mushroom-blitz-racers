/**
 * useRoomPresence.ts
 *
 * Manages real-time RTDB presence for a multiplayer room:
 *   - Writes this player's slot on mount
 *   - Registers onDisconnect().remove() so the slot is cleaned up if device drops
 *   - Subscribes to the whole room node and syncs to roomStore
 *   - Unsubscribes + removes own slot on unmount
 */
import { useEffect, useRef } from 'react';
import {
  ref,
  set,
  onValue,
  onDisconnect,
  remove,
  update,
} from 'firebase/database';
import { getRTDB } from '@/src/firebase/rtdb';
import { useRoomStore, type RemotePlayerSlot } from './roomStore';
import type { CharacterId } from '@/src/constants/characters';

interface UseRoomPresenceOptions {
  roomCode: string;
  uid: string;
  displayName: string;
  character: CharacterId;
  color: string;
}

export function useRoomPresence({
  roomCode,
  uid,
  displayName,
  character,
  color,
}: UseRoomPresenceOptions) {
  const setRoomStatus = useRoomStore((s) => s.setRoomStatus);
  const updatePlayer  = useRoomStore((s) => s.updatePlayer);
  const setHostUid    = useRoomStore((s) => s.setHostUid);

  // Keep latest values in ref so cleanup can use them without re-subscribing
  const uidRef  = useRef(uid);
  const codeRef = useRef(roomCode);

  useEffect(() => {
    uidRef.current  = uid;
    codeRef.current = roomCode;
  });

  useEffect(() => {
    const db = getRTDB();
    if (!db || !roomCode || !uid) return;

    const playerRef = ref(db, `rooms/${roomCode}/players/${uid}`);
    const roomRef   = ref(db, `rooms/${roomCode}`);

    // Write our own slot
    const mySlot: RemotePlayerSlot = {
      uid, displayName, character, color,
      x: 80, y: 0, groundY: 300, distance: 0, hearts: 3,
      finished: false, finishTime: null, eliminated: false, ready: false,
      updatedAt: Date.now(),
    };
    set(playerRef, mySlot).catch(() => {});

    // Auto-remove when device disconnects
    onDisconnect(playerRef).remove().catch(() => {});

    // Subscribe to full room node
    const unsub = onValue(roomRef, (snapshot) => {
      const data = snapshot.val() as {
        host?: string;
        status?: string;
        startAt?: number | null;
        seed?: number;
        players?: Record<string, RemotePlayerSlot>;
      } | null;
      if (!data) return;

      // Sync room meta — use setHostUid NOT setRoom (setRoom wipes players)
      if (data.host) setHostUid(data.host);
      if (data.seed !== undefined) useRoomStore.getState().setSeed(data.seed);
      if (data.status) {
        setRoomStatus(data.status as any, data.startAt ?? null);
      }
      // Sync all player slots
      if (data.players) {
        Object.entries(data.players).forEach(([pid, slot]) => {
          updatePlayer(pid, slot);
        });
      }
    });

    return () => {
      unsub();
      // Remove own slot on clean unmount
      remove(playerRef).catch(() => {});
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, uid]);
}
