/**
 * useAuthState.ts
 *
 * Background auth listener mounted in _layout.tsx.
 * ONLY syncs Firebase user state to playerStore.
 * Does NOT navigate — login.tsx and index.tsx handle their own navigation
 * to avoid race conditions where both listeners try to navigate at once.
 */
import { useEffect } from 'react';
import { onAuthChanged } from './auth';
import { subscribeToUserProfile } from './userProfile';
import { usePlayerStore } from '@/src/store/playerStore';

export function useAuthState() {
  const setFirebaseUser = usePlayerStore((s) => s.setFirebaseUser);

  useEffect(() => {
    let profileUnsub: (() => void) | null = null;

    const authUnsub = onAuthChanged((user) => {
      // Clean up previous profile listener if it exists
      if (profileUnsub) {
        profileUnsub();
        profileUnsub = null;
      }

      if (!user) {
        setFirebaseUser(null);
        return;
      }

      // Default state while waiting for profile
      const defaultDisplayName = user.displayName ?? 'Racer';
      
      // Initially set user without profile
      setFirebaseUser({
        uid: user.uid, displayName: defaultDisplayName, isAnonymous: user.isAnonymous,
        hasUsername: false, coins: 0, selectedCharacterId: undefined, unlockedCharacterIds: undefined,
      });

      // Subscribe to real-time profile updates
      profileUnsub = subscribeToUserProfile(user.uid, (profile) => {
        if (profile) {
          setFirebaseUser({
            uid: user.uid,
            displayName: profile.displayName,
            isAnonymous: user.isAnonymous,
            hasUsername: true,
            coins: profile.coins ?? 0,
            selectedCharacterId: profile.selectedCharacterId,
            unlockedCharacterIds: profile.unlockedCharacterIds,
          });
        }
      });
      
      // NOTE: No router.replace() here!
      // Navigation is handled by:
      //   - app/index.tsx (splash screen) for cold start
      //   - app/(auth)/login.tsx for manual sign-in
    });

    return () => {
      authUnsub();
      if (profileUnsub) profileUnsub();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
