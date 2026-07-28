/**
 * GhostOverlay.tsx
 *
 * Renders other players as ghost avatars over the game canvas (View-based, no Skia).
 *
 * Ghost Y-fix:
 *   Remote player publishes (y, groundY). We normalise to the local viewport:
 *     relY = slot.y - slot.groundY        (displacement from ground level on remote device)
 *     screenY = localGroundY + relY       (apply same displacement on this device)
 *   This keeps ghosts at the correct ground-relative position regardless of screen size.
 *
 * Features:
 *   - Heart pips under each ghost (❤️ / 🖤)
 *   - Name label above
 *   - "Hit flash" red overlay when hitFlashUids contains this uid
 *   - Eliminated ghosts show 50% opacity with ☠️ tag
 *   - Sync and display character skills: Peach Shield, Luigi Ghost Dash, Toad Boost, and Mario Fireballs.
 */
import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { RemotePlayerSlot } from './roomStore';
import { CHARACTERS } from '@/src/constants/characters';
import { PHYSICS } from '@/src/game/core/constants';

interface Props {
  remotePlayers: RemotePlayerSlot[];
  myUid: string;
  snapshotRef: React.MutableRefObject<any>;
  /** UIDs that just took a fireball hit — show red flash */
  hitFlashUids?: Set<string>;
}

const CHAR_EMOJIS: Record<string, string> = {
  mario: '🔴', luigi: '🟢', peach: '🩷', toad: '🔵',
};

function getCharColor(character: string): string {
  return CHARACTERS.find((c) => c.id === character)?.color ?? '#aaa';
}

const GhostPlayer = memo(function GhostPlayer({
  slot,
  screenX,
  screenY,
  isHit,
}: {
  slot: RemotePlayerSlot;
  screenX: number;
  screenY: number;
  isHit: boolean;
}) {
  const color   = getCharColor(slot.character);
  const emoji   = CHAR_EMOJIS[slot.character] ?? '⚪';
  const W = PHYSICS.PLAYER_WIDTH;
  const H = PHYSICS.PLAYER_HEIGHT;
  const eliminated = slot.eliminated || (slot.finished && slot.hearts <= 0);

  // Skill states
  const hasShield = slot.shieldActive && slot.character === 'peach';
  const hasLuigiGhost = slot.powerActive && slot.character === 'luigi';
  const hasToadBoost = slot.speedBoostActive && slot.character === 'toad';

  // Base opacity: Luigi is extra translucent when ghost-dashing
  let opacity = eliminated ? 0.45 : 1;
  if (hasLuigiGhost) opacity = 0.22;

  return (
    <View
      style={[
        styles.ghost,
        {
          left:            screenX,
          top:             screenY,
          width:           W,
          height:          H,
          borderColor:     isHit ? '#ff2222' : color,
          backgroundColor: isHit ? 'rgba(255,34,34,0.45)' : `${color}55`,
          opacity:         opacity,
        },
      ]}
    >
      {/* Peach Shield bubble */}
      {hasShield && <View style={styles.shield} />}

      {/* Luigi Ghost Glow */}
      {hasLuigiGhost && <View style={styles.luigiGhostGlow} />}

      {/* Toad Boost Trail/Glow */}
      {hasToadBoost && <View style={styles.toadBoostGlow} />}

      <View style={[styles.label, { borderColor: color, backgroundColor: `${color}cc` }]}>
        <Text style={styles.labelText} numberOfLines={1}>
          {eliminated ? '☠️ ' : emoji + ' '}{(slot.displayName || 'Player').substring(0, 8)}
        </Text>
      </View>

      {/* Body outline */}
      <View style={[StyleSheet.absoluteFillObject, { borderRadius: 10, borderWidth: 2, borderColor: isHit ? '#ff2222' : color }]} />

      {/* Stripe pattern */}
      <View style={[styles.stripe, { top: H * 0.25, backgroundColor: `${color}44` }]} />
      <View style={[styles.stripe, { top: H * 0.55, backgroundColor: `${color}44` }]} />

      {/* Hearts row */}
      <View style={styles.hearts}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Text key={i} style={styles.heartIcon}>{i < slot.hearts ? '❤️' : '🖤'}</Text>
        ))}
      </View>

      {/* Distance */}
      <Text style={styles.distText}>{Math.floor(slot.distance)}m</Text>
    </View>
  );
});

