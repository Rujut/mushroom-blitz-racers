import { COIN, PHYSICS, WORLD } from './constants';
import { resolvePlatformCollision } from './physics';
import { appendSegments, generateInitialWorld } from '@/src/game/levels/levelGenerator';
import { qualityManager } from '@/src/utils/QualityManager';
import {
  POWER_CATALOGUE,
  POWER_PROJECTILE_COLOR,
  SPEED_BOOST_FACTOR,
} from './powers';
import {
  createAnimAccumulator,
  stepAnimation,
  type AnimAccumulator,
  type AnimationSnapshot,
} from './playerAnimation';
import type { CharacterId } from '@/src/constants/characters';
import type {
  ActiveEffects,
  CoinEntity,
  EnemyEntity,
  HeartEntity,
  GameInput,
  GameSnapshot,
  PlatformRect,
  PlayerBody,
  Projectile,
  PowerState,
  RaceStatus,
  SpikeEntity,
} from './types';

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

let projIdCounter = 0;
const nextProjId = () => `proj-${projIdCounter++}`;

const MAX_HEARTS = 3;
/** Invincibility window after taking a hit (ms) */
const HIT_INVINCIBLE_MS = 1800;

export class GameEngine {
  private status: RaceStatus = 'idle';
  private player: PlayerBody;
  private renderX = 80;
  private renderY = 0;
  private prevX = 80;
  private prevY = 0;
  private platforms: PlatformRect[] = [];
  private coins: CoinEntity[] = [];
  private enemies: EnemyEntity[] = [];
  private spikes: SpikeEntity[] = [];
  private heartsList: HeartEntity[] = [];
  private input: GameInput = { left: false, right: false, jumpPressed: false, powerPressed: false };
  private cameraX = 0;
  private viewportWidth = 800;
  private viewportHeight = 400;
  private groundY = 300;
  private worldEndX = 0;
  private segmentIndex = 0;
  private coinsCollected = 0;
  private distance = 0;
  private checkpointX = 80;
  private checkpointY = 0;
  private maxPlayerX = 0;
  private timeAccumulator = 0;
  private elapsedTime = 0;

  // ── Perf: dirty flags to avoid per-tick array filters ──────────────────────
  /** True when at least one enemy died this tick — triggers filter in tickEnemies. */
  private _enemyDirty = false;
  /** Last camera-X at which we ran the world-trim filter. */
  private lastTrimX = 0;

  // Character & power
  private characterId: CharacterId = 'mario';
  private facingRight = true;
  private powerCooldownMs = 0;
  private powerActiveMs = 0;
  private ghostUntilMs = 0;   // Luigi
  private shieldActive = false; // Peach
  private speedBoostUntilMs = 0; // Toad
  private projectiles: Projectile[] = [];
  private difficulty = 0;

  // Heart / health system
  private hearts = MAX_HEARTS;
  private invincibleUntilMs = 0;

  // Animation state machine
  private animAccum: AnimAccumulator = createAnimAccumulator();
  private lastAnimSnap: AnimationSnapshot = {
    animState: 'idle', animFrame: 0, facingRight: true,
    landedThisFrame: false, landScaleX: 1, landScaleY: 1,
  };

