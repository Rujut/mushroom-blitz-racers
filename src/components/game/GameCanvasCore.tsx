import { useMemo } from 'react';
import {
  Canvas,
  Circle,
  Group,
  Path,
  RoundedRect,
  Rect,
  Oval,
  Image,
  useImage,
  useFont,
  Text as SkiaText,
  RuntimeShader,
  rect,
  Skia,
} from '@shopify/react-native-skia';
import { getFrameSourceRect, FRAME_H, FRAME_W, SHEET_W, SHEET_H } from '@/src/game/core/playerAnimation';
import type { EnemyEntity, GameSnapshot, SpikeEntity } from '@/src/game/core/types';
import { GameColors } from '@/src/constants/theme';
import { CHARACTER_TINT_COLORS, CHARACTER_TINT_SHADER } from '@/src/constants/characters';
import { qualityManager } from '@/src/utils/QualityManager';
import GameBackground from './GameBackground';
import { PHYSICS } from '@/src/game/core/constants';
import { POWER_PROJECTILE_COLOR } from '@/src/game/core/powers';

const HEART_PATH = "M 0 -2 C -4 -6 -8 -2 -4 2 L 0 6 L 4 2 C 8 -2 4 -6 0 -2 Z";

interface GameCanvasCoreProps {
  snapshot: GameSnapshot;
  ghostsRef?: React.MutableRefObject<any[]>;
  width: number;
  height: number;
  finishDistance?: number;
}

// Build SVG path string for a row of spikes
function buildSpikePath(s: SpikeEntity): string {
  const spikeW = 18;
  const count = Math.max(1, Math.round(s.width / spikeW));
  const actualW = count * spikeW;
  const baseY = s.y + s.height;
  let d = `M ${s.x} ${baseY}`;
  for (let i = 0; i < count; i++) {
    const px = s.x + i * spikeW;
    // Organic thorn: curve up, then drop sharply with height variation
    const heightVar = (i % 2 === 0) ? 0 : s.height * 0.2;
    const peakY = s.y + heightVar;

    // Curve up to peak
    d += ` Q ${px + spikeW * 0.2} ${baseY - s.height * 0.4} ${px + spikeW * 0.4} ${peakY}`;
    // Sharp drop back down
    d += ` Q ${px + spikeW * 0.7} ${baseY - s.height * 0.2} ${px + spikeW} ${baseY}`;
  }
  d += ` Z`;
  return d;
}

function FlyEnemy({ e }: { e: EnemyEntity }) {
  // Fast flapping animation independent of engine tick
  const t = Date.now() / 30;
  const wingOffset = Math.sin(t) * 4;
  const bodyOscillation = Math.cos(t * 0.5) * 1.5;
  const isMovingLeft = (e.vx || 0) <= 0;

  return (
    <Group transform={[{ translateX: e.x + e.width / 2 }, { scaleX: isMovingLeft ? 1 : -1 }, { translateX: -(e.x + e.width / 2) }]}>
      {/* Back wing (flapping) */}
      <RoundedRect x={e.x + wingOffset - 5} y={e.y - 6 - wingOffset} width={14} height={10} r={5} color="rgba(220,240,255,0.6)" />

      {/* Body: fuzzy/striped bee/fly look */}
      <RoundedRect x={e.x} y={e.y + bodyOscillation} width={e.width} height={e.height} r={8} color="#1a1a2e" />
      <RoundedRect x={e.x + 4} y={e.y + bodyOscillation} width={4} height={e.height} r={2} color="#f0d040" />
      <RoundedRect x={e.x + 12} y={e.y + bodyOscillation} width={4} height={e.height} r={2} color="#f0d040" />

      {/* Front wing (flapping opposite) */}
      <RoundedRect x={e.x - wingOffset + 5} y={e.y - 8 + wingOffset} width={16} height={12} r={6} color="rgba(200,220,255,0.8)" />

      {/* Giant compound eyes */}
      <Circle cx={e.x + 6} cy={e.y + 6 + bodyOscillation} r={4.5} color="#cc2222" />
      <Circle cx={e.x + 7} cy={e.y + 5 + bodyOscillation} r={1.5} color="rgba(255,255,255,0.8)" />
      <Circle cx={e.x + e.width - 6} cy={e.y + 6 + bodyOscillation} r={4.5} color="#cc2222" />
      <Circle cx={e.x + e.width - 7} cy={e.y + 5 + bodyOscillation} r={1.5} color="rgba(255,255,255,0.8)" />
    </Group>
  );
}

