import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, hitSlop, radius, spacing } from '../../theme';
import { AppText } from './app-text';
import { Icon } from './icon';

interface TopBarProps {
  title?: string;
  right?: React.ReactNode;
  onBack?: () => void;
  showBack?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Barra superior compacta para pantallas de flujo (detalle, checkout…). */
export function TopBar({ title, right, onBack, showBack = true, style }: TopBarProps) {
  const router = useRouter();

  return (
    <View style={[styles.bar, style]}>
      <View style={styles.side}>
        {showBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Volver"
            hitSlop={hitSlop}
            onPress={
              onBack ??
              (() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace('/home');
                }
              })
            }
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <Icon name="arrow-back" size={20} color={colors.text} />
          </Pressable>
        ) : null}
      </View>
      {title ? (
        <AppText variant="h3" numberOfLines={1} style={styles.title}>
          {title}
        </AppText>
      ) : (
        <View style={styles.flex} />
      )}
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  right?: React.ReactNode;
  showBack?: boolean;
  onBack?: () => void;
}

/** Encabezado de página con jerarquía clara y acción opcional. */
export function PageHeader({
  title,
  subtitle,
  eyebrow,
  right,
  showBack = false,
  onBack,
}: PageHeaderProps) {
  return (
    <View style={styles.pageHeader}>
      {showBack ? <TopBar showBack onBack={onBack} /> : null}
      <View style={styles.pageHeaderRow}>
        <View style={styles.flex}>
          {eyebrow ? (
            <AppText variant="micro" color={colors.brand} style={styles.eyebrow}>
              {eyebrow}
            </AppText>
          ) : null}
          <AppText variant="h1">{title}</AppText>
          {subtitle ? (
            <AppText variant="body" color={colors.muted} style={styles.subtitle}>
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {right ? <View>{right}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    minHeight: 44,
  },
  side: { minWidth: 44, flexDirection: 'row', alignItems: 'center' },
  right: { justifyContent: 'flex-end' },
  flex: { flex: 1 },
  title: { flex: 1, textAlign: 'center' },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  pageHeader: { gap: spacing.sm },
  pageHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  eyebrow: { textTransform: 'uppercase', marginBottom: 2 },
  subtitle: { marginTop: spacing.xs, maxWidth: 620 },
});
