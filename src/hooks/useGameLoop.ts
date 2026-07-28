import { useEffect, useRef } from 'react';

/**
 * Stable 60fps loop — callback stored in ref to avoid re-subscribing each render.
 * Works on both web (requestAnimationFrame) and React Native (global RAF polyfill).
 */
export function useGameLoop(
  enabled: boolean,
  onFrame: (deltaMs: number, timestamp: number) => void
) {
  const frameRef = useRef<number | null>(null);
  const lastRef = useRef<number>(0);
  const callbackRef = useRef(onFrame);
  callbackRef.current = onFrame;

  useEffect(() => {
    if (!enabled) return;

    let mounted = true;

    const loop = (timestamp: number) => {
      if (!mounted) return;
      // Cap delta to 50ms so a tab-switch or slow first frame doesn't cause a giant jump
      const rawDelta = lastRef.current ? timestamp - lastRef.current : 16;
      const delta = Math.min(rawDelta, 50);
      lastRef.current = timestamp;
      callbackRef.current(delta, timestamp);
      frameRef.current = requestAnimationFrame(loop);
    };

    lastRef.current = 0;
    frameRef.current = requestAnimationFrame(loop);

    return () => {
      mounted = false;
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [enabled]);
}

