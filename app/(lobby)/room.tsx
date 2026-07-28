/**
 * room.tsx — Live race lobby screen.
 *
 * Features:
 *  - Host selects track type (1 km / 2 km / 5 km / ∞ Endless) before starting
 *  - 2-player minimum enforced before Start Race enables
 *  - Real-time player slots via RTDB
 *  - 3-2-1-GO countdown overlay
 *  - trackType passed as route param to the game screen
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  ActivityIndicator, Animated, Easing,
  Platform, Pressable, ScrollView, StyleSheet, Text, View, Dimensions
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ref, onValue, update } from 'firebase/database';
import { getRTDB } from '@/src/firebase/rtdb';
import { isFirebaseConfigured } from '@/src/firebase/config';
import { getServerTime } from '@/src/firebase/timeSync';
import { useRoomStore, type RemotePlayerSlot, type TrackType } from '@/src/multiplayer/roomStore';
import { usePlayerStore } from '@/src/store/playerStore';
import { GameButton } from '@/src/components/ui/GameButton';
import { GameColors } from '@/src/constants/theme';
import { CHARACTERS } from '@/src/constants/characters';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Canvas, Rect, LinearGradient, vec } from '@shopify/react-native-skia';

const { width, height } = Dimensions.get('window');

// ── Background ────────────────────────────────────────────────────────────────

function RoomBackground() {
  return (
    <Canvas style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <Rect x={0} y={0} width={width} height={height}>
        <LinearGradient
          start={vec(0, 0)}
          end={vec(width, height)}
          // Unique action/racing theme: dark red to deep slate
          colors={['#2d0a0f', '#1f0d1a', '#0f172a']} 
        />
      </Rect>
    </Canvas>
  );
}

// ── Countdown animation ───────────────────────────────────────────────────────

function CountdownOverlay({ count }: { count: number | null }) {
  const scale   = useRef(new Animated.Value(0.4)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (count === null) return;
    scale.setValue(0.4); opacity.setValue(1);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1.1, useNativeDriver: true, friction: 5 }),
      Animated.timing(opacity, { toValue: 0, duration: 900, useNativeDriver: true, delay: 600, easing: Easing.out(Easing.ease) }),
    ]).start();
  }, [count]);

  if (count === null) return null;
  const label = count === 0 ? 'GO!' : String(count);
  const color = count === 0 ? GameColors.gold : '#fff';

  return (
    <View style={cStyles.overlay} pointerEvents="none">
      <Animated.Text style={[cStyles.countText, { color, transform: [{ scale }], opacity }]}>
        {label}
      </Animated.Text>
    </View>
  );
}
const cStyles = StyleSheet.create({
  overlay:   { ...StyleSheet.absoluteFillObject as any, justifyContent: 'center', alignItems: 'center', zIndex: 99, backgroundColor: 'rgba(0,0,0,0.6)' },
  countText: { fontSize: 130, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 4, height: 4 }, textShadowRadius: 10 },
});

// ── Track selector ────────────────────────────────────────────────────────────

const TRACK_OPTIONS: { type: TrackType; label: string; icon: any; desc: string }[] = [
  { type: 'endless', label: 'Endless', icon: 'infinity', desc: 'Last alive wins' },
  { type: 'km1',    label: '1 km',       icon: 'flag-checkered', desc: 'Sprint' },
  { type: 'km2',    label: '2 km',       icon: 'rocket-launch', desc: 'Standard' },
  { type: 'km5',    label: '5 km',       icon: 'lightning-bolt', desc: 'Marathon' },
];

function TrackSelector({
  selected,
  onSelect,
  disabled,
}: {
  selected: TrackType;
  onSelect: (t: TrackType) => void;
  disabled: boolean;
}) {
  return (
    <View style={tStyles.container}>
      <View style={tStyles.headerRow}>
        <MaterialCommunityIcons name="map-marker-distance" size={16} color="#aaa" />
        <Text style={tStyles.header}>TRACK LENGTH</Text>
      </View>
      <View style={tStyles.grid}>
        {TRACK_OPTIONS.map((opt) => {
          const active = selected === opt.type;
          return (
            <Pressable
              key={opt.type}
              style={[tStyles.pill, active && tStyles.pillActive, disabled && tStyles.pillDisabled]}
              onPress={() => !disabled && onSelect(opt.type)}
            >
              <MaterialCommunityIcons name={opt.icon} size={22} color={active ? GameColors.gold : '#ccc'} style={{ marginBottom: 4 }} />
              <Text style={[tStyles.pillLabel, active && tStyles.pillLabelActive]}>{opt.label}</Text>
              <Text style={tStyles.pillDesc}>{opt.desc}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
const tStyles = StyleSheet.create({
  container: { marginBottom: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  header:    { color: '#aaa', fontSize: 12, fontWeight: '800', letterSpacing: 2, marginLeft: 6 },
  grid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pill: {
    flex: 1, minWidth: '45%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16, borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 14, paddingHorizontal: 8, alignItems: 'center',
  },
  pillActive:   { backgroundColor: 'rgba(255,215,0,0.15)', borderColor: GameColors.gold },
  pillDisabled: { opacity: 0.4 },
  pillLabel:    { color: '#ccc', fontSize: 13, fontWeight: '800' },
  pillLabelActive: { color: GameColors.gold },
  pillDesc:     { color: 'rgba(255,255,255,0.5)', fontSize: 10, marginTop: 2, fontWeight: '600' },
});

// ── Player slot card ──────────────────────────────────────────────────────────

function PlayerCard({ slot, isMe, isHost }: { slot: RemotePlayerSlot; isMe: boolean; isHost: boolean }) {
  const charDef = CHARACTERS.find((c) => c.id === slot.character);
  const color   = charDef?.color ?? '#888';
  return (
    <View style={[pStyles.card, isMe && pStyles.cardMe, { borderLeftColor: color }]}>
      <View style={[pStyles.dot, { backgroundColor: color }]} />
      <View style={pStyles.info}>
        <Text style={pStyles.name} numberOfLines={1}>
          {slot.displayName}
          {isMe && <Text style={pStyles.meText}> (You)</Text>}
        </Text>
        <Text style={pStyles.char}>{charDef?.name ?? slot.character}</Text>
      </View>
      {isHost && (
        <View style={pStyles.hostBadge}>
          <MaterialCommunityIcons name="crown" size={14} color="#000" />
          <Text style={pStyles.hostText}>HOST</Text>
        </View>
      )}
      <View style={[pStyles.readyDot, { backgroundColor: slot.ready ? '#44dd77' : 'rgba(255,255,255,0.2)' }]} />
    </View>
  );
}
const pStyles = StyleSheet.create({
  card:     { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 12, padding: 14, marginBottom: 8, borderLeftWidth: 4, gap: 12 },
  cardMe:   { backgroundColor: 'rgba(255,215,0,0.08)', borderLeftColor: GameColors.gold },
  dot:      { width: 14, height: 14, borderRadius: 7 },
  info:     { flex: 1 },
  name:     { color: '#fff', fontSize: 14, fontWeight: '800' },
  meText:   { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '600' },
  char:     { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 4, fontWeight: '600' },
  hostBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: GameColors.gold, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginRight: 8 },
  hostText:  { color: '#000', fontSize: 10, fontWeight: '900', marginLeft: 2 },
  readyDot: { width: 12, height: 12, borderRadius: 6 },
});

function EmptySlot() {
  return (
    <View style={eStyles.slot}>
      <MaterialCommunityIcons name="account-search" size={20} color="rgba(255,255,255,0.2)" />
      <Text style={eStyles.text}>Waiting for player...</Text>
    </View>
  );
}
const eStyles = StyleSheet.create({
  slot: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 14, marginBottom: 8, alignItems: 'center', justifyContent: 'center', gap: 8 },
  text: { color: 'rgba(255,255,255,0.3)', fontSize: 13, fontWeight: '600' },
});

// ── main screen ───────────────────────────────────────────────────────────────

const MAX_PLAYERS     = 8;
const COUNTDOWN_LEAD_MS = 3500;

export default function RoomScreen() {
  const { code, isHost: isHostParam } = useLocalSearchParams<{ code?: string; isHost?: string }>();
  const roomCode = code ?? '';
  const isHost   = isHostParam === '1';

  const myUid      = usePlayerStore((s) => s.uid);
  const players    = useRoomStore((s) => s.players);
  const hostUid    = useRoomStore((s) => s.hostUid);
  const roomStatus = useRoomStore((s) => s.roomStatus);
  const startAt    = useRoomStore((s) => s.startAt);
  const storeTrackType = useRoomStore((s) => s.trackType);
  const setRoomStatus  = useRoomStore((s) => s.setRoomStatus);
  const setHostUid     = useRoomStore((s) => s.setHostUid);
  const updatePlayer   = useRoomStore((s) => s.updatePlayer);
  const clearRoom      = useRoomStore((s) => s.clearRoom);
  const setTrackType   = useRoomStore((s) => s.setTrackType);

  const [countdown,   setCountdown]   = useState<number | null>(null);
  const [starting,    setStarting]    = useState(false);
  const [startError,  setStartError]  = useState('');
  const [localTrack,  setLocalTrack]  = useState<TrackType>('endless');
  const navigatedRef = useRef(false);

  // Sync localTrack ↔ store
  useEffect(() => { setLocalTrack(storeTrackType); }, [storeTrackType]);

  // ── RTDB subscription ──────────────────────────────────────────────────────
  useEffect(() => {
    const db = getRTDB();
    if (!db || !roomCode) return;

    const roomRef = ref(db, `rooms/${roomCode}`);
    const unsub = onValue(roomRef, (snap) => {
      const data = snap.val() as {
        host?: string; status?: string; startAt?: number | null;
        trackType?: TrackType;
        seed?: number;
        players?: Record<string, RemotePlayerSlot>;
      } | null;
      if (!data) return;
      if (data.host) setHostUid(data.host);
      if (data.status) setRoomStatus(data.status as any, data.startAt ?? null);
      if (data.trackType) { setTrackType(data.trackType); setLocalTrack(data.trackType); }
      if (data.seed !== undefined) useRoomStore.getState().setSeed(data.seed);
      if (data.players) {
        Object.entries(data.players).forEach(([uid, slot]) => updatePlayer(uid, slot));
      }
    });
    return () => unsub();
  }, [roomCode, setRoomStatus, updatePlayer, setHostUid, setTrackType]);

  // ── Countdown timer ────────────────────────────────────────────────────────
  useEffect(() => {
    if (roomStatus !== 'countdown' || !startAt) return;
    const tick = () => {
      const remaining = startAt - getServerTime();
      if (remaining <= 0) {
        setCountdown(0);
        setTimeout(() => {
          if (navigatedRef.current) return;
          navigatedRef.current = true;
          router.replace({
            pathname: '/game',
            params: { mode: 'multiplayer', room: roomCode, trackType: storeTrackType, ts: getServerTime().toString() },
          });
        }, 800);
        return;
      }
      setCountdown(Math.ceil(remaining / 1000));
    };
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [roomStatus, startAt, roomCode, storeTrackType]);

  // ── Host: change track type ────────────────────────────────────────────────
  const handleTrackSelect = useCallback(async (t: TrackType) => {
    setLocalTrack(t);
    setTrackType(t);
    const db = getRTDB();
    if (db && roomCode) {
      update(ref(db, `rooms/${roomCode}`), { trackType: t }).catch(() => {});
    }
  }, [roomCode, setTrackType]);

  // ── Host: Start Race ───────────────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    const db = getRTDB();
    if (!db || !roomCode) { setStartError('Firebase not available.'); return; }
    setStarting(true); setStartError('');
    try {
      const raceStartAt = getServerTime() + COUNTDOWN_LEAD_MS;
      const newSeed = Math.floor(Math.random() * 1000000);
      await update(ref(db, `rooms/${roomCode}`), {
        status:    'countdown',
        startAt:   raceStartAt,
        trackType: localTrack,
        seed:      newSeed,
      });
    } catch (e: any) {
      setStartError(e?.message ?? 'Failed to start race.');
      setStarting(false);
    }
  }, [roomCode, localTrack]);

  // ── Leave room ─────────────────────────────────────────────────────────────
  const handleLeave = useCallback(() => { clearRoom(); router.back(); }, [clearRoom]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const playerList = Object.values(players);
  const emptySlots = Math.max(0, Math.min(4, MAX_PLAYERS) - playerList.length);
  const canStart   = isHost && playerList.length >= 2 && roomStatus === 'waiting';
  const isLocked   = roomStatus !== 'waiting';

  // ── No Firebase fallback ───────────────────────────────────────────────────
  if (!isFirebaseConfigured) {
    return (
      <View style={styles.background}>
        <RoomBackground />
        <View style={styles.overlay}>
          <View style={styles.contentContainer}>
            <View style={styles.warnBox}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                <MaterialCommunityIcons name="alert" size={18} color="#ffc080" />
                <Text style={styles.warnTitle}>Offline Mode</Text>
              </View>
              <Text style={styles.warnBody}>
                Real multiplayer requires Firebase RTDB credentials in your{' '}
                <Text style={styles.mono}>.env</Text> file.{'\n\n'}Starting a solo race instead.
              </Text>
            </View>
            <GameButton label="Play Solo" icon={<MaterialCommunityIcons name="controller-classic" size={20} color="#fff" />} onPress={() => router.replace({ pathname: '/game', params: { mode: 'single', ts: Date.now().toString() } })} />
            <GameButton label="Back" variant="ghost" onPress={() => router.back()} style={styles.mt} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.background}>
      <RoomBackground />
      <View style={styles.overlay}>
        <View style={styles.contentContainer}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
            
            <View style={styles.header}>
              <View style={styles.titleContainer}>
                <Text style={styles.title}>Race Lobby</Text>
              </View>
              <Pressable style={styles.leaveBtn} onPress={handleLeave}>
                <MaterialCommunityIcons name="exit-to-app" size={20} color="#fff" />
              </Pressable>
            </View>

            {/* Room code */}
            <View style={styles.codeBox}>
              <Text style={styles.codeLabel}>ROOM CODE</Text>
              <Text style={styles.codeValue}>{roomCode}</Text>
              <Text style={styles.codeSub}>Share this code with friends</Text>
            </View>

            {/* Track selector (host only, disabled after countdown) */}
            {isHost && (
              <TrackSelector selected={localTrack} onSelect={handleTrackSelect} disabled={isLocked} />
            )}
            {!isHost && (
              <View style={styles.trackBadge}>
                <MaterialCommunityIcons name="map-marker-distance" size={20} color={GameColors.gold} />
                <Text style={styles.trackBadgeLbl}>
                  <Text style={{ color: '#fff', fontWeight: '800' }}>TRACK: </Text>
                  {TRACK_OPTIONS.find((o) => o.type === localTrack)?.label ?? localTrack}
                </Text>
              </View>
            )}

            {/* Player list */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <MaterialCommunityIcons name="account-group" size={16} color="#aaa" />
              <Text style={styles.sectionHeader}>PLAYERS ({playerList.length}/{MAX_PLAYERS})</Text>
            </View>
            
            {playerList.map((slot) => (
              <PlayerCard key={slot.uid} slot={slot} isMe={slot.uid === myUid} isHost={slot.uid === hostUid} />
            ))}
            {Array.from({ length: emptySlots }).map((_, i) => (
              <EmptySlot key={`empty-${i}`} />
            ))}

            {/* Actions */}
            {roomStatus === 'waiting' && (
              <View style={styles.actionArea}>
                {isHost ? (
                  <>
                    {startError ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                        <MaterialCommunityIcons name="alert-circle" size={16} color="#ff6666" style={{ marginRight: 4 }} />
                        <Text style={styles.errorText}>{startError}</Text>
                      </View>
                    ) : null}
                    <GameButton
                      label={starting ? 'Starting...' : 'Start Race'}
                      icon={starting ? null : <MaterialCommunityIcons name="flag-checkered" size={20} color="#fff" />}
                      onPress={handleStart}
                      disabled={!canStart || starting}
                      style={styles.startBtn}
                    />
                    {playerList.length < 2 ? (
                      <View style={styles.waitRow}>
                        <MaterialCommunityIcons name="timer-sand" size={16} color="rgba(255,255,255,0.5)" />
                        <Text style={styles.waitText}>Waiting for at least 1 more player...</Text>
                      </View>
                    ) : (
                      <View style={styles.waitRow}>
                        <MaterialCommunityIcons name="check-circle" size={16} color={GameColors.gold} />
                        <Text style={styles.hostHint}>{playerList.length} players ready — tap Start Race!</Text>
                      </View>
                    )}
                  </>
                ) : (
                  <View style={styles.waitRowLarge}>
                    <ActivityIndicator color={GameColors.gold} size="large" />
                    <Text style={styles.waitTextLarge}>Waiting for host to start the race...</Text>
                  </View>
                )}
              </View>
            )}

            {roomStatus === 'countdown' && (
              <View style={styles.waitRowLarge}>
                <ActivityIndicator color={GameColors.primary} size="large" />
                <Text style={[styles.waitTextLarge, { color: GameColors.primary }]}>Get ready! Race is starting...</Text>
              </View>
            )}

          </ScrollView>
        </View>
      </View>
      <CountdownOverlay count={countdown} />
    </View>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, width: '100%', height: '100%' },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)', // Lighter overlay since bg is already very dark
    paddingTop: 50,
  },
  contentContainer: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  titleContainer: { flex: 1 },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 1,
    zIndex: 2,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 8,
  },
  leaveBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,100,100,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,100,100,0.3)',
  },
  codeBox:   { backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 16, padding: 16, alignItems: 'center', marginBottom: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  codeLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '800', letterSpacing: 2, marginBottom: 4 },
  codeValue: { color: '#fff', fontSize: 32, fontWeight: '900', letterSpacing: 10, textShadowColor: GameColors.primary, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10 },
  codeSub:   { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 6, fontWeight: '500' },
  trackBadge:    { flexDirection: 'row', backgroundColor: 'rgba(255,215,0,0.1)', borderRadius: 12, padding: 14, marginBottom: 24, alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)' },
  trackBadgeLbl: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600' },
  sectionHeader: { color: '#aaa', fontSize: 12, fontWeight: '800', letterSpacing: 2, marginLeft: 6 },
  actionArea: { marginTop: 16, backgroundColor: 'rgba(0,0,0,0.2)', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  startBtn:   { marginBottom: 12 },
  hostHint:   { color: GameColors.gold, fontSize: 12, fontWeight: '700' },
  waitRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' },
  waitText:   { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '600' },
  waitRowLarge: { flexDirection: 'row', alignItems: 'center', gap: 12, justifyContent: 'center', paddingVertical: 16 },
  waitTextLarge: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '700' },
  errorText:  { color: '#ff6666', fontSize: 12, fontWeight: '700' },
  mt:         { marginTop: 12 },
  warnBox:    { backgroundColor: 'rgba(92, 31, 0, 0.8)', borderRadius: 12, padding: 14, marginBottom: 20, borderLeftWidth: 4, borderLeftColor: '#ff6600' },
  warnTitle:  { color: '#ffc080', fontSize: 14, fontWeight: '800', marginLeft: 6 },
  warnBody:   { color: '#ffb070', fontSize: 13, lineHeight: 20, opacity: 0.9 },
  mono:       { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: '#ffc080' },
});
