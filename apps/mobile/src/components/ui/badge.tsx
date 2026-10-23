import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius } from '../../theme';
import { AppText } from './app-text';
import { Icon, type IconName } from './icon';

type Tone = 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'accent';

interface BadgeProps {
  label: string;
  tone?: Tone;
  icon?: IconName;
  dot?: boolean;
  style?: StyleProp<ViewStyle>;
}

const palette: Record<Tone, { background: string; text: string }> = {
  brand: { background: colors.brandTint, text: colors.brandDark },
  success: { background: colors.successSoft, text: colors.success },
  warning: { background: colors.warningSoft, text: colors.warning },
  danger: { background: colors.dangerSoft, text: colors.danger },
  info: { background: colors.infoSoft, text: colors.info },
  neutral: { background: colors.bgAlt, text: colors.muted },
  accent: { background: colors.accentSoft, text: colors.accentDark },
};

export function Badge({ label, tone = 'neutral', icon, dot, style }: BadgeProps) {
  const theme = palette[tone];
  return (
    <View style={[styles.badge, { backgroundColor: theme.background }, style]}>
      {dot ? <View style={[styles.dot, { backgroundColor: theme.text }]} /> : null}
      {icon ? <Icon name={icon} size={12} color={theme.text} /> : null}
      <AppText variant="micro" color={theme.text} numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  dot: { width: 6, height: 6, borderRadius: radius.pill },
});