  constructor(playerColor = '#e52521') {
    this.player = {
      x: 80, y: 0,
      width: PHYSICS.PLAYER_WIDTH, height: PHYSICS.PLAYER_HEIGHT,
      vx: 0, vy: 0,
      onGround: false, jumpsUsed: 0,
      color: playerColor,
    };
    this.renderY = this.player.y;
    this.renderX = this.player.x;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  setCharacter(id: CharacterId, color: string): void {
    this.characterId = id;
    this.player.color = color;
  }

  configureViewport(width: number, height: number): void {
    const firstSetup = this.status === 'idle';
    const oldGroundY = this.groundY;
    this.viewportWidth = width;
    this.viewportHeight = height;
    this.groundY = height * 0.72;
    if (firstSetup) {
      this.resetWorld();
    } else {
      const dy = this.groundY - oldGroundY;
      if (dy !== 0) {
        this.player.y += dy;
        this.renderY += dy;
        this.platforms.forEach(p => p.y += dy);
        this.coins.forEach(c => c.y += dy);
        this.enemies.forEach(e => {
          e.y += dy;
          e.originY += dy;
        });
        this.spikes.forEach(s => s.y += dy);
        this.projectiles.forEach(p => p.y += dy);
        if (this.checkpointY !== null) this.checkpointY += dy;
      }
    }
  }

  getStatus(): RaceStatus { return this.status; }

  start(): void {
    if (this.status === 'playing') return;
    this.resetWorld();
    this.status = 'playing';
    this.timeAccumulator = 0;
  }

  resetWorld(): void {
    const result = generateInitialWorld(this.groundY, WORLD.INITIAL_SEGMENTS);
    this.platforms = result.platforms;
    this.coins = result.coins;
    this.enemies = result.enemies;
    this.spikes = result.spikes;
    this.heartsList = result.hearts;
    this.worldEndX = WORLD.INITIAL_SEGMENTS * WORLD.SEGMENT_WIDTH;
    this.segmentIndex = WORLD.INITIAL_SEGMENTS;
    this.player.x = 80;
    this.player.y = this.groundY - PHYSICS.PLAYER_HEIGHT;
    this.player.vx = 0; this.player.vy = 0;
    this.player.onGround = false; this.player.jumpsUsed = 0;
    this.prevX = this.player.x; this.prevY = this.player.y;
    this.renderX = this.player.x; this.renderY = this.player.y;
    this.cameraX = 0;
    this.coinsCollected = 0; this.distance = 0;
    this.maxPlayerX = this.player.x;
    this.checkpointX = this.player.x; this.checkpointY = this.player.y;
    this.powerCooldownMs = 0; this.powerActiveMs = 0;
    this.ghostUntilMs = 0; this.shieldActive = false; this.speedBoostUntilMs = 0;
    this.projectiles = []; this.difficulty = 0; this.elapsedTime = 0;
    // Reset health
    this.hearts = MAX_HEARTS;
    this.invincibleUntilMs = 0;
    // Reset perf flags
    this._enemyDirty = false;
    this.lastTrimX = 0;
    // Reset animation
    this.animAccum = createAnimAccumulator();
    this.lastAnimSnap = {
      animState: 'idle', animFrame: 0, facingRight: true,
      landedThisFrame: false, landScaleX: 1, landScaleY: 1,
    };
    this.snapPlayerToGround();
  }

  setInput(input: Partial<GameInput>): void {
    if (input.left !== undefined) this.input.left = input.left;
    if (input.right !== undefined) this.input.right = input.right;
    if (input.jumpPressed) this.input.jumpPressed = true;
    if (input.powerPressed) this.input.powerPressed = true;
  }

  activatePower(): void { this.input.powerPressed = true; }

  tick(deltaMs: number): void {
    if (this.status !== 'playing' && this.status !== 'ghost') return;
    // Tightened 50ms → 40ms: prevents one giant physics jump after app-switch;
    // also ensures MAX_SUBSTEPS:3 is never exceeded on our capped delta.
    const clampedDelta = Math.min(Math.max(deltaMs, 8), 40);
    this.timeAccumulator += clampedDelta;
    let steps = 0;
    while (this.timeAccumulator >= PHYSICS.FIXED_DT_MS && steps < PHYSICS.MAX_SUBSTEPS) {
      if (this.status === 'ghost') {
        this.ghostFixedUpdate(PHYSICS.FIXED_DT_MS / 1000);
      } else {
        this.fixedUpdate(PHYSICS.FIXED_DT_MS / 1000);
      }
      this.timeAccumulator -= PHYSICS.FIXED_DT_MS;
      steps++;
    }
    if (steps === PHYSICS.MAX_SUBSTEPS) this.timeAccumulator = 0;

    // Camera is updated ONCE per tick (not per substep) so it's frame-rate independent
    this.updateCamera();

    // Snap renderY immediately when on ground (no lerp needed — position is stable)
    if (this.player.onGround) {
      this.renderY = this.player.y;
    } else {
      this.renderY = lerp(this.renderY, this.player.y, PHYSICS.RENDER_LERP);
    }
    // Snap renderX to exact position when very close to prevent sub-pixel oscillation
    const dx = this.player.x - this.renderX;
    if (Math.abs(dx) < 0.5) {
      this.renderX = this.player.x;
    } else {
      this.renderX = lerp(this.renderX, this.player.x, PHYSICS.RENDER_LERP);
    }

    // ── Animation: stepped once per tick (frame-rate independent via animTime) ───
    this.lastAnimSnap = stepAnimation(
      this.animAccum,
      this.player.vx,
      this.player.vy,
      this.player.onGround,
      clampedDelta / 1000, // convert ms → seconds
    );
    // Sync engine facingRight with animation (for fireball direction etc)
    this.facingRight = this.lastAnimSnap.facingRight;
  }

  private cachedPlatforms: any[] = [];
  private cachedCoins: any[] = [];
  private cachedEnemies: any[] = [];
  private cachedSpikes: any[] = [];
  private cachedHearts: any[] = [];
  private cachedSnapshot: any = null;

  getSnapshot(): GameSnapshot {
    const profile = qualityManager.getProfile();
    const cam = this.cameraX;
    const margin = 100;
    
    // REUSE array instances to completely eliminate GC array allocation lag!
    this.cachedPlatforms.length = 0;
    for (const p of this.platforms) {
      if (p.x + p.width > cam - margin && p.x < cam + this.viewportWidth + margin) this.cachedPlatforms.push(p);
    }
    
    this.cachedCoins.length = 0;
    let coinCount = 0;
    for (const c of this.coins) {
      if (coinCount >= profile.maxParticles) break;
      if (!c.collected && c.x > cam - margin && c.x < cam + this.viewportWidth + margin) {
        this.cachedCoins.push(c);
        coinCount++;
      }
    }
    
    this.cachedEnemies.length = 0;
    let enemyCount = 0;
    for (const e of this.enemies) {
      if (enemyCount >= profile.maxEnemies) break;
      if (!e.dead && e.x + e.width > cam - margin && e.x < cam + this.viewportWidth + margin) {
        this.cachedEnemies.push(e);
        enemyCount++;
      }
    }
    
    this.cachedSpikes.length = 0;
    for (const s of this.spikes) {
      if (s.x + s.width > cam - margin && s.x < cam + this.viewportWidth + margin) this.cachedSpikes.push(s);
    }

    this.cachedHearts.length = 0;
    for (const h of this.heartsList) {
      if (!h.collected && h.x > cam - margin && h.x < cam + this.viewportWidth + margin) {
        this.cachedHearts.push(h);
      }
    }

    const def = POWER_CATALOGUE[this.characterId];
    const power: PowerState = {
      cooldownMs: this.powerCooldownMs,
      maxCooldownMs: def.cooldownMs,
      active: this.powerActiveMs > 0,
      name: def.name,
      icon: def.icon,
    };

    const now = Date.now();
    const effects: ActiveEffects = {
      ghost:      this.characterId === 'luigi' && now < this.ghostUntilMs,
      speedBoost: this.characterId === 'toad'  && now < this.speedBoostUntilMs,
      shield:     this.shieldActive,
      bowserSpin: false, // bowser removed
    };

    return {
      status: this.status,
      cameraX: cam,
      viewportWidth: this.viewportWidth,
      viewportHeight: this.viewportHeight,
      groundY: this.groundY,
      player: {
        ...this.player,
        renderX: this.renderX,
        renderY: this.renderY,
        animState: this.lastAnimSnap.animState,
        animFrame: this.lastAnimSnap.animFrame,
        facingRight: this.lastAnimSnap.facingRight,
        landedThisFrame: this.lastAnimSnap.landedThisFrame,
        landScaleX: this.lastAnimSnap.landScaleX,
        landScaleY: this.lastAnimSnap.landScaleY,
      },
      // Pass array references directly — NO spreading.
      // Previously this spread every entity into new objects every frame → massive
      // GC pressure (30-60 allocations/frame @ 60fps = 1800-3600 allocs/sec).
      // GameCanvasNative is driven by the frame counter from useGameEngineRunner,
      // so it always re-renders when new data is available regardless of ref equality.
      platforms: this.cachedPlatforms,
      coins:     this.cachedCoins,
      enemies:   this.cachedEnemies,
      spikes:    this.cachedSpikes,
      heartsList: this.cachedHearts,
      projectiles: this.projectiles,
      coinsCollected: this.coinsCollected,
      distance: Math.floor(this.distance),
      checkpointX: this.checkpointX,
      checkpointY: this.checkpointY,
      parallaxFar: cam * 0.2,
      parallaxNear: cam * 0.45,
      power,
      effects,
      difficulty: this.difficulty,
      hearts: this.hearts,
      maxHearts: MAX_HEARTS,
      invincible: now < this.invincibleUntilMs,
      characterId: this.characterId,
    };
  }

  pause():  void { if (this.status === 'playing') this.status = 'paused'; }
  resume(): void { if (this.status === 'paused')  this.status = 'playing'; }

  /**
   * Enter ghost mode — player can move freely but can't collect coins,
   * take damage, or increase distance. Used in multiplayer when eliminated.
   */
  enterGhostMode(): void {
    this.status = 'ghost';
    this.hearts = 0;
    // Make player invincible so hazard collision code never triggers
    this.invincibleUntilMs = Infinity;
  }

  /**
   * External hit (remote fireball). Uses same invincibility window as local hazards.
   * Safe to call from useFireballSync at any time.
   */
  takeDamageExternal(): void {
    if (this.status !== 'playing') return;
    if (Date.now() < this.invincibleUntilMs) return;
    if (this.characterId === 'luigi' && Date.now() < this.ghostUntilMs) return;
    this.loseHeart();
  }

  // ── Fixed update pipeline ──────────────────────────────────────────────────

  private fixedUpdate(dt: number): void {
    this.elapsedTime += dt;
    this.updatePower(dt);
    this.applyInput(dt);
    this.applyPhysics(dt);
    this.resolveCollisions();
    this.collectItems();
    this.tickEnemies(dt);
    this.tickProjectiles(dt);
    this.checkProjectileEnemyCollisions();
    this.checkPlayerHazards();
    // NOTE: updateCamera() removed from here — called once per tick() instead
    this.expandWorld();
    this.checkDeath();
    this.updateStats();
  }

  /**
   * Ghost update — movement only, no coins/hazards/distance.
   * Player floats through everything like a ghost.
   */
  private ghostFixedUpdate(dt: number): void {
    this.applyInput(dt);
    this.applyPhysics(dt);
    this.resolveCollisions();
    this.tickEnemies(dt); // keep enemies animating so ghosts see them
    this.expandWorld();
    
    // Check if ghost fell into a hole, and respawn safely!
    if (this.player.y > this.viewportHeight + WORLD.DEATH_MARGIN_BELOW) {
      this.respawn();
    }
  }

  // ── Power system ───────────────────────────────────────────────────────────

  private updatePower(dt: number): void {
    const dtMs = dt * 1000;
    if (this.powerCooldownMs > 0) this.powerCooldownMs = Math.max(0, this.powerCooldownMs - dtMs);
    if (this.powerActiveMs   > 0) {
      this.powerActiveMs = Math.max(0, this.powerActiveMs - dtMs);
      // Expire Peach shield when timer runs out
      if (this.powerActiveMs <= 0 && this.characterId === 'peach') {
        this.shieldActive = false;
      }
    }
    if (this.input.powerPressed) {
      this.input.powerPressed = false;
      if (this.powerCooldownMs <= 0) this.triggerPower();
    }
  }

  private triggerPower(): void {
    const def = POWER_CATALOGUE[this.characterId];
    this.powerCooldownMs = def.cooldownMs;
    this.powerActiveMs   = def.durationMs;
    const now = Date.now();

    switch (this.characterId) {
      case 'mario':
        this.spawnFireball();
        break;
      case 'luigi':
        this.ghostUntilMs = now + def.durationMs;
        this.player.vx = PHYSICS.MAX_SPEED * 1.5 * (this.facingRight ? 1 : -1);
        break;
      case 'peach':
        this.shieldActive = true;
        break;
      case 'toad':
        this.speedBoostUntilMs = now + def.durationMs;
        break;
    }
  }

  /** Single horizontal fireball — no gravity, exact body-centre Y. */
  private spawnFireball(): void {
    const vx = this.facingRight ? 720 : -720;
    const spawnX = this.facingRight
      ? this.player.x + this.player.width + 2
      : this.player.x - 12;
    this.projectiles.push({
      id: nextProjId(),
      x: spawnX,
      y: this.player.y + this.player.height * 0.4,
      vx,
      vy: 0,
      radius: 9,
      color: POWER_PROJECTILE_COLOR,
      ttl: 2.5,
      gravityScale: 0,
    });
  }

  // ── Enemy simulation ───────────────────────────────────────────────────────

  private tickEnemies(dt: number): void {
    const t = this.elapsedTime;
    for (const e of this.enemies) {
      if (e.dead) continue;
      switch (e.type) {
        case 'fly': {
          const oldX = e.x;
          e.x = e.originX + Math.sin(t * 1.8 + e.phaseOrTimer) * 70;
          e.y = e.originY + Math.sin(t * 2.5 + e.phaseOrTimer * 1.3) * 12;
          if (dt > 0) e.vx = (e.x - oldX) / dt;
          break;
        }
        case 'bug': {
          e.x += e.vx * dt;
          if (e.x < e.originX - 110) { e.x = e.originX - 110; e.vx = Math.abs(e.vx); }
          if (e.x > e.originX + 110) { e.x = e.originX + 110; e.vx = -Math.abs(e.vx); }
          
          const bugOnGround = this.platforms.some(
            (p) =>
              e.x + e.width / 2 >= p.x &&
              e.x + e.width / 2 <= p.x + p.width &&
              Math.abs(e.y + 20 - p.y) < 20
          );
          
          if (!bugOnGround) {
            e.vy = (e.vy || 0) + PHYSICS.GRAVITY * 0.5 * dt;
            e.y += e.vy * dt;
            if (e.y > e.originY + 1500) { e.dead = true; this._enemyDirty = true; }
          } else if (e.vy > 0) {
            e.vy = 0;
            e.y = e.originY;
          }
          break;
        }
        case 'frog': {
          e.phaseOrTimer -= dt;
          
          const frogOnGround = this.platforms.some(
            (p) =>
              e.x + e.width / 2 >= p.x &&
              e.x + e.width / 2 <= p.x + p.width &&
              Math.abs(e.y + 26 - p.y) < 20
          );
          
          if (e.phaseOrTimer <= 0 && frogOnGround) {
            // Trigger jump
            e.vy = -360;
            e.vx = -120; // Jump right-to-left
            e.phaseOrTimer = 1.8 + (Math.sin(e.originX) * 0.5 + 0.5) * 1.2;
          }
          
          e.vy += PHYSICS.GRAVITY * 0.5 * dt;
          e.y += e.vy * dt;

          // Ceiling collision
          if (e.vy < 0) {
            const hitCeiling = this.platforms.find(
              (p) =>
                e.x + e.width - 5 >= p.x &&
                e.x + 5 <= p.x + p.width &&
                e.y < p.y + p.height &&
                e.y > p.y
            );
            if (hitCeiling) {
              e.y = hitCeiling.y + hitCeiling.height;
              e.vy = 50; // Bounce down
            }
          }
          
          if (!frogOnGround) {
            e.x += (e.vx || 0) * dt;
            if (e.y > e.originY + 1500) { e.dead = true; this._enemyDirty = true; }
          } else if (e.vy > 0) {
            // Landed
            e.vy = 0;
            e.vx = 0;
            e.y = e.originY; 
          }
          break;
        }
      }
    }
    // Only allocate a new array when an enemy actually died this tick.
    // The common case (zero deaths) now costs zero allocations.
    if (this._enemyDirty) {
      this.enemies = this.enemies.filter(e => !e.dead);
      this._enemyDirty = false;
    }
  }

  // ── Projectile vs enemy ────────────────────────────────────────────────────

  private checkProjectileEnemyCollisions(): void {
    const toRemoveProj = new Set<string>();
    for (const enemy of this.enemies) {
      if (enemy.dead) continue;
      const eCx = enemy.x + enemy.width / 2;
      const eCy = enemy.y + enemy.height / 2;
      for (const proj of this.projectiles) {
        if (toRemoveProj.has(proj.id)) continue;
        const dx = proj.x - eCx;
        const dy = proj.y - eCy;
        const hr = proj.radius + Math.max(enemy.width, enemy.height) / 2;
        if (dx * dx + dy * dy < hr * hr) {
          enemy.dead = true;
          this._enemyDirty = true; // signal tickEnemies to filter on next call
          toRemoveProj.add(proj.id);
          break;
        }
      }
    }
    if (toRemoveProj.size > 0) {
      this.projectiles = this.projectiles.filter(p => !toRemoveProj.has(p.id));
    }
  }

  // ── Player hazard checks ───────────────────────────────────────────────────

  private checkPlayerHazards(): void {
    const now = Date.now();
    // Ghost dash bypasses all enemy/spike damage
    if (this.characterId === 'luigi' && now < this.ghostUntilMs) return;
    // Invincibility window (post-hit) prevents stacking
    if (now < this.invincibleUntilMs) return;

    const px = this.player.x, py = this.player.y;
    const pw = this.player.width, ph = this.player.height;

    // Spikes
    for (const s of this.spikes) {
      if (px < s.x + s.width && px + pw > s.x && py < s.y + s.height && py + ph > s.y) {
        this.loseHeart();
        return;
      }
    }

    // Enemies
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (px < e.x + e.width && px + pw > e.x && py < e.y + e.height && py + ph > e.y) {
        this.loseHeart();
        return;
      }
    }
  }

