import { COIN, WORLD } from '@/src/game/core/constants';
import type { CoinEntity, EnemyEntity, HeartEntity, PlatformRect, SpikeEntity } from '@/src/game/core/types';

let idCounter = 0;
const nextId = (prefix: string) => `${prefix}-${idCounter++}`;

export let GLOBAL_SEED_OFFSET = 0;
export function randomizeLevelSeed() {
  GLOBAL_SEED_OFFSET = Math.floor(Math.random() * 1000000);
}
export function setLevelSeed(seed: number) {
  GLOBAL_SEED_OFFSET = seed;
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export interface LevelSegment {
  platforms: PlatformRect[];
  coins: CoinEntity[];
  enemies: EnemyEntity[];
  spikes: SpikeEntity[];
  hearts: HeartEntity[];
  endX: number;
}

/**
 * Procedural segment generator.
 * difficulty 0→1 scales gaps, spikes, and enemy density.
 */
export function generateSegment(
  startX: number,
  groundY: number,
  segmentIndex: number,
  difficulty = 0
): LevelSegment {
  const rand = seededRandom(segmentIndex * 9973 + 42 + GLOBAL_SEED_OFFSET);
  const rand2 = seededRandom(segmentIndex * 3571 + 17 + GLOBAL_SEED_OFFSET); // second stream for enemies
  const platforms: PlatformRect[] = [];
  const coins: CoinEntity[] = [];
  const enemies: EnemyEntity[] = [];
  const spikes: SpikeEntity[] = [];
  const hearts: HeartEntity[] = [];
  const w = WORLD.SEGMENT_WIDTH;
  const groundH = WORLD.GROUND_HEIGHT;

  // Safe start — always solid ground in first 2 segments
  if (segmentIndex < WORLD.SAFE_SEGMENT_COUNT) {
    platforms.push({ id: nextId('plat'), x: startX, y: groundY, width: w, height: groundH });
    coins.push({ id: nextId('coin'), x: startX + w * 0.35, y: groundY - 40, radius: COIN.RADIUS, collected: false });
    coins.push({ id: nextId('coin'), x: startX + w * 0.65, y: groundY - 40, radius: COIN.RADIUS, collected: false });
    return { platforms, coins, enemies, spikes, hearts, endX: startX + w };
  }

  // ── Ground / gap layout ───────────────────────────────────────────────────
  const gapChance = 0.22 + 0.28 * difficulty;
  const maxGapWidth = 100 + 180 * difficulty;
  let hasLeftGround = true;
  let hasRightGround = true;
  let groundLeftEnd = startX + w;   // end X of left ground piece
  let groundRightStart = startX;    // start X of right ground piece (if gap exists)

  if (rand() < gapChance) {
    const gapWidth = 80 + rand() * maxGapWidth;
    const leftW = (w - gapWidth) * (0.3 + rand() * 0.25);
    const rightW = Math.max(80, w - leftW - gapWidth);

    platforms.push({ id: nextId('plat'), x: startX, y: groundY, width: leftW, height: groundH });
    platforms.push({ id: nextId('plat'), x: startX + leftW + gapWidth, y: groundY, width: rightW, height: groundH });
    groundLeftEnd   = startX + leftW;
    groundRightStart = startX + leftW + gapWidth;
    hasRightGround  = rightW > 0;
  } else {
    platforms.push({ id: nextId('plat'), x: startX, y: groundY, width: w, height: groundH });
  }

  // ── Floating platforms ────────────────────────────────────────────────────
  const maxFloat = difficulty < 0.6 ? 2 : 1;
  const floatCount = Math.floor(rand() * (maxFloat + 1));
  for (let i = 0; i < floatCount; i++) {
    const fx = startX + 80 + rand() * (w - 160);
    const fy = groundY - 70 - rand() * (80 + 40 * difficulty);
    const fw = Math.max(50, 80 - rand() * 30 * difficulty);
    platforms.push({ id: nextId('float'), x: fx, y: fy, width: fw, height: 20, variant: Math.floor(rand() * 2) });
    
    // ~12% chance to spawn a heart on a floating platform (approx 1 per km)
    if (rand() < 0.12) {
      hearts.push({ id: nextId('heart'), x: fx + fw / 2, y: fy - 35, collected: false });
    } else if (rand() > 0.35 + 0.2 * difficulty) {
      coins.push({ id: nextId('coin'), x: fx + fw / 2, y: fy - 28, radius: COIN.RADIUS, collected: false });
    }
  }

  // ── Ground coins ──────────────────────────────────────────────────────────
  const maxGroundCoins = Math.max(1, Math.floor(4 - difficulty * 2));
  const coinCount = 1 + Math.floor(rand() * maxGroundCoins);
  for (let i = 0; i < coinCount; i++) {
    coins.push({
      id: nextId('coin'),
      x: startX + 60 + rand() * (w - 120),
      y: groundY - 36,
      radius: COIN.RADIUS,
      collected: false,
    });
  }

  // ── Spikes (ground hazards) ───────────────────────────────────────────────
  // Appear from difficulty 0.15 onward; chance scales with difficulty
  const spikeChance = Math.max(0, (difficulty - 0.15) * 0.7);
  if (rand2() < spikeChance) {
    // Place spikes on the left ground piece (if it exists and is wide enough)
    const spikeSection = groundLeftEnd - startX;
    if (spikeSection > 120) {
      const spikeW = 18 + Math.floor(rand2() * 3) * 18; // 18, 36, or 54 px wide (1–3 spikes)
      const spikeX = startX + 60 + rand2() * (spikeSection - 80);
      const spikeH = 22;
      spikes.push({
        id: nextId('spike'),
        x: spikeX,
        y: groundY - spikeH,
        width: spikeW,
        height: spikeH,
      });
    }
  }

  // ── Enemies ───────────────────────────────────────────────────────────────
  // Appear from difficulty 0.1; up to 2 enemies per segment at max difficulty
  const enemyChance = Math.max(0, (difficulty - 0.1) * 0.8);
  const enemyCount = rand2() < enemyChance ? (rand2() < 0.4 + difficulty * 0.3 ? 2 : 1) : 0;

  for (let i = 0; i < enemyCount; i++) {
    const r = rand2();
    if (r < 0.34) {
      // FLY — floats in air above ground
      const flyX = startX + 80 + rand2() * (w - 160);
      const flyY = groundY - 100 - rand2() * 60;
      enemies.push({
        id: nextId('fly'),
        type: 'fly',
        x: flyX, y: flyY,
        width: 28, height: 16,
        vx: 0, vy: 0,
        dead: false,
        originX: flyX, originY: flyY,
        phaseOrTimer: rand2() * Math.PI * 2,
      });
    } else if (r < 0.67) {
      // BUG — patrols on ground
      if (groundLeftEnd - startX > 80) {
        const bugX = startX + 60 + rand2() * Math.max(10, groundLeftEnd - startX - 80);
        const bugY = groundY - 20;
        enemies.push({
          id: nextId('bug'),
          type: 'bug',
          x: bugX, y: bugY,
          width: 36, height: 30,
          vx: (rand2() > 0.5 ? 1 : -1) * (60 + rand2() * 40),
          vy: 0,
          dead: false,
          originX: bugX, originY: bugY,
          phaseOrTimer: 0,
        });
      }
    } else {
      // FROG — jumps on ground
      if (hasRightGround) {
        const frogX = groundRightStart + 30 + rand2() * 80;
        const frogY = groundY - 26;
        enemies.push({
          id: nextId('frog'),
          type: 'frog',
          x: frogX, y: frogY,
          width: 26, height: 26,
          vx: 0, vy: 0,
          dead: false,
          originX: frogX, originY: frogY,
          phaseOrTimer: 0.5 + rand2() * 1.5, // initial jump delay
        });
      }
    }
  }

  return { platforms, coins, enemies, spikes, hearts, endX: startX + w };
}

export function generateInitialWorld(
  groundY: number,
  segmentCount: number
): { platforms: PlatformRect[]; coins: CoinEntity[]; enemies: EnemyEntity[]; spikes: SpikeEntity[]; hearts: HeartEntity[] } {
  idCounter = 0;
  const platforms: PlatformRect[] = [];
  const coins: CoinEntity[] = [];
  const enemies: EnemyEntity[] = [];
  const spikes: SpikeEntity[] = [];
  const hearts: HeartEntity[] = [];
  let x = 0;
  for (let i = 0; i < segmentCount; i++) {
    const seg = generateSegment(x, groundY, i, 0);
    platforms.push(...seg.platforms);
    coins.push(...seg.coins);
    enemies.push(...seg.enemies);
    spikes.push(...seg.spikes);
    hearts.push(...seg.hearts);
    x = seg.endX;
  }
  return { platforms, coins, enemies, spikes, hearts };
}

export function appendSegments(
  platforms: PlatformRect[],
  coins: CoinEntity[],
  enemies: EnemyEntity[],
  spikes: SpikeEntity[],
  hearts: HeartEntity[],
  fromX: number,
  groundY: number,
  startIndex: number,
  count: number,
  difficulty = 0
): number {
  let x = fromX;
  let idx = startIndex;
  for (let i = 0; i < count; i++) {
    const seg = generateSegment(x, groundY, idx++, difficulty);
    platforms.push(...seg.platforms);
    coins.push(...seg.coins);
    enemies.push(...seg.enemies);
    spikes.push(...seg.spikes);
    hearts.push(...seg.hearts);
    x = seg.endX;
  }
  return x;
}