function BugEnemy({ e }: { e: EnemyEntity }) {
  // Animate legs based on movement
  const crawl = Math.sin(e.x * 0.2) * 3;
  const isMovingLeft = (e.vx || -1) < 0;

  return (
    <Group transform={[{ translateX: e.x + e.width / 2 }, { scaleX: isMovingLeft ? 1 : -1 }, { translateX: -(e.x + e.width / 2) }]}>
      {/* Moving Legs (6 legs) */}
      <Path path={`M ${e.x + 12 + crawl} ${e.y + 18} Q ${e.x + 8 + crawl} ${e.y + 28} ${e.x + 6} ${e.y + 30}`} color="#1a0510" style="stroke" strokeWidth={3} />
      <Path path={`M ${e.x + 20 - crawl} ${e.y + 18} Q ${e.x + 20 - crawl} ${e.y + 28} ${e.x + 20} ${e.y + 30}`} color="#1a0510" style="stroke" strokeWidth={3} />
      <Path path={`M ${e.x + 28 + crawl} ${e.y + 18} Q ${e.x + 32 + crawl} ${e.y + 28} ${e.x + 34} ${e.y + 30}`} color="#1a0510" style="stroke" strokeWidth={3} />

      {/* Antennae */}
      <Path path={`M ${e.x + 8} ${e.y + 10} Q ${e.x - 2} ${e.y + 2} ${e.x - 4} ${e.y - 2}`} color="#8a2be2" style="stroke" strokeWidth={2} />
      <Path path={`M ${e.x + 12} ${e.y + 8} Q ${e.x + 2} ${e.y} ${e.x + 4} ${e.y - 4}`} color="#8a2be2" style="stroke" strokeWidth={2} />

      {/* Glossy Carapace base */}
      <RoundedRect x={e.x + 4} y={e.y + 4} width={30} height={18} r={10} color="#2b0042" />

      {/* Carapace Segments (Armor plates) */}
      <RoundedRect x={e.x + 8} y={e.y + 3} width={24} height={16} r={8} color="#4b0082" />
      <RoundedRect x={e.x + 12} y={e.y + 2} width={18} height={14} r={6} color="#6a0dad" />
      <RoundedRect x={e.x + 16} y={e.y + 1} width={12} height={12} r={4} color="#8a2be2" />

      {/* Spikes on back */}
      <Circle cx={e.x + 16} cy={e.y + 4} r={3} color="#ff00ff" />
      <Circle cx={e.x + 22} cy={e.y + 2} r={2.5} color="#ff00ff" />
      <Circle cx={e.x + 27} cy={e.y + 4} r={2} color="#ff00ff" />

      {/* Reflection shine */}
      <RoundedRect x={e.x + 12} y={e.y + 5} width={16} height={3} r={1.5} color="rgba(255,255,255,0.4)" />

      {/* Head */}
      <Circle cx={e.x + 6} cy={e.y + 14} r={7} color="#1a0022" />
      <Circle cx={e.x + 5} cy={e.y + 14} r={5} color="#3a0044" />

      {/* Glowing Eyes */}
      <Oval x={e.x - 1} y={e.y + 10} width={4} height={7} color="#ff3333" />
      <Circle cx={e.x} cy={e.y + 12} r={1.5} color="#fff" />
    </Group>
  );
}

