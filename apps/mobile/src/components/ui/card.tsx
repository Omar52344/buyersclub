import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, shadows, webCursor } from '../../theme';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: 'elevated' | 'outline' | 'plain' | 'brand';
  padding?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

/** Superficie base. `onPress` la convierte en tarjeta interactiva. */
export function Card({
  children,
  onPress,
  variant = 'elevated',
  padding = 20,
  style,
  accessibilityLabel,
}: CardProps) {
  const base = [styles.card, variantStyles[variant], { padding }, style];

  if (!onPress) {
    return <View style={base}>{children}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [base, pressed && styles.pressed, webCursor]}
    >
      {children}
    </Pressable>
  );
}

const variantStyles = StyleSheet.create({
  elevated: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  outline: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  plain: { backgroundColor: colors.surfaceMuted },
  brand: {
    backgroundColor: colors.brand,
    ...shadows.brand,
  },
});

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, gap: 10 },
  pressed: { opacity: 0.9, transform: [{ scale: 0.995 }] },
});
