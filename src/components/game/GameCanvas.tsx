import React from 'react';
import { StyleSheet, View } from 'react-native';
import GameCanvasCore from './GameCanvasCore';
import type { GameSnapshot } from '@/src/game/core/types';

interface GameCanvasProps {
  snapshotRef: React.MutableRefObject<GameSnapshot | null>;
  ghostsRef?: React.MutableRefObject<any[]>;
  width: number;
  height: number;
  finishDistance?: number;
}

/**
 * Native GameCanvas — now using pure Skia (GameCanvasCore).
 * Eliminates React Native bridge layout stutter and compositor clipping bugs.
 */
export function GameCanvas({ snapshotRef, ghostsRef, width, height, finishDistance }: GameCanvasProps) {
  const [, setTick] = React.useState(0);

  // Autonomous 60fps render loop for the Canvas.
  // Skips React diffing for the parent UI entirely.
  React.useEffect(() => {
    let rafId: number;
    const loop = () => {
      setTick((t) => t + 1);
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const snapshot = snapshotRef.current;
  if (!snapshot) return null;

  return (
    <View style={[styles.wrap, { width, height }]} pointerEvents="none">
      <GameCanvasCore snapshot={snapshot} ghostsRef={ghostsRef} width={width} height={height} finishDistance={finishDistance} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
  },
});