  private loseHeart(isPit = false): void {
    // Peach shield absorbs the hit
    if (this.shieldActive) {
      this.shieldActive = false;
      this.powerActiveMs = 0; // Turn off the active power skill state immediately
      this.invincibleUntilMs = Date.now() + HIT_INVINCIBLE_MS;
      if (isPit) this.respawn();
      return;
    }

    this.hearts -= 1;
    this.invincibleUntilMs = Date.now() + HIT_INVINCIBLE_MS;
    if (isPit) this.respawn();

    if (this.hearts <= 0) {
      this.hearts = 0;
      this.status = 'gameover';
    }
  }

  // ── Projectile ticking ─────────────────────────────────────────────────────

  private tickProjectiles(dt: number): void {
    for (const p of this.projectiles) {
      p.vy += PHYSICS.GRAVITY * p.gravityScale * dt;
      p.x  += p.vx * dt;
      p.y  += p.vy * dt;
      p.ttl -= dt;
    }
    const cullL = this.cameraX - 200;
    const cullR = this.cameraX + this.viewportWidth + 200;
    this.projectiles = this.projectiles.filter(
      p => p.ttl > 0 && p.x > cullL && p.x < cullR
    );
  }

  // ── Input & physics ────────────────────────────────────────────────────────

  private applyInput(dt: number): void {
    const { left, right, jumpPressed } = this.input;
    const control = this.player.onGround ? 1 : PHYSICS.AIR_CONTROL;

    if (right && !left) this.facingRight = true;
    else if (left && !right) this.facingRight = false;

    const now = Date.now();
    const toadBoost = this.characterId === 'toad' && now < this.speedBoostUntilMs ? SPEED_BOOST_FACTOR : 1;
    const maxSpeed  = PHYSICS.MAX_SPEED * control * toadBoost;

    let targetVx = 0;
    if (left && !right)   targetVx = -maxSpeed;
    else if (right && !left) targetVx =  maxSpeed;

    const rate = targetVx === 0 ? PHYSICS.MOVE_DECEL : PHYSICS.MOVE_ACCEL;
    const diff = targetVx - this.player.vx;
    const maxStep = rate * control * dt;
    if (Math.abs(diff) <= maxStep) this.player.vx = targetVx;
    else this.player.vx += Math.sign(diff) * maxStep;

    if (jumpPressed) {
      if (this.player.jumpsUsed < PHYSICS.MAX_JUMPS) {
        this.player.vy = PHYSICS.JUMP_VELOCITY;
        this.player.onGround = false;
        this.player.jumpsUsed++;
      }
      this.input.jumpPressed = false;
    }
  }

