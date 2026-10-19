import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';

interface RoleCardProps {
  icon: string;
  title: string;
  description: string;
  cta: string;
  onPress: () => void;
  tone?: 'brand' | 'accent';
}

export function RoleCard({
  icon,
  title,
  description,
  cta,
  onPress,
  tone = 'brand',
}: RoleCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${description}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={[styles.iconWrap, tone === 'accent' && styles.iconWrapAccent]}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      <View style={[styles.cta, tone === 'accent' && styles.ctaAccent]}>
        <Text style={styles.ctaText}>{cta}</Text>
        <Text style={styles.ctaText}>→</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 240,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.995 }],
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  iconWrapAccent: {
    backgroundColor: '#FEF3C7',
  },
  icon: {
    fontSize: 22,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
    flexGrow: 1,
  },
  cta: {
    marginTop: spacing.md,
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ctaAccent: {
    backgroundColor: colors.brandDark,
  },
  ctaText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
});
