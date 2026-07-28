import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View, Dimensions, ScrollView } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { GameButton } from '@/src/components/ui/GameButton';
import { GameColors } from '@/src/constants/theme';
import { useRoomStore } from '@/src/multiplayer/roomStore';
import { MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { Canvas, Rect, LinearGradient, vec } from '@shopify/react-native-skia';

const { width, height } = Dimensions.get('window');

// ── Background ────────────────────────────────────────────────────────────────

function ResultsBackground() {
  return (
    <Canvas style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <Rect x={0} y={0} width={width} height={height}>
        <LinearGradient
          start={vec(0, 0)}
          end={vec(width, height)}
          // Celebratory / premium dark theme
          colors={['#1a1025', '#1e1b4b', '#0f172a']} 
        />
      </Rect>
    </Canvas>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function rankIcon(rank: number): keyof typeof MaterialCommunityIcons.glyphMap {
  if (rank === 1) return 'trophy';
  if (rank === 2) return 'medal';
  if (rank === 3) return 'medal-outline';
  return 'flag-checkered';
}

function rankColor(rank: number): string {
  if (rank === 1) return '#FFD700'; // Gold
  if (rank === 2) return '#E0E0E0'; // Silver
  if (rank === 3) return '#CD7F32'; // Bronze
  return '#aaaaaa';
}

function rankLabel(rank: number): string {
  if (rank === 1) return '1st Place!';
  if (rank === 2) return '2nd Place';
  if (rank === 3) return '3rd Place';
  return `${rank}th Place`;
}

function getSinglePlayerResultDetails(distance: number) {
  if (distance >= 1000) {
    return { icon: 'star-shooting', color: '#FFD700', message: 'Mighty Legend!' }; // Gold
  }
  if (distance >= 500) {
    return { icon: 'fire', color: '#FF8C00', message: 'Unstoppable!' }; // Dark Orange
  }
  if (distance >= 200) {
    return { icon: 'run-fast', color: '#32CD32', message: 'Incredible Run!' }; // Lime Green
  }
  if (distance >= 100) {
    return { icon: 'mushroom', color: '#00BFFF', message: 'Nice Race!' }; // Deep Sky Blue
  }
  return { icon: 'walk', color: '#aaaaaa', message: 'Well Tried!' }; // Gray
}

// ── component ─────────────────────────────────────────────────────────────────

export default function ResultsScreen() {
  const { rank, totalPlayers, mode, distance, coins, leaderboard } = useLocalSearchParams<{
    rank?: string; totalPlayers?: string; mode?: string; distance?: string; coins?: string; leaderboard?: string;
  }>();

  const rankNum  = parseInt(rank ?? '1', 10);
  const totalNum = parseInt(totalPlayers ?? '1', 10);
  const isMulti  = mode === 'multiplayer';
  const clearRoom = useRoomStore((s) => s.clearRoom);

  const parsedDistance = parseInt(distance ?? '0', 10);
  const spDetails = getSinglePlayerResultDetails(parsedDistance);

  const parsedLeaderboard = useMemo(() => {
    try {
      return leaderboard ? JSON.parse(leaderboard) : [];
    } catch {
      return [];
    }
  }, [leaderboard]);

  // Always portrait on results screen
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
  }, []);

  const handleRematch = () => {
    if (isMulti) clearRoom();
    router.replace(
      isMulti
        ? '/(lobby)/matchmaking'
        : { pathname: '/game', params: { mode: mode ?? 'single', ts: Date.now().toString() } }
    );
  };

  const handleHome = () => {
    if (isMulti) clearRoom();
    router.replace('/(menu)/home');
  };

  return (
    <View style={styles.background}>
      <ResultsBackground />
      <View style={styles.overlay}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>
              {isMulti ? (rankNum === 1 ? 'VICTORY' : 'RACE FINISHED') : 'RACE COMPLETE'}
            </Text>
            <Text style={styles.subtitle}>
              {isMulti ? `MULTIPLAYER · ${totalNum} PLAYERS` : 'SINGLE PLAYER RUN'}
            </Text>
          </View>

          <View style={styles.glassCard}>
            
            {/* Rank — ONLY for multiplayer */}
            {isMulti && (
              <View style={styles.resultMain}>
                <View style={[styles.iconRing, { borderColor: rankColor(rankNum) }]}>
                  <MaterialCommunityIcons name={rankIcon(rankNum)} size={48} color={rankColor(rankNum)} />
                </View>
                <Text style={[styles.rankNum, { color: rankColor(rankNum) }]}>
                  {rankLabel(rankNum)}
                </Text>
                <Text style={styles.outOf}>Out of {totalNum} racers</Text>
              </View>
            )}

            {/* Multiplayer Leaderboard */}
            {isMulti && parsedLeaderboard.length > 0 && (
              <View style={styles.leaderboardBox}>
                <Text style={styles.leaderboardTitle}>FINAL STANDINGS</Text>
                {parsedLeaderboard.map((p: any, idx: number) => (
                  <View key={p.uid} style={[styles.lbRow, p.isMe && styles.lbRowMe]}>
                    <Text style={[styles.lbRank, { color: rankColor(p.rank) }]}>#{p.rank}</Text>
                    <View style={styles.lbNameCol}>
                      <Text style={styles.lbName} numberOfLines={1}>{p.name}</Text>
                    </View>
                    <Text style={styles.lbDist}>{p.distance}m</Text>
                    <Text style={styles.lbStatus}>{p.isDead ? '💀' : '✅'}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Single player — no rank, just a fun message */}
            {!isMulti && (
              <View style={styles.resultMain}>
                <View style={[styles.iconRing, { borderColor: spDetails.color }]}>
                  <MaterialCommunityIcons 
                    name={spDetails.icon as any} 
                    size={48} 
                    color={spDetails.color} 
                  />
                </View>
                <Text style={styles.spMsg}>
                  {spDetails.message}
                </Text>
              </View>
            )}

            {/* Stats Row */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <MaterialCommunityIcons name="map-marker-distance" size={24} color={GameColors.primary} style={styles.statIcon} />
                <Text style={styles.statVal}>
                  {distance ?? '0'}<Text style={styles.statUnit}>m</Text>
                </Text>
                <Text style={styles.statLbl}>DISTANCE</Text>
              </View>
              <View style={styles.statCard}>
                <FontAwesome5 name="coins" size={24} color={GameColors.gold} style={styles.statIcon} />
                <Text style={styles.statVal}>{coins ?? '0'}</Text>
                <Text style={styles.statLbl}>COINS</Text>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionContainer}>
            <GameButton
              label={isMulti ? 'Play Again' : 'Race Again'}
              icon={<MaterialCommunityIcons name="reload" size={24} color="#fff" />}
              onPress={handleRematch}
              style={styles.actionBtn}
            />
            <GameButton
              label="Return to Home"
              variant="secondary"
              icon={<MaterialCommunityIcons name="home" size={24} color="#fff" />}
              onPress={handleHome}
              style={styles.actionBtn}
            />
          </View>

        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, width: '100%', height: '100%' },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 2,
    zIndex: 2,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 8,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 4,
    marginTop: 8,
  },
  glassCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    marginBottom: 24,
  },
  resultMain: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 4,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  rankNum:  { fontSize: 28, fontWeight: '900', marginBottom: 6, letterSpacing: 1 },
  outOf:    { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  spMsg:    { color: '#fff', fontSize: 24, fontWeight: '900', textAlign: 'center', letterSpacing: 1 },
  statsRow: { flexDirection: 'row', gap: 16, width: '100%' },
  statCard: {
    flex: 1, alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 16, paddingVertical: 16, paddingHorizontal: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  statIcon: { marginBottom: 8, opacity: 0.9 },
  statVal:  { color: '#fff', fontSize: 26, fontWeight: '900' },
  statUnit: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.6)' },
  statLbl:  { color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '800', marginTop: 6, letterSpacing: 2 },
  actionContainer: {
    width: '100%',
    gap: 16,
  },
  actionBtn: { width: '100%' },
  leaderboardBox: {
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  leaderboardTitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 12,
    textAlign: 'center',
  },
  lbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  lbRowMe: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
  },
  lbRank: {
    width: 30,
    fontSize: 16,
    fontWeight: '900',
  },
  lbNameCol: {
    flex: 1,
    paddingHorizontal: 8,
  },
  lbName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  lbDist: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    width: 50,
    textAlign: 'right',
  },
  lbStatus: {
    width: 30,
    textAlign: 'right',
    fontSize: 14,
  },
});
