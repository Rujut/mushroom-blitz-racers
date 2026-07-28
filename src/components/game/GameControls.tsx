import React, { useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View, Dimensions, Animated } from 'react-native';
import { GameColors } from '@/src/constants/theme';
import type { PowerState } from '@/src/game/core/types';
import * as Device from 'expo-device';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type Zone = 'left' | 'right' | 'skill' | 'jump';

interface GameControlsProps {
  onLeft:  (pressed: boolean) => void;
  onRight: (pressed: boolean) => void;
  onJump:  () => void;
  onPower: () => void;
  power:   PowerState;
  bottomInset?: number;
}

// ── Virtual Button Component ────────────────────────────────────────────────
// Uses RNGH directly on the JS thread. No Reanimated worklets to prevent Skia bridge crashes!
function VirtualButton({ 
  zone, 
  onPress, 
  onRelease, 
  style, 
  children, 
  hitSlopVal 
}: { 
  zone: Zone;
  onPress: () => void;
  onRelease: () => void;
  style: any;
  children: React.ReactNode;
  hitSlopVal: number;
}) {
  const [active, setActive] = useState(false);
  const isActiveRef = useRef(false);
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (!isActiveRef.current) {
      isActiveRef.current = true;
      setActive(true);
      onPress();
      Animated.parallel([
        Animated.timing(scale, { toValue: 0.91, duration: 50, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.72, duration: 50, useNativeDriver: true })
      ]).start();
    }
  };

  const handlePressOut = () => {
    if (isActiveRef.current) {
      isActiveRef.current = false;
      setActive(false);
      onRelease();
      Animated.parallel([
        Animated.timing(scale, { toValue: 1, duration: 100, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 100, useNativeDriver: true })
      ]).start();
    }
  };

  const tap = Gesture.Tap()
    .maxDuration(100000)
    .hitSlop(hitSlopVal)
    .onTouchesDown(() => handlePressIn())
    .onTouchesUp(() => handlePressOut())
    .runOnJS(true);

  const pan = Gesture.Pan()
    .manualActivation(true)
    .hitSlop(hitSlopVal)
    .onTouchesDown(() => handlePressIn())
    .onTouchesUp(() => handlePressOut())
    .onTouchesCancelled(() => handlePressOut())
    .runOnJS(true);

  const composed = Gesture.Simultaneous(tap, pan);

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[
        style, 
        { 
          transform: [{ scale }], 
          opacity,
          borderColor: active ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)'
        }
      ]}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

