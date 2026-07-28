import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { useCallback, useRef } from 'react';
import { SinglePlayerGame }   from '@/src/components/game/SinglePlayerGame';
import { MultiplayerGame }    from '@/src/components/game/MultiplayerGame';
import type { GameMode } from '@/src/game/core/types';
import type { TrackType } from '@/src/multiplayer/roomStore';

export default function GameScreen() {
  const { mode, ts, room, trackType } = useLocalSearchParams<{
    mode?: string; ts?: string; room?: string; trackType?: string;
  }>();

  const gameMode: GameMode = mode === 'multiplayer' ? 'multiplayer' : 'single';
  const roomCode  = room ?? '';
  const resolvedTrackType: TrackType =
    (['endless', 'km1', 'km2', 'km5'] as TrackType[]).includes(trackType as TrackType)
      ? (trackType as TrackType)
      : 'endless';

  const gameModeRef = useRef(gameMode);
  gameModeRef.current = gameMode;

  // Guard: prevent double-navigation (e.g. gameover + quit fire at the same tick)
  const navigatedRef = useRef(false);

  const handleFinish = useCallback(
    ({ distance, coins, rank, totalPlayers, leaderboard }: { distance: number; coins: number; rank?: number; totalPlayers?: number; leaderboard?: string }) => {
      if (navigatedRef.current) return;
      navigatedRef.current = true;

      // Delay navigation by one frame so React can clean up the game component
      // first. Navigating synchronously from an RAF callback while orientation
      // is changing causes a React Native bridge crash on Android.
      setTimeout(() => {
        try {
          router.replace({
            pathname: '/game/results',
            params: {
              rank:         String(rank ?? 1),
              totalPlayers: String(totalPlayers ?? 1),
              mode:         gameModeRef.current,
              distance:     String(distance),
              coins:        String(coins),
              leaderboard:  leaderboard ?? '',
            },
          });
        } catch (e) {
          console.error('[GameScreen] navigation error:', e);
          // Fallback — go home if results navigation fails
          try { router.replace('/(menu)/home'); } catch {}
        }
      }, 50);
    },
    [],
  );

  const handleQuit = useCallback(() => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    setTimeout(() => {
      try { router.replace('/(menu)/home'); } catch {}
    }, 50);
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      {gameMode === 'multiplayer' ? (
        <MultiplayerGame
          key={ts ?? 'mp-first'}
          roomCode={roomCode}
          trackType={resolvedTrackType}
          onFinish={handleFinish}
          onQuit={handleQuit}
        />
      ) : (
        <SinglePlayerGame
          key={ts ?? 'first'}
          onFinish={handleFinish}
          onQuit={handleQuit}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
});