  private applyPhysics(dt: number): void {
    this.prevX = this.player.x;
    this.prevY = this.player.y;

    // Peach slow fall while shield is active
    const gravMult = (this.characterId === 'peach' && this.shieldActive && !this.player.onGround) ? 0.35 : 1;
    this.player.vy += PHYSICS.GRAVITY * gravMult * dt;
    const maxFall = (this.characterId === 'peach' && this.shieldActive)
      ? PHYSICS.MAX_FALL_SPEED * 0.3
      : PHYSICS.MAX_FALL_SPEED;
    if (this.player.vy > maxFall) this.player.vy = maxFall;

    this.player.x += this.player.vx * dt;
    this.player.y += this.player.vy * dt;
    if (this.player.x < 0) { this.player.x = 0; this.player.vx = 0; }
  }

  /** Always resolves ground collisions — Luigi ghost only skips hazard damage. */
  private resolveCollisions(): void {
    this.player.onGround = false;
    for (const plat of this.platforms) {
      resolvePlatformCollision(this.player, plat, this.prevX, this.prevY);
    }
  }

  private collectItems(): void {
    const px = this.player.x + this.player.width / 2;
    const py = this.player.y + this.player.height / 2;
    
    for (const coin of this.coins) {
      if (coin.collected) continue;
      const dx = px - coin.x, dy = py - coin.y;
      if (dx * dx + dy * dy < (coin.radius + 20) ** 2) {
        coin.collected = true;
        this.coinsCollected += COIN.VALUE;
      }
    }
    
    for (const heart of this.heartsList) {
      if (heart.collected) continue;
      const dx = px - heart.x, dy = py - heart.y;
      if (dx * dx + dy * dy < (15 + 20) ** 2) { // heart radius ~15
        heart.collected = true;
        if (this.hearts < MAX_HEARTS) {
          this.hearts++;
        }
      }
    }
  }

