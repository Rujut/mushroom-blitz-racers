/**
 * matchmaking.tsx — Create or join a multiplayer room.
 */
import { useState, useCallback, useEffect } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
  Dimensions,
  Pressable,
  ScrollView
} from 'react-native';
import { router } from 'expo-router';
import { ref, set } from 'firebase/database';
import { getRTDB } from '@/src/firebase/rtdb';
import { isFirebaseConfigured } from '@/src/firebase/config';
import { initTimeSync } from '@/src/firebase/timeSync';
import { useRoomStore } from '@/src/multiplayer/roomStore';
import { usePlayerStore } from '@/src/store/playerStore';
import { GameButton } from '@/src/components/ui/GameButton';
import { GameColors } from '@/src/constants/theme';
import { CHARACTERS } from '@/src/constants/characters';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Canvas, Rect, LinearGradient, vec } from '@shopify/react-native-skia';

const { width, height } = Dimensions.get('window');

// ── helpers ──────────────────────────────────────────────────────────────────

function generateRoomCode(): string {
  // No I/O/0/1 — avoids confusion when reading aloud
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ── Background ────────────────────────────────────────────────────────────────

function LobbyBackground() {
  return (
    <Canvas style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <Rect x={0} y={0} width={width} height={height}>
        <LinearGradient
          start={vec(0, 0)}
          end={vec(width, height)}
          colors={['#0f172a', '#1e1b4b', '#312e81']} // Sleek dark slate to deep purple/indigo
        />
      </Rect>
    </Canvas>
  );
}

// ── component ─────────────────────────────────────────────────────────────────

export default function MatchmakingScreen() {
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => {
    initTimeSync();
  }, []);

  const uid               = usePlayerStore((s) => s.uid);
  const displayName       = usePlayerStore((s) => s.displayName);
  const characterId       = usePlayerStore((s) => s.selectedCharacterId);
  const characterColor    = CHARACTERS.find((c) => c.id === characterId)?.color ?? '#e52521';

  const setRoom  = useRoomStore((s) => s.setRoom);
  const setMyUid = useRoomStore((s) => s.setMyUid);

  // ── Create Room ─────────────────────────────────────────────────────────────
  const createRoom = useCallback(async () => {
    const db = getRTDB();
    if (!db) { setError('Firebase not configured — check your .env file.'); return; }
    setLoading(true);
    setError('');
    try {
      const code = generateRoomCode();
      const seed = Math.floor(Math.random() * 1000000);
      await set(ref(db, `rooms/${code}`), {
        host:      uid,
        status:    'waiting',
        startAt:   null,
        seed:      seed,
        createdAt: Date.now(),
        players: {
          [uid]: {
            uid,
            displayName,
            character: characterId,
            color:     characterColor,
            x: 80, y: 0, distance: 0, hearts: 3,
            finished: false, ready: false,
            updatedAt: Date.now(),
          },
        },
      });
      setRoom(code, uid);
      setMyUid(uid);
      router.push({ pathname: '/(lobby)/room', params: { code, isHost: '1' } });
    } catch (e: any) {
      setError(e?.message ?? 'Failed to create room. Check Firebase rules.');
    } finally {
      setLoading(false);
    }
  }, [uid, displayName, characterId, characterColor, setRoom, setMyUid]);

  // ── Join Room ───────────────────────────────────────────────────────────────
  const joinRoom = useCallback(async () => {
    const db = getRTDB();
    if (!db) { setError('Firebase not configured — check your .env file.'); return; }
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) { setError('Enter a valid 6-character room code.'); return; }
    setLoading(true);
    setError('');
    try {
      await set(ref(db, `rooms/${code}/players/${uid}`), {
        uid,
        displayName,
        character: characterId,
        color:     characterColor,
        x: 80, y: 0, distance: 0, hearts: 3,
        finished: false, ready: false,
        updatedAt: Date.now(),
      });
      setMyUid(uid);
      router.push({ pathname: '/(lobby)/room', params: { code, isHost: '0' } });
    } catch (e: any) {
      setError(e?.message ?? 'Room not found or Firebase error.');
    } finally {
      setLoading(false);
    }
  }, [uid, displayName, characterId, characterColor, joinCode, setMyUid]);

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <View style={styles.background}>
      <LobbyBackground />
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
          style={styles.kav}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.contentContainer}>
            
            <View style={styles.header}>
              <Pressable style={styles.backBtn} onPress={() => router.back()}>
                <MaterialCommunityIcons name="arrow-left" size={28} color="#fff" />
              </Pressable>
              <View style={styles.titleContainer}>
                <Text style={styles.title}>Multiplayer</Text>
                <Text style={styles.titleShadow}>Multiplayer</Text>
                <Text style={styles.subtitle}>Global 2–8 player racing</Text>
              </View>
            </View>

            <View style={styles.card}>
              {/* Firebase not-configured banner */}
              {!isFirebaseConfigured && (
                <View style={styles.warnBox}>
                  <View style={styles.warnHeader}>
                    <MaterialCommunityIcons name="alert" size={18} color="#ffc080" />
                    <Text style={styles.warnTitle}>Offline Mode</Text>
                  </View>
                  <Text style={styles.warnBody}>
                    Firebase is not configured in <Text style={styles.mono}>.env</Text>. Real multiplayer is disabled.
                  </Text>
                </View>
              )}

              {/* Player identity */}
              <View style={styles.identityRow}>
                <View style={[styles.colorDot, { backgroundColor: characterColor }]} />
                <Text style={styles.identityText}>
                  Playing as <Text style={styles.identityName}>{displayName}</Text>
                  {' '}· {CHARACTERS.find((c) => c.id === characterId)?.name ?? characterId}
                </Text>
              </View>

              {/* Create Room */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <MaterialCommunityIcons name="server-network" size={20} color={GameColors.primary} />
                  <Text style={styles.sectionTitle}>Host a Room</Text>
                </View>
                <Text style={styles.sectionSub}>
                  A unique 6-character code will be generated. Share it with friends.
                </Text>
                <GameButton
                  label={loading ? 'Creating...' : 'Create Room'}
                  icon={loading ? null : <MaterialCommunityIcons name="plus-network" size={20} color="#fff" />}
                  onPress={createRoom}
                  disabled={loading || !isFirebaseConfigured}
                  style={styles.btn}
                />
              </View>

              <View style={styles.orRow}>
                <View style={styles.orLine} />
                <Text style={styles.orText}>OR JOIN</Text>
                <View style={styles.orLine} />
              </View>

              {/* Join Room */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <MaterialCommunityIcons name="login-variant" size={20} color={GameColors.secondary} />
                  <Text style={styles.sectionTitle}>Join a Room</Text>
                </View>
                <TextInput
                  style={[
                    styles.codeInput,
                    !isFirebaseConfigured && styles.inputDisabled,
                    joinCode.length === 0 && styles.codeInputPlaceholder
                  ]}
                  placeholder="e.g. ABC123"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  value={joinCode}
                  onChangeText={(t) => setJoinCode(t.toUpperCase())}
                  maxLength={6}
                  autoCapitalize="characters"
                  editable={isFirebaseConfigured && !loading}
                />
                <GameButton
                  label={loading ? 'Joining...' : 'Join Room'}
                  icon={loading ? null : <MaterialCommunityIcons name="rocket-launch" size={20} color="#fff" />}
                  variant="secondary"
                  onPress={joinRoom}
                  disabled={loading || !isFirebaseConfigured || joinCode.trim().length < 4}
                  style={styles.btn}
                />
              </View>

              {/* Error message */}
              {!!error && (
                <View style={styles.errorBox}>
                  <MaterialCommunityIcons name="alert-circle" size={16} color="#ffaaaa" style={{ marginRight: 6 }} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              {loading && <ActivityIndicator style={styles.spinner} color={GameColors.gold} size="large" />}
            </View>
          </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, width: '100%', height: '100%' },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    paddingTop: 50,
  },
  kav: { flex: 1, width: '100%' },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingBottom: 40,
  },
  contentContainer: {
    width: '100%',
    maxWidth: 400,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    marginRight: 16,
  },
  titleContainer: { flex: 1 },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 1,
    zIndex: 2,
  },
  titleShadow: {
    fontSize: 32,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 1,
    position: 'absolute',
    top: 3,
    left: 3,
    zIndex: 1,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
    fontWeight: '600',
  },
  card: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  warnBox: {
    backgroundColor: 'rgba(92, 31, 0, 0.8)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#ff6600',
  },
  warnHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  warnTitle: { color: '#ffc080', fontSize: 14, fontWeight: '800', marginLeft: 6 },
  warnBody:  { color: '#ffb070', fontSize: 12, lineHeight: 18, opacity: 0.9 },
  mono: { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: '#ffc080' },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.3)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  colorDot: { width: 14, height: 14, borderRadius: 7 },
  identityText: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600' },
  identityName: { fontWeight: '800', color: GameColors.gold },
  section: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '800', marginLeft: 6 },
  sectionSub:   { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 14, fontWeight: '500' },
  btn: { marginTop: 4 },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 12 },
  orLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  orText: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  codeInput: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 8,
    textAlign: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  codeInputPlaceholder: {
    fontSize: 16,
    letterSpacing: 2,
    fontWeight: '600',
  },
  inputDisabled: { opacity: 0.4 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(92, 16, 16, 0.8)',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#ff4444',
  },
  errorText: { color: '#ffaaaa', fontSize: 13, fontWeight: '600', flex: 1 },
  spinner:   { marginTop: 16 },
});
