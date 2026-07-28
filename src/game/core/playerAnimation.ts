/**
 * playerAnimation.ts
 *
 * Pure-function animation state machine for the player character.
 * Called once per engine tick() — NOT per physics substep.
 *
 * ─── Sprite Sheet Layout (10 cols × 5 rows, 72×72px frames) ────────────────
 *   Row 0: Idle   (4 frames)  — subtle breathing/bobbing
 *   Row 1: Run    (8 frames)  — full run cycle
 *   Row 2: Jump   (4 frames)  — ascending pose
 *   Row 3: Fall   (4 frames)  — descending pose
 *   Row 4: Land   (3 frames)  — squash impact
 * ────────────────────────────────────────────────────────────────────────────
 */

// ── Sprite sheet constants ──────────────────────────────────────────────────

/** Width of each frame in the sprite sheet (px). */
export const FRAME_W = 62.5;
/** Height of each frame in the sprite sheet (px). */
export const FRAME_H = 100;
/** Total columns in the sprite sheet. */
export const SHEET_COLS = 8;
/** Total rows in the sprite sheet. */
export const SHEET_ROWS = 5;
/** Total sprite sheet width (px). */
export const SHEET_W = FRAME_W * SHEET_COLS;  // 500
/** Total sprite sheet height (px). */
export const SHEET_H = FRAME_H * SHEET_ROWS;  // 500

// ── Animation state types ───────────────────────────────────────────────────

export type PlayerAnimState = 'idle' | 'run' | 'jump' | 'fall' | 'land';

export interface AnimationSnapshot {
  /** Current animation state (idle, run, jump, fall, land). */
  animState: PlayerAnimState;
  /** Current frame index within the active animation. */
  animFrame: number;
  /** True when facing right; false when facing left. */
  facingRight: boolean;
  /** True on the exact frame the player touches ground after being airborne. */
  landedThisFrame: boolean;
  /** Scale factors for squash/stretch landing effect. */
  landScaleX: number;
  landScaleY: number;
}

// ── Animation definitions ───────────────────────────────────────────────────

interface AnimDef {
  /** Row in the sprite sheet (0-indexed). */
  row: number;
  /** Number of frames in this animation. */
  frameCount: number;
  /** Duration of each frame in seconds (controls animation speed). */
  frameDuration: number;
  /** Whether this animation loops. */
  loop: boolean;
}

const ANIM_DEFS: Record<PlayerAnimState, AnimDef> = {
  idle: { row: 0, frameCount: 4, frameDuration: 0.10, loop: true },
  // Run uses a dynamic frameDuration (scaled by velocity), this is the BASE (slowest).
  // The actual frame count is driven by RUN_FRAME_REMAP.length below.
  run: { row: 1, frameCount: 4, frameDuration: 0.12, loop: true },
  jump: { row: 2, frameCount: 4, frameDuration: 0.06, loop: false },
  fall: { row: 3, frameCount: 4, frameDuration: 0.07, loop: false },
  land: { row: 4, frameCount: 3, frameDuration: 0.03, loop: false },
};

/**
 * Run frame remapping table — CRITICAL for natural-looking animation.
 *
 * Looking at the sprite sheet row 1 (8 raw frames):
 *   Col 0: standing / left leg back        (contact pose A)
 *   Col 1: left leg forward, right arm fwd (passing pose)
 *   Col 2: left leg far forward            (full stride left)
 *   Col 3: mid-stride transition           (contact B approach)
 *   Col 4: right leg forward               (passing pose)
 *   Col 5: right leg far forward           (full stride right)
 *   Col 6: returning to neutral            (contact A approach)
 *   Col 7: near-standing                   (pre-loop)
 *
 * We pick 4 frames that create the clearest left ↔ right alternation:
 *   Frame 0 → Col 1 (left leg forward)
 *   Frame 1 → Col 3 (mid / transition)
 *   Frame 2 → Col 5 (right leg forward)
 *   Frame 3 → Col 7 (mid / transition back)
 *
 * This creates a smooth: left → mid → right → mid → left → ...
 */
const RUN_FRAME_REMAP = [1, 3, 5, 7];

/** Base run frame duration (at low speed). Gets faster as player accelerates. */
const RUN_BASE_FRAME_DURATION = 0.44;
/** Fastest possible run frame duration (at max speed). */
const RUN_MIN_FRAME_DURATION = 0.28;

/** Minimum |vx| to be considered "running" rather than "idle". */
const VELOCITY_THRESHOLD = 50;

/** Duration of the landing squash effect in seconds. */
const LAND_EFFECT_DURATION = 0.18;

/** Max horizontal speed — used to scale run animation speed. */
const MAX_SPEED_FOR_ANIM = 340;

// ── Mutable animation state (lives in GameEngine) ───────────────────────────

export interface AnimAccumulator {
  /** Current animation state. */
  state: PlayerAnimState;
  /** Time accumulated within the current frame (seconds). */
  frameTime: number;
  /** Current frame index. */
  frameIndex: number;
  /** Whether the player was on the ground last tick (for landing detection). */
  wasOnGround: boolean;
  /** Which direction the player is facing. */
  facingRight: boolean;
  /** Time remaining in the landing squash effect (seconds). */
  landEffectTime: number;
}

/** Create a fresh animation accumulator (call once on engine reset). */
export function createAnimAccumulator(): AnimAccumulator {
  return {
    state: 'idle',
    frameTime: 0,
    frameIndex: 0,
    wasOnGround: true,
    facingRight: true,
    landEffectTime: 0,
  };
}

