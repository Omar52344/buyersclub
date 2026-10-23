import { Pressable, StyleSheet, View } from 'react-native';
import { colors, radius, shadows, spacing, webCursor } from '../theme';
import { AppText } from './ui/app-text';
import { Icon, type IconName } from './ui/icon';

interface RoleCardProps {
  icon: IconName;
  title: string;
  description: string;
  cta: string;
  onPress: () => void;
  highlights?: string[];
  tone?: 'brand' | 'accent';
}

/** Tarjeta de elección de rol con CTA explícito y micro-beneficios. */
export function RoleCard({
  icon,
  title,
  description,
  cta,
  onPress,
  highlights = [],
  tone = 'brand',
}: RoleCardProps) {
  const accent = tone === 'accent';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${description}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        accent && styles.cardAccent,
        pressed && styles.cardPressed,
        webCursor,
      ]}
    >
      <View style={[styles.iconWrap, accent && styles.iconWrapAccent]}>
        <Icon name={icon} size={24} color={accent ? colors.accentDark : colors.brandDark} />
      </View>
      <View style={styles.body}>
        <AppText variant="h2">{title}</AppText>
        <AppText variant="body" color={colors.muted}>
          {description}
        </AppText>
        {highlights.length > 0 ? (
          <View style={styles.highlights}>
            {highlights.map((highlight) => (
              <View key={highlight} style={styles.highlightRow}>
                <Icon name="checkmark-circle" size={15} color={colors.brand} />
                <AppText variant="caption" color={colors.textSoft}>
                  {highlight}
                </AppText>
              </View>
            ))}
          </View>
        ) : null}
      </View>
      <View style={[styles.cta, accent && styles.ctaAccent]}>
        <AppText variant="label" color={accent ? colors.accentDark : colors.brandDark}>
          {cta}
        </AppText>
        <Icon name="arrow-forward" size={16} color={accent ? colors.accentDark : colors.brandDark} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 260,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card,
  },
  cardAccent: { borderColor: colors.warningBorder, backgroundColor: colors.accentTint },
  cardPressed: { opacity: 0.9, transform: [{ scale: 0.995 }] },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    backgroundColor: colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapAccent: { backgroundColor: colors.accentSoft },
  body: { gap: 6, flexGrow: 1 },
  highlights: { gap: 6, marginTop: 6 },
  highlightRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  cta: {
    marginTop: spacing.xs,
    backgroundColor: colors.brandTint,
    borderRadius: radius.pill,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 46,
  },
  ctaAccent: { backgroundColor: colors.accentSoft },
});
