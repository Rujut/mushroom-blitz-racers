/**
 * SpectatorOverlay.tsx
 *
 * Two-phase overlay for eliminated multiplayer players:
 *
 * Phase 1 — Ghost banner (while others are alive):
 *   Small translucent banner at top saying "👻 Ghost Mode"
 *   Player can still move freely in the background
 *
 * Phase 2 — Final standings (when ALL players eliminated/finished):
 *   Full-screen overlay showing ranked standings
 *   Last to die = 1st place (highest rank)
 */
import React, { useMemo } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import type { RemotePlayerSlot } from './roomStore';
import { CHARACTERS } from '@/src/constants/characters';

const GOLD = '#FFD700';

interface Props {
  ghosts: RemotePlayerSlot[];
  myUid: string;
  myDisplayName: string;
  myCharacterId: string;
  myColor: string;
  myDistance: number;
  myDeathTime: number | null;  // timestamp when local player died (for ranking)
  onLeave: () => void;
}

function rankIcon(rank: number): string {
  return ['🥇', '🥈', '🥉'][rank - 1] ?? `#${rank}`;
}

interface RankedPlayer {
  uid: string;
  displayName: string;
  character: string;
  color: string;
  distance: number;
  hearts: number;
  eliminated: boolean;
  finished: boolean;
  /** Death/finish timestamp — later = better in endless mode */
  eventTime: number;
  isMe: boolean;
}

function CharRow({ player, rank }: { player: RankedPlayer; rank: number }) {
  const alive = !player.eliminated && player.hearts > 0 && !player.finished;
  const won   = player.finished && player.hearts > 0;

  return (
    <View style={[rowStyles.row, player.isMe && rowStyles.me]}>
      <Text style={rowStyles.rank}>{rankIcon(rank)}</Text>
      <View style={[rowStyles.dot, { backgroundColor: player.color }]} />
      <View style={{ flex: 1 }}>
        <Text style={rowStyles.name} numberOfLines={1}>
          {player.displayName} {player.isMe ? '(You)' : ''}
        </Text>
        <Text style={rowStyles.sub}>{Math.floor(player.distance)} m · {player.hearts}❤️</Text>
      </View>
      {won   && <Text style={rowStyles.badge}>🏆</Text>}
      {alive && <Text style={rowStyles.badge}>🏃</Text>}
      {!alive && !won && <Text style={rowStyles.badge}>☠️</Text>}
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: 10, marginBottom: 6,
    backgroundColor: 'rgba(255,255,255,0.08)', gap: 10,
  },
  me: {
    backgroundColor: 'rgba(255,215,0,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.3)',
  },
  rank: { fontSize: 18, minWidth: 28 },
  dot:  { width: 12, height: 12, borderRadius: 6 },
  name: { color: '#fff', fontSize: 14, fontWeight: '700' },
  sub:  { color: '#aaa', fontSize: 11 },
  badge:{ fontSize: 18 },
});

export function SpectatorOverlay({ ghosts, myUid, myDisplayName, myCharacterId, myColor, myDistance, myDeathTime, onLeave }: Props) {
  const aliveCount = ghosts.filter((s) => !s.eliminated && s.hearts > 0 && !s.finished).length;
  const raceOver   = aliveCount === 0;

  // Build ranked standings — combine ghosts + local player
  const standings: RankedPlayer[] = useMemo(() => {
    const me: RankedPlayer = {
      uid: myUid,
      displayName: myDisplayName,
      character: myCharacterId,
      color: myColor,
      distance: myDistance,
      hearts: 0,
      eliminated: true,
      finished: false,
      eventTime: myDeathTime ?? Date.now(),
      isMe: true,
    };

    const others: RankedPlayer[] = ghosts.map((g) => {
      const char = CHARACTERS.find((c) => c.id === g.character);
      return {
        uid: g.uid,
        displayName: g.displayName,
        character: g.character,
        color: char?.color ?? g.color,
        distance: g.distance,
        hearts: g.hearts,
        eliminated: g.eliminated,
        finished: g.finished,
        eventTime: g.finishTime ?? g.updatedAt,
        isMe: false,
      };
    });

    const all = [me, ...others];

    // Ranking:
    // - Alive players first (ranked by distance, highest first)
    // - Then finished players (ranked by finish time, earliest first)
    // - Then eliminated players: LAST to die = best rank (ranked by eventTime, latest first)
    //   This means the player who survived longest gets the highest rank.
    all.sort((a, b) => {
      const aAlive = !a.eliminated && a.hearts > 0 && !a.finished;
      const bAlive = !b.eliminated && b.hearts > 0 && !b.finished;
      const aFinished = a.finished && a.hearts > 0;
      const bFinished = b.finished && b.hearts > 0;

      // Alive > Finished > Dead
      if (aAlive && !bAlive) return -1;
      if (!aAlive && bAlive) return 1;
      if (aFinished && !bFinished) return -1;
      if (!aFinished && bFinished) return 1;

      // Both alive → rank by distance
      if (aAlive && bAlive) return b.distance - a.distance;
      // Both finished → rank by finish time (earlier = better)
      if (aFinished && bFinished) return a.eventTime - b.eventTime;
      // Both dead → rank by event time (LATER death = BETTER rank)
      return b.eventTime - a.eventTime;
    });

    return all;
  }, [ghosts, myUid, myDisplayName, myDistance, myDeathTime]);

  // We only render the Phase 1 ghost banner. 
  // Final standings are handled by app/game/results.tsx
  if (raceOver) return null;

  return (
    <View style={styles.bannerWrap} pointerEvents="box-none">
      <View style={styles.banner}>
        <Text style={styles.bannerText}>
          👻 Ghost Mode — {aliveCount} player{aliveCount !== 1 ? 's' : ''} still racing
        </Text>
      </View>
    </View>
  );
}



const styles = StyleSheet.create({
  // Phase 1: Ghost banner
  bannerWrap: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 50,
  },
  banner: {
    backgroundColor: 'rgba(100, 50, 200, 0.85)',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(200, 150, 255, 0.5)',
  },
  bannerText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
});