  private updateCamera(): void {
    const targetX = this.player.x - this.viewportWidth * 0.35;
    this.cameraX += (targetX - this.cameraX) * PHYSICS.CAMERA_LERP;
    if (this.cameraX < 0) this.cameraX = 0;
    // Round to nearest pixel — eliminates sub-pixel camera drift jitter
    this.cameraX = Math.round(this.cameraX);
  }

  private expandWorld(): void {
    const ahead = this.worldEndX - (this.cameraX + this.viewportWidth);
    if (ahead < WORLD.SEGMENT_WIDTH * WORLD.GENERATE_AHEAD) {
      this.worldEndX = appendSegments(
        this.platforms, this.coins, this.enemies, this.spikes, this.heartsList,
        this.worldEndX, this.groundY, this.segmentIndex, 2, this.difficulty
      );
      this.segmentIndex += 2;
    }
    const trimX = this.cameraX - WORLD.SEGMENT_WIDTH * 2;
    // Throttle trim: run the filter only when camera crosses a segment boundary
    // This removes the lastTrimX state variable which breaks on respawns!
    if (trimX > 0 && Math.floor(this.cameraX) % Math.floor(WORLD.SEGMENT_WIDTH * 0.5) === 0) {
      this.platforms = this.platforms.filter(p => p.x + p.width > trimX);
      this.coins     = this.coins.filter(c => !c.collected && c.x > trimX - 100);
      this.enemies   = this.enemies.filter(e => !e.dead && e.x + e.width > trimX);
      this.spikes    = this.spikes.filter(s => s.x + s.width > trimX);
      this.heartsList = this.heartsList.filter(h => !h.collected && h.x > trimX - 100);
    }
  }

