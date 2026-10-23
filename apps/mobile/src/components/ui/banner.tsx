import { StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '../../theme';
import { AppText } from './app-text';
import { Button } from './button';
import { Icon, type IconName } from './icon';

type Tone = 'info' | 'success' | 'warning' | 'danger';

const tones: Record<Tone, { bg: string; border: string; fg: string; icon: IconName }> = {
  info: { bg: colors.infoSoft, border: colors.infoBorder, fg: colors.info, icon: 'information-circle' },
  success: {
    bg: colors.successSoft,
    border: colors.successBorder,
    fg: colors.success,
    icon: 'checkmark-circle',
  },
  warning: {
    bg: colors.warningSoft,
    border: colors.warningBorder,
    fg: colors.warning,
    icon: 'alert-circle',
  },
  danger: { bg: colors.dangerSoft, border: colors.dangerBorder, fg: colors.danger, icon: 'close-circle' },
};

interface BannerProps {
  tone?: Tone;
  title?: string;
  message: string;
  icon?: IconName;
  actionLabel?: string;
  onAction?: () => void;
}

/** Aviso contextual en línea. Reemplaza cajas de error planas. */
export function Banner({ tone = 'info', title, message, icon, actionLabel, onAction }: BannerProps) {
  const theme = tones[tone];
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.container, { backgroundColor: theme.bg, borderColor: theme.border }]}
    >
      <Icon name={icon ?? theme.icon} size={19} color={theme.fg} />
      <View style={styles.body}>
        {title ? (
          <AppText variant="label" color={theme.fg}>
            {title}
          </AppText>
        ) : null}
        <AppText variant="caption" color={theme.fg} style={styles.message}>
          {message}
        </AppText>
        {actionLabel && onAction ? (
          <Button
            label={actionLabel}
            onPress={onAction}
            size="sm"
            variant="secondary"
            style={styles.action}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  body: { flex: 1, gap: 2 },
  message: { lineHeight: 18 },
  action: { marginTop: spacing.sm, alignSelf: 'flex-start' },
});
