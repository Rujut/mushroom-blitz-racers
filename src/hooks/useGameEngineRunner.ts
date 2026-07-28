import { useCallback, useEffect, useRef, useState } from 'react';
import { GameEngine } from '@/src/game/core/GameEngine';
import { useGameLoop } from './useGameLoop';
import type { GameSnapshot } from '@/src/game/core/types';
import { qualityManager } from '../utils/QualityManager';

interface UseGameEngineRunnerOptions {
  engine: GameEngine;
  enabled: boolean;
  finishDistance: number;
  onFinish: (stats: { distance: number; coins: number }) => void;
}

interface HudState {
  distance: number;
  coins: number;
  hearts: number;
  maxHearts: number;
  invincible: boolean;
}

/**
 * Drives the game engine at 60fps.
 *
 * PERF CHANGE: Was previously calling setHud() + setFrame() every frame
 * = 2 React state updates = 2 re-renders @ 60fps = 120 re-renders/sec.
 * Now uses a single merged setGameState() = 1 re-render @ 60fps = 60/sec.
 * That alone halves all downstream render work on low-RAM devices.
 *
 * Also exposes `snapshotRef` so parent components (SinglePlayerGame,
 * MultiplayerGame) can read the last snapshot without calling
 * engine.getSnapshot() again (which was allocating new entity arrays
 * on every render, adding GC pressure).
 */
export function useGameEngineRunner({
  engine,
  enabled,
  finishDistance,
  onFinish,
}: UseGameEngineRunnerOptions) {
  const finishedRef = useRef(false);
  const frameRef    = useRef(0);
  const mountedRef  = useRef(true);

  const lastHudUpdateRef = useRef(0);

  /** Last computed snapshot — shared with parent components via ref (zero copy). */
  const snapshotRef = useRef<GameSnapshot | null>(null);

  // ── Single merged state — ONE setState = ONE re-render per frame ───────────
  const [hud, setHud] = useState<HudState>({
    distance: 0, coins: 0, hearts: 3, maxHearts: 3, invincible: false,
  });
  const [loopActive, setLoopActive] = useState(false);

  // Reset when engine/enabled changes
  useEffect(() => {
    finishedRef.current = false;
    frameRef.current    = 0;
    setLoopActive(enabled);
  }, [engine, enabled]);

  // Track mount
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Prime first frame
  useEffect(() => {
    if (!enabled) return;
    try {
      engine.tick(16);
      const snap = engine.getSnapshot();
      snapshotRef.current = snap;
      if (!mountedRef.current) return;
      setHud({
        distance:   snap.distance,
        coins:      snap.coinsCollected,
        hearts:     snap.hearts,
        maxHearts:  snap.maxHearts,
        invincible: snap.invincible,
      });
    } catch (e) {
      console.warn('[Runner] prime tick error:', e);
    }
  }, [enabled, engine]);

  const onFrame = useCallback(
    (deltaMs: number) => {
      if (!mountedRef.current) return;

      // Performance monitoring
      if (deltaMs > 25) {
        qualityManager.reportSlowFrame();
      } else {
        qualityManager.reportFastFrame();
      }

      // Ghost mode — keep ticking but don't fire onFinish again
      const engineStatus = engine.getStatus();
      if (engineStatus === 'ghost') {
        try { engine.tick(deltaMs); } catch { /* ignore */ }
        if (!mountedRef.current) return;
        const snap = engine.getSnapshot();
        snapshotRef.current = snap;
        frameRef.current += 1;
        
        const now = Date.now();
        if (mountedRef.current && now - lastHudUpdateRef.current > 100) {
          lastHudUpdateRef.current = now;
          setHud({
            distance:   snap.distance,
            coins:      snap.coinsCollected,
            hearts:     snap.hearts,
            maxHearts:  snap.maxHearts,
            invincible: snap.invincible,
          });
        }
        return;
      }

      if (finishedRef.current) return;

      try {
        engine.tick(deltaMs);
      } catch (e) {
        console.error('[Runner] engine tick crashed:', e);
        finishedRef.current = true;
        setLoopActive(false);
        return;
      }

      if (!mountedRef.current) return;

      const snap = engine.getSnapshot();
      snapshotRef.current = snap; // store for parent components — no extra allocation
      frameRef.current += 1;

      const hud: HudState = {
        distance:   snap.distance,
        coins:      snap.coinsCollected,
        hearts:     snap.hearts,
        maxHearts:  snap.maxHearts,
        invincible: snap.invincible,
      };

      // Distance finish
      if (snap.distance >= finishDistance) {
        finishedRef.current = true;
        setHud(hud);
        onFinish({ distance: snap.distance, coins: snap.coinsCollected });
        if (engine.getStatus() !== 'ghost') {
          setLoopActive(false);
        }
        return;
      }

      // Game over (all hearts lost)
      if (snap.status === 'gameover') {
        finishedRef.current = true;
        setHud(hud);
        onFinish({ distance: snap.distance, coins: snap.coinsCollected });
        if (engine.getStatus() !== 'ghost') {
          setLoopActive(false);
        }
        return;
      }

      // Throttle HUD updates to 10fps (every 100ms) to unblock JS thread
      const now = Date.now();
      if (mountedRef.current && now - lastHudUpdateRef.current > 100) {
        lastHudUpdateRef.current = now;
        setHud(hud);
      }
    },
    [engine, finishDistance, onFinish],
  );

  useGameLoop(loopActive, onFrame);

  return { hud, snapshotRef };
}
