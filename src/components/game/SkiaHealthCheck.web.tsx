/** Web only: load CanvasKit before rendering Skia canvas. */
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { WithSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
import { GameColors } from '@/src/constants/theme';

export function SkiaHealthCheck() {
  return (
    <WithSkiaWeb
      getComponent={() => import('./SkiaHealthCheckCanvas')}
      fallback={
        <View style={styles.fallback}>
          <ActivityIndicator color={GameColors.primary} />
          <Text style={styles.fallbackText}>Loading graphics engine…</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  fallback: {
    marginVertical: 16,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  fallbackText: { fontSize: 12, color: GameColors.textDark },
});
