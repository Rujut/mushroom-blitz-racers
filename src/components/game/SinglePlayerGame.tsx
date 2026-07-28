import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, Platform, StyleSheet, Text, View, Pressable, StatusBar as RNStatusBar, AppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import type { PowerState } from '@/src/game/core/types';
import { randomizeLevelSeed } from '@/src/game/levels/levelGenerator';
import { POWER_CATALOGUE } from '@/src/game/core/powers';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface SinglePlayerGameProps {
  onFinish: (stats: { distance: number; coins: number }) => void;
  onQuit: () => void;
}

function difficultyLabel(distance: number): string {
  if (distance < 50)  return 'Easy';
  if (distance < 150) return 'Medium';
  if (distance < 300) return 'Hard';
  return '🔥 Max';
}

function difficultyColor(distance: number): string {
  if (distance < 50)  return '#44dd77';
  if (distance < 150) return '#ffcc00';
  if (distance < 300) return '#ff8800';
  return '#ff3333';
}

/** Renders 3 heart icons — full ❤️ or empty 🖤 */
const HeartsDisplay = React.memo(function HeartsDisplay({ hearts, maxHearts, invincible }: { hearts: number; maxHearts: number; invincible: boolean }) {
  return (
    <View style={heartStyles.row}>
      {Array.from({ length: maxHearts }).map((_, i) => (
        <View
          key={i}
          style={[heartStyles.heartWrap, invincible && i >= hearts && heartStyles.heartFlash]}
        >
          <MaterialCommunityIcons
            name={i < hearts ? 'heart' : 'heart-outline'}
            size={18}
            color={i < hearts ? '#ff3b5c' : '#555'}
          />
        </View>
      ))}
    </View>
  );
});

const heartStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  heartWrap: {},
  heartFlash: { opacity: 0.4 },
});

