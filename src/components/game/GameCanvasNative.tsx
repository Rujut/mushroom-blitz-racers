/**
 * GameCanvasNative.tsx
 *
 * Pure React Native renderer — zero Skia / WebGL dependency.
 * Uses absolute-positioned <View> for maximum native performance.
 * Forest SVG background via expo-image (ParallaxBackground).
 */
import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import type { EnemyEntity, GameSnapshot, SpikeEntity } from '@/src/game/core/types';
import { GameColors } from '@/src/constants/theme';
import ParallaxBackground from './ParallaxBackground';
import ParallaxGround from './ParallaxGround';
import AnimatedPlayer from './AnimatedPlayer';

interface Props {
  snapshot: GameSnapshot;
  width: number;
  height: number;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

/** World-x → screen-x. Always returns an integer to prevent sub-pixel jitter. */
function wx(worldX: number, camX: number): number {
  return Math.round(worldX - camX);
}
/** Round to nearest integer for stable layout. */
const r = Math.round;

// ─── sub-components ──────────────────────────────────────────────────────────

const Cloud = memo(function Cloud({ cx, cy, cw }: { cx: number; cy: number; cw: number }) {
  return (
    <View
      style={[
        styles.abs,
        {
          left: r(cx), top: r(cy),
          width: r(cw), height: 24,
          borderRadius: 12,
          backgroundColor: 'rgba(255,255,255,0.9)',
        },
      ]}
    />
  );
});

const Spike = memo(function Spike({ s, camX }: { s: SpikeEntity; camX: number }) {
  const spikeW = 18;
  const count  = Math.max(1, Math.round(s.width / spikeW));
  const screenX = wx(s.x, camX);
  return (
    <View style={{ position: 'absolute', left: screenX, top: r(s.y), flexDirection: 'row' }}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            width: spikeW,
            height: s.height,
            backgroundColor: 'transparent',
            borderLeftWidth: spikeW / 2,
            borderRightWidth: spikeW / 2,
            borderBottomWidth: s.height,
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            borderBottomColor: '#cc1a00',
          }}
        />
      ))}
    </View>
  );
});

const FlyEnemy = memo(function FlyEnemy({ x, y, w, h, camX }: { x: number; y: number; w: number; h: number; camX: number }) {
  const sx = wx(x, camX);
  return (
    <View style={{ position: 'absolute', left: sx - 10, top: r(y) - 4 }}>
      <View style={[styles.wing, { left: 0, top: 0 }]} />
      <View style={[styles.wing, { left: w + 10 - 2, top: 0 }]} />
      <View style={[styles.enemyBody, { left: 10, top: 0, width: w, height: h, borderRadius: 8, backgroundColor: '#2a1a3a' }]}>
        <View style={[styles.eyeRed, { left: 5, top: 5 }]} />
        <View style={[styles.eyeRed, { left: w - 11, top: 5 }]} />
      </View>
    </View>
  );
});

const BugEnemy = memo(function BugEnemy({ x, y, w, h, camX }: { x: number; y: number; w: number; h: number; camX: number }) {
  const sx = wx(x, camX);
  return (
    <View style={{ position: 'absolute', left: sx, top: r(y) }}>
      <View style={{ position: 'absolute', left: 0, top: 2, width: w, height: h - 4, borderRadius: 8, backgroundColor: '#8b4513' }} />
      <View style={{ position: 'absolute', left: 3, top: 4, width: w - 6, height: h - 10, borderRadius: 6, backgroundColor: '#a0522d' }} />
      <View style={{ position: 'absolute', left: w / 2 - 5, top: -2, width: 10, height: 10, borderRadius: 5, backgroundColor: '#7a3d10' }} />
    </View>
  );
});

