import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, hitSlop, radius, shadows, spacing, webCursor } from '../../theme';
import { AppText } from './app-text';
import { Icon, type IconName } from './icon';

type Variant = 'primary' | 'secondary' | 'soft' | 'ghost' | 'danger' | 'dangerSoft';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

const textColors: Record<Variant, string> = {
  primary: colors.onBrand,
  secondary: colors.text,
  soft: colors.brandDark,
  ghost: colors.brand,
  danger: colors.onBrand,
  dangerSoft: colors.danger,
};

const iconColors: Record<Variant, string> = {
  primary: colors.onBrand,
  secondary: colors.brand,
  soft: colors.brand,
  ghost: colors.brand,
  danger: colors.onBrand,
  dangerSoft: colors.danger,
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  loading = false,
  disabled = false,
  fullWidth = false,
  accessibilityLabel,
  style,
}: ButtonProps) {
  const inactive = disabled || loading;
  const iconSize = size === 'sm' ? 16 : 18;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        sizeStyles[size],
        fullWidth && styles.fullWidth,
        pressed && !inactive && styles.pressed,
        inactive && styles.disabled,
        style,
        webCursor,
      ]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="small" color={iconColors[variant]} />
        ) : icon ? (
          <Icon name={icon} size={iconSize} color={iconColors[variant]} />
        ) : null}
        <AppText
          variant={size === 'sm' ? 'label' : 'bodyStrong'}
          color={textColors[variant]}
          numberOfLines={1}
          style={size === 'lg' ? styles.lgLabel : undefined}
        >
          {label}
        </AppText>
        {!loading && iconRight ? (
          <Icon name={iconRight} size={iconSize} color={iconColors[variant]} />
        ) : null}
      </View>
    </Pressable>
  );
}

interface IconButtonProps {
  icon: IconName;
  onPress: () => void;
  label: string;
  size?: number;
  tone?: 'default' | 'brand' | 'danger';
  filled?: boolean;
  badge?: number;
  style?: StyleProp<ViewStyle>;
}

export function IconButton({
  icon,
  onPress,
  label,
  size = 20,
  tone = 'default',
  filled = false,
  badge,
  style,
}: IconButtonProps) {
  const tint = tone === 'brand' ? colors.brand : tone === 'danger' ? colors.danger : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={hitSlop}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        filled && styles.iconButtonFilled,
        pressed && styles.pressed,
        style,
        webCursor,
      ]}
    >
      <Icon name={icon} size={size} color={filled && tone === 'default' ? colors.brand : tint} />
      {badge && badge > 0 ? (
        <View style={styles.badge}>
          <AppText variant="micro" color={colors.onBrand} style={styles.badgeText}>
            {badge > 99 ? '99+' : badge}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

const variantStyles = StyleSheet.create({
  primary: { backgroundColor: colors.brand, ...shadows.brand },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong },
  soft: { backgroundColor: colors.brandTint, borderWidth: 1, borderColor: colors.brandSoft },
  ghost: { backgroundColor: 'transparent' },
  danger: { backgroundColor: colors.danger },
  dangerSoft: { backgroundColor: colors.dangerSoft },
});

const sizeStyles = StyleSheet.create({
  sm: { minHeight: 40, paddingVertical: spacing.sm, paddingHorizontal: 14 },
  md: { minHeight: 50, paddingVertical: 12, paddingHorizontal: spacing.lg },
  lg: { minHeight: 56, paddingVertical: 15, paddingHorizontal: spacing.lg },
});

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  fullWidth: { alignSelf: 'stretch' },
  pressed: { opacity: 0.86, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.5 },
  lgLabel: { fontSize: 16 },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconButtonFilled: { backgroundColor: colors.brandTint, borderColor: colors.brandSoft },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bg,
  },
  badgeText: { fontSize: 10, lineHeight: 12, color: colors.text },
});