export function SinglePlayerGame({ onFinish, onQuit }: SinglePlayerGameProps) {
  const insets = useSafeAreaInsets();
  const characterId = usePlayerStore((s) => s.selectedCharacterId);
  const addCoins    = usePlayerStore((s) => s.addCoins);

  const characterDef = CHARACTERS.find((c) => c.id === characterId);
  const characterColor = characterDef?.color ?? GameColors.primary;

  const engineRef = useRef<GameEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new GameEngine(characterColor);
    console.log('[SinglePlayerGame] new GameEngine created');
  }
  const engine = engineRef.current;

  // Tracks whether engine.start() has been called for this component lifetime
  const startedRef = useRef(false);

  const [layout, setLayout]     = useState({ width: 0, height: 0 });
  const [gameReady, setGameReady] = useState(false);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);

  const uid = usePlayerStore((s) => s.uid);
  const syncToCloud = usePlayerStore((s) => s.syncToCloud);

  const { hud, snapshotRef } = useGameEngineRunner({
    engine,
    enabled: gameReady,
    finishDistance: Infinity,
    onFinish: useCallback(
      (stats: { distance: number; coins: number }) => {
        addCoins(stats.coins);
        // Persist coins + character state to Firestore
        syncToCloud();
        onFinish(stats);
      },
      [addCoins, onFinish, syncToCloud]
    ),
  });

  const defaultPower: PowerState = {
    cooldownMs: 0, maxCooldownMs: 1, active: false,
    name: characterDef?.powerName ?? 'Power', icon: characterDef ? POWER_CATALOGUE[characterDef.id].icon : 'lightning-bolt',
  };
  const power: PowerState = gameReady ? (snapshotRef.current?.power ?? defaultPower) : defaultPower;

  // Lock landscape at runtime and force hide status bar
  useEffect(() => {
    RNStatusBar.setHidden(true);
    
    // Also hide it if user backgrounds the app and returns
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

      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE)
        .catch((e) => console.log('Orientation lock failed:', e));

      return () => {
        subscription.remove();
        RNStatusBar.setHidden(false);
        // Restore nav bar when exiting game
        if (Platform.OS === 'android') {
          NavigationBar.setVisibilityAsync('visible').catch(() => {});
        }
        // Restore portrait when leaving game
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      };
    }
    return () => {
      subscription.remove();
      RNStatusBar.setHidden(false);
    };
  }, []);

  // Init engine on layout.
  // IMPORTANT: ScreenOrientation.lockAsync is async — the first 1-2 layout
  // events arrive in PORTRAIT (360×709). Starting the engine in portrait puts
  // the player at groundY≈510. When landscape fires (780×313), the viewport
  // shrinks but the player stays at y=510 → instant game-over.
  // Fix: skip any layout where width < height (portrait), only start once
  // landscape is confirmed. Subsequent landscape resize just updates viewport.
  useEffect(() => {
    if (layout.width <= 0 || layout.height <= 0) return;

    // Skip portrait — wait for the orientation lock to complete
    if (layout.width < layout.height) {
      console.log('[SinglePlayerGame] skipping portrait layout', layout.width, 'x', layout.height);
      return;
    }

    // Always update viewport dimensions so groundY stays correct
    engine.configureViewport(layout.width, layout.height);

    if (!startedRef.current) {
      // First landscape layout — start the engine (resets world & snaps player to landscape groundY)
      engine.setCharacter(characterId, characterColor);
      randomizeLevelSeed();
      engine.start();
      startedRef.current = true;
      console.log('[SinglePlayerGame] engine started — layout:', layout.width, 'x', layout.height, 'status:', engine.getSnapshot().status);
      setGameReady(true);
    } else {
      console.log('[SinglePlayerGame] viewport updated (engine running):', layout.width, 'x', layout.height);
    }
  }, [layout.width, layout.height, engine, characterId, characterColor]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) setLayout({ width, height });
  };

  const tryHaptic = (style: Haptics.ImpactFeedbackStyle) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(style).catch(() => {});
  };

  const handleLeft  = (pressed: boolean) => {
    if (pressed) tryHaptic(Haptics.ImpactFeedbackStyle.Light);
    engine.setInput(pressed ? { left: true, right: false } : { left: false });
  };
  const handleRight = (pressed: boolean) => {
    if (pressed) tryHaptic(Haptics.ImpactFeedbackStyle.Light);
    engine.setInput(pressed ? { right: true, left: false } : { right: false });
  };
  const handleJump = useCallback(() => {
    tryHaptic(Haptics.ImpactFeedbackStyle.Medium);
    engine.setInput({ jumpPressed: true });
  }, [engine]);
  const handlePower = useCallback(() => {
    tryHaptic(Haptics.ImpactFeedbackStyle.Heavy);
    engine.activatePower();
  }, [engine]);

  const handleQuit = useCallback(() => {
    tryHaptic(Haptics.ImpactFeedbackStyle.Light);
    engine.pause();
    setShowQuitConfirm(true);
  }, [engine]);

  const handleConfirmQuit = useCallback(() => {
    onQuit();
  }, [onQuit]);

  const handleCancelQuit = useCallback(() => {
    setShowQuitConfirm(false);
    engine.resume();
  }, [engine]);

  // Keyboard controls for web
  useEffect(() => {
    if (Platform.OS !== 'web' || !gameReady) return;
    const keysDown = new Set<string>();

    const onKeyDown = (e: KeyboardEvent) => {
      if (keysDown.has(e.code)) return;
      keysDown.add(e.code);
      switch (e.code) {
        case 'ArrowLeft': case 'KeyA':  e.preventDefault(); engine.setInput({ left: true, right: false }); break;
        case 'ArrowRight': case 'KeyD': e.preventDefault(); engine.setInput({ right: true, left: false }); break;
        case 'ArrowUp': case 'Space': case 'KeyW': e.preventDefault(); engine.setInput({ jumpPressed: true }); break;
        case 'KeyQ': case 'KeyE': e.preventDefault(); engine.activatePower(); break;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysDown.delete(e.code);
      switch (e.code) {
        case 'ArrowLeft': case 'KeyA':  e.preventDefault(); engine.setInput({ left: false }); break;
        case 'ArrowRight': case 'KeyD': e.preventDefault(); engine.setInput({ right: false }); break;
      }
    };
    const onBlur = () => { keysDown.clear(); engine.setInput({ left: false, right: false }); };

    document.addEventListener('keydown', onKeyDown, { capture: true });
    document.addEventListener('keyup',   onKeyUp,   { capture: true });
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('keydown', onKeyDown, { capture: true } as any);
      document.removeEventListener('keyup',   onKeyUp,   { capture: true } as any);
      window.removeEventListener('blur', onBlur);
    };
  }, [gameReady, engine]);

  const dist = hud.distance;

  return (
    <View style={styles.root}>
      <StatusBar hidden={true} />
      {/* HUD */}
      <View
        style={[styles.hud, { paddingTop: 12, paddingLeft: Math.max(insets.left, 16) }]}
        pointerEvents="box-none"
      >
        <View style={styles.hudLeft}>
          {/* Hearts */}
          <HeartsDisplay hearts={hud.hearts} maxHearts={hud.maxHearts} invincible={hud.invincible} />
          
          <View style={styles.statPill}>
            <Text style={styles.hudIcon}>🍄</Text>
            <Text style={styles.hudText}>{dist}m</Text>
          </View>

          <View style={styles.statPill}>
            <Text style={styles.hudIcon}>🪙</Text>
            <Text style={styles.hudText}>{hud.coins}</Text>
          </View>

          <View style={[styles.statPill, styles.endlessPill]}>
            <Text style={styles.hudEndless}>∞ Endless</Text>
          </View>
        </View>

        <Pressable 
          style={({ pressed }) => [styles.quitBtn, pressed && { opacity: 0.7 }]} 
          onPress={handleQuit}
        >
          <Text style={styles.quitText}>✕ Quit</Text>
        </Pressable>
      </View>

      {/* Play area */}
      <View style={styles.playArea} pointerEvents="box-none">
        <View style={styles.canvasWrap} onLayout={onLayout} pointerEvents="none">
          {layout.width > 0 && gameReady && (
            <GameCanvas snapshotRef={snapshotRef} width={layout.width} height={layout.height} />
          )}
        </View>

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
  endlessPill: {
    backgroundColor: 'rgba(255,215,0,0.15)',
    borderColor: 'rgba(255,215,0,0.3)',
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
  playArea: { flex: 1, position: 'relative' },
  canvasWrap: { ...StyleSheet.absoluteFillObject },
  controlsLayer: { ...StyleSheet.absoluteFillObject, zIndex: 30, elevation: 30 },

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
});