// ── Core animation step function ────────────────────────────────────────────

/**
 * Advance the animation state machine by `dt` seconds.
 *
 * This is a PURE function of the player's physics state. It updates the
 * accumulator in-place (for zero allocation) and returns the snapshot
 * data needed by renderers.
 *
 * @param acc   - Mutable accumulator (lives on GameEngine instance)
 * @param vx    - Player horizontal velocity
 * @param vy    - Player vertical velocity
 * @param onGround - Whether the player is on the ground this tick
 * @param dt    - Delta time in seconds (frame time, NOT physics substep time)
 */
export function stepAnimation(
  acc: AnimAccumulator,
  vx: number,
  vy: number,
  onGround: boolean,
  dt: number,
): AnimationSnapshot {
  // ── 1. Update facing direction ──────────────────────────────────────────
  if (vx > VELOCITY_THRESHOLD) acc.facingRight = true;
  else if (vx < -VELOCITY_THRESHOLD) acc.facingRight = false;

  // ── 2. Detect landing (was airborne, now on ground) ─────────────────────
  const landedThisFrame = !acc.wasOnGround && onGround;
  acc.wasOnGround = onGround;

  // ── 3. Determine target animation state ─────────────────────────────────
  let targetState: PlayerAnimState;

  if (landedThisFrame) {
    // Just landed → play land animation (short squash)
    targetState = 'land';
    acc.landEffectTime = LAND_EFFECT_DURATION;
  } else if (!onGround && vy < -20) {
    // Ascending (jumping)
    targetState = 'jump';
  } else if (!onGround && vy > 20) {
    // Descending (falling)
    targetState = 'fall';
  } else if (onGround && Math.abs(vx) > VELOCITY_THRESHOLD) {
    // On ground and moving fast enough → run
    targetState = 'run';
  } else if (onGround) {
    // On ground, barely moving → idle
    targetState = 'idle';
  } else {
    // Edge case: airborne but low velocity → hold current aerial state
    targetState = acc.state === 'jump' || acc.state === 'fall' ? acc.state : 'fall';
  }

  // Special case: if we're in 'land' state and it hasn't finished, stay in land
  if (acc.state === 'land' && acc.landEffectTime > 0) {
    targetState = 'land'; // keep playing land animation
  }

  // ── 4. State transition → reset frame if state changed ──────────────────
  if (targetState !== acc.state) {
    acc.state = targetState;
    acc.frameTime = 0;
    acc.frameIndex = 0;
  }

  // ── 5. Advance frame timer ──────────────────────────────────────────────
  const def = ANIM_DEFS[acc.state];
  acc.frameTime += dt;

  // For run state, dynamically scale frame duration with player speed.
  // Faster movement = faster leg animation = more realistic running.
  let effectiveDuration = def.frameDuration;
  if (acc.state === 'run') {
    const speedRatio = Math.min(Math.abs(vx) / MAX_SPEED_FOR_ANIM, 1); // 0..1
    // Lerp from BASE (slow jog) to MIN (full sprint)
    effectiveDuration = RUN_BASE_FRAME_DURATION - speedRatio * (RUN_BASE_FRAME_DURATION - RUN_MIN_FRAME_DURATION);
  }

  // Determine effective frame count (run uses remap table length)
  const effectiveFrameCount = acc.state === 'run' ? RUN_FRAME_REMAP.length : def.frameCount;

  while (acc.frameTime >= effectiveDuration) {
    acc.frameTime -= effectiveDuration;
    acc.frameIndex++;

    if (acc.frameIndex >= effectiveFrameCount) {
      if (def.loop) {
        acc.frameIndex = 0;
      } else {
        // Hold on last frame (e.g., hold the last jump/fall pose)
        acc.frameIndex = effectiveFrameCount - 1;
        acc.frameTime = 0; // stop advancing
        break;
      }
    }
  }

  // ── 6. Compute landing squash/stretch scales ────────────────────────────
  let landScaleX = 1;
  let landScaleY = 1;

  if (acc.landEffectTime > 0) {
    acc.landEffectTime = Math.max(0, acc.landEffectTime - dt);
    // Progress goes from 1 (just landed) → 0 (effect done)
    const progress = acc.landEffectTime / LAND_EFFECT_DURATION;
    // Squash: wider + shorter at impact, then spring back
    // Using a sine curve for smooth spring-back
    const squash = Math.sin(progress * Math.PI) * 0.15;
    landScaleX = 1 + squash;     // wider
    landScaleY = 1 - squash;     // shorter
  }

  // ── 7. Return snapshot for renderers ────────────────────────────────────
  return {
    animState: acc.state,
    animFrame: acc.frameIndex,
    facingRight: acc.facingRight,
    landedThisFrame,
    landScaleX,
    landScaleY,
  };
}

// ── Helper: get source rect for a given animation snapshot ──────────────────

/**
 * Returns the source rectangle (in pixels) for the current frame in the
 * sprite sheet. Used by Canvas 2D drawImage and Skia Image clipping.
 */
export function getFrameSourceRect(animState: PlayerAnimState, frameIndex: number) {
  const def = ANIM_DEFS[animState];
  let col = Math.min(frameIndex, def.frameCount - 1);

  // For run state, remap through our smooth alternating table
  if (animState === 'run') {
    col = RUN_FRAME_REMAP[col % RUN_FRAME_REMAP.length];
  }

  const row = def.row;
  return {
    sx: col * FRAME_W,
    sy: row * FRAME_H,
    sw: FRAME_W,
    sh: FRAME_H,
  };
}
