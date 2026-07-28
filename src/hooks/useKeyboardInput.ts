import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

/**
 * Listens for keyboard events on web to control the game via arrow keys / WASD / space.
 * No-ops on native since controls are touch-based.
 */
export function useKeyboardInput(callbacks: {
  onLeft: (pressed: boolean) => void;
  onRight: (pressed: boolean) => void;
  onJump: () => void;
  enabled: boolean;
}) {
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  useEffect(() => {
    if (Platform.OS !== 'web' || !cbRef.current.enabled) return;

    const keysDown = new Set<string>();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (keysDown.has(e.code)) return; // prevent repeat
      keysDown.add(e.code);

      switch (e.code) {
        case 'ArrowLeft':
        case 'KeyA':
          e.preventDefault();
          cbRef.current.onLeft(true);
          break;
        case 'ArrowRight':
        case 'KeyD':
          e.preventDefault();
          cbRef.current.onRight(true);
          break;
        case 'ArrowUp':
        case 'Space':
        case 'KeyW':
          e.preventDefault();
          cbRef.current.onJump();
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysDown.delete(e.code);

      switch (e.code) {
        case 'ArrowLeft':
        case 'KeyA':
          e.preventDefault();
          cbRef.current.onLeft(false);
          break;
        case 'ArrowRight':
        case 'KeyD':
          e.preventDefault();
          cbRef.current.onRight(false);
          break;
      }
    };

    // Blur all inputs on mount to ensure key events reach window
    const handleBlur = () => {
      keysDown.clear();
      cbRef.current.onLeft(false);
      cbRef.current.onRight(false);
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    window.addEventListener('keyup', handleKeyUp, { passive: false });
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [callbacks.enabled]);
}
