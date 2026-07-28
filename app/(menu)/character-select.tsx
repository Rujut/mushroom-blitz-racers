import React from 'react';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View, Dimensions } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GameButton } from '@/src/components/ui/GameButton';
import { CHARACTERS, type CharacterId } from '@/src/constants/characters';
import { usePlayerStore } from '@/src/store/playerStore';
import { GameColors } from '@/src/constants/theme';
import { Canvas, Group, Image as SkiaImage, useImage, RuntimeShader, Skia } from '@shopify/react-native-skia';
import { CHARACTER_TINT_COLORS, CHARACTER_TINT_SHADER } from '@/src/constants/characters';
import { FRAME_H, FRAME_W, SHEET_W, SHEET_H, getFrameSourceRect } from '@/src/game/core/playerAnimation';

const { width, height } = Dimensions.get('window');

function GiantCharacterAvatar({ characterId, spriteSheet }: { characterId: string; spriteSheet: any }) {
  if (!spriteSheet) return null;
  const tintShader = React.useMemo(() => Skia.RuntimeEffect.Make(CHARACTER_TINT_SHADER), []);
  const targetColor = CHARACTER_TINT_COLORS[characterId] ?? null;
  const srcRect = getFrameSourceRect('idle', 0);
  
  // Make it massive and center it in the background
  const scale = 8;
  
  return (
    <Canvas style={[StyleSheet.absoluteFillObject, { opacity: 0.35 }]} pointerEvents="none">
      <Group 
        transform={[
          { translateX: width / 2 },
          { translateY: height / 2 - 50 }, 
          { scaleX: scale },
          { scaleY: scale },
          { translateX: -FRAME_W / 2 },
          { translateY: -FRAME_H / 2 },
        ]}
      >
        {tintShader && targetColor && (
          <RuntimeShader source={tintShader} uniforms={{ targetColor }} />
        )}
        <SkiaImage
          image={spriteSheet}
          x={-srcRect.sx}
          y={-srcRect.sy}
          width={SHEET_W}
          height={SHEET_H}
          fit="fill"
        />
      </Group>
    </Canvas>
  );
}

function CharacterAvatar({ characterId, color, spriteSheet }: { characterId: string; color: string; spriteSheet: any }) {
  if (!spriteSheet) {
    return <View style={[styles.avatar, { backgroundColor: color }]} />;
  }
  const tintShader = React.useMemo(() => Skia.RuntimeEffect.Make(CHARACTER_TINT_SHADER), []);
  const targetColor = CHARACTER_TINT_COLORS[characterId] ?? null;
  const srcRect = getFrameSourceRect('idle', 0);
  const scale = 0.65;

  return (
    <View style={[styles.avatar, { backgroundColor: 'rgba(255,255,255,0.2)', overflow: 'hidden' }]}>
      <Canvas style={{ width: 48, height: 48 }}>
        <Group 
          transform={[
            { translateX: 48 / 2 },
            { translateY: 48 / 2 + 10 },
            { scaleX: scale },
            { scaleY: scale },
            { translateX: -FRAME_W / 2 },
            { translateY: -FRAME_H / 2 },
          ]}
        >
          {tintShader && targetColor && (
            <RuntimeShader source={tintShader} uniforms={{ targetColor }} />
          )}
          <SkiaImage
            image={spriteSheet}
            x={-srcRect.sx}
            y={-srcRect.sy}
            width={SHEET_W}
            height={SHEET_H}
            fit="fill"
          />
        </Group>
      </Canvas>
    </View>
  );
}

export default function CharacterSelectScreen() {
  const selected = usePlayerStore((s) => s.selectedCharacterId);
  const unlocked = usePlayerStore((s) => s.unlockedCharacterIds);
  const setSelected = usePlayerStore((s) => s.setSelectedCharacter);
  
  const spriteSheet = useImage(require('../../assets/characters/player-spritesheet.png'));

  return (
    <View style={styles.background}>
      <ExpoImage
        source={require('../../assets/vecteezy_deep-forest-scene-with-trees-cartoon-background-vector_9577135.webp')}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        transition={0}
      />
      <View style={styles.overlay}>
        {/* Render the massive selected character behind the list */}
        <GiantCharacterAvatar characterId={selected} spriteSheet={spriteSheet} />

        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={28} color="#fff" />
          </Pressable>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>Pick Your Racer</Text>
            <Text style={styles.titleShadow}>Pick Your Racer</Text>
            <Text style={styles.subtitle}>Each hero has a unique power</Text>
          </View>
        </View>

        <FlatList
          data={CHARACTERS}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const isUnlocked = unlocked.includes(item.id);
            const isSelected = selected === item.id;
            return (
              <Pressable
                disabled={!isUnlocked}
                onPress={() => setSelected(item.id as CharacterId)}
                style={[
                  styles.card,
                  { borderColor: isSelected ? '#FFD700' : 'rgba(255,255,255,0.2)' },
                  isSelected && styles.selected,
                  !isUnlocked && styles.locked,
                ]}
              >
                <CharacterAvatar characterId={item.id} color={item.color} spriteSheet={spriteSheet} />
                <View style={styles.info}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={[styles.power, isSelected && { color: '#FFD700' }]}>{item.powerName}</Text>
                  <Text style={styles.desc} numberOfLines={2}>
                    {isUnlocked ? item.powerDescription : 'Locked — play more to unlock'}
                  </Text>
                </View>
                {isSelected && (
                  <View style={styles.selectedBadge}>
                    <MaterialCommunityIcons name="check-circle" size={24} color="#FFD700" />
                  </View>
                )}
              </Pressable>
            );
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, width: '100%', height: '100%' },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)', // Darker overlay so list is readable over giant character
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 24,
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
    fontSize: 28,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 1,
    zIndex: 2,
  },
  titleShadow: {
    fontSize: 28,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 1,
    position: 'absolute',
    top: 2,
    left: 2,
    zIndex: 1,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
    fontWeight: '600',
  },
  list: { paddingBottom: 40, paddingHorizontal: 20 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
  },
  selected: { 
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
  },
  locked: { opacity: 0.4 },
  avatar: { width: 48, height: 48, borderRadius: 24, marginRight: 14 },
  info: { flex: 1 },
  name: { fontSize: 18, fontWeight: '800', color: '#fff' },
  power: { fontSize: 13, color: '#aaa', marginTop: 2, fontWeight: '700' },
  desc: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4, fontWeight: '500' },
  selectedBadge: { marginLeft: 10 },
});
