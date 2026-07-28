export interface Vector2 {
  x: number;
  y: number;
}

export type GameMode = 'single' | 'multiplayer';
export type RaceStatus = 'idle' | 'playing' | 'paused' | 'gameover' | 'ghost';

export interface PlatformRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  variant?: number;
}

export interface CoinEntity {
  id: string;
  x: number;
  y: number;
  radius: number;
  collected: boolean;
}

export interface HeartEntity {
  id: string;
  x: number;
  y: number;
  collected: boolean;
}

export interface PlayerBody {
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
  onGround: boolean;
  jumpsUsed: number;
  color: string;
}

/** Smoothed position used only for drawing. */
export interface PlayerRenderState extends PlayerBody {
  renderX: number;
  renderY: number;
  /** Current animation state (idle, run, jump, fall, land). */
  animState: 'idle' | 'run' | 'jump' | 'fall' | 'land';
  /** Current frame index within the active animation. */
  animFrame: number;
  /** True when facing right; false when facing left. */
  facingRight: boolean;
  /** True on the exact frame the player touches ground after being airborne. */
  landedThisFrame: boolean;
  /** Horizontal scale for landing squash/stretch effect (1 = normal). */
  landScaleX: number;
  /** Vertical scale for landing squash/stretch effect (1 = normal). */
  landScaleY: number;
}

export interface GameInput {
  left: boolean;
  right: boolean;
  jumpPressed: boolean;
  /** Momentary press to activate character power */
  powerPressed: boolean;
}

// ── Part 3: Power types ──────────────────────────────────────────────────────

export interface PowerState {
  cooldownMs: number;
  maxCooldownMs: number;
  active: boolean;
  name: string;
  icon: string;
  speedBoost?: boolean;
  shield?: boolean;
  bowserSpin?: boolean;
}

/** A flying projectile spawned by a power (fireball, egg). */
export interface Projectile {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  ttl: number;
  /** 0 = no gravity (Mario fireball), 0.35 = arcing (Yoshi egg) */
  gravityScale: number;
}

export interface ActiveEffects {
  ghost: boolean;
  speedBoost: boolean;
  shield: boolean;
  bowserSpin: boolean;
}

// ── Part 3: Obstacles & Enemies ──────────────────────────────────────────────

/** Static spike hazard on the ground. */
export interface SpikeEntity {
  id: string;
  x: number;
  y: number;
  /** Total width of spike cluster */
  width: number;
  height: number;
}

export type EnemyType = 'fly' | 'bug' | 'frog';

/** Animated enemy entity. */
export interface EnemyEntity {
  id: string;
  type: EnemyType;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Horizontal velocity (bug) */
  vx: number;
  /** Vertical velocity (frog) */
  vy: number;
  /** Whether the enemy has been defeated */
  dead: boolean;
  /** Origin X for patrol / oscillation range */
  originX: number;
  /** Origin Y (ground-level y for bug/frog, air-level y for fly) */
  originY: number;
  /** Phase offset (fly oscillation) or jump cooldown timer (frog) */
  phaseOrTimer: number;
}

export interface GameSnapshot {
  status: RaceStatus;
  cameraX: number;
  viewportWidth: number;
  viewportHeight: number;
  /** groundY = viewportHeight * 0.72 — the baseline Y for on-ground position */
  groundY: number;
  player: PlayerRenderState;
  platforms: PlatformRect[];
  coins: CoinEntity[];
  coinsCollected: number;
  distance: number;
  checkpointX: number;
  checkpointY: number;
  parallaxFar: number;
  parallaxNear: number;
  power: PowerState;
  projectiles: Projectile[];
  effects: ActiveEffects;
  difficulty: number;
  enemies: EnemyEntity[];
  spikes: SpikeEntity[];
  /** Spawned hearts on track */
  heartsList: HeartEntity[];
  /** Hearts remaining (0 = game over) */
  hearts: number;
  maxHearts: number;
  /** True during post-hit invincibility window */
  invincible: boolean;
  /** Which character is being played */
  characterId: string;
}

export interface PlayerRaceState {
  uid: string;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  distance: number;
  rank: number;
  finished: boolean;
  finishTimeMs: number | null;
}
