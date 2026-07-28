import type { PlatformRect, PlayerBody } from './types';

export interface AABB {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function overlaps(a: AABB, b: AABB): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/** Resolve player vs platform using previous position for stable landing. */
export function resolvePlatformCollision(
  player: PlayerBody,
  platform: PlatformRect,
  prevX: number,
  prevY: number
): boolean {
  const pw = player.width;
  const ph = player.height;
  const prevBottom = prevY + ph;
  const currBottom = player.y + ph;

  const box = { x: player.x, y: player.y, width: pw, height: ph };
  if (!overlaps(box, platform)) {
    return false;
  }

  const landingOnTop =
    player.vy >= 0 &&
    prevBottom <= platform.y + 6 &&
    currBottom >= platform.y - 4 &&
    player.x + pw - 8 > platform.x &&
    player.x + 8 < platform.x + platform.width;

  if (landingOnTop) {
    player.y = platform.y - ph;
    player.vy = 0;
    player.onGround = true;
    player.jumpsUsed = 0;
    return true;
  }

  const overlapLeft = player.x + pw - platform.x;
  const overlapRight = platform.x + platform.width - player.x;
  const overlapTop = player.y + ph - platform.y;
  const overlapBottom = platform.y + platform.height - player.y;
  const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

  if (minOverlap === overlapBottom && player.vy < 0) {
    player.y = platform.y + platform.height;
    player.vy = 0;
  } else if (minOverlap === overlapLeft && prevX + pw <= platform.x + 4) {
    player.x = platform.x - pw;
    player.vx = 0;
  } else if (minOverlap === overlapRight && prevX >= platform.x + platform.width - 4) {
    player.x = platform.x + platform.width;
    player.vx = 0;
  }

  return false;
}
