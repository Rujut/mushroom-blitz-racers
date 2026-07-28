import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { GameColors } from '@/src/constants/theme';

type Variant = 'primary' | 'secondary' | 'ghost';

interface GameButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  style?: ViewStyle;
  icon?: ReactNode;
}

export function GameButton({
  label,
  onPress,
  variant = 'primary',
  disabled,
  style,
  icon,
}: GameButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <View style={styles.contentRow}>
        {icon && <View style={styles.iconContainer}>{icon}</View>}
        <Text style={[styles.label, variant === 'ghost' && styles.ghostLabel]}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 200,
  },
  primary: { backgroundColor: GameColors.primary },
  secondary: { backgroundColor: GameColors.secondary },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: GameColors.textLight,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.5 },
  label: {
    color: GameColors.textLight,
    fontSize: 16,
    fontWeight: '700',
  },
  ghostLabel: { color: GameColors.textLight },
  contentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  iconContainer: { marginRight: 8 },
});