  private checkDeath(): void {
    // Don't double-damage during invincibility window after a previous hit
    if (Date.now() < this.invincibleUntilMs) return;
    if (this.player.y > this.viewportHeight + WORLD.DEATH_MARGIN_BELOW) {
      this.loseHeart(true);
    }
  }

  private respawn(): void {
    this.player.x = this.checkpointX;
    this.player.y = this.checkpointY;
    this.player.vx = 0; this.player.vy = 0; this.player.jumpsUsed = 0;
    this.prevX = this.player.x; this.prevY = this.player.y;
    this.renderX = this.player.x; this.renderY = this.player.y;
    this.cameraX = Math.max(0, this.checkpointX - this.viewportWidth * 0.35);
    this.ghostUntilMs = 0;
  }

  private updateStats(): void {
    const startX = 80;
    this.distance = Math.max(0, (this.player.x - startX) / 10);
    if (this.player.x > this.maxPlayerX) this.maxPlayerX = this.player.x;
    if (this.player.onGround) { this.checkpointX = this.player.x; this.checkpointY = this.player.y; }
    this.difficulty = Math.min(1, this.distance / 300);
  }

  private snapPlayerToGround(): void {
    let bestY = this.groundY;
    for (const plat of this.platforms) {
      if (plat.height >= 24 && this.player.x + this.player.width > plat.x + 4 && this.player.x < plat.x + plat.width - 4) {
        bestY = Math.min(bestY, plat.y);
      }
    }
    this.player.y = bestY - this.player.height;
    this.player.vy = 0; this.player.onGround = true; this.player.jumpsUsed = 0;
    this.renderX = this.player.x; this.renderY = this.player.y;
    this.prevX = this.player.x; this.prevY = this.player.y;
  }
}
