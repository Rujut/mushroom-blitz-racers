import { createElement } from 'react';
import type { GameSnapshot } from '@/src/game/core/types';
import ParallaxBackground from './ParallaxBackground';
import ParallaxGround from './ParallaxGround';
import GameCanvasWeb2D from './GameCanvasWeb2D';

interface GameCanvasProps {
  snapshot: GameSnapshot;
  width: number;
  height: number;
}

/**
 * Web GameCanvas: HTML forest background + transparent 2D canvas foreground.
 */
export function GameCanvas({ snapshot, width, height }: GameCanvasProps) {
  return createElement(
    'div',
    {
      style: {
        position: 'relative',
        width,
        height,
        overflow: 'hidden',
        pointerEvents: 'none',
      },
    },
    createElement(ParallaxBackground, {
      scrollX: snapshot.cameraX,
      width,
      height,
    }),
    createElement(ParallaxGround, {
      scrollX: snapshot.cameraX,
      width,
      height,
      groundY: height * 0.72,
    }),
    createElement(
      'div',
      {
        style: {
          position: 'absolute',
          top: 0,
          left: 0,
          width,
          height,
          zIndex: 1,
          pointerEvents: 'none',
        },
      },
      createElement(GameCanvasWeb2D, { snapshot, width, height }),
    ),
  );
}
