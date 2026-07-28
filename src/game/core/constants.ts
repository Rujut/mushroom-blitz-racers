/** Physics & world tuning (logical pixels, landscape). */
export const PHYSICS = {
  GRAVITY: 1350,
  MAX_SPEED: 340,
  MOVE_ACCEL: 2400,
  MOVE_DECEL: 3200,
  AIR_CONTROL: 0.72,
  JUMP_VELOCITY: -520,
  MAX_FALL_SPEED: 900,
  PLAYER_WIDTH: 42,
  PLAYER_HEIGHT: 52,
  MAX_JUMPS: 2,
  FIXED_DT_MS: 1000 / 60,
  /** Reduced from 5 → 3: prevents physics death-spiral on slow frames (2GB devices).
   *  5 substeps on a 50ms frame = 5× JS work in one frame → next frame also slow → stutter loop.
   *  3 substeps is safe for a 40ms frame (our capped max delta). */
  MAX_SUBSTEPS: 3,
  /** High lerp = snap-to-target in 1-2 frames. Low lerp = lag + visible ringing on mobile. */
  RENDER_LERP: 0.85,
  /** Camera lerp — called once per tick (not per substep) so frame-rate independent. */
  CAMERA_LERP: 0.18,
} as const;

export const WORLD = {
  SEGMENT_WIDTH: 520,
  INITIAL_SEGMENTS: 8,
  GENERATE_AHEAD: 3,
  GROUND_HEIGHT: 56,
  DEATH_MARGIN_BELOW: 120,
  /** First segment(s) always solid — no gaps under spawn. */
  SAFE_SEGMENT_COUNT: 2,
} as const;

export const COIN = {
  RADIUS: 16,
  VALUE: 1,
} as const;
