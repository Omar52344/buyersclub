import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, webCursor } from '../../theme';
import { AppText } from './app-text';
import { Icon, type IconName } from './icon';

interface SectionProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Section({ title, subtitle, actionLabel, onAction, children, style }: SectionProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <AppText variant="h2">{title}</AppText>
          {subtitle ? (
            <AppText variant="caption" color={colors.muted}>
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {actionLabel && onAction ? (
          <Pressable
            accessibilityRole="button"
            onPress={onAction}
            style={({ pressed }) => [styles.action, pressed && styles.pressed, webCursor]}
          >
            <AppText variant="label" color={colors.brand}>
              {actionLabel}
            </AppText>
            <Icon name="chevron-forward" size={14} color={colors.brand} />
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

interface ListRowProps {
  title: string;
  subtitle?: string;
  icon?: IconName;
  iconTone?: 'brand' | 'accent' | 'danger' | 'neutral';
  value?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  showChevron?: boolean;
  last?: boolean;
}

/** Fila de menú o ajustes con icono, descripción y chevron. */
export function ListRow({
  title,
  subtitle,
  icon,
  iconTone = 'brand',
  value,
  onPress,
  right,
  showChevron = true,
  last = false,
}: ListRowProps) {
  const iconBackground =
    iconTone === 'accent'
      ? colors.accentSoft
      : iconTone === 'danger'
        ? colors.dangerSoft
        : iconTone === 'neutral'
          ? colors.bgAlt
          : colors.brandTint;
  const iconColor =
    iconTone === 'accent'
      ? colors.accentDark
      : iconTone === 'danger'
        ? colors.danger
        : iconTone === 'neutral'
          ? colors.muted
          : colors.brand;

  const content = (
    <>
      {icon ? (
        <View style={[styles.iconWrap, { backgroundColor: iconBackground }]}>
          <Icon name={icon} size={19} color={iconColor} />
        </View>
      ) : null}
      <View style={styles.rowText}>
        <AppText variant="bodyStrong">{title}</AppText>
        {subtitle ? (
          <AppText variant="caption" color={colors.muted} numberOfLines={2}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {value ? (
        <AppText variant="caption" color={colors.muted} numberOfLines={1}>
          {value}
        </AppText>
      ) : null}
      {right}
      {onPress && showChevron ? (
        <Icon name="chevron-forward" size={17} color={colors.subtle} />
      ) : null}
    </>
  );

  if (!onPress) {
    return <View style={[styles.row, !last && styles.divider]}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, !last && styles.divider, pressed && styles.pressed, webCursor]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerText: { flex: 1, gap: 2 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 4 },
  pressed: { opacity: 0.65 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    minHeight: 56,
  },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowText: { flex: 1, gap: 1 },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