function FrogEnemy({ e }: { e: EnemyEntity }) {
  // e.vy is negative when jumping up, positive when falling, 0 when landed
  const isJumping = (e.vy || 0) !== 0;
  const legExtension = isJumping ? 12 : 0;

  // Body squash and stretch based on velocity
  const stretch = isJumping ? 4 : 0;
  const squash = isJumping ? -4 : 0;

  return (
    <Group>
      {/* Thighs */}
      <Oval x={e.x - 4} y={e.y + e.height - 12 + legExtension / 2} width={12} height={14 + legExtension} color="#166016" />
      <Oval x={e.x + e.width - 8} y={e.y + e.height - 12 + legExtension / 2} width={12} height={14 + legExtension} color="#166016" />

      {/* Feet */}
      <RoundedRect x={e.x - 6} y={e.y + e.height + legExtension} width={14} height={4} r={2} color="#0d400d" />
      <RoundedRect x={e.x + e.width - 8} y={e.y + e.height + legExtension} width={14} height={4} r={2} color="#0d400d" />

      {/* Body */}
      <RoundedRect x={e.x - squash / 2} y={e.y + 6 - stretch} width={e.width + squash} height={e.height - 8 + stretch * 2} r={10} color="#279e27" />

      {/* Underbelly */}
      <RoundedRect x={e.x + 2} y={e.y + 10 - stretch / 2} width={e.width - 4} height={e.height - 14 + stretch} r={6} color="#e0f0b0" />

      {/* Organic spots (warts) */}
      <Circle cx={e.x + 6} cy={e.y + 10} r={2} color="#1a701a" />
      <Circle cx={e.x + e.width - 8} cy={e.y + 14} r={2.5} color="#1a701a" />
      <Circle cx={e.x + 12} cy={e.y + 18} r={1.5} color="#1a701a" />

      {/* Bulging Eyes */}
      <Circle cx={e.x + 6} cy={e.y + 2 - stretch} r={5.5} color="#3ab83a" />
      <Circle cx={e.x + e.width - 6} cy={e.y + 2 - stretch} r={5.5} color="#3ab83a" />

      {/* Pupils (looking left) */}
      <Circle cx={e.x + 4} cy={e.y + 2 - stretch} r={2.5} color="#000" />
      <Circle cx={e.x + e.width - 8} cy={e.y + 2 - stretch} r={2.5} color="#000" />
      <Circle cx={e.x + 3} cy={e.y + 1 - stretch} r={1} color="#fff" />
      <Circle cx={e.x + e.width - 9} cy={e.y + 1 - stretch} r={1} color="#fff" />
    </Group>
  );
}


// ─── main export ────────────────────────────────────────────────────────────────

