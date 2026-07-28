/**
 * MultiplayerGame.tsx
 *
 * Full multiplayer race component. Zero Zustand subscriptions (ghost data via ref).
 *
 * Features:
 *   - Track types: 1 km / 2 km / 5 km (finite finish) or Endless (last-alive wins)
 *   - Finite mode: first to cross finish line wins; rank by finish time
 *   - Endless mode: hearts=0 → ghost mode (can move but no coins/damage/distance)
 *     Last player alive wins; dead players become ghosts until all die
 *   - Cross-player fireball damage via useFireballSync
 *   - Ghost Y normalised across different screen sizes (groundY displacement)
 *   - Hit flash on ghosts when a fireball lands
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, Platform, StyleSheet, Text, View, StatusBar as RNStatusBar, AppState, Pressable, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ref, update, get } from 'firebase/database';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as NavigationBar from 'expo-navigation-bar';
import * as Haptics from 'expo-haptics';
import { GameEngine } from '@/src/game/core/GameEngine';
import { useGameEngineRunner } from '@/src/hooks/useGameEngineRunner';
import { CHARACTERS } from '@/src/constants/characters';
import { usePlayerStore } from '@/src/store/playerStore';
import { GameColors } from '@/src/constants/theme';
import { GameCanvas } from './GameCanvas';
import { GameControls } from './GameControls';
import { isFirebaseConfigured } from '@/src/firebase/config';
import { getRTDB } from '@/src/firebase/rtdb';
import { usePositionSubscriber } from '@/src/multiplayer/usePositionSubscriber';
import { usePositionSync } from '@/src/multiplayer/usePositionSync';
import { useFireballSync } from '@/src/multiplayer/useFireballSync';
import { getServerTime } from '@/src/firebase/timeSync';

import { SpectatorOverlay } from '@/src/multiplayer/SpectatorOverlay';
import type { PowerState } from '@/src/game/core/types';
import type { RemotePlayerSlot } from '@/src/multiplayer/roomStore';
import { TRACK_FINISH_M, type TrackType, useRoomStore } from '@/src/multiplayer/roomStore';
import { setLevelSeed } from '@/src/game/levels/levelGenerator';
import { POWER_CATALOGUE } from '@/src/game/core/powers';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface MultiplayerGameProps {
  roomCode: string;
  trackType: TrackType;
  onFinish: (stats: { distance: number; coins: number; rank: number; totalPlayers: number; leaderboard?: string }) => void;
  onQuit: () => void;
}

// ── helpers ───────────────────────────────────────────────────────────────────

function difficultyLabel(d: number) {
  if (d < 50) return 'Easy'; if (d < 150) return 'Medium';
  if (d < 300) return 'Hard'; return '🔥 Max';
}
function difficultyColor(d: number) {
  if (d < 50) return '#44dd77'; if (d < 150) return '#ffcc00';
  if (d < 300) return '#ff8800'; return '#ff3333';
}
function trackLabel(t: TrackType) {
  return { endless: '∞ Endless', km1: '1 km', km2: '2 km', km5: '5 km' }[t];
}

function HeartsDisplay({ hearts, maxHearts, invincible }: { hearts: number; maxHearts: number; invincible: boolean }) {
  return (
    <View style={heartStyles.row}>
      {Array.from({ length: maxHearts }).map((_, i) => (
        <View key={i} style={[heartStyles.heartWrap, invincible && i >= hearts && heartStyles.flash]}>
          <MaterialCommunityIcons
            name={i < hearts ? 'heart' : 'heart-outline'}
            size={18}
            color={i < hearts ? '#ff3b5c' : '#555'}
          />
        </View>
      ))}
    </View>
  );
}
const heartStyles = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', gap: 1 },
  heartWrap: {},
  flash: { opacity: 0.4 },
});

// ── component ─────────────────────────────────────────────────────────────────

export function MultiplayerGame({ roomCode, trackType, onFinish, onQuit }: MultiplayerGameProps) {
  const insets      = useSafeAreaInsets();
  const uid         = usePlayerStore((s) => s.uid);
  const displayName = usePlayerStore((s) => s.displayName);
  const characterId = usePlayerStore((s) => s.selectedCharacterId);
  const addCoins    = usePlayerStore((s) => s.addCoins);
  const syncToCloud = usePlayerStore((s) => s.syncToCloud);

  const charDef        = CHARACTERS.find((c) => c.id === characterId);
  const characterColor = charDef?.color ?? GameColors.primary;
  const finishDistance = TRACK_FINISH_M[trackType]; // null = endless

  // ── Engine (stable ref) ───────────────────────────────────────────────────
  const engineRef = useRef<GameEngine | null>(null);
  if (!engineRef.current) engineRef.current = new GameEngine(characterColor);
  const engine = engineRef.current;

  const startedRef   = useRef(false);
  const finishedRef  = useRef(false);
  const [layout, setLayout]         = useState({ width: 0, height: 0 });
  const [gameReady, setGameReady]   = useState(false);
  /** True after local player died — enters ghost mode (can still move) */
  const [isGhost, setIsGhost]       = useState(false);
  const [finishStatus, setFinishStatus] = useState<'playing' | 'finished' | 'eliminated'>('playing');
  /** Frozen distance at death (for ranking) */
  const [deathDistance, setDeathDistance] = useState(0);
  /** Timestamp when local player died (for ranking — later = better) */
  const [deathTime, setDeathTime]       = useState<number | null>(null);
  // UIDs of ghosts currently flashing from a fireball hit
  const [hitFlashUids, setHitFlashUids] = useState<Set<string>>(new Set());
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const [isCalculatingResults, setIsCalculatingResults] = useState(false);

  // ── Multiplayer: ref-based ghost data (zero Zustand/setState) ────────────
  const ghostsRef = usePositionSubscriber({
    roomCode, uid, displayName, character: characterId, color: characterColor,
  });

  // ── Fireball sync ──────────────────────────────────────────────────────────
  const handleHitDetected = useCallback((victimUid: string) => {
    setHitFlashUids((prev) => {
      const next = new Set(prev); next.add(victimUid); return next;
    });
    setTimeout(() => {
      setHitFlashUids((prev) => { const next = new Set(prev); next.delete(victimUid); return next; });
    }, 350);
  }, []);

  useFireballSync({
    engine,
    roomCode,
    myUid: uid,
    ghostsRef,
    active: gameReady && !isGhost,  // ghosts don't fire/receive fireballs
    onHitDetected: handleHitDetected,
  });

  // ── Game loop ──────────────────────────────────────────────────────────────
  const handleGameFinish = useCallback(
    (stats: { distance: number; coins: number }) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      addCoins(stats.coins);
      syncToCloud();

      const engineStatus = engine.getStatus();
      


      // Player died — check if they are the LAST player alive
      if (engineStatus === 'gameover') {
        const now = getServerTime();
        setDeathDistance(stats.distance);
        setDeathTime(now);
        setFinishStatus('eliminated');
        
        // Enter ghost mode
        engine.enterGhostMode(); // switches engine to 'ghost' status — keeps ticking
        setIsGhost(true);

        // Tell other players we died
        const db = getRTDB();
        if (db) {
          update(ref(db, `rooms/${roomCode}/players/${uid}`), {
            eliminated: true, e: true,
            hearts: 0, h: 0,
            distance: stats.distance, d: stats.distance,
          }).catch(() => {});
        }
        return;
      }

      // Player finished the track (finite mode)
      const now = getServerTime();
      setDeathDistance(stats.distance); // Use death distance to store finish distance just in case
      setDeathTime(now);
      setFinishStatus('finished');

      const db = getRTDB();
      if (db) {
        update(ref(db, `rooms/${roomCode}/players/${uid}`), {
          finished: true, f: true, 
          finishTime: now, 
          hearts: 1, h: 1, 
          distance: stats.distance, d: stats.distance
        }).catch(() => {});
      }

      // Enter ghost mode to wait for others
      engine.enterGhostMode(); 
      setIsGhost(true);
    },
    [addCoins, onFinish, roomCode, uid, ghostsRef, engine, syncToCloud, trackType],
  );

  // Engine runner — keeps running even in ghost mode (enabled stays true)
  const { hud, snapshotRef } = useGameEngineRunner({
    engine,
    enabled: gameReady,  // NOT gated by isGhost — ghost mode keeps the loop
    finishDistance: finishDistance ?? Infinity,
    onFinish: handleGameFinish,
  });

  const defaultPower: PowerState = {
    cooldownMs: 0, maxCooldownMs: 1, active: false,
    name: charDef?.powerName ?? 'Power', icon: charDef ? POWER_CATALOGUE[charDef.id].icon : 'lightning-bolt',
  };
  const power: PowerState = gameReady ? (snapshotRef.current?.power ?? defaultPower) : defaultPower;

  // ── Last Alive Ghost Check ───────────────────────────────────────
  // When a player is a ghost, the engine stops triggering 'gameover' events.
  // We need to continuously check if everyone else has finished or died so we can show results.
  useEffect(() => {
    if (!isGhost || finishStatus === 'playing') return;
    const timer = setInterval(() => {
      const gList = ghostsRef.current;
      const aliveGhosts = gList.filter(g => !g.eliminated && !g.finished);
      
      if (aliveGhosts.length === 0) {
        clearInterval(timer);
        setIsCalculatingResults(true);

        // Wait 2.5 seconds, then do a FRESH one-shot read from Firebase.
        // This ensures ALL players read the exact same final data from the
        // single source of truth, producing identical leaderboards.
        setTimeout(async () => {
          try {
            const db = getRTDB();
            let allPlayers: { uid: string; name: string; character: string; color: string; distance: number; isDead: boolean; finished: boolean; finishTime: number; isMe: boolean }[] = [];

            if (db) {
              const playersSnap = await get(ref(db, `rooms/${roomCode}/players`));
              const playersData = playersSnap.val() as Record<string, any> | null;
              
              if (playersData) {
                allPlayers = Object.entries(playersData).map(([pUid, val]) => ({
                  uid: pUid,
                  name: val.displayName || 'Player',
                  character: val.character || 'mario',
                  color: val.color || '#aaa',
                  distance: val.d ?? val.distance ?? 0,
                  isDead: !!(val.e ?? val.eliminated) || (val.h ?? val.hearts ?? 0) <= 0,
                  finished: !!(val.f ?? val.finished),
                  finishTime: val.finishTime ?? Infinity,
                  isMe: pUid === uid,
                }));
              }
            }

            // Fallback: if Firebase read failed, use local data
            if (allPlayers.length === 0) {
              const finalGList = ghostsRef.current;
              allPlayers = [
                ...finalGList.map(g => ({
                  uid: g.uid, name: g.displayName, character: g.character, color: g.color,
                  distance: g.distance, isDead: g.eliminated || g.hearts <= 0,
                  finished: !!g.finished, finishTime: g.finishTime ?? Infinity,
                  isMe: false
                })),
                { 
                  uid, name: displayName, character: characterId, color: characterColor, 
                  distance: deathDistance, isDead: finishStatus === 'eliminated',
                  finished: finishStatus === 'finished', finishTime: deathTime ?? Infinity,
                  isMe: true 
                }
              ];
            }

            // Tier 1: Finished players, sorted by finishTime ASC
            const finishedTier = allPlayers.filter(p => p.finished).sort((a, b) => a.finishTime - b.finishTime);
            // Tier 2: Eliminated players, sorted by distance DESC
            const eliminatedTier = allPlayers.filter(p => !p.finished).sort((a, b) => b.distance - a.distance);

            const list = [...finishedTier, ...eliminatedTier];
            const leaderboardStr = JSON.stringify(list.map((item, idx) => ({ ...item, rank: idx + 1 })));
            const myRank = list.findIndex(p => p.isMe) + 1;

            onFinish({ distance: deathDistance, coins: hud.coins, rank: myRank || 1, totalPlayers: allPlayers.length, leaderboard: leaderboardStr });
          } catch (err) {
            console.error('[MultiplayerGame] Results calculation error:', err);
            // Emergency fallback
            onFinish({ distance: deathDistance, coins: hud.coins, rank: 1, totalPlayers: 1, leaderboard: '' });
          }
        }, 2500);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [isGhost, finishStatus, deathDistance, deathTime, hud.coins, onFinish, roomCode, uid, displayName, characterId, characterColor]);

  // ── Orientation lock ──────────────────────────────────────────────────────
  useEffect(() => {
    RNStatusBar.setHidden(true);
    
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        RNStatusBar.setHidden(true);
      }
    });

    if (Platform.OS !== 'web') {
      // Force immersive mode (hide Android nav bar)
      if (Platform.OS === 'android') {
        NavigationBar.setVisibilityAsync('hidden').catch(() => {});
        NavigationBar.setBehaviorAsync('overlay-swipe').catch(() => {});
      }
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
      return () => {
        subscription.remove();
        RNStatusBar.setHidden(false);
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
        if (Platform.OS === 'android') {
          NavigationBar.setVisibilityAsync('visible').catch(() => {});
        }
      };
    }
    return () => {
      subscription.remove();
      RNStatusBar.setHidden(false);
    };
  }, []);

  // ── Engine init (landscape guard) ─────────────────────────────────────────
  const roomSeed = useRoomStore((s) => s.seed);
  useEffect(() => {
    if (layout.width <= 0 || layout.height <= 0) return;
    if (layout.width < layout.height) return;
    engine.configureViewport(layout.width, layout.height);
    if (!startedRef.current) {
      setLevelSeed(roomSeed);
      engine.setCharacter(characterId, characterColor);
      engine.start();
      startedRef.current = true;
      setGameReady(true);
    }
  }, [layout.width, layout.height, engine, characterId, characterColor, roomSeed]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) setLayout({ width, height });
  };

  // Publish position at 20 Hz (keep publishing in ghost mode so others see the ghost)
  usePositionSync({ engine, roomCode, uid, active: gameReady });

  // ── Input handlers ─────────────────────────────────────────────────────────
  const tryHaptic = (s: Haptics.ImpactFeedbackStyle) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(s).catch(() => {});
  };
  const handleLeft  = (p: boolean) => {
    if (p) tryHaptic(Haptics.ImpactFeedbackStyle.Light);
    engine.setInput(p ? { left: true, right: false } : { left: false });
  };
  const handleRight = (p: boolean) => {
    if (p) tryHaptic(Haptics.ImpactFeedbackStyle.Light);
    engine.setInput(p ? { right: true, left: false } : { right: false });
  };
  const handleJump  = useCallback(() => {
    tryHaptic(Haptics.ImpactFeedbackStyle.Medium);
    engine.setInput({ jumpPressed: true });
  }, [engine]);
  const handlePower = useCallback(() => {
    if (isGhost) return; // ghosts can't use powers
    tryHaptic(Haptics.ImpactFeedbackStyle.Heavy);
    engine.activatePower();
  }, [engine, isGhost]);
  
  const handleQuitRequest = useCallback(() => {
    engine.pause();
    setShowQuitConfirm(true);
  }, [engine]);

  const handleCancelQuit = useCallback(() => {
    setShowQuitConfirm(false);
    engine.resume();
  }, [engine]);

  const handleConfirmQuit = useCallback(() => {
    setShowQuitConfirm(false);
    onQuit();
  }, [onQuit]);

  // ── Keyboard (web) ────────────────────────────────────────────────────────
  useEffect(() => {
    if (Platform.OS !== 'web' || !gameReady) return;
    const keys = new Set<string>();
    const dn = (e: KeyboardEvent) => {
      if (keys.has(e.code)) return; keys.add(e.code);
      switch (e.code) {
        case 'ArrowLeft':  case 'KeyA':  e.preventDefault(); engine.setInput({ left: true,  right: false }); break;
        case 'ArrowRight': case 'KeyD':  e.preventDefault(); engine.setInput({ right: true, left: false  }); break;
        case 'ArrowUp': case 'Space': case 'KeyW': e.preventDefault(); engine.setInput({ jumpPressed: true }); break;
        case 'KeyQ': case 'KeyE': e.preventDefault(); if (!isGhost) engine.activatePower(); break;
      }
    };
    const up   = (e: KeyboardEvent) => {
      keys.delete(e.code);
      switch (e.code) {
        case 'ArrowLeft':  case 'KeyA': e.preventDefault(); engine.setInput({ left: false  }); break;
        case 'ArrowRight': case 'KeyD': e.preventDefault(); engine.setInput({ right: false }); break;
      }
    };
    const blur = () => { keys.clear(); engine.setInput({ left: false, right: false }); };
    document.addEventListener('keydown', dn, { capture: true });
    document.addEventListener('keyup',   up, { capture: true });
    window.addEventListener('blur', blur);
    return () => {
      document.removeEventListener('keydown', dn, { capture: true } as any);
      document.removeEventListener('keyup',   up, { capture: true } as any);
      window.removeEventListener('blur', blur);
    };
  }, [gameReady, engine, isGhost]);

  // ── Rank / leaderboard (from ghostsRef — read each frame) ─────────────────
  const dist    = isGhost ? deathDistance : hud.distance;
  const ghosts: RemotePlayerSlot[] = ghostsRef.current;
  const allDist = [...ghosts.map((g) => g.distance), dist].sort((a, b) => b - a);
  const myRank  = allDist.indexOf(dist) + 1;
  const total   = allDist.length;
  const aliveCount = ghosts.filter((g) => !g.eliminated && g.hearts > 0).length + (isGhost ? 0 : 1);

  // Finish progress bar (finite tracks)
  const finishPct = finishDistance != null ? Math.min(1, dist / finishDistance) : null;

  return (
    <View style={styles.root}>
      <StatusBar hidden={true} />

      {/* ── HUD ─────────────────────────────────────────────────────────── */}
      <View
        style={[styles.hud, { paddingTop: 12, paddingLeft: Math.max(insets.left, 16) }]}
        pointerEvents="box-none"
      >
        <View style={styles.hudLeft}>
          <HeartsDisplay hearts={isGhost ? 0 : hud.hearts} maxHearts={hud.maxHearts} invincible={hud.invincible} />
          
          <View style={[styles.statPill, styles.rankPill]}>
            <Text style={styles.hudIcon}>🏆</Text>
            <Text style={styles.hudText}>#{myRank}/{total}</Text>
          </View>

          <View style={styles.statPill}>
            <Text style={styles.hudIcon}>🍄</Text>
            <Text style={styles.hudText}>{dist}m</Text>
          </View>

          <View style={styles.statPill}>
            <Text style={styles.hudIcon}>🪙</Text>
            <Text style={styles.hudText}>{hud.coins}</Text>
          </View>

          {finishDistance != null ? (
            <View style={styles.statPill}>
              <Text style={styles.hudIcon}>🏁</Text>
              <Text style={styles.hudText}>{Math.round((finishPct ?? 0) * 100)}%</Text>
            </View>
          ) : (
            <View style={[styles.statPill, styles.endlessPill]}>
              <Text style={styles.hudEndless}>💀 {aliveCount} ALIVE</Text>
            </View>
          )}
          
          {isGhost && (
            <View style={[styles.statPill, styles.ghostPill]}>
              <Text style={styles.hudEndless}>👻 GHOST</Text>
            </View>
          )}
        </View>

        <Pressable 
          style={({ pressed }) => [styles.quitBtn, pressed && { opacity: 0.7 }]} 
          onPress={handleQuitRequest}
        >
          <Text style={styles.quitText}>✕ Quit</Text>
        </Pressable>
      </View>

      {/* Firebase warning */}
      {!isFirebaseConfigured && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>⚠️ Firebase not configured — solo mode</Text>
        </View>
      )}

      {/* ── Play area ────────────────────────────────────────────────────── */}
      <View style={styles.play} pointerEvents="box-none">

        {/* Canvas */}
        <View style={styles.canvasWrap} onLayout={onLayout} pointerEvents="none">
          {layout.width > 0 && gameReady && (
            <GameCanvas snapshotRef={snapshotRef} ghostsRef={ghostsRef} width={layout.width} height={layout.height} finishDistance={finishDistance ?? undefined} />
          )}
        </View>

        {/* Controls — ALWAYS visible (ghosts can still move) */}
        <View style={styles.controlsLayer} pointerEvents="box-none">
          <GameControls
            onLeft={handleLeft}
            onRight={handleRight}
            onJump={handleJump}
            onPower={handlePower}
            power={power}
            bottomInset={Math.max(insets.bottom, 8)}
          />
        </View>
      </View>

      {/* Spectator overlay (ghost banner + final standings) */}
      {isGhost && (
        <SpectatorOverlay
          ghosts={ghosts}
          myUid={uid}
          myDisplayName={displayName}
          myCharacterId={characterId}
          myColor={characterColor}
          myDistance={deathDistance}
          myDeathTime={deathTime}
          onLeave={handleQuitRequest}
        />
      )}

      {/* Quit Confirmation Overlay */}
      {showQuitConfirm && (
        <View style={styles.quitOverlay} pointerEvents="auto">
          <View style={styles.quitModal}>
            <Text style={styles.quitTitle}>Are you sure?</Text>
            <Text style={styles.quitDesc}>Do you really want to quit the game?</Text>
            <View style={styles.quitActions}>
              <Pressable style={styles.quitBtnCancel} onPress={handleCancelQuit}>
                <Text style={styles.quitBtnCancelText}>No, Continue</Text>
              </Pressable>
              <Pressable style={styles.quitBtnConfirm} onPress={handleConfirmQuit}>
                <Text style={styles.quitBtnConfirmText}>Yes, Quit</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* Calculating Results Overlay */}
      {isCalculatingResults && (
        <View style={styles.calculatingOverlay} pointerEvents="auto">
          <ActivityIndicator size="large" color="#FFD700" />
          <Text style={styles.calculatingTitle}>Calculating Match Results...</Text>
          <Text style={styles.calculatingDesc}>Syncing with the cloud</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1a1a2e' },
  hud: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 12,
    paddingBottom: 8,
    backgroundColor: 'rgba(10,10,30,0.85)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.15)',
    zIndex: 20,
  },
  hudLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    gap: 4,
  },
  rankPill: {
    backgroundColor: 'rgba(30,100,255,0.15)',
    borderColor: 'rgba(30,100,255,0.3)',
  },
  endlessPill: {
    backgroundColor: 'rgba(255,50,50,0.15)',
    borderColor: 'rgba(255,50,50,0.3)',
  },
  ghostPill: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderColor: 'rgba(255,255,255,0.4)',
  },
  hudIcon: { fontSize: 13 },
  hudText: { color: GameColors.textLight, fontSize: 14, fontWeight: '700' },
  hudEndless: { color: GameColors.gold, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  quitBtn: {
    backgroundColor: 'rgba(255,50,50,0.2)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,50,50,0.4)',
  },
  quitText: {
    color: '#ffaaaa',
    fontSize: 13,
    fontWeight: '700',
  },
  play: { flex: 1, position: 'relative' },
  canvasWrap: { ...StyleSheet.absoluteFillObject },
  controlsLayer: { ...StyleSheet.absoluteFillObject, zIndex: 30, elevation: 30 },
  banner: {
    backgroundColor: 'rgba(255,100,100,0.9)',
    paddingVertical: 4,
    alignItems: 'center',
    zIndex: 40,
  },
  bannerText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  quitOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    elevation: 100,
  },
  quitModal: {
    backgroundColor: '#2a2a3e',
    padding: 24,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
    width: 320,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  quitTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
  },
  quitDesc: {
    color: '#aaa',
    fontSize: 14,
    marginBottom: 24,
    textAlign: 'center',
  },
  quitActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  quitBtnCancel: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    alignItems: 'center',
  },
  quitBtnCancelText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  quitBtnConfirm: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: GameColors.danger,
    borderRadius: 10,
    alignItems: 'center',
  },
  quitBtnConfirmText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  calculatingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1a1025',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
    elevation: 999,
  },
  calculatingTitle: {
    color: '#FFD700',
    fontSize: 24,
    fontFamily: 'Nunito-Black',
    marginTop: 24,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  calculatingDesc: {
    color: '#aaa',
    fontSize: 16,
    fontFamily: 'Nunito-Bold',
    marginTop: 8,
  }
});
