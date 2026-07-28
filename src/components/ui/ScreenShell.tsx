import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GameColors } from '@/src/constants/theme';

interface ScreenShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  backgroundColor?: string;
}

export function ScreenShell({
  title,
  subtitle,
  children,
  backgroundColor = GameColors.sky,
}: ScreenShellProps) {
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor }]}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.body}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: GameColors.textDark,
  },
  subtitle: {
    fontSize: 14,
    color: GameColors.textDark,
    opacity: 0.75,
    marginTop: 4,
  },
  body: { flex: 1, paddingHorizontal: 20 },
});