const FrogEnemy = memo(function FrogEnemy({ x, y, w, h, camX }: { x: number; y: number; w: number; h: number; camX: number }) {
  const sx = wx(x, camX);
  return (
    <View style={{ position: 'absolute', left: sx, top: r(y) }}>
      <View style={{ position: 'absolute', left: 0, top: 6, width: w, height: h - 8, borderRadius: 8, backgroundColor: '#32a832' }} />
      <View style={{ position: 'absolute', left: 2, top: 0, width: w - 4, height: 14, borderRadius: 7, backgroundColor: '#3ab83a' }} />
      <View style={{ position: 'absolute', left: 2, top: -4, width: 10, height: 10, borderRadius: 5, backgroundColor: '#3ab83a' }}>
        <View style={[styles.eyeDark, { left: 2, top: 2 }]} />
      </View>
      <View style={{ position: 'absolute', left: w - 12, top: -4, width: 10, height: 10, borderRadius: 5, backgroundColor: '#3ab83a' }}>
        <View style={[styles.eyeDark, { left: 2, top: 2 }]} />
      </View>
    </View>
  );
});

// ─── main renderer ───────────────────────────────────────────────────────────

export default memo(function GameCanvasNative({ snapshot, width, height }: Props) {
  const {
    cameraX, player, platforms, coins,
    projectiles, effects, enemies, spikes, invincible,
  } = snapshot;

  // All screen coordinates rounded to integers — CRITICAL for preventing jitter
  const px = r(player.renderX - cameraX);
  const py = r(player.renderY);
  const groundY = r(height * 0.72);
  const isGhostStatus = snapshot.status === 'ghost';
  const playerOpacity = isGhostStatus ? 0.35 : (effects.ghost ? 0.42 : (invincible ? 0.55 : 1.0));

  // Garden ground (replaces plain green fill)

  return (
    <View style={[styles.canvas, { width, height }]}>

      {/* ── Parallax Background ─────────────────────────────────────────── */}
      <ParallaxBackground scrollX={cameraX} width={width} height={height} />

      {/* ── Exact User Image Ground (Parallax scrolling) ────────────────── */}
      <ParallaxGround scrollX={cameraX} width={width} height={height} groundY={groundY} />

      {/* Ground was removed here so ParallaxGround shows through */}

      {/* ── Platforms ───────────────────────────────────────────────────── */}
      {platforms.map((p) => {
        const sx = wx(p.x, cameraX);
        const sy = r(p.y);
        const isGround = p.height >= 24;
        return (
          <View key={p.id} style={[styles.abs, {
            left: sx, top: sy,
            width: r(p.width), height: r(p.height),
            borderRadius: isGround ? 0 : 6,
            backgroundColor: isGround ? 'transparent' : '#8d6e4c',
            overflow: 'hidden',
          }]}>
            {isGround ? (
              <>
                <View style={{ position: 'absolute', left: 0, top: 0, width: p.width, height: 14, backgroundColor: '#5cb85c' }} />
                <View style={{ position: 'absolute', left: 0, top: 12, width: p.width, height: 4, backgroundColor: '#4a9e4a' }} />
              </>
            ) : (
              <>
                <View style={{ position: 'absolute', left: 0, top: 0, width: p.width, height: 8, backgroundColor: '#a0825e', borderRadius: 6 }} />
                <View style={{ position: 'absolute', left: 4, top: 2, width: p.width - 8, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2 }} />
              </>
            )}
          </View>
        );
      })}

      {/* ── Spikes ──────────────────────────────────────────────────────── */}
      {spikes.map((s) => <Spike key={s.id} s={s} camX={cameraX} />)}

      {/* ── Coins ───────────────────────────────────────────────────────── */}
      {coins.map((c) => {
        const sx = wx(c.x, cameraX);
        const rr = c.radius;
        return (
          <View key={c.id} style={[styles.abs, { left: sx - rr - 5, top: r(c.y) - rr - 5 }]}>
            <View style={{ width: (rr + 5) * 2, height: (rr + 5) * 2, borderRadius: rr + 5, backgroundColor: 'rgba(255,215,0,0.25)', position: 'absolute' }} />
            <View style={{ left: 3, top: 3, width: (rr + 2) * 2, height: (rr + 2) * 2, borderRadius: rr + 2, backgroundColor: '#b8860b', position: 'absolute' }} />
            <View style={{ left: 5, top: 5, width: rr * 2, height: rr * 2, borderRadius: rr, backgroundColor: GameColors.gold, position: 'absolute' }} />
          </View>
        );
      })}

      {/* ── Enemies ─────────────────────────────────────────────────────── */}
      {enemies.map((e) => {
        if (e.dead) return null;
        if (e.type === 'fly')  return <FlyEnemy  key={e.id} x={e.x} y={e.y} w={e.width} h={e.height} camX={cameraX} />;
        if (e.type === 'bug')  return <BugEnemy  key={e.id} x={e.x} y={e.y} w={e.width} h={e.height} camX={cameraX} />;
        if (e.type === 'frog') return <FrogEnemy key={e.id} x={e.x} y={e.y} w={e.width} h={e.height} camX={cameraX} />;
        return null;
      })}

      {/* ── Projectiles ─────────────────────────────────────────────────── */}
      {projectiles.map((proj) => {
        const sx = wx(proj.x, cameraX);
        const sy = r(proj.y);
        const rr = proj.radius;
        return (
          <View key={proj.id} style={[styles.abs, { left: sx - rr - 7, top: sy - rr - 7 }]}>
            <View style={{ width: (rr + 7) * 2, height: (rr + 7) * 2, borderRadius: rr + 7, backgroundColor: `${proj.color}44`, position: 'absolute' }} />
            <View style={{ left: 4, top: 4, width: (rr + 3) * 2, height: (rr + 3) * 2, borderRadius: rr + 3, backgroundColor: `${proj.color}88`, position: 'absolute' }} />
            <View style={{ left: 7, top: 7, width: rr * 2, height: rr * 2, borderRadius: rr, backgroundColor: proj.color, position: 'absolute' }} />
          </View>
        );
      })}

      {/* ── Power effects ─────────────────────────────────────────────────── */}
      {effects.shield && (
        <View style={[styles.abs, {
          left: px + player.width / 2 - player.width * 0.9,
          top:  py + player.height / 2 - player.width * 0.9,
          width: player.width * 1.8, height: player.width * 1.8,
          borderRadius: player.width * 0.9,
          backgroundColor: 'rgba(255,100,160,0.18)',
        }]} />
      )}
      {effects.speedBoost && (
        <View style={[styles.abs, {
          left: px - 6, top: py + player.height - 6,
          width: player.width + 12, height: 14,
          borderRadius: 7,
          backgroundColor: 'rgba(255,220,0,0.4)',
        }]} />
      )}

      {/* ── Player shadow ─────────────────────────────────────────────────── */}
      <View style={[styles.abs, {
        left: px + 6, top: py + player.height,
        width: player.width - 12, height: 8,
        borderRadius: 4,
        backgroundColor: 'rgba(0,0,0,0.2)',
      }]} />

      {/* ── Player body (Animated Sprite) ─────────────────────────────────── */}
      <AnimatedPlayer player={{...player, renderX: px, renderY: py}} opacity={playerOpacity} />
    </View>
  );
});

// ─── styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  canvas: {
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#2980b9', // sky shown while SVG image decodes on first frame
  },
  abs: { position: 'absolute' },
  cloud: { position: 'absolute' },
  wing: {
    position: 'absolute',
    width: 12, height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(180,180,220,0.75)',
  },
  enemyBody: { position: 'absolute' },
  eyeRed: {
    position: 'absolute',
    width: 6, height: 6,
    borderRadius: 3,
    backgroundColor: '#ff3030',
  },
  eyeDark: {
    position: 'absolute',
    width: 6, height: 6,
    borderRadius: 3,
    backgroundColor: '#111',
  },
});
