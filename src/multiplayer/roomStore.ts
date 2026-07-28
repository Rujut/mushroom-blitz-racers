/**
 * roomStore.ts — Zustand store for multiplayer room state.
 * Tracks room code, player slots, host, race status, track type, and leaderboard.
 */
import { create } from 'zustand';
import type { CharacterId } from '@/src/constants/characters';
import type { PlayerAnimState } from '@/src/game/core/playerAnimation';

export type TrackType = 'endless' | 'km1' | 'km2' | 'km5';

/** Distance in metres for each track type (null = endless) */
export const TRACK_FINISH_M: Record<TrackType, number | null> = {
  endless: null,
  km1:     1000,
  km2:     2000,
  km5:     5000,
};

export interface RemotePlayerSlot {
  uid: string;
  displayName: string;
  character: CharacterId;
  color: string;
  /** World X position */
  x: number;
  /** World Y position (absolute, same coordinate space as local engine) */
  y: number;
  /** ground Y on the publishing device — used to normalise Y across screen sizes */
  groundY: number;
  distance: number;
  hearts: number;
  finished: boolean;
  /** Timestamp (ms) when this player finished — used for rank ordering */
  finishTime: number | null;
  /** True when eliminated in endless mode */
  eliminated: boolean;
  ready: boolean;
  updatedAt: number;
  // Skill & power state sync fields
  shieldActive?: boolean;
  powerActive?: boolean;
  speedBoostActive?: boolean;
  projectiles?: { id: string; x: number; y: number }[];
  // Animation state for accurate remote rendering
  animState?: PlayerAnimState;
  animFrame?: number;
  facingRight?: boolean;
  /** True when Luigi's ghost dash power is active */
  ghostDashActive?: boolean;
}

export type RoomStatus = 'waiting' | 'countdown' | 'racing' | 'finished';

interface RoomState {
  roomCode: string | null;
  hostUid: string | null;
  roomStatus: RoomStatus;
  startAt: number | null;
  trackType: TrackType;
  /** Leaderboard of finished players in order of finish (uid[]) */
  finishOrder: string[];
  players: Record<string, RemotePlayerSlot>;
  myUid: string | null;
  seed: number;

  setRoom: (code: string, hostUid: string) => void;
  setMyUid: (uid: string) => void;
  setHostUid: (hostUid: string) => void;
  setTrackType: (t: TrackType) => void;
  setSeed: (s: number) => void;
  updatePlayer: (uid: string, slot: Partial<RemotePlayerSlot>) => void;
  removePlayer: (uid: string) => void;
  setRoomStatus: (status: RoomStatus, startAt?: number | null) => void;
  recordFinish: (uid: string) => void;
  clearRoom: () => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  roomCode: null,
  hostUid: null,
  roomStatus: 'waiting',
  startAt: null,
  trackType: 'endless',
  finishOrder: [],
  players: {},
  myUid: null,
  seed: 0,

  setRoom: (code, hostUid) =>
    set({ roomCode: code, hostUid, roomStatus: 'waiting', players: {}, startAt: null, finishOrder: [], trackType: 'endless', seed: 0 }),
  setMyUid: (uid) => set({ myUid: uid }),
  setHostUid: (hostUid) => set({ hostUid }),
  setTrackType: (trackType) => set({ trackType }),
  setSeed: (s) => set({ seed: s }),
  updatePlayer: (uid, slot) =>
    set((s) => ({
      players: { ...s.players, [uid]: { ...s.players[uid], ...slot, uid } as RemotePlayerSlot },
    })),
  removePlayer: (uid) =>
    set((s) => {
      const next = { ...s.players }; delete next[uid]; return { players: next };
    }),
  setRoomStatus: (status, startAt = null) =>
    set({ roomStatus: status, startAt: startAt ?? null }),
  recordFinish: (uid) =>
    set((s) => ({
      finishOrder: s.finishOrder.includes(uid) ? s.finishOrder : [...s.finishOrder, uid],
    })),
  clearRoom: () =>
    set({ roomCode: null, hostUid: null, roomStatus: 'waiting', players: {}, startAt: null, myUid: null, finishOrder: [], trackType: 'endless', seed: 0 }),
}));
