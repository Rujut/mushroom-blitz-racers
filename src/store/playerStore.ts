import { create } from 'zustand';
import type { CharacterId } from '@/src/constants/characters';
import { saveGameState } from '@/src/firebase/userProfile';

function generateGuestUid(): string {
  return 'guest_' + Math.random().toString(36).slice(2, 8) + '_' + Date.now().toString(36);
}
const SESSION_UID = generateGuestUid();

const ALL_CHARACTER_IDS: CharacterId[] = ['mario', 'luigi', 'peach', 'toad'];

interface PlayerState {
  uid: string;
  displayName: string;
  isFirebaseUser: boolean;
  isAnonymous: boolean;
  hasUsername: boolean;
  coins: number;
  selectedCharacterId: CharacterId;
  unlockedCharacterIds: CharacterId[];

  setSelectedCharacter: (id: CharacterId) => void;
  setDisplayName: (name: string) => void;
  addCoins: (amount: number) => void;
  setCoins: (amount: number) => void;
  /** Persist current game state to Firestore (fire-and-forget) */
  syncToCloud: () => void;
  setFirebaseUser: (user: {
    uid: string;
    displayName: string | null;
    isAnonymous: boolean;
    hasUsername: boolean;
    coins?: number;
    selectedCharacterId?: string;
    unlockedCharacterIds?: string[];
  } | null) => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  uid:                 SESSION_UID,
  displayName:         'Racer',
  isFirebaseUser:      false,
  isAnonymous:         false,
  hasUsername:         false,
  coins:               0,
  selectedCharacterId: 'mario',
  unlockedCharacterIds: ALL_CHARACTER_IDS,

  setSelectedCharacter: (id) => {
    set({ selectedCharacterId: id });
    // Auto-save to cloud when character changes
    const s = get();
    if (s.isFirebaseUser) {
      saveGameState(s.uid, {
        coins: s.coins,
        selectedCharacterId: id,
        unlockedCharacterIds: s.unlockedCharacterIds,
      }).catch(() => {});
    }
  },

  setDisplayName: (name) => set({ displayName: name }),
  addCoins:       (amount) => set((s) => ({ coins: s.coins + amount })),
  setCoins:       (amount) => set({ coins: amount }),

  syncToCloud: () => {
    const s = get();
    if (!s.isFirebaseUser) return;
    saveGameState(s.uid, {
      coins: s.coins,
      selectedCharacterId: s.selectedCharacterId,
      unlockedCharacterIds: s.unlockedCharacterIds,
    }).catch(() => {});
  },

  setFirebaseUser: (user) => {
    if (!user) {
      set({
        uid:            SESSION_UID,
        displayName:    'Racer',
        isFirebaseUser: false,
        isAnonymous:    false,
        hasUsername:    false,
        coins:          0,
        selectedCharacterId: 'mario',
        unlockedCharacterIds: ALL_CHARACTER_IDS,
      });
    } else {
      // Validate character IDs from DB
      const validCharIds = ALL_CHARACTER_IDS;
      const restoredChar =
        user.selectedCharacterId && validCharIds.includes(user.selectedCharacterId as CharacterId)
          ? (user.selectedCharacterId as CharacterId)
          : 'mario';
      const restoredUnlocked =
        user.unlockedCharacterIds && user.unlockedCharacterIds.length > 0
          ? (user.unlockedCharacterIds.filter(id => validCharIds.includes(id as CharacterId)) as CharacterId[])
          : ALL_CHARACTER_IDS;

      set({
        uid:            user.uid,
        displayName:    user.displayName ?? 'Racer',
        isFirebaseUser: true,
        isAnonymous:    user.isAnonymous,
        hasUsername:    user.hasUsername,
        coins:          user.coins ?? 0,
        selectedCharacterId: restoredChar,
        unlockedCharacterIds: restoredUnlocked.length > 0 ? restoredUnlocked : ALL_CHARACTER_IDS,
      });
    }
  },
}));