// ── Main Controls ──────────────────────────────────────────────────────────
function GameControlsComponent({
  onLeft, onRight, onJump, onPower, power, bottomInset = 0,
}: GameControlsProps) {

  // Dynamic hitSlop based on device (Samsung/Xiaomi budget lines often drop edges)
  const isBudget = Device.manufacturer?.toLowerCase() === 'xiaomi' || Device.manufacturer?.toLowerCase() === 'samsung';
  const slopVal = isBudget ? 60 : 35;

  const onCooldown   = power.cooldownMs > 0;
  const fillFraction = onCooldown ? 1 - power.cooldownMs / power.maxCooldownMs : 1;
  const cooldownSec  = Math.ceil(power.cooldownMs / 1000);
  const pb = Math.max(bottomInset, 10);

  return (
      <View style={[styles.overlay, { paddingBottom: pb }]} pointerEvents="box-none">

        {/* LEFT cluster — ◀ ▶ */}
        <View style={styles.leftCluster} pointerEvents="box-none">
          <VirtualButton 
            zone="left" 
            onPress={() => onLeft(true)} 
            onRelease={() => onLeft(false)} 
            style={[styles.btn, styles.moveBtn]} 
            hitSlopVal={slopVal}
          >
            <MaterialCommunityIcons name="chevron-left" size={36} color="rgba(255,255,255,0.9)" />
          </VirtualButton>

          <VirtualButton 
            zone="right" 
            onPress={() => onRight(true)} 
            onRelease={() => onRight(false)} 
            style={[styles.btn, styles.moveBtn]} 
            hitSlopVal={slopVal}
          >
            <MaterialCommunityIcons name="chevron-right" size={36} color="rgba(255,255,255,0.9)" />
          </VirtualButton>
        </View>

        {/* RIGHT cluster — Skill JUMP */}
        <View style={styles.rightCluster} pointerEvents="box-none">
          <VirtualButton 
            zone="skill" 
            onPress={() => onPower()} 
            onRelease={() => {}} 
            style={[styles.btn, styles.powerBtn, onCooldown && styles.powerBtnCooldown]} 
            hitSlopVal={slopVal}
          >
            <View style={styles.powerFillTrack}>
              <View style={[styles.powerFillBar, {
                height: `${Math.round(fillFraction * 100)}%` as any,
                backgroundColor: onCooldown ? 'rgba(255, 150, 0, 0.4)' : 'rgba(68, 255, 136, 0.2)',
              }]} />
            </View>
            <MaterialCommunityIcons name={power.icon as any} size={28} color={onCooldown ? '#ff9900' : 'rgba(255,255,255,0.9)'} />
            {onCooldown
              ? <Text style={[styles.powerNameLabel, { color: '#ff9900' }]} selectable={false}>{cooldownSec}s</Text>
              : <Text style={styles.powerNameLabel} selectable={false}>{power.name}</Text>}
          </VirtualButton>

          <VirtualButton 
            zone="jump" 
            onPress={() => onJump()} 
            onRelease={() => {}} 
            style={[styles.btn, styles.jumpBtn]} 
            hitSlopVal={slopVal}
          >
            <MaterialCommunityIcons name="arrow-up-bold" size={32} color="rgba(255,255,255,0.9)" />
          </VirtualButton>
        </View>

      </View>
  );
}
// ── Styles ────────────────────────────────────────────────────────────────────

const BTN_SIZE = 64;
const RADIUS = BTN_SIZE / 2;

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
  },
  leftCluster: {
    flexDirection: 'row',
    gap: 16, // more gap between buttons
    marginLeft: 32, // shift rightwards
    paddingBottom: 8,
  },
  rightCluster: {
    flexDirection: 'row',
    gap: 16, // more gap between buttons
    marginRight: 32, // shift leftwards
    paddingBottom: 8,
  },
  btn: {
    width: BTN_SIZE,
    height: BTN_SIZE,
    borderRadius: RADIUS,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  btnActive: {
    opacity: 0.72,
    transform: [{ scale: 0.91 }],
    borderColor: 'rgba(255,255,255,0.9)',
  },
  moveBtn:  { backgroundColor: 'rgba(30, 45, 30, 0.85)' },
  jumpBtn:  { backgroundColor: 'rgba(40, 60, 40, 0.85)' },
  powerBtn: { backgroundColor: 'rgba(50, 40, 60, 0.85)', borderColor: 'rgba(200,160,255,0.5)' },
  powerBtnCooldown: { backgroundColor: 'rgba(30, 20, 40, 0.85)', borderColor: 'rgba(200,160,255,0.2)', opacity: 0.85 },
  powerNameLabel: {
    color: '#ffddff', fontSize: 10, fontWeight: '700', letterSpacing: 0.4, marginTop: 2,
    ...(Platform.OS === 'web' ? ({ userSelect: 'none' } as any) : {}),
  },
  powerFillTrack: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: -1 },
  powerFillBar:   { position: 'absolute', bottom: 0, left: 0, right: 0, width: '100%' },
});

export const GameControls = React.memo(
  GameControlsComponent,
  (prev, next) => {
    // Only re-render if power state meaningfully changes
    return (
      prev.power.cooldownMs === next.power.cooldownMs &&
      prev.power.active === next.power.active &&
      prev.bottomInset === next.bottomInset
    );
  }
);