export default function GameCanvasCore({ snapshot, ghostsRef, width, height, finishDistance }: GameCanvasCoreProps) {
  const { cameraX, player, platforms, coins, parallaxFar, projectiles, effects, enemies, spikes, invincible, characterId, heartsList } = snapshot;

  const {
    shadowsEnabled,
    backgroundLayers,
    maxRemotePlayers,
    ghostEffectsEnabled,
    level,
  } = useMemo(() => qualityManager.getProfile(), []);

  const spriteSheet = useImage(require('../../../assets/characters/player-spritesheet.png'));
  const font = useFont(require('../../../assets/fonts/SpaceMono-Regular.ttf'), 12);

  // Compile the tint shader only once
  const tintShader = useMemo(() => Skia.RuntimeEffect.Make(CHARACTER_TINT_SHADER), []);
  const targetColor = CHARACTER_TINT_COLORS[characterId] ?? null;

  const px = player.renderX;
  const py = player.renderY;
  const groundY = height * 0.72;
  // Ghost: very translucent blue. Invincible: flickering mid-opacity. Normal: opaque.
  const playerOpacity = effects.ghost ? 0.42 : invincible ? 0.55 : 1;
  const flagX = finishDistance != null ? finishDistance * 10 + 80 : 0;

  return (
    <Canvas style={{ width, height }}>
      {backgroundLayers > 2 && <GameBackground scrollX={cameraX} width={width} height={height} speed={0.15} />}
      {backgroundLayers > 3 && <GameBackground scrollX={cameraX} width={width} height={height} speed={0.25} />}
      <GameBackground scrollX={cameraX} width={width} height={height} speed={0.35} />

      {/* ── Garden ground ────────────────────────────────────────────── */}
      {/* Ground was removed here so ParallaxGround shows through */}

      {/* Camera-space world */}
      <Group transform={[{ translateX: -cameraX }]}>

        {/* ── Finish Line Flag ────────────────────────────────────────────── */}
        {finishDistance != null && finishDistance < Infinity && (
          <Group>
            {/* Flag Pole base */}
            <RoundedRect x={flagX - 6} y={groundY - 10} width={18} height={10} r={4} color="#666" />
            {/* Flag Pole */}
            <Rect x={flagX} y={groundY - 160} width={6} height={150} color="#e0e0e0" />
            <Rect x={flagX + 4} y={groundY - 160} width={2} height={150} color="#999" />
            {/* Flag Cloth (Checkered) */}
            <Group>
              <Rect x={flagX + 6} y={groundY - 160} width={60} height={40} color="#fff" />
              <Rect x={flagX + 6} y={groundY - 160} width={15} height={10} color="#000" />
              <Rect x={flagX + 36} y={groundY - 160} width={15} height={10} color="#000" />
              <Rect x={flagX + 21} y={groundY - 150} width={15} height={10} color="#000" />
              <Rect x={flagX + 51} y={groundY - 150} width={15} height={10} color="#000" />
              <Rect x={flagX + 6} y={groundY - 140} width={15} height={10} color="#000" />
              <Rect x={flagX + 36} y={groundY - 140} width={15} height={10} color="#000" />
              <Rect x={flagX + 21} y={groundY - 130} width={15} height={10} color="#000" />
              <Rect x={flagX + 51} y={groundY - 130} width={15} height={10} color="#000" />
              <Rect x={flagX + 6} y={groundY - 160} width={60} height={40} style="stroke" strokeWidth={1} color="#000" />
            </Group>
            {/* Finish Line on Ground */}
            <Rect x={flagX - 10} y={groundY} width={20} height={4} color="#fff" />
          </Group>
        )}

        {/* Platforms */}
        {platforms.map((p) => {
          const isGround = p.height >= 24;
          return (
            <Group key={p.id}>
              {/* Ground rendering (untouched) */}
              {isGround && (<>
                <Rect x={p.x} y={p.y} width={p.width} height={14} color="#5cb85c" />
                <Rect x={p.x} y={p.y + 12} width={p.width} height={4} color="#4a9e4a" />
              </>)}

              {/* Air Platform rendering (realistic) */}
              {!isGround && (
                <Group>
                  {/* Drop shadow */}
                  {level !== 'low' && <RoundedRect x={p.x + 4} y={p.y + 8} width={p.width} height={p.height} r={8} color="rgba(0,0,0,0.3)" />}

                  {p.variant === 0 && (
                    <>
                      {/* Mossy Log */}
                      {level !== 'low' && (
                        <>
                          <Path path={`M ${p.x + 10} ${p.y + p.height} Q ${p.x + 12} ${p.y + p.height + 20} ${p.x + 8} ${p.y + p.height + 30}`} color="#3a8a3a" style="stroke" strokeWidth={3} />
                          <Path path={`M ${p.x + p.width - 20} ${p.y + p.height} Q ${p.x + p.width - 15} ${p.y + p.height + 15} ${p.x + p.width - 25} ${p.y + p.height + 25}`} color="#2a7a2a" style="stroke" strokeWidth={2} />
                          <Path path={`M ${p.x + p.width / 2} ${p.y + p.height} Q ${p.x + p.width / 2 + 5} ${p.y + p.height + 10} ${p.x + p.width / 2} ${p.y + p.height + 18}`} color="#4a9a4a" style="stroke" strokeWidth={2.5} />
                        </>
                      )}
                      <RoundedRect x={p.x} y={p.y} width={p.width} height={p.height} r={8} color="#6b4423" />
                      <RoundedRect x={p.x} y={p.y} width={p.width} height={6} r={6} color="#4a8522" />
                      {level !== 'low' && (
                        <>
                          <RoundedRect x={p.x + 10} y={p.y + 4} width={p.width - 20} height={2} r={1} color="#503010" />
                          <RoundedRect x={p.x + 4} y={p.y + 8} width={p.width - 8} height={1.5} r={0.5} color="#503010" />
                          <RoundedRect x={p.x + 15} y={p.y + 12} width={p.width - 30} height={2} r={1} color="#503010" />
                        </>
                      )}
                    </>
                  )}
                  {p.variant === 1 && (
                    <>
                      {/* Stone with Roots */}
                      <RoundedRect x={p.x} y={p.y} width={p.width} height={p.height} r={4} color="#696969" />
                      <RoundedRect x={p.x + 2} y={p.y + 2} width={p.width - 4} height={4} r={2} color="#a9a9a9" />
                      <Path path={`M ${p.x + 5} ${p.y - 2} Q ${p.x + 15} ${p.y + 15} ${p.x + 5} ${p.y + p.height + 5}`} color="#4a3010" style="stroke" strokeWidth={3} />
                      <Path path={`M ${p.x + p.width - 15} ${p.y - 2} Q ${p.x + p.width - 5} ${p.y + 10} ${p.x + p.width - 15} ${p.y + p.height + 5}`} color="#3a2010" style="stroke" strokeWidth={2} />
                    </>
                  )}
                  {(p.variant === 2 || p.variant === undefined) && (
                    <>
                      {/* Ancient Carved Wood */}
                      <RoundedRect x={p.x} y={p.y} width={p.width} height={p.height} r={2} color="#4b3621" />
                      <Rect x={p.x + 5} y={p.y + 5} width={10} height={10} color="#00e5ff" />
                      <Rect x={p.x + p.width - 15} y={p.y + 5} width={10} height={10} color="#00e5ff" />
                      <Rect x={p.x + p.width / 2 - 5} y={p.y + 8} width={10} height={4} color="#00e5ff" />
                    </>
                  )}
                </Group>
              )}
            </Group>
          );
        })}

        {/* ── Spikes ──────────────────────────────────────────────────────── */}
        {spikes.map((s) => (
          <Group key={s.id}>
            {level === 'low' ? (
              <Path path={`M ${s.x} ${s.y + s.height} L ${s.x + s.width / 2} ${s.y} L ${s.x + s.width} ${s.y + s.height} Z`} color="#cc1a00" />
            ) : (
              <>
                {/* Dark shadow */}
                <Path path={buildSpikePath({ ...s, y: s.y + 2 })} color="rgba(0,0,0,0.25)" />
                {/* Red metal spikes */}
                <Path path={buildSpikePath(s)} color="#cc1a00" />
                {/* Highlight on tips */}
                <Path path={buildSpikePath({ ...s, y: s.y + 2, height: s.height - 2 })} color="rgba(255,80,40,0.35)" />
              </>
            )}
          </Group>
        ))}

        {/* Coins */}
        {coins.map((c) => {
          const spin = Math.sin(Date.now() / 400);
          return (
            <Group key={c.id} transform={[{ translateX: c.x }, { scaleX: spin }, { translateX: -c.x }]}>
              {level === 'low' ? (
                <>
                  <Circle cx={c.x} cy={c.y} r={c.radius} color={GameColors.gold} />
                  <Circle cx={c.x} cy={c.y} r={c.radius * 0.5} color="#e6c200" />
                </>
              ) : (
                <>
                  <Circle cx={c.x} cy={c.y} r={c.radius + 5} color="rgba(255,215,0,0.25)" />
                  <Circle cx={c.x} cy={c.y} r={c.radius + 2} color="#b8860b" />
                  <Circle cx={c.x} cy={c.y} r={c.radius} color={GameColors.gold} />
                  <Circle cx={c.x - 3} cy={c.y - 3} r={c.radius * 0.35} color="#fff8dc" />
                  <Circle cx={c.x} cy={c.y} r={c.radius * 0.5} color="#e6c200" />
                </>
              )}
            </Group>
          );
        })}

        {/* ── Hearts ──────────────────────────────────────────────────────── */}
        {heartsList?.map((h) => {
          const float = Math.sin(Date.now() / 300) * 4;
          return (
            <Group key={h.id} transform={[{ translateY: float }]}>
              {/* Heart glow */}
              {level !== 'low' && <Circle cx={h.x} cy={h.y} r={22} color="rgba(255,50,50,0.3)" />}
              {/* Heart shape */}
              <Path path={`M ${h.x} ${h.y + 6} 
                C ${h.x - 20} ${h.y - 12}, ${h.x - 8} ${h.y - 20}, ${h.x} ${h.y - 6}
                C ${h.x + 8} ${h.y - 20}, ${h.x + 20} ${h.y - 12}, ${h.x} ${h.y + 6}
                Z`} 
                color="#ff2222" 
              />
              <Circle cx={h.x - 5} cy={h.y - 8} r={3} color="rgba(255,255,255,0.8)" />
            </Group>
          );
        })}

        {/* ── Enemies ──────────────────────────────────────────────────────── */}
        {enemies.map((e) => {
          if (e.type === 'fly') return <FlyEnemy key={e.id} e={e} />;
          if (e.type === 'bug') return <BugEnemy key={e.id} e={e} />;
          if (e.type === 'frog') return <FrogEnemy key={e.id} e={e} />;
          return null;
        })}

        {/* ── Projectiles ───────────────────────────────────────────────── */}
        {projectiles.map((proj) => (
          <Group key={proj.id}>
            <Circle cx={proj.x} cy={proj.y} r={proj.radius + 7} color={`${proj.color}44`} />
            <Circle cx={proj.x} cy={proj.y} r={proj.radius + 3} color={`${proj.color}88`} />
            <Circle cx={proj.x} cy={proj.y} r={proj.radius} color={proj.color} />
            <Circle cx={proj.x - proj.radius * 0.3} cy={proj.y - proj.radius * 0.3} r={proj.radius * 0.4} color="rgba(255,255,255,0.7)" />
          </Group>
        ))}

        {/* ── Ghosts (Remote Players) ────────────────────────────────────── */}
        {ghostsRef?.current?.slice(0, maxRemotePlayers).map((g: any) => {
          // Normalise Y: local ground + relative offset from ghost's local ground
          const gGroundY = g.groundY || snapshot.groundY || 300;
          const gy = snapshot.groundY + (g.y - gGroundY);
          const color = g.color || '#aaa';
          const isElim = g.eliminated || (g.finished && g.hearts <= 0);
          
          const isLocalAlive = snapshot.status === 'playing' || snapshot.status === 'idle';
          // Hide dead ghosts if we are still alive
          if (isLocalAlive && isElim) return null;

          // Use synced animation state from remote player (no guessing)
          const animState = g.animState || 'run';
          const animFrame = g.animFrame ?? 0;
          const ghostFacingRight = g.facingRight ?? true;
          const ghostColor = CHARACTER_TINT_COLORS[g.character || 'mario'] ?? null;
          
          return (
            <Group key={g.uid} opacity={isElim ? 0.45 : 1}>
              {/* Ghost Projectiles */}
              {g.projectiles?.map((proj: any) => (
                <Circle key={proj.id} cx={proj.x} cy={proj.y} r={8} color={POWER_PROJECTILE_COLOR} />
              ))}

              {/* Optional effects */}
              {level !== 'low' && ghostEffectsEnabled && g.shieldActive && (
                <RoundedRect x={g.x - 5} y={gy - 5} width={PHYSICS.PLAYER_WIDTH + 10} height={PHYSICS.PLAYER_HEIGHT + 10} r={15} color="rgba(255,105,180,0.3)" />
              )}
              {level !== 'low' && ghostEffectsEnabled && g.speedBoostActive && (
                <RoundedRect x={g.x - 6} y={gy + PHYSICS.PLAYER_HEIGHT - 6} width={PHYSICS.PLAYER_WIDTH + 12} height={14} r={7} color="rgba(255,220,0,0.4)" />
              )}
              {/* Ghost shadow */}
              {level !== 'low' && (
                <RoundedRect x={g.x + 6} y={gy + PHYSICS.PLAYER_HEIGHT} width={PHYSICS.PLAYER_WIDTH - 12} height={8} r={4} color="rgba(0,0,0,0.2)" />
              )}

              {/* Ghost Sprite */}
              {spriteSheet ? (
                <Group
                  transform={[
                    { translateX: g.x - (FRAME_W - PHYSICS.PLAYER_WIDTH) / 2 + FRAME_W / 2 },
                    { translateY: gy - (FRAME_H - PHYSICS.PLAYER_HEIGHT) + FRAME_H / 2 + 18 },
                    { scaleX: ghostFacingRight ? 1 : -1 },
                    { scaleY: 1 },
                    { translateX: -FRAME_W / 2 },
                    { translateY: -FRAME_H / 2 },
                  ]}
                  clip={rect(0, 0, FRAME_W, FRAME_H)}
                >
                  <Group>
                    {tintShader && ghostColor && (
                      <RuntimeShader source={tintShader} uniforms={{ targetColor: ghostColor }} />
                    )}
                    <Image
                      image={spriteSheet}
                      x={-getFrameSourceRect(animState, animFrame).sx}
                      y={-getFrameSourceRect(animState, animFrame).sy}
                      width={SHEET_W}
                      height={SHEET_H}
                      fit="fill"
                    />
                  </Group>
                </Group>
              ) : (
                <RoundedRect x={g.x} y={gy} width={PHYSICS.PLAYER_WIDTH} height={PHYSICS.PLAYER_HEIGHT} r={10} color={`${color}88`} />
              )}

              {/* Ghost Name Label */}
              {font && g.displayName && (
                <Group transform={[{ translateX: g.x + PHYSICS.PLAYER_WIDTH / 2 - font.getTextWidth(g.displayName) / 2 }, { translateY: gy - 22 }]}>
                  {/* Text shadow/stroke effect */}
                  {level !== 'low' && (
                    <>
                      <SkiaText font={font} text={g.displayName} x={1} y={1} color="black" />
                      <SkiaText font={font} text={g.displayName} x={-1} y={-1} color="black" />
                    </>
                  )}
                  <SkiaText font={font} text={g.displayName} x={0} y={0} color={color} />
                </Group>
              )}

              {/* Ghost Lives */}
              <Group transform={[{ translateX: g.x + PHYSICS.PLAYER_WIDTH / 2 }, { translateY: gy + PHYSICS.PLAYER_HEIGHT + 10 }]}>
                {Array.from({ length: g.hearts || 0 }).map((_, i) => (
                  <Group key={i} transform={[{ translateX: (i - (g.hearts - 1) / 2) * 14 }]}>
                    <Path path={HEART_PATH} color="#ff3333" />
                  </Group>
                ))}
              </Group>
            </Group>
          );
        })}

        {/* Peach shield aura */}
        {effects.shield && (
          <>
            <Circle cx={px + player.width / 2} cy={py + player.height / 2} r={player.width * 0.9} color="rgba(255,100,160,0.18)" />
            <Circle cx={px + player.width / 2} cy={py + player.height / 2} r={player.width * 0.85} color="rgba(255,160,200,0.12)" />
          </>
        )}

        {/* Toad speed boost glow */}
        {effects.speedBoost && (
          <RoundedRect x={px - 6} y={py + player.height - 6} width={player.width + 12} height={14} r={7} color="rgba(255,220,0,0.4)" />
        )}

        {/* Bowser spin aura */}
        {effects.bowserSpin && (
          <>
            <Circle cx={px + player.width / 2} cy={py + player.height / 2} r={player.width * 1.4} color="rgba(255,140,0,0.18)" />
            <Circle cx={px + player.width / 2} cy={py + player.height / 2} r={player.width * 1.2} color="rgba(255,80,0,0.12)" />
          </>
        )}

        {/* Player shadow */}
        <RoundedRect x={px + 6} y={py + player.height} width={player.width - 12} height={8} r={4} color="rgba(0,0,0,0.2)" />

        {/* Player body (Animated Sprite) */}
        {spriteSheet ? (
          <Group
            transform={[
              { translateX: px - (FRAME_W - player.width) / 2 + FRAME_W / 2 },
              // Offset so character's feet rest exactly on the green ground surface
              { translateY: py - (FRAME_H - player.height) + FRAME_H / 2 + 18 },
              { scaleX: (player.facingRight ? 1 : -1) * player.landScaleX },
              { scaleY: player.landScaleY },
              { translateX: -FRAME_W / 2 },
              { translateY: -FRAME_H / 2 },
            ]}
            opacity={playerOpacity}
            clip={rect(0, 0, FRAME_W, FRAME_H)}
          >
            <Group>
              {/* Apply precise color replacement via SkSL shader (null for Mario = original) */}
              {tintShader && targetColor && (
                <RuntimeShader source={tintShader} uniforms={{ targetColor }} />
              )}
              <Image
                image={spriteSheet}
                x={-getFrameSourceRect(player.animState, player.animFrame).sx}
                y={-getFrameSourceRect(player.animState, player.animFrame).sy}
                width={SHEET_W}
                height={SHEET_H}
                fit="fill"
              />
            </Group>
          </Group>
        ) : null}
      </Group>
    </Canvas>
  );
}
