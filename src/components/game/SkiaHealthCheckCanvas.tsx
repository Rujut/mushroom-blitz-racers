import { Canvas, Circle, LinearGradient, Rect, vec } from '@shopify/react-native-skia';
import { StyleSheet, Text, View } from 'react-native';
import { GameColors } from '@/src/constants/theme';

/** Actual Skia canvas — lazy-loaded on web via WithSkiaWeb. */
export default function SkiaHealthCheckCanvas() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Skia render test (Part 1)</Text>
      <Canvas style={styles.canvas}>
        <Rect x={0} y={0} width={280} height={80}>
          <LinearGradient
            start={vec(0, 0)}
            end={vec(280, 80)}
            colors={[GameColors.sky, GameColors.grass]}
          />
        </Rect>
        <Circle cx={40} cy={40} r={24} color={GameColors.mushroomRed} />
        <Circle cx={120} cy={40} r={20} color={GameColors.gold} />
        <Circle cx={200} cy={40} r={16} color={GameColors.pipeGreen} />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginVertical: 16 },
  label: {
    fontSize: 12,
    color: GameColors.textDark,
    marginBottom: 8,
    fontWeight: '600',
  },
  canvas: { width: 280, height: 80, borderRadius: 8, overflow: 'hidden' },
});
