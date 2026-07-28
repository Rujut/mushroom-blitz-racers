/**
 * Lightweight physics smoke tests (run via npm run test:engine).
 */
import { GameEngine } from './GameEngine';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

export function runGameEngineTests(): void {
  const engine = new GameEngine('#f00');
  engine.configureViewport(800, 400);
  engine.start();
  engine.setInput({ right: true });

  let moved = false;
  for (let i = 0; i < 90; i++) {
    engine.tick(16.67);
    if (engine.getSnapshot().player.x > 90) moved = true;
  }
  assert(moved, 'Player should move right when holding right');

  engine.setInput({ right: false, left: false });
  for (let i = 0; i < 45; i++) engine.tick(16.67);
  const vxAfterRelease = engine.getSnapshot().player.vx;
  assert(Math.abs(vxAfterRelease) < 20, 'Player should decelerate to near-zero speed');

  engine.setInput({ jumpPressed: true });
  engine.tick(16.67);
  const vy1 = engine.getSnapshot().player.vy;
  assert(vy1 < 0, 'Jump should apply upward velocity');

  console.log('[GameEngine] All smoke tests passed.');
}

runGameEngineTests();