export const GhostOverlay = memo(function GhostOverlay({
  remotePlayers,
  myUid,
  snapshotRef,
  hitFlashUids = new Set(),
}: Props) {
  const [, setTick] = React.useState(0);

  // Autonomous 60fps render loop to keep ghosts in sync with the Skia camera
  React.useEffect(() => {
    let rafId: number;
    const loop = () => {
      setTick((t) => t + 1);
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const snapshot = snapshotRef.current;
  if (!snapshot) return null;

  const { cameraX, viewportWidth, groundY: localGroundY } = snapshot;
  const W = PHYSICS.PLAYER_WIDTH;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {remotePlayers
        .filter((s) => s.uid !== myUid)
        .map((slot) => {
          const screenX = slot.x - cameraX;
          if (screenX + W < -120 || screenX > viewportWidth + 120) return null;

          // Normalise Y across different viewport/screen sizes
          const slotGroundY = slot.groundY > 0 ? slot.groundY : localGroundY;
          const relY   = slot.y - slotGroundY;               // displacement from ground
          const screenY = localGroundY + relY;               // apply on this device

          return (
            <React.Fragment key={slot.uid}>
              {/* Remote Player Ghost */}
              <GhostPlayer
                slot={slot}
                screenX={Math.round(screenX)}
                screenY={Math.round(screenY)}
                isHit={hitFlashUids.has(slot.uid)}
              />

              {/* Remote Player Fireballs */}
              {slot.projectiles?.map((proj) => {
                const px = proj.x - cameraX;
                // Don't draw off-screen projectiles
                if (px + 18 < -20 || px > viewportWidth + 20) return null;

                // Normalise Y of the remote projectile to local viewport
                const py = localGroundY + (proj.y - slotGroundY);

                return (
                  <View
                    key={proj.id}
                    style={[
                      styles.fireball,
                      {
                        left: Math.round(px - 9),
                        top: Math.round(py - 9),
                      },
                    ]}
                  />
                );
              })}
            </React.Fragment>
          );
        })}
    </View>
  );
});

const styles = StyleSheet.create({
  ghost: {
    position: 'absolute',
    borderRadius: 10,
    borderWidth: 2,
    overflow: 'visible',
  },
  shield: {
    position: 'absolute',
    left: -12,
    top: -12,
    width: PHYSICS.PLAYER_WIDTH + 24,
    height: PHYSICS.PLAYER_HEIGHT + 24,
    borderRadius: (PHYSICS.PLAYER_HEIGHT + 24) / 2,
    borderWidth: 3,
    borderColor: '#ff69b4',
    backgroundColor: 'rgba(255,105,180,0.18)',
  },
  luigiGhostGlow: {
    position: 'absolute',
    left: -4,
    top: -4,
    right: -4,
    bottom: -4,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#00a800',
    opacity: 0.7,
  },
  toadBoostGlow: {
    position: 'absolute',
    left: -6,
    top: -6,
    right: -6,
    bottom: -6,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: '#4169e1',
    opacity: 0.8,
  },
  fireball: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ff4500',
    borderWidth: 2,
    borderColor: '#ffcc00',
  },
  label: {
    position: 'absolute',
    top: -22,
    left: -8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 60,
    alignItems: 'center',
  },
  labelText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  stripe: {
    position: 'absolute',
    left: 4, right: 4,
    height: 4, borderRadius: 2,
  },
  hearts: {
    position: 'absolute',
    bottom: -18,
    left: -4,
    flexDirection: 'row',
    gap: 1,
  },
  heartIcon: { fontSize: 8 },
  distText: {
    position: 'absolute',
    bottom: -28,
    left: 0, right: 0,
    textAlign: 'center',
    fontSize: 8,
    color: '#fff',
    fontWeight: '700',
  },
});
